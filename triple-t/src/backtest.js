// Copy-trade backtest. For each position a wallet opened, simulate us:
//   - buying a fixed USD size `delay` seconds after their first buy,
//   - selling the same fraction of our bag `delay` seconds after each of their
//     sells (fraction of what they held at that moment),
//   - paying slippage on every fill plus a % platform fee and a fixed
//     priority/tip cost per transaction.
// Prices come from GMGN 1-second candles: the price at time x is the close of
// the last 1s candle at or before x (no candle = nobody traded = unchanged).
// Delay 0 with the wallet's own fills is the baseline: what the wallet's edge
// was worth at our size before copy lag.
const { candles1s } = require('./history');
const { median } = require('./positions');

const DEFAULTS = {
  sizeUsd: 100,
  delays: [1, 3, 10, 30],
  slippage: 0.02, // 2% worse than the candle on every fill
  feePct: 0.01, // platform fee per side (Axiom / fomo / bots are ~0.75-1%)
  fixedFeeUsd: 0.3, // priority fee + Jito tip per transaction
  windowSec: 64,
  minWalletCostUsd: 5, // ignore dust test buys
};

class PriceTape {
  constructor(g) { this.g = g; this.windows = new Map(); this.calls = 0; this.misses = 0; }

  async priceAt(token, x, fallback) {
    const list = this.windows.get(token) || [];
    let win = list.find((w) => x >= w.from && x <= w.to);
    if (!win) {
      const from = x - 2, to = x + DEFAULTS.windowSec;
      let candles = [];
      try { candles = await candles1s(this.g, token, from, to); this.calls++; } catch { candles = []; }
      win = { from, to, candles };
      list.push(win);
      this.windows.set(token, list);
    }
    let px = null;
    for (const c of win.candles) { if (c.t <= x) px = c.c; else break; }
    if (px == null) { this.misses++; return fallback; }
    return px;
  }
}

function summarizeTrades(trades) {
  const done = trades.filter((t) => t.closed);
  const pnl = trades.reduce((s, t) => s + t.pnl, 0);
  const deployed = trades.reduce((s, t) => s + t.cost, 0);
  const wins = trades.filter((t) => t.pnl > 0);
  const gw = wins.reduce((s, t) => s + t.pnl, 0);
  const gl = -trades.filter((t) => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0);
  let cum = 0, peak = 0, dd = 0;
  for (const t of [...trades].sort((a, b) => a.endTs - b.endTs)) { cum += t.pnl; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  const best = Math.max(0, ...trades.map((t) => t.pnl));
  return {
    trades: trades.length,
    closed: done.length,
    deployedUsd: round(deployed),
    pnlUsd: round(pnl),
    roi: deployed ? round(pnl / deployed, 4) : null,
    winRate: trades.length ? round(wins.length / trades.length, 3) : null,
    profitFactor: gl > 0 ? round(gw / gl, 2) : (gw > 0 ? 'inf' : null),
    medianTradeRoi: round(median(trades.map((t) => t.pnl / t.cost)), 4),
    maxDrawdownUsd: round(dd),
    pnlWithoutBestUsd: round(pnl - best),
  };
}
const round = (x, d = 2) => (x == null || !isFinite(x) ? x : Math.round(x * 10 ** d) / 10 ** d);

// Simulate one position at one delay. `px(ts, walletPrice)` gives a fill price.
async function simulate(p, delay, cfg, px, markPrice) {
  const fee = (usd) => usd * cfg.feePct + cfg.fixedFeeUsd;
  const entry = await px(p.openTs + delay, p.entryPriceUsd);
  if (!(entry > 0)) return null;
  const buyPrice = entry * (1 + cfg.slippage);
  let tokens = cfg.sizeUsd / buyPrice;
  let cash = -cfg.sizeUsd - fee(cfg.sizeUsd);
  // Wallet holdings over time, so each of their sells maps to a fraction.
  const events = [...p.buys.slice(1).map((b) => ({ ...b, side: 'buy' })), ...p.sells.map((s) => ({ ...s, side: 'sell' }))].sort((a, b) => a.ts - b.ts);
  let held = p.buys[0].amount, endTs = p.openTs;
  for (const e of events) {
    if (e.side === 'buy') { held += e.amount; continue; }
    const frac = Math.min(1, e.amount / held);
    held -= e.amount;
    if (tokens <= 0) continue;
    const price = (await px(e.ts + delay, e.priceUsd)) * (1 - cfg.slippage);
    const sellTokens = held <= p.bought * 0.02 ? tokens : tokens * frac; // their exit = our full exit
    const usd = sellTokens * price;
    cash += usd - fee(usd);
    tokens -= sellTokens;
    endTs = e.ts;
  }
  let closed = true;
  if (tokens > 0) { // still holding: mark to market, minus the cost of selling
    closed = false;
    const usd = tokens * (markPrice || 0) * (1 - cfg.slippage);
    cash += usd - (usd > 0 ? fee(usd) : 0);
  }
  return { token: p.token, symbol: p.symbol, cost: cfg.sizeUsd, pnl: cash, closed, startTs: p.openTs, endTs };
}

// positions: from buildPositions. marks: optional { token: latestPriceUsd }.
async function backtestPositions(g, positions, opts = {}) {
  const { marks = {}, ...rest } = opts;
  const cfg = { ...DEFAULTS, ...rest };
  const tape = new PriceTape(g);
  const usable = positions.filter((p) => p.costUsd >= cfg.minWalletCostUsd && p.buys.length && p.entryPriceUsd > 0);
  const result = { config: cfg, positions: usable.length, byDelay: {} };

  // Baseline: the wallet's own fill prices at our size and fees.
  const own = [];
  for (const p of usable) {
    const t = await simulate(p, 0, { ...cfg, slippage: 0 }, async (_ts, walletPx) => walletPx, marks[p.token]);
    if (t) own.push(t);
  }
  result.walletFills = summarizeTrades(own);

  for (const d of cfg.delays) {
    const trades = [];
    for (const p of usable) {
      const t = await simulate(p, d, cfg, (ts, walletPx) => tape.priceAt(p.token, ts, walletPx), marks[p.token]);
      if (t) trades.push(t);
    }
    result.byDelay[`${d}s`] = summarizeTrades(trades);
    result.byDelay[`${d}s`].edgeRetained = result.walletFills.pnlUsd > 0 ? round(result.byDelay[`${d}s`].pnlUsd / result.walletFills.pnlUsd, 3) : null;
    if (d === cfg.delays[0]) result.trades = trades; // keep one trade list for inspection
  }
  result.candleCalls = tape.calls;
  result.priceMisses = tape.misses;
  return result;
}

module.exports = { backtestPositions, DEFAULTS };
