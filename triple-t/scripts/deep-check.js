// Deep check of every wallet that passed all Triple T rules on the latest 14 days,
// at the user's real setup ($2 a copy, 0.0002 SOL priority on GMGN):
//   - copy results 1s / 3s / 5s / 10s late (does the edge survive slow fills?)
//   - week by week (is it fading?) and the last 3 days
//   - rug-like copies (lost 80%+), cash needed, price jump after their buys
//   - fresh GMGN profile: followers, tags, last active
//   - overlap: shared coins between candidates, shared funding wallet
const fs = require('fs');
const T = require('path').join(__dirname, '..');
const { Gmgn } = require(T + '/src/gmgn');
const { latestPrice } = require(T + '/src/history');
const { backtestPositions, summarizeTrades } = require(T + '/src/backtest');
const { median, walletStats, slicePositions } = require(T + '/src/positions');
const { walletFails, copyFails } = require(T + '/src/hunt');
const res = JSON.parse(fs.readFileSync(T + '/data/hunt/result.json', 'utf8'));
const u = JSON.parse(fs.readFileSync(T + '/data/universe.json', 'utf8'));
const c = res.criteria; const { split, end } = res.window;
const SOL = Number(process.env.SOL || 122), SIZE = 2, PRIO = 0.0002, RENT = 0.00204 * SOL;
const DAY = 86400;

function cashNeed(ts) {
  const ev = [];
  for (const t of ts) { ev.push([t.startTs, -t.cost - RENT]); if (t.closed) ev.push([t.endTs, t.cost + t.pnl + RENT]); }
  ev.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let cash = 0, low = 0; for (const [, d] of ev) { cash += d; low = Math.min(low, cash); }
  return -low;
}

