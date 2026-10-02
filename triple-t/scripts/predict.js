// What predicted copy profit out of sample? For every backtested wallet: older-14-day
// stats and copy results vs copy ROI over the newer 14 days (3s late, $2 copies).
const fs = require('fs');
const T = require('path').join(__dirname, '..');
const { walletStats, slicePositions } = require(T + '/src/positions');
const { walletFails, copyFails } = require(T + '/src/hunt');
const res = JSON.parse(fs.readFileSync(T + '/data/hunt/result.json', 'utf8'));
const c = res.criteria; const { start, split, end } = res.window;
const rows = [];
for (const f of fs.readdirSync(T + '/data/hunt').filter((x) => x.endsWith('.json') && x !== 'result.json')) {
  const r = JSON.parse(fs.readFileSync(`${T}/data/hunt/${f}`, 'utf8'));
  if (!r.sumNew || !r.sumOld) continue;
  const old = walletStats(slicePositions(r.positions, start, split, { asOf: split }), { nowTs: split });
  const y = r.sumNew.at3s; if (!y || y.trades < 10) continue;
  rows.push({ a: r.address, passOld: !walletFails(old, c.wallet).length && !copyFails(r.sumOld, c.copy).length, passOldWallet: !walletFails(old, c.wallet).length,
    passRecent: !r.failsRecent.length && !r.copyFailsRecent.length, pick: res.picks.some((p) => p.address === r.address),
    y: y.roi, yPnl: y.pnlUsd, yN: y.trades,
    x: { winRate: old.winRate, green: old.greenDayShare, pf: Math.min(old.profitFactor ?? 0, 20), closed: old.closed, hold: old.medianHoldSec, mcap: old.medianEntryMcapUsd, perDay: old.positionsPerDay, buy: old.medianFirstBuyUsd, best: old.bestTradeShareOfProfit, oldCopy3s: r.sumOld.at3s?.roi, oldJump: r.sumOld.followerJump3s, oldOwnRoi: r.sumOld.own?.roi } });
}
const rank = (v) => { const s = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const out = Array(v.length); s.forEach(([, i], k) => (out[i] = k)); return out; };
const spearman = (xs, ys) => { const ok = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => x != null && isFinite(x) && y != null && isFinite(y)); const a = rank(ok.map((p) => p[0])), b = rank(ok.map((p) => p[1])); const n = ok.length, ma = (n - 1) / 2; let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - ma); da += (a[i] - ma) ** 2; db += (b[i] - ma) ** 2; } return { rho: num / Math.sqrt(da * db), n }; };
console.log(`${rows.length} wallets with 10+ copies in the newer 14 days`);
for (const k of Object.keys(rows[0].x)) { const s = spearman(rows.map((r) => r.x[k]), rows.map((r) => r.y)); console.log(`  ${k.padEnd(10)} rho ${s.rho.toFixed(2)} (n ${s.n})`); }
const pooled = (rs) => { const n = rs.reduce((s, r) => s + r.yN, 0); const p = rs.reduce((s, r) => s + r.yPnl, 0); return `${rs.length} wallets, ${rs.filter((r) => r.y > 0).length} profitable, median ${(rs.map((r) => r.y).sort((a, b) => a - b)[Math.floor(rs.length / 2)] * 100).toFixed(1)}%`; };
console.log('pass all rules on old window ->', pooled(rows.filter((r) => r.passOld)));
console.log('pass wallet rules on old window ->', pooled(rows.filter((r) => r.passOldWallet)));
console.log('everyone else ->', pooled(rows.filter((r) => !r.passOldWallet)));
console.log('all ->', pooled(rows));
console.log('\npassed rules on the older 14 days AND copied well in the newer 14 days:');
for (const r of rows.filter((r) => r.passOld).sort((a, b) => b.y - a.y)) console.log(`  ${r.a.slice(0, 8)} new copy 3s ${(r.y * 100).toFixed(1)}% n${r.yN} $${r.yPnl} passes latest-14d rules: ${r.passRecent}${r.pick ? ' (in picks)' : ''}`);
