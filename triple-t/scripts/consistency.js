// 28-day consistency for every wallet with a saved trade history: daily realized
// P&L by close day, weekly P&L, losing streaks, best-day share.
const fs = require('fs');
const T = require('path').join(__dirname, '..');
const { buildPositions, walletStats } = require(T + '/src/positions');
const u = JSON.parse(fs.readFileSync(T + '/data/universe.json', 'utf8'));
const DAY = 86400;
function consistency(trades, endTs, days = 28) {
  const start = endTs - days * DAY;
  const { positions } = buildPositions(trades);
  const closed = positions.filter((p) => p.status === 'closed' && p.closeTs >= start && p.closeTs <= endTs);
  const byDay = {};
  for (const p of closed) { const d = Math.floor((p.closeTs - start) / DAY); byDay[d] = (byDay[d] || 0) + p.realizedPnlUsd; }
  const dayKeys = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  const vals = dayKeys.map((d) => byDay[d]);
  const green = vals.filter((v) => v > 0).length;
  const weeks = [0, 0, 0, 0]; for (const d of dayKeys) weeks[Math.min(3, Math.floor(d / 7))] += byDay[d];
  let streak = 0, worst = 0; for (const v of vals) { streak = v < 0 ? streak + 1 : 0; worst = Math.max(worst, streak); }
  const pos = vals.filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const total = vals.reduce((a, b) => a + b, 0);
  const s = walletStats(positions.filter((p) => p.openTs >= start), { nowTs: endTs });
  return { activeDays: vals.length, green, greenShare: vals.length ? green / vals.length : 0, weeks, weeksUp: weeks.filter((w) => w > 0).length, worstStreak: worst,
    bestDayShare: pos ? Math.max(...vals) / pos : 1, total, closed: closed.length, winRate: s.winRate, pf: s.profitFactor, hold: s.medianHoldSec, perDay: s.positionsPerDay,
    buy: s.medianFirstBuyUsd, mcap: s.medianEntryMcapUsd, bestTrade: s.bestTradeShareOfProfit, lastTs: s.lastTradeTs };
}
module.exports = { consistency };
if (require.main === module) {
  const dir = T + '/data/cache/activity'; const out = [];
  for (const f of fs.readdirSync(dir)) {
    let j; try { j = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')); } catch { continue; }
    if (!j.trades || !j.trades.length) continue;
    const endTs = Math.floor(Date.parse(j.fetchedAt) / 1000) || Math.max(...j.trades.map((t) => t.ts));
    if (j.coveredSince && j.coveredSince > endTs - 27 * DAY && !j.complete) continue; // not a full 28 days
    const w = u.wallets[j.wallet] || {}; const g = w.gmgn || {}; const p = w.profile || {};
    const c = consistency(j.trades, endTs);
    out.push({ address: j.wallet, followers: Number(g.follow_count ?? p.followers ?? 0), tags: g.tags || p.tags || [], twitter: g.twitter_username || null, name: g.name || null, fomo: !!(w.sources && w.sources.copyfomo) || (g.tags || p.tags || []).includes('fomo'), ...c });
  }
  fs.writeFileSync(T + '/data/consistency28.json', JSON.stringify(out));
  const bad = ['wash_trader', 'sandwich_bot', 'snipe_bot', 'bundler_bot', 'top_dev'];
  const ok = out.filter((r) => !r.tags.some((t) => bad.includes(t)) && r.total > 0 && r.activeDays >= 16 && r.greenShare >= 0.7 && r.weeksUp >= 4 && r.bestDayShare <= 0.3 && r.closed >= 60 && (r.pf === Infinity || r.pf >= 1.5) && r.hold >= 60 && r.followers <= 5000);
  console.log(out.length, 'wallets with 28 days of history;', ok.length, 'pass the consistency bar');
  ok.sort((a, b) => b.greenShare * Math.min(1, b.activeDays / 24) - a.greenShare * Math.min(1, a.activeDays / 24));
  for (const r of ok.slice(0, 40)) console.log(`${r.address.slice(0, 8)} days ${r.activeDays} green ${(r.greenShare * 100).toFixed(0)}% weeks ${r.weeks.map((w) => (w >= 0 ? '+' : '') + Math.round(w)).join('/')} streak ${r.worstStreak} bestDay ${(r.bestDayShare * 100).toFixed(0)}% total $${Math.round(r.total)} closed ${r.closed} win ${(r.winRate * 100).toFixed(0)}% pf ${r.pf === Infinity ? 'inf' : r.pf.toFixed(1)} hold ${Math.round(r.hold / 60)}m buy $${Math.round(r.buy)} mcap $${Math.round(r.mcap / 1000)}K f${r.followers} ${r.twitter ? '@' + r.twitter : ''} ${r.fomo ? 'FOMO' : ''}`);
}
