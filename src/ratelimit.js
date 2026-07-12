// Rate limiting for every endpoint — fixed-window counters, in memory.
//
// Keys are per-IP for public traffic and per-user+IP for authenticated
// traffic. Limits are deliberately generous for legitimate use (a whole salon
// behind one router never comes close) and tight where abuse hurts: login,
// creating bookings, posting reviews.
//
// Graceful by design: over-limit requests get a clean 429 JSON body with a
// Retry-After header — never a dropped socket.
//
// Set KAIRO_RATELIMIT=off to disable (load testing only; never in production).

const DISABLED = process.env.KAIRO_RATELIMIT === 'off';

// bucket → { limit, windowMs }
const POLICIES = {
  login:          { limit: 20,  windowMs: 10 * 60 * 1000 }, // brute-force guard
  public_book:    { limit: 12,  windowMs: 5 * 60 * 1000 },  // booking spam guard
  public_review:  { limit: 10,  windowMs: 10 * 60 * 1000 },
  public_deposit: { limit: 20,  windowMs: 10 * 60 * 1000 },
  public_read:    { limit: 240, windowMs: 60 * 1000 },      // info/availability/ics/review-form
  authed:         { limit: 600, windowMs: 60 * 1000 },      // per user+IP, anti-runaway
  api_global:     { limit: 900, windowMs: 60 * 1000 },      // absolute per-IP ceiling
};

const windows = new Map(); // `${bucket}:${key}` → { count, resetAt }
let lastSweep = Date.now();

function sweep() {
  const now = Date.now();
  if (now - lastSweep < 60 * 1000 && windows.size < 50_000) return;
  lastSweep = now;
  for (const [k, w] of windows) {
    if (w.resetAt <= now) windows.delete(k);
  }
}

// The documented deployments (Render, or a VPS behind Caddy/nginx) all sit
// behind a proxy that sets x-forwarded-for, so it is trusted by default.
// If you expose the Node process directly to the internet with no proxy,
// set KAIRO_TRUST_PROXY=0 so clients can't spoof their IP past the limiter.
const TRUST_PROXY = process.env.KAIRO_TRUST_PROXY !== '0';

/** Client IP, honouring the proxy header set by Render/Caddy/nginx. */
export function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/** Which policy bucket a request falls into (public routes get their own). */
export function classifyRequest(method, pathname) {
  if (pathname === '/api/auth/login') return 'login';
  if (pathname === '/api/public/book' && method === 'POST') return 'public_book';
  if (pathname === '/api/public/review' && method === 'POST') return 'public_review';
  if (pathname === '/api/public/confirm-deposit') return 'public_deposit';
  if (pathname.startsWith('/api/public/') || pathname.startsWith('/api/auth/verify-email')) return 'public_read';
  return 'authed';
}

/**
 * Count this request against `bucket` for `key`.
 * Returns null when allowed, or { retryAfterSec } when over the limit.
 */
export function hit(bucket, key) {
  if (DISABLED) return null;
  sweep();
  const policy = POLICIES[bucket];
  if (!policy) return null;
  const now = Date.now();
  const mapKey = `${bucket}:${key}`;
  let w = windows.get(mapKey);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + policy.windowMs };
    windows.set(mapKey, w);
  }
  w.count += 1;
  if (w.count > policy.limit) {
    return { retryAfterSec: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
  }
  return null;
}
