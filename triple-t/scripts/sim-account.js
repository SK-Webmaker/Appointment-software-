// A $35 GMGN account copying at 0.05 SOL a copy (GMGN's minimum), latest 14 days.
// Buys fail when cash runs out (GMGN pauses a task after 3 failed copies in a row;
// here a paused task restarts 24h later, like a daily check). Open coins are
// marked at today's price. Each coin held locks ~0.002 SOL of account rent.
const fs = require('fs');
const T = require('path').join(__dirname, '..');
const { Gmgn } = require(T + '/src/gmgn');
const { latestPrice } = require(T + '/src/history');
const { backtestPositions } = require(T + '/src/backtest');
const res = JSON.parse(fs.readFileSync(T + '/data/hunt/result.json', 'utf8'));
const deep = JSON.parse(fs.readFileSync(T + '/data/hunt/deep.json', 'utf8'));
const c = res.criteria; const { split, end } = res.window;
const SOL = 122.9, SIZE = 0.05 * SOL, RENT = 0.00204 * SOL, START = 35;
const deepAll = JSON.parse(fs.readFileSync(T + '/data/hunt/deep.json', 'utf8'));
const SHORT = process.env.WALLETS ? process.env.WALLETS.split(',') : deepAll.map((o) => o.address.slice(0, 8));
let g = null; const lazy = { get: async (p) => { if (!g) g = await new Gmgn().open(); return g.get(p); } };
const byPre = Object.fromEntries(deep.map((o) => [o.address.slice(0, 8), o]));
const share = (a, b) => { const A = new Set(byPre[a].tokens), B = byPre[b].tokens; return B.filter((t) => A.has(t)).length / Math.min(A.size, B.length); };
function sim(sets) { // sets: [{name, trades}]; cash moves at the copy's buy and at each copied sell
  const ev = [];
  for (const s of sets) for (const t of s.trades) ev.push({ ts: t.startTs, kind: 'buy', s: s.name, t });
  ev.sort((a, b) => a.ts - b.ts);
  let cash = START, low = START, done = 0, failed = 0, pauses = 0; const fails = {}, pausedUntil = {};
  const pending = []; // [ts, usd] cash still to come from copies we hold
  let lockedEnd = 0, openN = 0;
  const settle = (ts) => { pending.sort((a, b) => a[0] - b[0]); while (pending.length && pending[0][0] <= ts) cash += pending.shift()[1]; };
  for (const e of ev) {
    settle(e.ts);
    if ((pausedUntil[e.s] || 0) > e.ts) { failed++; continue; }
    const need = e.t.cost + (e.t.buyFee || 0) + RENT;
    if (cash >= need) {
      cash -= need; done++; fails[e.s] = 0; low = Math.min(low, cash);
      const fills = e.t.fills || [];
      for (const f of fills) pending.push([f[0], f[1]]);
      if (e.t.closed) pending.push([(fills.length ? fills[fills.length - 1][0] : e.t.endTs), RENT]);
      else { openN++; lockedEnd += e.t.pnl + e.t.cost + (e.t.buyFee || 0) - fills.reduce((x, f) => x + f[1], 0) + RENT; }
    } else { failed++; fails[e.s] = (fails[e.s] || 0) + 1; if (fails[e.s] >= 3) { pauses++; pausedUntil[e.s] = e.ts + 86400; fails[e.s] = 0; } }
  }
  settle(Infinity);
  return { equity: cash + lockedEnd, low, done, failed, pauses, open: openN };
}
(async () => {
  const marks = {}; const tr = {};
  for (const pre of SHORT) {
    const o = byPre[pre]; const r = JSON.parse(fs.readFileSync(`${T}/data/hunt/${o.address}.json`, 'utf8'));
    const recent = r.positions.filter((p) => p.openTs >= split);
    for (const p of recent) if (p.status !== 'closed' && !(p.token in marks)) marks[p.token] = await latestPrice(lazy, p.token);
    tr[pre] = {};
    for (const prio of [0.0002, 0.0005]) {
      const bt = await backtestPositions(lazy, recent, { ...c.backtest, feePct: 0.01, minTicketUsd: 0, maxChase: null, minTraderBuyUsd: 50, sizeUsd: SIZE, fixedFeeUsd: prio * SOL, marks, keepTrades: true, delays: [3, 10] });
      tr[pre][prio] = { d3: bt.tradesByDelay['3s'].filter((t) => !t.skipped), d10: bt.tradesByDelay['10s'].filter((t) => !t.skipped) };
    }
    process.stderr.write(pre + ' ');
  }
  if (g) await g.close();
  const combos = [];
  for (let i = 0; i < SHORT.length; i++) {
    combos.push([SHORT[i]]);
    for (let j = i + 1; j < SHORT.length; j++) { if (share(SHORT[i], SHORT[j]) < 0.3) combos.push([SHORT[i], SHORT[j]]); }
  }
  for (const prio of [0.0002, 0.0005]) {
    console.log(`\n== 0.05 SOL ($${SIZE.toFixed(2)}) a copy, priority ${prio} SOL, start $35, latest 14 days`);
    const rows = combos.map((cb) => {
      const a = sim(cb.map((p) => ({ name: p, trades: tr[p][prio].d3 }))), b = sim(cb.map((p) => ({ name: p, trades: tr[p][prio].d10 })));
      return { cb: cb.join('+'), a, b };
    }).sort((x, y) => y.b.equity - x.b.equity);
    for (const r of rows.slice(0, 40)) console.log(`  ${r.cb.padEnd(18)} end $${r.a.equity.toFixed(0)} (10s late $${r.b.equity.toFixed(0)})  copied ${r.a.done}, missed ${r.a.failed} for no cash, pauses ${r.a.pauses}, lowest cash $${r.a.low.toFixed(0)}, ${r.a.open} coins still held`);
  }
})();
