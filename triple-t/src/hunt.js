// Hunt: one full Triple T run against criteria.json.
//   pool    -> profile checks on every candidate (followers, tags, activity)
//   stage 1 -> 28 days of trades rebuilt into positions; the wallet rules
//   stage 2 -> copy backtest with the bot's real fees and guards; copy rules
//   picks   -> best N by copy results, at most M well-known wallets
//   proof   -> the same rules run on the older 14 days only; those picks'
//              copy results over the newer 14 days, next to simple baselines
const fs = require('fs');
const path = require('path');
const { Gmgn } = require('./gmgn');
const { loadUniverse, saveUniverse, DATA } = require('./discover');
const { walletTrades, latestPrice } = require('./history');
const { buildPositions, walletStats, slicePositions, median } = require('./positions');
const { backtestPositions, summarizeTrades } = require('./backtest');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(DATA, 'hunt');

const loadCriteria = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'criteria.json'), 'utf8'));
const ge = (x, t) => x != null && isFinite(x) ? x >= t : x === Infinity;
const le = (x, t) => x != null && isFinite(x) && x <= t;
const key = (token, ts) => `${token}:${ts}`;

async function pmap(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; await fn(item); }
  }));
}

const isFomo = (w) => !!(w.sources.copyfomo || w.sources.fomo
  || (w.gmgn && (w.gmgn.tags || []).includes('fomo')) || (w.profile && (w.profile.tags || []).includes('fomo')));

// One shape for a wallet's GMGN profile, from a leaderboard row or a profile call.
function profileOf(w) {
  const g = w.gmgn;
  if (g && g.realized_profit_30d !== undefined) {
    return {
      followers: Number(g.follow_count || 0), tags: g.tags || [], lastActive: Number(g.last_active || 0),
      buys30d: Number(g.buy_30d || 0), txs30d: Number(g.txs_30d || 0), realized30d: Number(g.realized_profit_30d || 0),
      name: g.twitter_username || g.name || null,
    };
  }
  return w.profile || null;
}

async function fetchProfile(g, address) {
  const d = await g.get(`/defi/quotation/v1/smartmoney/sol/walletNew/${address}?period=30d`);
  return {
    followers: Number(d.followers_count || 0), tags: d.tags || [], lastActive: Number(d.last_active_timestamp || 0),
    buys30d: Number(d.buy_30d || 0), txs30d: Number(d.buy_30d || 0) + Number(d.sell_30d || 0),
    realized30d: Number(d.realized_profit_30d || 0), name: d.twitter_username || d.name || null,
    fetchedAt: new Date().toISOString(),
  };
}

function poolFails(p, c, now) {
  const f = [];
  if (p.tags.some((t) => c.excludeTags.includes(t))) f.push('bot or wash-trading tag');
  if (now - p.lastActive > c.maxHoursSinceActive * 3600) f.push('not active lately');
  if (p.buys30d < c.minBuys30d) f.push('too few buys');
  if (p.txs30d > c.maxTxs30d) f.push('trades like a bot');
  if (!(p.realized30d > c.minRealizedProfit30dUsd)) f.push('not profitable over 30d');
  if (p.followers > c.maxGmgnFollowers) f.push('heavily followed');
  return f;
}

