// Signing in from kairobookings.com, without knowing your own address.
//
// Every salon lives at its own address — hairbysha.kairobookings.com — and its
// accounts live in its own database. That is the right design and it is not
// changing. What it costs is that an owner has to remember the address before
// they can sign in, and "what was my link again?" is a support request that
// should never have to exist.
//
// So login.kairobookings.com is a front door. It asks for the email and
// password the owner already has, finds the salon that account belongs to,
// checks the password THERE, against that salon's own records, and hands the
// browser across. The salon then signs them in exactly as its own login page
// would. Nothing about an account moves, and no second copy of a password
// exists anywhere.
//
// The hand-across is the part that needs care, because it is a credential in
// a URL for about a second. See mintHandoff and redeemHandoff below.
//
// docs/12-central-login.md has the reasoning in full.
import crypto from 'node:crypto';
import {
  BASE_DOMAIN, MULTI, listTenantSlugs, getTenant, withTenant, tenantFault,
} from './tenant.js';
import { db, getSetting } from './db.js';
import { verifyPassword } from './auth.js';

/** The front door's address. login.<base domain> unless told otherwise. */
export function loginHost() {
  return String(process.env.KAIRO_LOGIN_HOST || `login.${BASE_DOMAIN}`).trim().toLowerCase();
}

