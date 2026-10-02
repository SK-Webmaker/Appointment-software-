// Per-wallet trade history and token price data, cached on disk so reruns
// (new criteria, new delay assumptions) cost no extra API calls.
const fs = require('fs');
const path = require('path');
const { DATA } = require('./discover');

const CACHE = path.join(DATA, 'cache');
const ACT_DIR = path.join(CACHE, 'activity');
const CANDLE_DIR = path.join(CACHE, 'candles');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj));
}

// Slim a GMGN activity row to what positions/backtests use.
function slim(r) {
  return {
    ts: r.timestamp,
    side: r.event_type, // buy | sell
    token: (r.token && r.token.address) || r.token_address,
    symbol: r.token && r.token.symbol,
    supply: r.token && Number(r.token.total_supply),
    amount: Number(r.token_amount),
    usd: Number(r.cost_usd),
    priceUsd: Number(r.price_usd),
    quote: r.quote_token && r.quote_token.symbol,
    quoteAmount: Number(r.quote_amount),
    feesUsd: Number(r.gas_usd || 0) + Number(r.dex_usd || 0),
    launchpad: r.launchpad_platform || r.launchpad || null,
    tx: r.tx_hash,
  };
}

// Trades for `wallet` over the last `days`, newest first. Reuses the cache and
// only fetches pages newer than what is already stored.
async function walletTrades(g, wallet, { days = 30, maxPages = 80, refresh = true } = {}) {
  const file = path.join(ACT_DIR, `${wallet}.json`);
  const cached = readJson(file) || { wallet, trades: [], fetchedAt: null };
  const sinceTs = Math.floor(Date.now() / 1000) - days * 86400;
  const have = new Set(cached.trades.map((t) => t.tx + t.side + t.token));
  const newestCached = cached.trades.length ? cached.trades[0].ts : 0;
  const oldestCached = cached.trades.length ? cached.trades[cached.trades.length - 1].ts : Infinity;
  const needBackfill = oldestCached > sinceTs && !cached.complete;
  if (refresh || needBackfill) {
    const fresh = [];
    let cursor = null, done = false;
    for (let page = 0; page < maxPages && !done; page++) {
      const { rows, next } = await g.walletActivityPage(wallet, cursor);
      for (const r of rows.map(slim)) {
        if (r.ts < sinceTs) { done = true; break; }
        // Caught up with the cache and it already reaches back far enough.
        if (have.has(r.tx + r.side + r.token) && !needBackfill && r.ts <= newestCached) { done = true; break; }
        if (!have.has(r.tx + r.side + r.token)) fresh.push(r);
      }
      if (!next || !rows.length) { done = true; cached.complete = true; }
      cursor = next;
    }
    cached.trades = [...fresh, ...cached.trades].sort((a, b) => b.ts - a.ts);
    cached.fetchedAt = new Date().toISOString();
    cached.days = Math.max(cached.days || 0, days);
    writeJson(file, cached);
  }
  const out = cached.trades.filter((t) => t.ts >= sinceTs);
  // Page cap hit before reaching sinceTs: the window is only partly covered.
  const oldest = cached.trades.length ? cached.trades[cached.trades.length - 1].ts : 0;
  out.truncated = !cached.complete && oldest > sinceTs;
  return out;
}

// 1-second candles for `token` covering [fromTs, toTs] (unix seconds). Only
// seconds with trades have candles. Cached per token per window.
async function candles1s(g, token, fromTs, toTs) {
  const file = path.join(CANDLE_DIR, token, `${fromTs}-${toTs}.json`);
  const hit = readJson(file);
  if (hit) return hit;
  const q = new URLSearchParams({ resolution: '1s', from: String(fromTs * 1000), to: String(toTs * 1000), limit: '500' });
  const data = await g.get(`/api/v1/token_candles/sol/${token}?${q}`);
  const list = ((data && data.list) || []).map((c) => ({ t: Math.floor(c.time / 1000), o: +c.open, h: +c.high, l: +c.low, c: +c.close, v: +c.volume }))
    .sort((a, b) => a.t - b.t);
  writeJson(file, list);
  return list;
}

// Latest traded price (1m candles over the last 3 days). 0 when the token has
// not traded at all in that time: for a meme coin that means it is dead.
async function latestPrice(g, token) {
  const to = Math.floor(Date.now() / 1000), from = to - 3 * 86400;
  const q = new URLSearchParams({ resolution: '1m', from: String(from * 1000), to: String(to * 1000), limit: '1' });
  try {
    const data = await g.get(`/api/v1/token_candles/sol/${token}?${q}`);
    const list = (data && data.list) || [];
    return list.length ? +list[list.length - 1].close : 0;
  } catch {
    return null; // unknown, not zero
  }
}

module.exports = { walletTrades, candles1s, latestPrice, slim, CACHE };