// Stage 1: copyable style and a real, repeatable edge, from their own trades.
function walletFails(s, c) {
  const f = [];
  const chk = (ok, name, value, need) => { if (!ok) f.push({ name, value, need }); };
  chk(ge(s.closed, c.minClosed), 'closed trades', s.closed, `>= ${c.minClosed}`);
  chk(ge(s.medianHoldSec, c.minMedianHoldSec), 'median hold', s.medianHoldSec, `>= ${c.minMedianHoldSec}s`);
  if (c.maxMedianHoldSec) chk(le(s.medianHoldSec, c.maxMedianHoldSec), 'holds too long', s.medianHoldSec, `<= ${c.maxMedianHoldSec}s`);
  if (c.minWinRate != null) chk(ge(s.winRate, c.minWinRate), 'win rate', s.winRate, `>= ${c.minWinRate}`);
  chk(le(s.shareHeldUnder60s, c.maxShareHeldUnder60s), 'flips under 60s', s.shareHeldUnder60s, `<= ${c.maxShareHeldUnder60s}`);
  chk(ge(s.medianEntryMcapUsd, c.minMedianEntryMcapUsd), 'entry market cap', s.medianEntryMcapUsd, `>= $${c.minMedianEntryMcapUsd}`);
  if (c.maxMedianEntryMcapUsd) chk(le(s.medianEntryMcapUsd, c.maxMedianEntryMcapUsd), 'buys big caps', s.medianEntryMcapUsd, `<= $${c.maxMedianEntryMcapUsd}`);
  chk(le(s.positionsPerDay, c.maxPositionsPerDay), 'coins per day', s.positionsPerDay, `<= ${c.maxPositionsPerDay}`);
  chk(ge(s.medianFirstBuyUsd, c.firstBuyUsd[0]) && le(s.medianFirstBuyUsd, c.firstBuyUsd[1]), 'buy size', s.medianFirstBuyUsd, `$${c.firstBuyUsd[0]}-${c.firstBuyUsd[1]}`);
  chk(ge(s.profitFactor, c.minProfitFactor), 'profit factor', s.profitFactor, `>= ${c.minProfitFactor}`);
  if (c.mustProfitWithoutBestTrade) chk(s.pnlWithoutBestTradeUsd > 0, 'profit without best trade', s.pnlWithoutBestTradeUsd, '> 0');
  if (c.maxBestTradeShareOfProfit != null) chk(s.totalRealizedPnlUsd > 0 && le(s.bestTradeShareOfProfit, c.maxBestTradeShareOfProfit), 'one trade is the profit', s.bestTradeShareOfProfit, `<= ${c.maxBestTradeShareOfProfit}`);
  chk(ge(s.greenDayShare, c.minGreenDayShare), 'green days', s.greenDayShare, `>= ${c.minGreenDayShare}`);
  chk(ge(s.tradingDays, c.minTradingDays), 'trading days', s.tradingDays, `>= ${c.minTradingDays}`);
  chk(ge(s.launchpadShare, c.minLaunchpadShare), 'meme coin share', s.launchpadShare, `>= ${c.minLaunchpadShare}`);
  return f;
}

// Copy results over the backtest trades that pass `keep`.
function windowSummary(bt, keep) {
  const pick = (d) => (bt.tradesByDelay[d] || []).filter((t) => keep(t));
  const d1 = pick('1s'), d3 = pick('3s');
  const taken1 = d1.filter((t) => !t.skipped), taken3 = d3.filter((t) => !t.skipped);
  return {
    at1s: summarizeTrades(taken1), at3s: summarizeTrades(taken3),
    skipped1s: d1.length - taken1.length,
    followerJump3s: median(d3.map((t) => t.entryPremium).filter((x) => isFinite(x))),
    own: summarizeTrades((bt.ownTrades || []).filter((t) => keep(t))),
  };
}

function copyFails(sum, c) {
  const f = [];
  const chk = (ok, name, value, need) => { if (!ok) f.push({ name, value, need }); };
  chk(ge(sum.at1s.roi, c.minRoiAt1s), 'copy ROI at 1s', sum.at1s.roi, `>= ${c.minRoiAt1s}`);
  chk(ge(sum.at3s.roi, c.minRoiAt3s), 'copy ROI at 3s', sum.at3s.roi, `>= ${c.minRoiAt3s}`);
  chk(ge(sum.at1s.trades, c.minCopies), 'copies', sum.at1s.trades, `>= ${c.minCopies}`);
  chk(le(sum.followerJump3s, c.maxMedianFollowerJump3s), 'price jump after their buy', sum.followerJump3s, `<= ${c.maxMedianFollowerJump3s}`);
  return f;
}

// Ranking. 'persistence' uses the traits that predicted a wallet still
// winning the following week; 'copyRoi' ranks by past copy profit.
const score = (sum, stats, how = 'persistence') => (how === 'persistence'
  ? (stats.winRate || 0) * (stats.greenDayShare || 0) * Math.min(1, (stats.closed || 0) / 40)
  : (sum.at1s.roi > 0 ? sum.at1s.roi * Math.min(1, sum.at1s.trades / 40) * (0.5 + (stats.greenDayShare || 0) / 2) : (sum.at1s.roi == null ? -9 : sum.at1s.roi)));

function wellKnown(w, c) {
  const p = profileOf(w) || {};
  return (p.followers || 0) >= c.wellKnownFollowers
    || (p.tags || []).some((t) => c.wellKnownTags.includes(t))
    || ((w.fomo && w.fomo.fomoFollowers) || 0) >= (c.wellKnownFomoFollowers || 10000);
}

