// Analysis: prescreen the universe, pull each shortlisted wallet's history,
// rebuild its positions, run the copy backtest and apply the final gates.
// Writes data/results/<wallet>.json, data/report.json and REPORT.md.
const fs = require('fs');
const path = require('path');
const { Gmgn } = require('./gmgn');
const { loadUniverse, DATA } = require('./discover');
const { walletTrades, latestPrice } = require('./history');
const { buildPositions, walletStats, median } = require('./positions');
const { backtestPositions } = require('./backtest');

const ROOT = path.join(__dirname, '..');
const RESULTS = path.join(DATA, 'results');

function loadCriteria(file = path.join(ROOT, 'criteria.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Cheap first cut on leaderboard stats. Returns [{ address, via, score }].
function prescreen(u, c) {
  const p = c.prescreen, now = Date.now() / 1000;
  const fromStats = [], fromWinners = [];
  for (const w of Object.values(u.wallets)) {
    const s = w.gmgn;
    if (s && s.realized_profit_30d !== undefined) {
      const tags = s.tags || [];
      const avgCost = Number(s.avg_cost_30d);
      const ok = !tags.some((t) => p.excludeTags.includes(t))
        && now - Number(s.last_active || 0) <= p.maxHoursSinceActive * 3600
        && Number(s.buy_30d) >= p.minBuys30d
        && Number(s.txs_30d) <= p.maxTxs30d
        && Number(s.avg_holding_period_30d) >= p.minAvgHoldSec30d
        && Number(s.realized_profit_30d) >= p.minRealizedProfit30dUsd
        && Number(s.winrate_30d) >= p.minWinrate30d
        && avgCost >= p.avgCostUsd30d[0] && avgCost <= p.avgCostUsd30d[1];
      if (ok) fromStats.push({ address: w.address, via: 'stats', score: Number(s.winrate_30d) * Math.log10(Number(s.realized_profit_30d)) });
    } else if ((w.sources.winners || []).length >= p.winnersOnly.minRunnerHits) {
      const hits = w.sources.winners;
      const medCost = median(hits.map((h) => h.costUsd));
      // GMGN tags half of all profitable runner trades "bundler" (bots send
      // Jito bundles), so only hard insider tags exclude, and only when they
      // are on most of the wallet's hits. Bundler / transfer-in stay as signals.
      const insiderHits = hits.filter((h) => (h.makerTags || []).some((t) => /dev_team|creator|rat_trader/.test(t))).length;
      const flagged = insiderHits / hits.length >= 0.5;
      if (medCost <= p.winnersOnly.maxMedianCostUsd && !flagged) fromWinners.push({ address: w.address, via: 'winners', score: hits.length });
    }
  }
  fromStats.sort((a, b) => b.score - a.score);
  fromWinners.sort((a, b) => b.score - a.score);
  // Keep a third of the slots for less-known repeat winners.
  const nWin = Math.min(fromWinners.length, Math.floor(p.maxDeepDives / 3));
  const pick = [...fromStats.slice(0, p.maxDeepDives - nWin), ...fromWinners.slice(0, nWin)];
  return { pick, eligible: { stats: fromStats.length, winners: fromWinners.length } };
}

// The backtest view the gates use: fixed or proportional sizing, or whichever
// did better for this wallet ("best": the copy bot can be set either way).
function view(bt, f) {
  const fixed = { mode: 'fixed', fills: bt.walletFills.fixed || bt.walletFills, byDelay: bt.byDelay };
  const prop = bt.byDelayProportional && bt.walletFills.proportional
    ? { mode: 'proportional', fills: bt.walletFills.proportional, byDelay: bt.byDelayProportional } : null;
  if (f.sizing === 'proportional' && prop) return prop;
  if (f.sizing === 'best' && prop) {
    const rf = (fixed.byDelay[f.delayForGates] || {}).roi ?? -Infinity;
    const rp = (prop.byDelay[f.delayForGates] || {}).roi ?? -Infinity;
    return rp > rf ? prop : fixed;
  }
  return fixed;
}

function finalGates(stats, bt, f) {
  const v = view(bt, f);
  const d = v.byDelay[f.delayForGates] || {};
  const checks = [
    ['closedPositions', stats.closed, stats.closed >= f.minClosedPositions, `>= ${f.minClosedPositions}`],
    ['profitFactor', stats.profitFactor, stats.profitFactor >= f.minProfitFactor, `>= ${f.minProfitFactor}`],
    ['bestTradeShareOfProfit', stats.bestTradeShareOfProfit, stats.bestTradeShareOfProfit != null && stats.bestTradeShareOfProfit <= f.maxBestTradeShareOfProfit, `<= ${f.maxBestTradeShareOfProfit}`],
    ['shareHeldUnder60s', stats.shareHeldUnder60s, stats.shareHeldUnder60s != null && stats.shareHeldUnder60s <= f.maxShareHeldUnder60s, `<= ${f.maxShareHeldUnder60s}`],
    [`copyRoi@${f.delayForGates}`, d.roi, d.roi >= f.minCopyRoi, `>= ${f.minCopyRoi}`],
    ['edgeRetained', d.edgeRetained, d.edgeRetained >= f.minEdgeRetained, `>= ${f.minEdgeRetained}`],
  ];
  // Safety margin: still profitable if the copy lands later than planned.
  if (f.robustDelay) {
    const r = v.byDelay[f.robustDelay] || {};
    checks.push([`copyRoi@${f.robustDelay}`, r.roi, r.roi >= f.minRobustRoi, `>= ${f.minRobustRoi}`]);
  }
  const failed = checks.filter((x) => !x[2]).map(([name, value, , need]) => ({ name, value, need }));
  return { pass: failed.length === 0, sizing: v.mode, failed };
}

const labelOf = (w) => (w && ((w.gmgn && (w.gmgn.twitter_username || w.gmgn.name)) || (w.kolscan && w.kolscan.name) || (w.fomo && w.fomo.handle))) || null;

// Backtest + gates from positions, and write the result file.
async function evaluate(g, address, positions, marks, c, w, extra) {
  const stats = walletStats(positions);
  const bt = await backtestPositions(g, positions, { ...c.backtest, marks });
  const gates = finalGates(stats, bt, c.final);
  const out = {
    address, label: labelOf(w), analyzedAt: new Date().toISOString(), ...extra,
    sources: w ? Object.keys(w.sources) : [], gmgnTags: (w && w.gmgn && w.gmgn.tags) || [],
    followers: (w && w.gmgn && w.gmgn.follow_count) || null,
    stats, backtest: { ...bt, trades: undefined }, gates,
  };
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, `${address}.json`), JSON.stringify({ ...out, marks, positions, copyTrades: bt.trades }, null, 1));
  return out;
}

