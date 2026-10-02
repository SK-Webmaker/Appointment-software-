// Discovery: build the candidate wallet universe from every source we can
// reach, merged by address into data/universe.json.
//
//   1. GMGN wallet leaderboards: every period x tag x sort order.
//   2. kolscan leaderboards (daily / weekly / monthly top 50).
//   3. Winners intersection: for meme tokens that actually ran, the top 100
//      wallets by profit on each. A wallet that keeps showing up profitable on
//      many different runners is skill, not one lucky ape, and is usually far
//      less crowded than a leaderboard name.
const fs = require('fs');
const path = require('path');
const { Gmgn } = require('./gmgn');
const { kolscanLeaderboard } = require('./kolscan');

const DATA = process.env.TRIPLE_T_DATA || path.join(__dirname, '..', 'data');
const UNIVERSE = path.join(DATA, 'universe.json');

const PERIODS = ['1d', '7d', '30d'];
const TAGS = [null, 'smart_degen', 'pump_smart', 'renowned', 'top_followed', 'fresh_wallet', 'sniper'];
const SORTS = (p) => [`pnl_${p}`, `realized_profit_${p}`, `winrate_${p}`];

// GMGN leaderboard fields worth keeping per wallet (the rest is UI fluff).
const GMGN_FIELDS = [
  'name', 'twitter_username', 'twitter_name', 'tags', 'follow_count', 'remark_count', 'sol_balance', 'last_active',
  ...PERIODS.flatMap((p) => [`pnl_${p}`, `realized_profit_${p}`, `winrate_${p}`, `buy_${p}`, `sell_${p}`, `txs_${p}`,
    `volume_${p}`, `avg_cost_${p}`, `avg_holding_period_${p}`, `net_inflow_${p}`]),
  'pnl_gt_5x_num_7d', 'pnl_2x_5x_num_7d', 'pnl_lt_2x_num_7d', 'pnl_minus_dot5_0x_num_7d', 'pnl_lt_minus_dot5_num_7d',
  'daily_profit_7d',
];

// Majors and stables we never want to treat as "meme runners".
const NOT_MEMES = new Set(['SOL', 'WSOL', 'USDC', 'USDT', 'ZEC', 'JUP', 'JTO', 'BONK', 'WIF', 'PYTH', 'RAY', 'ETH', 'BTC', 'WBTC', 'CBBTC', 'TRUMP']);

function loadUniverse() {
  try { return JSON.parse(fs.readFileSync(UNIVERSE, 'utf8')); } catch { return { updatedAt: null, wallets: {} }; }
}

function saveUniverse(u) {
  fs.mkdirSync(DATA, { recursive: true });
  u.updatedAt = new Date().toISOString();
  fs.writeFileSync(UNIVERSE, JSON.stringify(u, null, 1));
}

function walletEntry(u, address) {
  const now = new Date().toISOString();
  const w = (u.wallets[address] ||= { address, firstSeen: now, sources: {} });
  w.lastSeen = now;
  return w;
}

// Replace this run's hits for one source, keeping other sources untouched.
function resetSource(u, source) {
  for (const w of Object.values(u.wallets)) delete w.sources[source];
}

async function gmgnLeaderboards(g, u, log) {
  resetSource(u, 'gmgn_rank');
  let calls = 0, rows = 0;
  for (const period of PERIODS) {
    for (const tag of TAGS) {
      for (const orderby of SORTS(period)) {
        let list;
        try { list = await g.rankWallets({ period, tag, orderby }); } catch (e) { log(`  gmgn ${period}/${tag}/${orderby}: ${e.message}`); continue; }
        calls++; rows += list.length;
        list.forEach((r, i) => {
          const w = walletEntry(u, r.wallet_address || r.address);
          (w.sources.gmgn_rank ||= []).push({ period, tag: tag || 'all', orderby, rank: i + 1 });
          w.gmgn = Object.fromEntries(GMGN_FIELDS.filter((f) => r[f] !== undefined).map((f) => [f, r[f]]));
          w.gmgn.fetchedAt = new Date().toISOString();
        });
      }
    }
    log(`  gmgn leaderboards ${period}: done`);
  }
  return { calls, rows };
}

async function kolscan(u, log) {
  resetSource(u, 'kolscan');
  const rows = await kolscanLeaderboard();
  for (const r of rows) {
    const w = walletEntry(u, r.wallet_address);
    (w.sources.kolscan ||= []).push({ timeframe: r.timeframe, rank: r.rank, profitSol: r.profit, wins: r.wins, losses: r.losses });
    w.kolscan = { name: r.name, twitter: r.twitter, telegram: r.telegram };
  }
  log(`  kolscan: ${rows.length} rows`);
  return { rows: rows.length };
}

// Meme tokens that ran recently: launchpad tokens whose all-time-high market
// cap cleared `minAthMcap`, from GMGN's 1h / 6h / 24h swap rankings.
async function runnerTokens(g, { minAthMcap = 1_000_000, max = 60 } = {}) {
  const seen = new Map();
  for (const win of ['1h', '6h', '24h']) {
    let list = [];
    try { list = (await g.get(`/defi/quotation/v1/rank/sol/swaps/${win}?orderby=swaps&direction=desc&limit=100`)).rank || []; } catch { continue; }
    for (const t of list) {
      const ath = Number(t.history_highest_market_cap || t.market_cap || 0);
      const isLaunchpad = !!(t.launchpad || t.launchpad_platform) || /(pump|bonk)$/i.test(t.address || '');
      if (!t.address || NOT_MEMES.has(String(t.symbol).toUpperCase()) || !isLaunchpad || ath < minAthMcap) continue;
      if (!seen.has(t.address)) seen.set(t.address, { address: t.address, symbol: t.symbol, athMcap: ath, mcap: Number(t.market_cap || 0), openTs: t.open_timestamp || t.creation_timestamp || null, launchpad: t.launchpad_platform || t.launchpad || null });
    }
  }
  return [...seen.values()].sort((a, b) => b.athMcap - a.athMcap).slice(0, max);
}

