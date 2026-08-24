// Making the Cloudflare layer actually apply.
//
// Put a domain behind Cloudflare and you get a WAF, bot filtering and DDoS
// absorption — for traffic that goes through Cloudflare. The host underneath
// stays publicly reachable, and on Render its `*.onrender.com` address cannot
// be turned off. Anyone who finds it walks straight past every one of those
// protections. A security layer that can be stepped around is decoration.
//
// So Cloudflare attaches a shared secret to each request it forwards (a
// Transform Rule adding a header), and Kairo refuses requests that arrive
// without it. That is what turns "traffic usually comes via Cloudflare" into
// "traffic can only come via Cloudflare".
//
// Three modes, because switching this on carelessly locks the owner out of
// their own salon:
//   off      — nothing happens. The default, and what every existing install
//              keeps doing until someone deliberately changes it.
//   monitor  — allow everything, but count what arrived without the header.
//              This is how you find out whether enforcing is safe BEFORE it
//              bites: if the counter is climbing with your own traffic, the
//              Cloudflare rule isn't set up right yet.
//   enforce  — refuse anything without the header.
import crypto from 'node:crypto';
import { getSetting, setSetting } from './db.js';

/** Header Cloudflare adds. Named for what it is, not for what it protects. */
export const ORIGIN_HEADER = 'x-kairo-origin';

/**
 * Paths that answer even in enforce mode.
 *
 * Render pings the health check straight at the origin — never through
 * Cloudflare — so blocking it would make Render believe the service is down and
 * restart it in a loop. /api/version returns a version string and nothing else,
 * so leaving it open costs nothing.
 */
const ALWAYS_ALLOWED = new Set(['/api/version', '/health']);

export const MODES = ['off', 'monitor', 'enforce'];

/**
 * The way back in.
 *
 * Every other setting here can be changed from the Settings screen. This one
 * can lock the owner out of that screen, so it needs a door that doesn't go
 * through the app: setting KAIRO_ORIGIN_LOCK=off in the host's environment
 * (Render → Environment) turns the lock off on the next restart no matter what
 * the database says. Documented in SECURITY.md, and worth more than the small
 * amount of code it costs.
 */
const envOverride = () => {
  const v = String(process.env.KAIRO_ORIGIN_LOCK || '').trim().toLowerCase();
  return MODES.includes(v) ? v : '';
};

const mode = () => {
  const forced = envOverride();
  if (forced) return forced;
  const m = getSetting('origin_lock_mode', 'off');
  return MODES.includes(m) ? m : 'off';
};

/** Constant-time compare, so the secret can't be guessed a character at a time. */
function sameSecret(a, b) {
  if (!a || !b) return false;
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Decide what to do with one request.
 * @returns {{ block: boolean, reason: string }}
 */
export function checkOrigin(req, pathname) {
  const m = mode();
  if (m === 'off') return { block: false, reason: '' };

  const secret = getSetting('cf_origin_secret', '');
  // No secret set is a half-finished setup, not a reason to lock everyone out.
  if (!secret) return { block: false, reason: 'no secret configured' };
  if (ALWAYS_ALLOWED.has(pathname)) return { block: false, reason: 'health check' };

  if (sameSecret(req.headers[ORIGIN_HEADER], secret)) return { block: false, reason: '' };

  noteDirectHit(pathname);
  return {
    block: m === 'enforce',
    reason: m === 'enforce' ? 'blocked: did not come through Cloudflare' : 'monitored: did not come through Cloudflare',
  };
}

/**
 * Remember that something reached the origin directly.
 *
 * Counted rather than logged line by line: the number is the useful part, and a
 * scan would otherwise fill the log with thousands of identical lines. The path
 * is kept so the owner can tell a stray health check from someone probing.
 */
function noteDirectHit(pathname) {
  const n = Number(getSetting('origin_direct_count', '0')) || 0;
  setSetting('origin_direct_count', String(n + 1));
  setSetting('origin_direct_last_at', new Date().toISOString());
  setSetting('origin_direct_last_path', String(pathname).slice(0, 120));
}

/**
 * Did *this* request come through Cloudflare?
 *
 * Asked of the request that is trying to switch the lock on. If the owner's own
 * browser is reaching the origin directly, enforcing would lock them out of the
 * screen they'd need to undo it — so the answer here is what decides whether
 * that switch is allowed to move at all.
 */
export function requestCameViaEdge(req) {
  const secret = getSetting('cf_origin_secret', '');
  return Boolean(secret) && sameSecret(req?.headers?.[ORIGIN_HEADER], secret);
}

/** What the Settings screen needs to show, and to decide it is safe to enforce. */
export function originStatus(req = null) {
  const count = Number(getSetting('origin_direct_count', '0')) || 0;
  return {
    mode: mode(),
    secret_set: Boolean(getSetting('cf_origin_secret', '')),
    header: ORIGIN_HEADER,
    direct_count: count,
    direct_last_at: getSetting('origin_direct_last_at', ''),
    direct_last_path: getSetting('origin_direct_last_path', ''),
    // Only meaningful when a request is to hand — the Settings screen uses it
    // to say whether Enforce is safe yet, and the guard uses it to refuse.
    via_edge: req ? requestCameViaEdge(req) : false,
    forced_by_env: Boolean(envOverride()),
  };
}

export function resetOriginCounter() {
  setSetting('origin_direct_count', '0');
  setSetting('origin_direct_last_at', '');
  setSetting('origin_direct_last_path', '');
}

/** A secret worth using: 32 random bytes, URL-safe. */
export function newOriginSecret() {
  return crypto.randomBytes(24).toString('base64url');
}