/** Is this request for the front door rather than for a salon? */
export function isLoginHost(host) {
  const h = String(host || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  return Boolean(h) && h === loginHost();
}

/** A salon's own address, which is where the browser is handed to. */
export function salonOrigin(slug, { secure = true } = {}) {
  return `${secure ? 'https' : 'http'}://${slug}.${BASE_DOMAIN}`;
}

// ── How long a hand-across lives ────────────────────────────────────────────
//
// Long enough for a redirect on a slow phone connection; short enough that a
// token lifted from a log or a browser history is dead before anybody could
// use it. It is also single-use, which matters more: the moment the salon
// redeems it, it is gone.
export const HANDOFF_TTL_MS = 60_000;

// ── Repeated wrong passwords for one email ──────────────────────────────────
//
// The per-address rate limit stops one machine guessing. It does nothing
// against a hundred machines guessing the same account, which is what
// credential stuffing looks like. So failures are also counted per email, and
// an email that keeps failing is refused for a while regardless of where the
// attempts come from.
//
// Kept in memory. The shard is one process, and a restart clearing the count
// is fine: it costs an attacker a restart they cannot cause.
const FAIL_LIMIT = 8;
const FAIL_WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
const failures = new Map(); // email -> { count, first, lockedUntil }

function sweepFailures(now) {
  if (failures.size < 5000) return;
  for (const [k, v] of failures) {
    if (v.lockedUntil < now && now - v.first > FAIL_WINDOW_MS) failures.delete(k);
  }
}

/** Is this email currently refused? Returns seconds left, or 0. */
export function lockedFor(email, now = Date.now()) {
  const f = failures.get(email);
  if (!f || f.lockedUntil <= now) return 0;
  return Math.ceil((f.lockedUntil - now) / 1000);
}

export function recordFailure(email, now = Date.now()) {
  sweepFailures(now);
  let f = failures.get(email);
  if (!f || now - f.first > FAIL_WINDOW_MS) f = { count: 0, first: now, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= FAIL_LIMIT) f.lockedUntil = now + LOCK_MS;
  failures.set(email, f);
}

export function clearFailures(email) {
  failures.delete(email);
}

/** Tests only: start from a clean slate. */
export function resetFailuresForTests() {
  failures.clear();
}

/**
 * Every salon account this email and password open.
 *
 * Asked of every salon in turn, inside that salon's own context, against that
 * salon's own users table — the same table, and the same password check, as
 * the salon's own sign-in page. Nothing is looked up anywhere else.
 *
 * Timing: a password is only hashed where the email actually exists, and a
 * decoy hash runs when it exists nowhere. So "no such email" and "wrong
 * password" take the same time, and the response cannot be used to find out
 * whether somebody has a Kairo account.
 *
 * `onlySlug` narrows the search to one salon — used when somebody with access
 * to several has picked which one they meant.
 */
export function findAccounts(email, password, { onlySlug = '' } = {}) {
  const want = String(email || '').trim().toLowerCase();
  const pass = String(password || '');
  const matches = [];
  let hashed = 0;
  if (!want || !pass || !MULTI) {
    verifyPassword(pass, 'decoy-salt', '00');
    return matches;
  }
  for (const slug of listTenantSlugs()) {
    if (onlySlug && slug !== onlySlug) continue;
    // A salon whose address IS the front door is never a sign-in target. The
    // signup page refuses the name, so none should exist — but if one ever
    // did, sending its owner "home" would send them back here in a loop.
    if (`${slug}.${BASE_DOMAIN}` === loginHost()) continue;
    // A salon that will not open is skipped, not fatal. One broken salon must
    // never stop every other owner on the shard from signing in.
    if (tenantFault(slug)) continue;
    const tenant = getTenant(slug);
    if (!tenant) continue;
    withTenant(tenant, () => {
      const user = db.prepare(
        'SELECT id, name, email, role, salt, pass_hash FROM users WHERE lower(email) = ?'
      ).get(want);
      if (!user) return;
      hashed += 1;
      if (!verifyPassword(pass, user.salt, user.pass_hash)) return;
      matches.push({
        slug,
        tenant,
        userId: user.id,
        userName: user.name || '',
        role: user.role || '',
        business: String(getSetting('business_name', '') || '').trim() || slug,
      });
    });
  }
  if (!hashed) verifyPassword(pass, 'decoy-salt', '00');
  return matches;
}

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/**
 * Write a single-use pass for one user into one salon, and return it.
 *
 * Only the hash is stored, so a copy of the database is not a copy of any
 * live pass. Expired passes are swept on the way in, so the table never grows.
 */
export function mintHandoff(match, { ip = '', userAgent = '', now = Date.now() } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  withTenant(match.tenant, () => {
    db.prepare('DELETE FROM login_handoffs WHERE expires_at <= ?').run(sqlTime(now));
    db.prepare(
      `INSERT INTO login_handoffs (token_hash, user_id, expires_at, ip, user_agent)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sha256(token), match.userId, sqlTime(now + HANDOFF_TTL_MS),
      String(ip).slice(0, 64), String(userAgent).slice(0, 300));
  });
  return token;
}

/**
 * Trade a pass for the user it was issued to. Runs inside the salon's context.
 *
 * DELETE ... RETURNING makes "look it up" and "use it up" one statement, so the
 * same pass can never be redeemed twice, even by two requests that arrive in
 * the same instant. It is deleted whether or not it turns out to have expired:
 * a pass that failed once is not worth keeping for a second try.
 */
export function redeemHandoff(token, { now = Date.now() } = {}) {
  const t = String(token || '');
  // A real pass is 43 base64url characters. Anything else is not worth hashing.
  if (!/^[A-Za-z0-9_-]{43}$/.test(t)) return null;
  const row = db.prepare('DELETE FROM login_handoffs WHERE token_hash = ? RETURNING *').get(sha256(t));
  if (!row) return null;
  if (row.expires_at <= sqlTime(now)) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user) return null;
  return { user, ip: row.ip, userAgent: row.user_agent };
}

// ── The optional "are you a person" check ───────────────────────────────────
//
// The front door belongs to no salon, so it cannot read a salon's Turnstile
// keys. It takes its own from the environment. With none set it is off, and
// the rate limit and the per-email lock carry the load on their own.
export function loginTurnstile() {
  const siteKey = String(process.env.KAIRO_LOGIN_TURNSTILE_SITE_KEY || '').trim();
  const secret = String(process.env.KAIRO_LOGIN_TURNSTILE_SECRET || '').trim();
  return siteKey && secret ? { siteKey, secret } : null;
}