(async () => {
  const files = fs.readdirSync(T + '/data/hunt').filter((f) => f.endsWith('.json') && f !== 'result.json');
  const cands = [];
  for (const f of files) {
    const r = JSON.parse(fs.readFileSync(`${T}/data/hunt/${f}`, 'utf8'));
    const extra = (process.env.EXTRA || '').split(',').filter(Boolean).some((x) => r.address.startsWith(x));
    if (!extra && (!r.failsRecent || r.failsRecent.length || !r.copyFailsRecent || r.copyFailsRecent.length)) continue;
    r.extra = extra && !!(r.failsRecent.length || (r.copyFailsRecent || []).length);
    const oldS = walletStats(slicePositions(r.positions, res.window.start, split, { asOf: split }), { nowTs: split });
    r.passOld = !walletFails(oldS, c.wallet).length && !copyFails(r.sumOld, c.copy).length;
    cands.push(r);
  }
  if (process.env.LIMIT) cands.splice(Number(process.env.LIMIT));
  console.error(`${cands.length} wallets pass every rule`);
  const g = await new Gmgn({ tabs: 4, minGapMs: 150 }).open();
  const out = [];
  try {
    let i = 0;
    await Promise.all([0, 1, 2, 3].map(async () => {
      while (i < cands.length) {
        const r = cands[i++];
        const marks = {};
        for (const p of r.positions) if (p.status !== 'closed' && p.openTs >= split && !(p.token in marks)) marks[p.token] = await latestPrice(g, p.token);
        const recent = r.positions.filter((p) => p.openTs >= split);
        const bt = await backtestPositions(g, recent, { ...c.backtest, feePct: 0.01, minTicketUsd: 0, maxChase: null, minTraderBuyUsd: 50, sizeUsd: SIZE, fixedFeeUsd: PRIO * SOL, marks, keepTrades: true, delays: [1, 3, 5, 10] });
        const taken = (d) => bt.tradesByDelay[d].filter((t) => !t.skipped);
        const t3 = taken('3s');
        const wk = (a, b) => summarizeTrades(t3.filter((t) => t.startTs >= a && t.startTs < b));
        let prof = null;
        try { prof = await g.get(`/defi/quotation/v1/smartmoney/sol/walletNew/${r.address}?period=7d`); } catch { /* keep going */ }
        const w = u.wallets[r.address] || {};
        const s3 = summarizeTrades(t3);
        out.push({
          address: r.address, name: r.name, bot: r.bot, wellKnown: r.wellKnown, extra: r.extra, passOld: r.passOld, fails: r.failsRecent.map((f) => f.name),
          firstTrade: Math.min(...r.positions.map((p) => p.openTs)),
          stats: { winRate: r.recent.winRate, green: r.recent.greenDayShare, closed: r.recent.closed, holdMin: r.recent.medianHoldSec / 60, entryMcap: r.recent.medianEntryMcapUsd, buyUsd: r.recent.medianFirstBuyUsd, pf: r.recent.profitFactor, perDay: r.recent.positionsPerDay, bestShare: r.recent.bestTradeShareOfProfit, pnl: r.recent.totalRealizedPnlUsd },
          copy: Object.fromEntries(['1s', '3s', '5s', '10s'].map((d) => { const s = summarizeTrades(taken(d)); return [d, { n: s.trades, roi: s.roi, pnl: s.pnlUsd }]; })),
          copy3: s3,
          week1: wk(split, split + 7 * DAY), week2: wk(split + 7 * DAY, end + 1), last3d: wk(end - 3 * DAY, end + 1),
          rugCopies: t3.filter((t) => t.pnl / t.cost <= -0.8).length,
          rugLossUsd: t3.filter((t) => t.pnl / t.cost <= -0.8).reduce((s, t) => s + t.pnl, 0),
          jump3s: median(bt.tradesByDelay['3s'].map((t) => t.entryPremium).filter((x) => isFinite(x))),
          cashNeed: cashNeed(taken('1s')),
          copiesPerDay: taken('1s').length / 14,
          tokens: [...new Set(recent.map((p) => p.token))],
          trades1s: taken('1s').map((t) => ({ token: t.token, startTs: t.startTs, endTs: t.endTs, cost: t.cost, pnl: t.pnl, closed: t.closed })),
          fundedBy: w.fundedBy || null,
          now: prof && { followers: Number(prof.followers_count || 0), tags: prof.tags || [], lastActive: prof.last_active_timestamp, pnl7d: Number(prof.realized_profit_7d || 0), pnl30d: Number(prof.realized_profit_30d || 0), buys7d: Number(prof.buy_7d || 0) },
        });
        console.error(`  ${out.length}/${cands.length} ${r.address.slice(0, 8)}`);
      }
    }));
  } finally { await g.close(); }
  fs.writeFileSync(process.env.OUT || T + '/data/hunt/deep.json', JSON.stringify(out, null, 1));
  const pct = (x) => (x == null || !isFinite(x) ? '   -' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%`.padStart(5));
  out.sort((a, b) => (b.stats.winRate * b.stats.green) - (a.stats.winRate * a.stats.green));
  for (const o of out) {
    const age = ((end - o.firstTrade) / DAY).toFixed(0);
    console.log(`${o.address.slice(0, 8)} age ${age}d wr ${pct(o.stats.winRate)} green ${pct(o.stats.green)} hold ${o.stats.holdMin.toFixed(0)}m buy $${Math.round(o.stats.buyUsd)} mcap $${Math.round(o.stats.entryMcap / 1000)}K | copy ROI 1s ${pct(o.copy['1s'].roi)} 3s ${pct(o.copy['3s'].roi)} 5s ${pct(o.copy['5s'].roi)} 10s ${pct(o.copy['10s'].roi)} n ${o.copy['3s'].n} $${o.copy['3s'].pnl} | wk1 ${pct(o.week1.roi)} wk2 ${pct(o.week2.roi)} 3d ${pct(o.last3d.roi)} (${o.last3d.trades}) | rugs ${o.rugCopies} ($${o.rugLossUsd.toFixed(1)}) jump ${pct(o.jump3s)} cash $${o.cashNeed.toFixed(0)} ${o.copiesPerDay.toFixed(1)}/d | now f${o.now?.followers} 7d $${Math.round(o.now?.pnl7d || 0)} tags ${(o.now?.tags || []).join('/')}${o.wellKnown ? ' WELL-KNOWN' : ''}${o.passOld ? ' PASSED-OLD' : ''}${o.extra ? ' NEAR-MISS(' + o.fails.join(',') + ')' : ''}`);
  }
  // overlap between candidates: shared coins (last 14 days) and shared funder
  console.log('\nshared coins >= 30% (of the smaller set), or same funder:');
  for (let a = 0; a < out.length; a++) for (let b = a + 1; b < out.length; b++) {
    const A = new Set(out[a].tokens), B = out[b].tokens; const sh = B.filter((t) => A.has(t)).length;
    const frac = sh / Math.min(A.size, B.length);
    const fa = out[a].fundedBy && (out[a].fundedBy.address || out[a].fundedBy), fb = out[b].fundedBy && (out[b].fundedBy.address || out[b].fundedBy);
    const same = fa && fb && JSON.stringify(fa) === JSON.stringify(fb);
    if (frac >= 0.3 || same) console.log(`  ${out[a].address.slice(0, 8)} ~ ${out[b].address.slice(0, 8)}: ${(frac * 100).toFixed(0)}% shared coins${same ? ', SAME FUNDER' : ''}`);
  }
})();
