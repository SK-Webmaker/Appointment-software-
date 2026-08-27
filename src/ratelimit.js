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
  // Changing a password requires the current one, so a stolen session is not
  // enough on its own — but at the generic authed limit a hijacked session
  // could still guess the current password hundreds of times a minute. This
  // bucket makes that as slow as attacking the login itself.
  password:       { limit: 10,  windowMs: 15 * 60 * 1000 },
  public_book:    { limit: 12,  windowMs: 5 * 60 * 1000 },  // booking spam guard
  public_review:  { limit: 10,  windowMs: 10 * 60 * 1000 },
  // Joining a waitlist creates a client record, so it gets the same guard as
  // booking — tighter, in fact, since nobody legitimately joins twelve times.
  public_waitlist: { limit: 6, windowMs: 10 * 60 * 1000 },
  // The cancel link's token is a credential, so looking one up is guessable in
  // principle — kept tight for the same reason login is, even though a 128-bit
  // token makes brute force hopeless. Generous enough for a client who opens
  // their link, thinks about it, and comes back.
  public_cancel:  { limit: 30,  windowMs: 10 * 60 * 1000 },
  // Same reasoning as the cancel link, and it changes something: an unsubscribe
  // token is a credential that opts somebody out permanently. Brute force is
  // hopeless against 144 bits, but this costs nothing and keeps the two links
  // that carry a token treated alike.
  public_unsub:   { limit: 30,  windowMs: 10 * 60 * 1000 },
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
  if (pathname === '/api/auth/password') return 'password';
  if (pathname === '/api/public/book' && method === 'POST') return 'public_book';
  if (pathname === '/api/public/review' && method === 'POST') return 'public_review';
  if (pathname === '/api/public/waitlist' && method === 'POST') return 'public_waitlist';
  if (pathname === '/api/public/cancel') return 'public_cancel'; // GET too — the lookup is the guessable part
  if (pathname === '/api/public/unsubscribe') return 'public_unsub'; // GET too, same reason
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