// Best first, skipping well-known wallets past the cap.
function choose(cands, c) {
  const out = [];
  let known = 0;
  for (const x of [...cands].sort((a, b) => b.score - a.score)) {
    if (out.length >= c.count) break;
    if (x.wellKnown && known >= c.maxWellKnown) continue;
    if (x.wellKnown) known++;
    out.push(x);
  }
  return out;
}

function groupResult(name, recs) {
  const t1 = recs.flatMap((r) => (r.bt.tradesByDelay['1s'] || []).filter((t) => !t.skipped && t.startTs >= r.split));
  const t3 = recs.flatMap((r) => (r.bt.tradesByDelay['3s'] || []).filter((t) => !t.skipped && t.startTs >= r.split));
  const per = recs.map((r) => r.sumNew.at1s.roi).filter((x) => x != null);
  return {
    group: name, wallets: recs.length,
    at1s: summarizeTrades(t1), at3s: summarizeTrades(t3),
    walletsProfitable: per.filter((x) => x > 0).length, walletsWithCopies: per.length,
    medianWalletRoi: median(per),
  };
}

async function hunt({ log = console.error, concurrency = 5, stage2Limit = 70, seed = 7 } = {}) {
  const c = loadCriteria();
  const u = loadUniverse();
  const now = Math.floor(Date.now() / 1000);
  const start = now - c.history.days * 86400;
  const split = now - c.history.splitDays * 86400;
  const g = await new Gmgn({ tabs: concurrency, minGapMs: 130 }).open();
  const funnel = { candidates: 0, pool: 0, poolRejects: {}, stage1: 0, stage1Rejects: {}, stage1Pass: 0, stage1PassOld: 0, backtested: 0, picks: 0 };
  const recs = new Map();
  let naive = [], random = [];
  try {
    // Pool: everyone we have heard of, then the cheap profile checks.
    const cands = Object.values(u.wallets).filter((w) => w.gmgn || w.sources.kolscan || w.sources.copyfomo || isFomo(w)
      || (w.sources.winners || []).length >= c.pool.minRunnerHits);
    funnel.candidates = cands.length;
    const stale = (w) => !w.gmgn && (!w.profile || Date.now() - Date.parse(w.profile.fetchedAt) > 24 * 3600e3);
    const need = cands.filter((w) => !profileOf(w) || stale(w));
    log(`pool: ${cands.length} candidates, fetching ${need.length} profiles`);
    await pmap(need, concurrency, async (w) => { try { w.profile = await fetchProfile(g, w.address); } catch { /* left without a profile */ } });
    saveUniverse(u);
    const pool = [];
    for (const w of cands) {
      const p = profileOf(w);
      const f = p ? poolFails(p, c.pool, now) : ['no profile'];
      if (f.length) funnel.poolRejects[f[0]] = (funnel.poolRejects[f[0]] || 0) + 1;
      else pool.push(w);
    }
    funnel.pool = pool.length;
    log(`pool: ${pool.length} pass the profile checks; pulling ${c.history.days} days of trades`);

    // Stage 1: their own trades.
    let done = 0;
    await pmap(pool, concurrency, async (w) => {
      let trades;
      try { trades = await walletTrades(g, w.address, { days: c.history.days, maxPages: c.history.maxPages }); } catch (e) { log(`  ${w.address.slice(0, 8)} history error: ${e.message}`); return; }
      if (++done % 25 === 0) log(`  history ${done}/${pool.length}`);
      if (trades.truncated) { funnel.stage1Rejects['trades like a bot'] = (funnel.stage1Rejects['trades like a bot'] || 0) + 1; return; }
      const { positions } = buildPositions(trades);
      const full = walletStats(positions, { nowTs: now });
      const old = walletStats(slicePositions(positions, start, split, { asOf: split }), { nowTs: split });
      // The latest 14 days, judged exactly like the older 14 in the forward
      // test: this is the window the final picks are chosen on.
      const recent = walletStats(slicePositions(positions, split, now, { asOf: now }), { nowTs: now });
      const rec = { address: w.address, w, positions, full, old, recent, split, failsFull: walletFails(full, c.wallet), failsOld: walletFails(old, c.wallet), failsRecent: walletFails(recent, c.wallet) };
      recs.set(w.address, rec);
      const first = rec.failsRecent[0];
      if (first) funnel.stage1Rejects[first.name] = (funnel.stage1Rejects[first.name] || 0) + 1;
    });
    const all = [...recs.values()];
    funnel.stage1 = all.length;
    const s1Recent = all.filter((r) => !r.failsRecent.length);
    const s1Old = all.filter((r) => !r.failsOld.length);
    funnel.stage1Pass = s1Recent.length;
    funnel.stage1PassOld = s1Old.length;
    log(`stage 1: ${all.length} with history, ${s1Recent.length} pass on the latest 14 days, ${s1Old.length} pass on the older 14 days`);

    // Who gets a backtest: the stage-1 survivors (best first by a cheap
    // pre-score if there are too many), last fortnight's biggest earners
    // (the naive way to pick), and a random sample of the pool.
    const pre = (r, s) => (s.winRate || 0) * (s.greenDayShare || 0) * Math.min(1, (s.closed || 0) / 40);
    naive = [...all].sort((a, b) => (b.old.totalRealizedPnlUsd || 0) - (a.old.totalRealizedPnlUsd || 0)).slice(0, c.picks.count);
    let rnd = seed;
    random = [...all].map((r) => ({ r, k: (rnd = (rnd * 16807) % 2147483647) })).sort((a, b) => a.k - b.k).slice(0, 15).map((x) => x.r);
    const toTest = new Map();
    for (const r of [...s1Recent].sort((a, b) => pre(b, b.recent) - pre(a, a.recent)).slice(0, stage2Limit)) toTest.set(r.address, r);
    for (const r of [...s1Old].sort((a, b) => pre(b, b.old) - pre(a, a.old)).slice(0, stage2Limit)) toTest.set(r.address, r);
    for (const r of [...naive, ...random]) toTest.set(r.address, r);
    log(`stage 2: backtesting ${toTest.size} wallets`);

    done = 0;
    await pmap([...toTest.values()], concurrency, async (r) => {
      const marks = {};
      for (const p of r.positions) if (p.status !== 'closed' && !(p.token in marks)) marks[p.token] = await latestPrice(g, p.token);
      r.bot = isFomo(r.w) ? 'copyfomo' : 'gmgn';
      const { _about, ...profile } = c.bots[r.bot];
      r.bt = await backtestPositions(g, r.positions, { ...c.backtest, ...profile, marks, keepTrades: true });
      const oldKeys = new Set(r.positions.filter((p) => p.openTs >= start && p.openTs < split && p.closeTs && p.closeTs < split).map((p) => key(p.token, p.openTs)));
      r.sumFull = windowSummary(r.bt, () => true);
      r.sumOld = windowSummary(r.bt, (t) => oldKeys.has(key(t.token, t.startTs)));
      r.sumNew = windowSummary(r.bt, (t) => t.startTs >= split);
      const recentKeys = new Set(r.positions.filter((p) => p.openTs >= split && p.closeTs).map((p) => key(p.token, p.openTs)));
      r.sumRecent = windowSummary(r.bt, (t) => recentKeys.has(key(t.token, t.startTs)));
      r.copyFailsFull = copyFails(r.sumFull, c.copy);
      r.copyFailsRecent = copyFails(r.sumRecent, c.copy);
      r.copyFailsOld = copyFails(r.sumOld, c.copy);
      r.wellKnown = wellKnown(r.w, c.picks);
      if (++done % 10 === 0) log(`  backtested ${done}/${toTest.size}`);
    });
    funnel.backtested = toTest.size;
  } finally {
    await g.close();
  }

  const tested = [...recs.values()].filter((r) => r.bt);
  // Final picks: the forward-tested procedure on the latest 14 days.
  const passFull = tested.filter((r) => !r.failsRecent.length && !r.copyFailsRecent.length)
    .map((r) => ({ r, score: score(r.sumRecent, r.recent, c.picks.rankBy), wellKnown: r.wellKnown }));
  const passOld = tested.filter((r) => !r.failsOld.length && !r.copyFailsOld.length)
    .map((r) => ({ r, score: score(r.sumOld, r.old, c.picks.rankBy), wellKnown: r.wellKnown }));
  const picks = choose(passFull, c.picks).map((x) => x.r);
  // copyfomo can only copy fomo traders: the best one that passes every rule
  // and is not already a pick goes there.
  const fomoPick = passFull.filter((x) => x.r.bot === 'copyfomo' && !picks.includes(x.r)).sort((a, b) => b.score - a.score).map((x) => x.r)[0] || null;
  const picksOld = choose(passOld, c.picks).map((x) => x.r);
  funnel.picks = picks.length;
  const proof = [
    groupResult('Triple T rules, picked on the older 14 days', picksOld),
    groupResult('Biggest earners of the older 14 days (naive)', naive.filter((r) => r.bt)),
    groupResult('Random wallets from the pool', random.filter((r) => r.bt)),
  ];

  const slim = (r) => ({
    address: r.address, name: (profileOf(r.w) || {}).name || (r.w.fomo && r.w.fomo.handle) || (r.w.kolscan && r.w.kolscan.name) || null,
    fomo: isFomo(r.w), fomoHandle: (r.w.fomo && r.w.fomo.handle) || null, bot: r.bot, wellKnown: r.wellKnown,
    followers: (profileOf(r.w) || {}).followers, fomoFollowers: (r.w.fomo && r.w.fomo.fomoFollowers) || null,
    tags: (profileOf(r.w) || {}).tags || [], sources: Object.keys(r.w.sources),
    full: r.full, recent: r.recent, failsFull: r.failsFull, failsRecent: r.failsRecent,
    copyFailsFull: r.copyFailsFull || null, copyFailsRecent: r.copyFailsRecent || null,
    sumFull: r.sumFull || null, sumRecent: r.sumRecent || null, sumNew: r.sumNew || null, sumOld: r.sumOld || null,
  });
  const result = {
    generatedAt: new Date().toISOString(), window: { start, split, end: now }, criteria: c, funnel, proof,
    picks: picks.map(slim), fomoPick: fomoPick && slim(fomoPick), picksOld: picksOld.map((r) => ({ ...slim(r), sumNew: r.sumNew })),
    passedFull: passFull.length, passedOld: passOld.length,
    nearMisses: tested.filter((r) => !r.failsRecent.length && r.copyFailsRecent.length).map(slim).slice(0, 30),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1));
  for (const r of tested) fs.writeFileSync(path.join(OUT, `${r.address}.json`), JSON.stringify({ ...slim(r), positions: r.positions, copyTrades1s: r.bt.tradesByDelay['1s'] }, null, 1));
  writePicks(result);
  return result;
}