// Snowball: runners taken from analyzed wallets' own big wins (>= minRoi on a
// real-size position) over the history window. Reaches tokens that ran days or
// weeks ago, which today's trending lists no longer show.
function snowballTokens({ minRoi = 2, minCostUsd = 100, max = 80 } = {}) {
  const dir = path.join(DATA, 'results');
  const seen = new Map();
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    let r;
    try { r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    for (const p of r.positions || []) {
      if (p.status !== 'closed' || p.roi < minRoi || p.costUsd < minCostUsd || NOT_MEMES.has(String(p.symbol).toUpperCase())) continue;
      const t = seen.get(p.token) || { address: p.token, symbol: p.symbol, athMcap: null, openTs: null, foundVia: [] };
      t.foundVia.push(r.address);
      seen.set(p.token, t);
    }
  }
  return [...seen.values()].sort((a, b) => b.foundVia.length - a.foundVia.length).slice(0, max);
}

async function winnersIntersection(g, u, log, opts = {}) {
  resetSource(u, 'winners');
  const trending = await runnerTokens(g, opts);
  const known = new Set(trending.map((t) => t.address));
  const snow = snowballTokens().filter((t) => !known.has(t.address));
  const tokens = [...trending, ...snow];
  log(`  winners: ${trending.length} trending runners + ${snow.length} snowball runners`);
  let hits = 0;
  for (const t of tokens) {
    let traders = [];
    try { traders = await g.get(`/vas/api/v1/token_traders/sol/${t.address}?limit=100&orderby=profit&direction=desc`); } catch (e) { log(`  token_traders ${t.symbol}: ${e.message}`); continue; }
    if (!Array.isArray(traders)) traders = traders.list || [];
    for (const r of traders) {
      const profit = Number(r.realized_profit || 0) + Number(r.unrealized_profit || 0);
      if (profit <= 0 || r.is_suspicious || r.exchange) continue;
      const w = walletEntry(u, r.address);
      (w.sources.winners ||= []).push({
        token: t.address, symbol: t.symbol, athMcap: t.athMcap,
        profitUsd: Math.round(profit), realizedUsd: Math.round(Number(r.realized_profit || 0)),
        costUsd: Math.round(Number(r.history_bought_cost || r.total_cost || 0)),
        entryTs: r.start_holding_at || null, exitTs: r.end_holding_at || null, tokenOpenTs: t.openTs,
        entryDelaySec: r.start_holding_at && t.openTs ? r.start_holding_at - t.openTs : null,
        buys: r.buy_tx_count_cur, sells: r.sell_tx_count_cur,
        // Tokens that arrived by transfer rather than a buy: dev / insider bundles.
        transferIn: !!r.transfer_in || Number(r.transfer_in_count || 0) > 0,
        tags: r.tags || [], makerTags: r.maker_token_tags || [],
      });
      // Funding wallet and wallet age, for spotting linked wallet clusters later.
      if (r.native_transfer && r.native_transfer.from_address) w.fundedBy = r.native_transfer.from_address;
      if (r.created_at) w.createdAt = r.created_at;
      hits++;
    }
  }
  return { tokens: tokens.length, hits };
}

function summarize(u) {
  const ws = Object.values(u.wallets);
  const by = (s) => ws.filter((w) => w.sources[s]).length;
  const tagCount = {};
  for (const w of ws) for (const t of (w.gmgn && w.gmgn.tags) || []) tagCount[t] = (tagCount[t] || 0) + 1;
  const multiWinners = ws.filter((w) => (w.sources.winners || []).length >= 3).length;
  return {
    total: ws.length,
    bySource: { gmgn_rank: by('gmgn_rank'), kolscan: by('kolscan'), winners: by('winners'), fomo: by('fomo') },
    inTwoPlusSources: ws.filter((w) => Object.keys(w.sources).length >= 2).length,
    profitableOn3PlusRunners: multiWinners,
    platformTags: Object.fromEntries(Object.entries(tagCount).sort((a, b) => b[1] - a[1])),
  };
}

async function discover({ log = console.error, skip = [] } = {}) {
  const u = loadUniverse();
  const report = {};
  if (!skip.includes('kolscan')) {
    try { report.kolscan = await kolscan(u, log); } catch (e) { log(`  kolscan failed: ${e.message}`); }
  }
  if (!skip.includes('gmgn')) {
    const g = await new Gmgn().open();
    try {
      report.gmgn = await gmgnLeaderboards(g, u, log);
      if (!skip.includes('winners')) report.winners = await winnersIntersection(g, u, log);
    } finally {
      report.gmgnCalls = g.calls;
      await g.close();
    }
  }
  saveUniverse(u);
  return { report, summary: summarize(u) };
}

module.exports = { discover, loadUniverse, saveUniverse, walletEntry, resetSource, summarize, runnerTokens, UNIVERSE, DATA };
