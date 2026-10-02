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
const { candles1s, cachedCandleWindows } = require('./history');
const { median } = require('./positions');

const DEFAULTS = {
  sizeUsd: 100,
  // fixed: every copy is sizeUsd. proportional: sizeUsd scaled by their size
  // vs their median size (clamped), the way copy bots' "follow ratio" works.
  propClamp: [0.25, 4],
  delays: [1, 3, 10, 30],
  slippage: 0.02, // 2% worse than the candle on every fill
  feePct: 0.01, // platform fee per side (Axiom / fomo / bots are ~0.75-1%)
  fixedFeeUsd: 0.3, // priority fee + Jito tip per transaction
  windowSec: 480, // one candle request covers 8 minutes (endpoint returns up to 500)
  minWalletCostUsd: 5, // ignore dust test buys
  // Copy-bot guards, as copyfomo / GMGN expose them. null / 0 = off.
  maxChase: null, // skip the copy when our entry is more than this above their fill (0.25 = 25%)
  minTraderBuyUsd: 0, // ignore their buys smaller than this ("minimum trade")
  mcapBand: null, // [min, max] market cap at their entry; null on either side = open
  minTicketUsd: 0, // the bot's smallest copy (copyfomo: $3)
};

class PriceTape {
  constructor(g) { this.g = g; this.windows = new Map(); this.calls = 0; this.misses = 0; }

  async priceAt(token, x, fallback) {
    // First touch of a token: start from every window already on disk.
    if (!this.windows.has(token)) this.windows.set(token, cachedCandleWindows(token));
    const list = this.windows.get(token);
    // Needs at least 2s of the window before x, so the candle at x is in it.
    let win = list.find((w) => x - 2 >= w.from && x <= w.to);
    if (!win) {
      const from = x - 2, to = x + DEFAULTS.windowSec;
      let candles = [];
      try { candles = await candles1s(this.g, token, from, to); this.calls++; } catch { candles = []; }
      win = { from, to, candles };
      list.push(win);
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
async function simulate(p, delay, cfg, px, markPrice, size = cfg.sizeUsd) {
  const fee = (usd) => usd * cfg.feePct + cfg.fixedFeeUsd;
  const entry = await px(p.openTs + delay, p.entryPriceUsd);
  if (!(entry > 0)) return null;
  // How far the price ran between their fill and ours: followers and bots
  // piling in behind them. Max chase refuses a fill too far above theirs.
  const entryPremium = entry / p.entryPriceUsd - 1;
  if (cfg.maxChase != null && entryPremium > cfg.maxChase) return { skipped: true, entryPremium, token: p.token, startTs: p.openTs };
  size = Math.max(size, cfg.minTicketUsd || 0);
  const buyPrice = entry * (1 + cfg.slippage);
  let tokens = size / buyPrice;
  let cash = -size - fee(size);
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
  return { token: p.token, symbol: p.symbol, cost: size, pnl: cash, closed, startTs: p.openTs, endTs, entryPremium };
}

// positions: from buildPositions. marks: optional { token: latestPriceUsd }.
async function backtestPositions(g, positions, opts = {}) {
  const { marks = {}, ...rest } = opts;
  const cfg = { ...DEFAULTS, ...rest };
  const tape = new PriceTape(g);
  const band = cfg.mcapBand || [null, null];
  const inBand = (m) => (band[0] == null || m >= band[0]) && (band[1] == null || m <= band[1]);
  const usable = positions.filter((p) => p.costUsd >= cfg.minWalletCostUsd && p.buys.length && p.entryPriceUsd > 0
    && p.buys[0].usd >= (cfg.minTraderBuyUsd || 0)
    && (!cfg.mcapBand || (p.entryMcapUsd > 0 && inBand(p.entryMcapUsd))));
  const medCost = median(usable.map((p) => p.costUsd)) || 1;
  const sizeFor = {
    fixed: () => cfg.sizeUsd,
    proportional: (p) => cfg.sizeUsd * Math.min(cfg.propClamp[1], Math.max(cfg.propClamp[0], p.costUsd / medCost)),
  };
  const result = { config: cfg, positions: usable.length, walletFills: {}, byDelay: {}, byDelayProportional: {} };

  for (const mode of ['fixed', 'proportional']) {
    // Baseline: the wallet's own fill prices at our size and fees.
    const own = [];
    for (const p of usable) {
      const t = await simulate(p, 0, { ...cfg, slippage: 0, maxChase: null }, async (_ts, walletPx) => walletPx, marks[p.token], sizeFor[mode](p));
      if (t) own.push(t);
    }
    if (cfg.keepTrades && mode === 'fixed') result.ownTrades = own;
    const base = summarizeTrades(own);
    result.walletFills[mode] = base;
    const out = mode === 'fixed' ? result.byDelay : result.byDelayProportional;
    for (const d of cfg.delays) {
      const trades = [];
      const all = [];
      let skipped = 0;
      for (const p of usable) {
        const t = await simulate(p, d, cfg, (ts, walletPx) => tape.priceAt(p.token, ts, walletPx), marks[p.token], sizeFor[mode](p));
        if (!t) continue;
        all.push(t);
        if (t.skipped) skipped++;
        else trades.push(t);
      }
      out[`${d}s`] = { ...summarizeTrades(trades), skippedByChase: skipped, medianEntryPremium: round(median(all.map((t) => t.entryPremium).filter(isFinite)), 4) };
      if (cfg.keepTrades && mode === 'fixed') (result.tradesByDelay ||= {})[`${d}s`] = all;
      out[`${d}s`].edgeRetained = base.pnlUsd > 0 ? round(out[`${d}s`].pnlUsd / base.pnlUsd, 3) : null;
      if (mode === 'fixed' && d === cfg.delays[0]) result.trades = trades; // one trade list for inspection
    }
  }
  result.candleCalls = tape.calls;
  result.priceMisses = tape.misses;
  return result;
}

module.exports = { backtestPositions, summarizeTrades, DEFAULTS };