async function analyzeWallet(g, address, c, w) {
  const trades = await walletTrades(g, address, c.history);
  const { positions, orphanSells } = buildPositions(trades);
  const marks = {};
  for (const p of positions) if (p.status !== 'closed' && !(p.token in marks)) marks[p.token] = await latestPrice(g, p.token);
  return evaluate(g, address, positions, marks, c, w, { tradesPulled: trades.length, orphanSells });
}

function score(r, c) {
  const d = view(r.backtest, c.final).byDelay[c.final.delayForGates] || {};
  if (!(d.roi > 0)) return d.roi || -1;
  return d.roi * Math.min(1, r.stats.closed / 30) * (0.5 + (r.stats.greenDayShare || 0) / 2);
}

const pct = (x) => (x == null || !isFinite(x) ? '-' : `${Math.round(x * 100)}%`);
const usd = (x) => (x == null || !isFinite(x) ? '-' : `${x < 0 ? '-' : ''}$${Math.abs(Math.round(x)).toLocaleString('en-US')}`);
const dur = (s) => (s == null ? '-' : s < 120 ? `${Math.round(s)}s` : s < 7200 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`);

function writeReport(results, c, meta) {
  results.sort((a, b) => score(b, c) - score(a, c));
  fs.writeFileSync(path.join(DATA, 'report.json'), JSON.stringify({ meta, criteria: c, results }, null, 1));
  const delays = c.backtest.delays.map((d) => `${d}s`);
  const gd = c.final.delayForGates;
  const lines = [
    '# Triple T report',
    '',
    `Generated ${meta.generatedAt}. Universe ${meta.universe} wallets; prescreen eligible ${meta.eligible.stats} by stats + ${meta.eligible.winners} repeat winners; ${results.length} analyzed over the last ${c.history.days} days.`,
    `Copy simulation: $${c.backtest.sizeUsd} per entry (fixed) or scaled by their size (proportional, x${c.backtest.propClamp ? c.backtest.propClamp.join('-x') : '0.25-x4'}), ${+(c.backtest.slippage * 100).toFixed(2)}% slippage per fill, ${+(c.backtest.feePct * 100).toFixed(2)}% fee per side + $${c.backtest.fixedFeeUsd}/tx. Gates use ${c.final.sizing || 'fixed'} sizing at ${gd}. Criteria status: ${c._status ? 'PROVISIONAL' : 'agreed'}.`,
    '',
    `| # | Wallet | Who | Pass | Closed | Win | PF | Med hold | Med size | Wallet ROI | ${delays.map((d) => `Copy @${d}`).join(' | ')} | Prop. copy @${gd} | Edge kept @${gd} | Failed gates |`,
    `|---|---|---|---|---|---|---|---|---|---|${delays.map(() => '---').join('|')}|---|---|---|`,
  ];
  results.forEach((r, i) => {
    const s = r.stats, b = r.backtest, v = view(b, c.final);
    const fixedFills = b.walletFills.fixed || b.walletFills;
    const prop = b.byDelayProportional && b.byDelayProportional[gd];
    lines.push(`| ${i + 1} | \`${r.address}\` | ${r.label || '-'} | ${r.gates.pass ? 'YES' : 'no'} | ${s.closed} | ${pct(s.winRate)} | ${s.profitFactor === Infinity ? 'inf' : s.profitFactor == null ? '-' : s.profitFactor.toFixed(2)} | ${dur(s.medianHoldSec)} | ${usd(s.medianCostUsd)} | ${pct(fixedFills.roi)} | ${delays.map((d) => pct(b.byDelay[d] && b.byDelay[d].roi)).join(' | ')} | ${pct(prop && prop.roi)} | ${pct(v.byDelay[gd] && v.byDelay[gd].edgeRetained)} | ${r.gates.failed.map((f) => f.name).join(', ') || '-'} |`);
  });
  lines.push('', 'Wallet ROI = the wallet\'s own fills at our fixed size and fees. Copy @Ns = our simulated fixed-size fills N seconds later. Prop. copy = same, sized like they size. Edge kept = copy PnL / wallet-fills PnL in the gated sizing mode.');
  fs.writeFileSync(path.join(ROOT, 'REPORT.md'), lines.join('\n') + '\n');
}