// --- PICKS.md -----------------------------------------------------------------
const pct = (x) => (x == null || !isFinite(x) ? '-' : `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`);
const usd = (x) => (x == null || !isFinite(x) ? '-' : `${x < 0 ? '-' : ''}$${Math.abs(Math.round(x)).toLocaleString('en-US')}`);
const kusd = (x) => (x == null || !isFinite(x) ? '-' : x >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : `$${Math.round(x / 1000)}K`);
const dur = (s) => (s == null ? '-' : s < 120 ? `${Math.round(s)}s` : s < 7200 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`);

// Plain-language warnings for a pick.
function flags(p, res) {
  const out = [];
  const firstDay = p.full.lastTradeTs && p.full.spanDays ? res.window.end - p.full.spanDays * 86400 : null;
  if (firstDay && firstDay > res.window.start + 7 * 86400) out.push(`new wallet (${Math.round(p.full.spanDays)} days of history)`);
  if (p.sumFull.at1s.roi < 0.05) out.push('thin copy margin');
  if (p.sumFull.followerJump3s >= 0.1) out.push('some crowding after their buys');
  if (p.sumNew && p.sumNew.at1s.trades < 10) out.push('quiet in the last 2 weeks');
  if (p.wellKnown) out.push('well-known');
  return out.join('; ') || '-';
}

function writePicks(res) {
  const f = res.funnel;
  const L = [
    '# Triple T picks',
    '',
    `Run ${res.generatedAt.slice(0, 16).replace('T', ' ')} UTC over the last ${res.criteria.history.days} days. Criteria: ${res.criteria._status.split(':')[0]}.`,
    '',
    `Funnel: ${f.candidates} wallets seen -> ${f.pool} pass the profile checks -> ${f.stage1} with trade history -> ${f.stage1Pass} pass the wallet rules -> ${res.passedFull} pass the copy test -> ${res.picks.length} picks.`,
    '',
    '## Proof: does picking this way work going forward?',
    '',
    'Rules applied to the older 14 days only; then each group copied (bot fees and guards, 1s behind) over the newer 14 days.',
    '',
    '| Group | Wallets | Copies | Copy profit | Copy ROI 1s | Copy ROI 3s | Wallets in profit |',
    '|---|---|---|---|---|---|---|',
    ...res.proof.map((p) => `| ${p.group} | ${p.wallets} | ${p.at1s.trades} | ${usd(p.at1s.pnlUsd)} | ${pct(p.at1s.roi)} | ${pct(p.at3s.roi)} | ${p.walletsProfitable}/${p.walletsWithCopies} |`),
    '',
    '## The picks',
    '',
    'Chosen exactly like the forward test: the rules applied to the latest 14 days. Win rate through entry size are from those 14 days; copy ROI is shown over all 28 days and over the latest 14.',
    '',
    '| # | Wallet | Bot | Copies (28d) | Copy ROI 1s | Copy ROI 3s | Copy ROI last 14d | Win rate | Green days | Profit factor | Median hold | Entry mcap | Their buy | Followers | Jump after buy | Watch out |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...[...res.picks, ...(res.fomoPick ? [res.fomoPick] : [])].map((p, i) => `| ${i < res.picks.length ? i + 1 : 'copyfomo'} | \`${p.address}\`${p.fomoHandle ? ` @${p.fomoHandle}` : p.name ? ` (${p.name})` : ''} | ${p.bot} | ${p.sumFull.at1s.trades} | ${pct(p.sumFull.at1s.roi)} | ${pct(p.sumFull.at3s.roi)} | ${pct(p.sumRecent && p.sumRecent.at1s.roi)} | ${pct(p.recent.winRate)} | ${pct(p.recent.greenDayShare)} | ${p.recent.profitFactor === Infinity ? 'inf' : (p.recent.profitFactor || 0).toFixed(1)} | ${dur(p.recent.medianHoldSec)} | ${kusd(p.recent.medianEntryMcapUsd)} | ${usd(p.recent.medianFirstBuyUsd)} | ${p.followers ?? '-'}${p.fomoFollowers ? ` / fomo ${p.fomoFollowers}` : ''} | ${pct(p.sumFull.followerJump3s)} | ${flags(p, res)} |`),
    '',
    `Copy ROI = profit on what the bot would have spent, after fees, copying every buy and sell 1s / 3s after them. copyfomo picks: $${res.criteria.bots.copyfomo.sizeUsd} per copy, max chase ${res.criteria.bots.copyfomo.maxChase * 100}%, min trader buy $${res.criteria.bots.copyfomo.minTraderBuyUsd}. GMGN picks: $${res.criteria.bots.gmgn.sizeUsd} per copy, min copy amount $${res.criteria.bots.gmgn.minTraderBuyUsd}.`,
  ];
  if (res.picks.length < res.criteria.picks.count) {
    L.push('', `Only ${res.picks.length} wallets passed every rule. Closest misses (passed the wallet rules, failed the copy test):`, '');
    for (const p of res.nearMisses.slice(0, 8)) L.push(`- \`${p.address}\` ${p.name || ''} (${p.bot}): copy ROI 1s ${pct(p.sumFull.at1s.roi)}, 3s ${pct(p.sumFull.at3s.roi)}, ${p.sumFull.at1s.trades} copies; failed ${p.copyFailsFull.map((x) => x.name).join(', ')}`);
  }
  fs.writeFileSync(path.join(ROOT, 'PICKS.md'), L.join('\n') + '\n');
}

// Re-render PICKS.md from the last hunt without re-running it. Older results
// did not store the copyfomo pick; it is recovered from the per-wallet files.
function report() {
  const res = JSON.parse(fs.readFileSync(path.join(OUT, 'result.json'), 'utf8'));
  if (res.fomoPick === undefined) {
    const inPicks = new Set(res.picks.map((p) => p.address));
    const cands = fs.readdirSync(OUT).filter((f) => f !== 'result.json').map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')))
      .filter((r) => r.bot === 'copyfomo' && !inPicks.has(r.address) && r.failsRecent && !r.failsRecent.length && r.copyFailsRecent && !r.copyFailsRecent.length)
      .sort((a, b) => score(b.sumRecent, b.recent, res.criteria.picks.rankBy) - score(a.sumRecent, a.recent, res.criteria.picks.rankBy));
    res.fomoPick = cands[0] ? (({ positions, copyTrades1s, ...rest }) => rest)(cands[0]) : null;
    fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(res, null, 1));
  }
  writePicks(res);
  return res;
}

module.exports = { hunt, report, walletFails, copyFails, poolFails, choose, windowSummary, loadCriteria };
