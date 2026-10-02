// Turn a wallet's raw buys/sells into positions (one round trip per token
// entry) and compute the wallet-level stats that criteria are written against.

const DUST = 0.02; // a position counts as closed once <2% of the tokens remain

// trades: newest-first or any order. Returns positions oldest-first.
function buildPositions(trades) {
  const byToken = new Map();
  for (const t of [...trades].sort((a, b) => a.ts - b.ts)) {
    if (!t.token || !(t.amount > 0)) continue;
    if (!byToken.has(t.token)) byToken.set(t.token, []);
    byToken.get(t.token).push(t);
  }
  const positions = [];
  let orphanSells = 0;
  for (const [token, list] of byToken) {
    let pos = null;
    for (const t of list) {
      if (t.side === 'buy') {
        if (!pos) {
          pos = {
            token, symbol: t.symbol, launchpad: t.launchpad, openTs: t.ts, closeTs: null,
            entryPriceUsd: t.priceUsd, entryMcapUsd: t.supply ? t.priceUsd * t.supply : null,
            buys: [], sells: [], bought: 0, sold: 0, costUsd: 0, proceedsUsd: 0, feesUsd: 0,
          };
          positions.push(pos);
        }
        pos.buys.push({ ts: t.ts, amount: t.amount, usd: t.usd, priceUsd: t.priceUsd, tx: t.tx });
        pos.bought += t.amount; pos.costUsd += t.usd; pos.feesUsd += t.feesUsd || 0;
      } else if (t.side === 'sell') {
        // Sell with no buy in our window: bought earlier or received by
        // transfer. No cost basis, so it cannot be scored.
        if (!pos) { orphanSells++; continue; }
        const amount = Math.min(t.amount, pos.bought - pos.sold);
        if (!(amount > 0)) continue;
        const usd = t.usd * (amount / t.amount);
        pos.sells.push({ ts: t.ts, amount, usd, priceUsd: t.priceUsd, tx: t.tx });
        pos.sold += amount; pos.proceedsUsd += usd; pos.feesUsd += t.feesUsd || 0;
        if (pos.bought - pos.sold <= pos.bought * DUST) { pos.closeTs = t.ts; pos = null; }
      }
    }
  }
  for (const p of positions) {
    p.status = p.closeTs ? 'closed' : p.sold > 0 ? 'partial' : 'open';
    const soldFrac = p.bought ? p.sold / p.bought : 0;
    p.realizedPnlUsd = p.proceedsUsd - p.costUsd * soldFrac;
    p.roi = p.costUsd > 0 && p.status === 'closed' ? p.proceedsUsd / p.costUsd - 1 : null;
    p.holdSec = p.closeTs ? p.closeTs - p.openTs : null;
  }
  positions.sort((a, b) => a.openTs - b.openTs);
  return { positions, orphanSells };
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function walletStats(positions, { nowTs = Math.floor(Date.now() / 1000) } = {}) {
  const closed = positions.filter((p) => p.status === 'closed' && p.costUsd > 0);
  const wins = closed.filter((p) => p.realizedPnlUsd > 0);
  const losses = closed.filter((p) => p.realizedPnlUsd <= 0);
  const grossWin = wins.reduce((s, p) => s + p.realizedPnlUsd, 0);
  const grossLoss = -losses.reduce((s, p) => s + p.realizedPnlUsd, 0);
  const totalPnl = closed.reduce((s, p) => s + p.realizedPnlUsd, 0);
  const sortedPnl = closed.map((p) => p.realizedPnlUsd).sort((a, b) => b - a);
  const rois = closed.map((p) => p.roi);
  const days = new Map();
  for (const p of closed) {
    const d = Math.floor(p.closeTs / 86400);
    days.set(d, (days.get(d) || 0) + p.realizedPnlUsd);
  }
  // Longest run of consecutive losing positions (by close time).
  let streak = 0, worstStreak = 0;
  for (const p of [...closed].sort((a, b) => a.closeTs - b.closeTs)) {
    streak = p.realizedPnlUsd > 0 ? 0 : streak + 1;
    worstStreak = Math.max(worstStreak, streak);
  }
  // Max drawdown of the cumulative realized PnL curve.
  let cum = 0, peak = 0, maxDd = 0;
  for (const p of [...closed].sort((a, b) => a.closeTs - b.closeTs)) {
    cum += p.realizedPnlUsd; peak = Math.max(peak, cum); maxDd = Math.max(maxDd, peak - cum);
  }
  const first = positions.length ? positions[0].openTs : nowTs;
  const spanDays = Math.max(1, (nowTs - first) / 86400);
  const bucket = (lo, hi) => closed.filter((p) => p.roi >= lo && p.roi < hi).length;
  return {
    positions: positions.length,
    closed: closed.length,
    open: positions.filter((p) => p.status !== 'closed').length,
    winRate: closed.length ? wins.length / closed.length : null,
    totalRealizedPnlUsd: totalPnl,
    pnlWithoutBestTradeUsd: totalPnl - (sortedPnl[0] || 0),
    bestTradeShareOfProfit: totalPnl > 0 ? (sortedPnl[0] || 0) / totalPnl : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null),
    avgWinUsd: wins.length ? grossWin / wins.length : null,
    avgLossUsd: losses.length ? -grossLoss / losses.length : null,
    medianRoi: median(rois),
    medianCostUsd: median(closed.map((p) => p.costUsd)),
    medianFirstBuyUsd: median(positions.map((p) => p.buys[0] && p.buys[0].usd).filter((x) => x > 0)),
    medianHoldSec: median(closed.map((p) => p.holdSec)),
    shareHeldUnder60s: closed.length ? closed.filter((p) => p.holdSec < 60).length / closed.length : null,
    medianEntryMcapUsd: median(positions.map((p) => p.entryMcapUsd).filter((x) => x > 0)),
    avgBuysPerPosition: positions.length ? positions.reduce((s, p) => s + p.buys.length, 0) / positions.length : null,
    positionsPerDay: positions.length / spanDays,
    activeDays: days.size,
    tradingDays: new Set(positions.map((p) => Math.floor(p.openTs / 86400))).size,
    lastTradeTs: positions.reduce((m, p) => Math.max(m, p.closeTs || 0, ...p.sells.map((x) => x.ts), ...p.buys.map((x) => x.ts)), 0),
    greenDayShare: days.size ? [...days.values()].filter((v) => v > 0).length / days.size : null,
    worstLosingStreak: worstStreak,
    maxDrawdownUsd: maxDd,
    roiBuckets: {
      'lost>50%': bucket(-Infinity, -0.5), 'lost0-50%': bucket(-0.5, 0), 'up0-100%': bucket(0, 1),
      '2x-5x': bucket(1, 4), '>5x': bucket(4, Infinity),
    },
    launchpadShare: positions.length ? positions.filter((p) => p.launchpad).length / positions.length : null,
    spanDays,
  };
}

// Positions opened in [fromTs, toTs). With `asOf`, judge them as they stood at
// that moment: anything that closed later is treated as still open, so a
// selection made "as of" a date never sees what happened after it.
function slicePositions(positions, fromTs, toTs, { asOf = null } = {}) {
  return positions.filter((p) => p.openTs >= fromTs && p.openTs < toTs).map((p) => {
    if (asOf == null || !p.closeTs || p.closeTs < asOf) return p;
    const sells = p.sells.filter((x) => x.ts < asOf);
    const sold = sells.reduce((s, x) => s + x.amount, 0);
    const proceeds = sells.reduce((s, x) => s + x.usd, 0);
    const buys = p.buys.filter((x) => x.ts < asOf);
    const bought = buys.reduce((s, x) => s + x.amount, 0);
    const cost = buys.reduce((s, x) => s + x.usd, 0);
    return { ...p, buys, sells, bought, sold, costUsd: cost, proceedsUsd: proceeds, closeTs: null, holdSec: null, roi: null,
      status: sold > 0 ? 'partial' : 'open', realizedPnlUsd: proceeds - cost * (bought ? sold / bought : 0) };
  });
}

module.exports = { buildPositions, walletStats, slicePositions, median };