// Re-run backtests and gates for every saved result with the current
// criteria. Uses cached candles; GMGN is only opened on a cache miss.
async function rescore({ log = console.error } = {}) {
  const c = loadCriteria();
  const u = loadUniverse();
  let g = null;
  const lazy = { get: async (p) => { if (!g) g = await new Gmgn().open(); return g.get(p); } };
  const results = [];
  try {
    for (const f of fs.readdirSync(RESULTS)) {
      const r = JSON.parse(fs.readFileSync(path.join(RESULTS, f), 'utf8'));
      const marks = { ...(r.marks || (r.backtest && r.backtest.config && r.backtest.config.marks) || {}) };
      for (const p of r.positions) if (p.status !== 'closed' && !(p.token in marks)) marks[p.token] = await latestPrice(lazy, p.token);
      const out = await evaluate(lazy, r.address, r.positions, marks, c, u.wallets[r.address], { tradesPulled: r.tradesPulled, orphanSells: r.orphanSells, via: r.via });
      results.push(out);
    }
  } finally {
    if (g) await g.close();
  }
  const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'report.json'), 'utf8')).meta; } catch { return {}; } })();
  const meta = { ...prev, generatedAt: new Date().toISOString(), universe: Object.keys(u.wallets).length, eligible: prev.eligible || { stats: 0, winners: 0 }, rescored: true };
  writeReport(results, c, meta);
  log(`rescored ${results.length}, passed ${results.filter((r) => r.gates.pass).length}`);
  return { rescored: results.length, passed: results.filter((r) => r.gates.pass).length };
}

async function analyze({ log = console.error, only = null, concurrency = 4 } = {}) {
  const c = loadCriteria();
  const u = loadUniverse();
  const { pick, eligible } = only ? { pick: only.map((a) => ({ address: a, via: 'manual' })), eligible: { stats: 0, winners: 0 } } : prescreen(u, c);
  log(`prescreen: ${eligible.stats} by stats, ${eligible.winners} repeat winners; analyzing ${pick.length}`);
  const g = await new Gmgn({ tabs: concurrency }).open();
  const results = [];
  let i = 0;
  const worker = async () => {
    while (i < pick.length) {
      const { address, via } = pick[i++];
      const t0 = Date.now();
      try {
        const r = await analyzeWallet(g, address, c, u.wallets[address]);
        r.via = via;
        results.push(r);
        const d = view(r.backtest, c.final).byDelay[c.final.delayForGates] || {};
        log(`  ${address.slice(0, 8)} ${via.padEnd(7)} trades ${r.tradesPulled} closed ${r.stats.closed} walletROI ${pct(view(r.backtest, c.final).fills.roi)} copyROI@${c.final.delayForGates} ${pct(d.roi)} ${r.gates.pass ? 'PASS' : 'fail'} (${Math.round((Date.now() - t0) / 1000)}s)`);
      } catch (e) {
        log(`  ${address.slice(0, 8)} error: ${e.message}`);
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    await g.close();
  }
  const meta = { generatedAt: new Date().toISOString(), universe: Object.keys(u.wallets).length, eligible, gmgnCalls: g.calls };
  writeReport(results, c, meta);
  return { meta, analyzed: results.length, passed: results.filter((r) => r.gates.pass).length };
}

module.exports = { analyze, rescore, prescreen, finalGates, loadCriteria };
