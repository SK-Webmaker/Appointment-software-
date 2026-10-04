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
// only fetches what it is missing. The cache records `coveredSince`: history is
// complete from that timestamp to `fetchedAt`. `truncated` on the result means
// the page budget ran out before reaching the start of the window (a wallet
// trading more than maxPages x 50 times in it); that verdict is remembered for
// a day so hyperactive wallets are not re-downloaded on every run.
async function walletTrades(g, wallet, { days = 30, maxPages = 80, refresh = true, chain = 'sol' } = {}) {
  const file = path.join(ACT_DIR, chain === 'sol' ? `${wallet}.json` : `${chain}-${wallet}.json`);
  const cached = readJson(file) || { wallet, trades: [], fetchedAt: null };
  const now = Math.floor(Date.now() / 1000);
  const sinceTs = now - days * 86400;
  const fetchedTs = cached.fetchedAt ? Math.floor(Date.parse(cached.fetchedAt) / 1000) : 0;
  // Caches written before coveredSince existed: their fetch either reached
  // `days` back or stopped at the page cap with a full budget of rows.
  if (cached.coveredSince == null && fetchedTs && cached.days) {
    const start = fetchedTs - cached.days * 86400;
    const inWindow = cached.trades.filter((t) => t.ts >= start).length;
    if (cached.complete || inWindow < (maxPages - 1) * 50) cached.coveredSince = start;
    else cached.tooActive = { at: fetchedTs, days: cached.days };
  }
  const result = () => {
    const out = cached.trades.filter((t) => t.ts >= sinceTs);
    out.truncated = !cached.complete && !(cached.coveredSince <= sinceTs);
    return out;
  };
  if (cached.tooActive && cached.tooActive.days >= days && now - cached.tooActive.at < 86400) return result();

  const covered = cached.complete || cached.coveredSince <= sinceTs;
  if (refresh || !covered) {
    const have = new Set(cached.trades.map((t) => t.tx + t.side + t.token));
    const newestCached = cached.trades.length ? cached.trades[0].ts : 0;
    const fresh = [];
    let cursor = null, done = false, reachedSince = false, oldestFetched = Infinity;
    for (let page = 0; page < maxPages && !done; page++) {
      const { rows, next } = await g.walletActivityPage(wallet, cursor, 50, chain);
      for (const r of rows.map(slim)) {
        if (r.ts < sinceTs) { done = true; reachedSince = true; break; }
        oldestFetched = Math.min(oldestFetched, r.ts);
        const k = r.tx + r.side + r.token;
        // Caught up with a cache that already reaches back far enough.
        if (covered && have.has(k) && r.ts <= newestCached) { done = true; break; }
        if (!have.has(k)) { fresh.push(r); have.add(k); }
      }
      if (!next || !rows.length) { done = true; cached.complete = true; }
      cursor = next;
    }
    cached.trades = [...fresh, ...cached.trades].sort((a, b) => b.ts - a.ts);
    // Pages run contiguously back from now, so they cover back to what they reached.
    if (reachedSince) cached.coveredSince = Math.min(cached.coveredSince ?? Infinity, sinceTs);
    else if (!covered && oldestFetched < Infinity) cached.coveredSince = Math.min(cached.coveredSince ?? Infinity, oldestFetched);
    cached.fetchedAt = new Date().toISOString();
    cached.days = Math.max(cached.days || 0, days);
    const out = result();
    cached.tooActive = out.truncated ? { at: now, days } : undefined;
    writeJson(file, cached);
    return out;
  }
  return result();
}

// 1-second candles for `token` covering [fromTs, toTs] (unix seconds). Only
// seconds with trades have candles. Cached per token per window.
async function candles1s(g, token, fromTs, toTs, chain = 'sol') {
  const file = path.join(CANDLE_DIR, token, `${fromTs}-${toTs}.json`);
  const hit = readJson(file);
  if (hit) return hit;
  const q = new URLSearchParams({ resolution: '1s', from: String(fromTs * 1000), to: String(toTs * 1000), limit: '500' });
  const data = await g.get(`/api/v1/token_candles/${chain}/${token}?${q}`);
  const list = ((data && data.list) || []).map((c) => ({ t: Math.floor(c.time / 1000), o: +c.open, h: +c.high, l: +c.low, c: +c.close, v: +c.volume }))
    .sort((a, b) => a.t - b.t);
  writeJson(file, list);
  return list;
}

// Every 1s candle window already cached for `token`, whatever its bounds.
function cachedCandleWindows(token) {
  const dir = path.join(CANDLE_DIR, token);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((f) => {
    const m = f.match(/^(\d+)-(\d+)\.json$/);
    const candles = m && readJson(path.join(dir, f));
    return m && candles ? { from: Number(m[1]), to: Number(m[2]), candles } : null;
  }).filter(Boolean);
}

// Latest traded price (1m candles over the last 3 days). 0 when the token has
// not traded at all in that time: for a meme coin that means it is dead.
async function latestPrice(g, token, chain = 'sol') {
  const to = Math.floor(Date.now() / 1000), from = to - 3 * 86400;
  const q = new URLSearchParams({ resolution: '1m', from: String(from * 1000), to: String(to * 1000), limit: '1' });
  try {
    const data = await g.get(`/api/v1/token_candles/${chain}/${token}?${q}`);
    const list = (data && data.list) || [];
    return list.length ? +list[list.length - 1].close : 0;
  } catch {
    return null; // unknown, not zero
  }
}

module.exports = { walletTrades, candles1s, cachedCandleWindows, latestPrice, slim, CACHE };
