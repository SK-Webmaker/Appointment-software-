// Password hashing (scrypt) and stateless signed session cookies.
import crypto from 'node:crypto';

const SESSION_DAYS = 30;
export const COOKIE_NAME = 'kairo_session';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * A short unguessable proof that the bearer was given this particular record,
 * for links handed to customers that carry no session — e.g. the .ics download
 * on a booking confirmation.
 *
 * Derived rather than stored, so there is no column to migrate and nothing to
 * leak from the database. Scoped by `purpose` so a token minted for one thing
 * can never be replayed against another, and unrelated to the cancel token, so
 * forwarding a calendar file never hands over the power to cancel the booking.
 */
export function recordToken(purpose, id, secret) {
  return sign(`${purpose}:${id}`, secret).slice(0, 32);
}

/** Constant-time check of a recordToken. */
export function recordTokenValid(purpose, id, token, secret) {
  const expected = recordToken(purpose, id, secret);
  const a = Buffer.from(String(token || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Create a session token: `<userId>.<tokenVersion>.<expiresMs>.<hmac>`.
 * The tokenVersion is baked into the signature, so bumping a user's
 * token_version (on password change or "sign out everywhere") instantly
 * invalidates every token minted before it — even a stolen cookie.
 */
export function createSession(userId, secret, tokenVersion = 0) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${userId}.${tokenVersion}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Returns { userId, version } for a valid, unexpired, correctly-signed token;
 * otherwise null. The caller must still confirm `version` matches the user's
 * current token_version in the database.
 */
export function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null; // old 3-part tokens are rejected → one clean re-login
  const [userId, version, expires, mac] = parts;
  const payload = `${userId}.${version}.${expires}`;
  const expected = sign(payload, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expires) < Date.now()) return null;
  return { userId: Number(userId), version: Number(version) };
}

/** `Secure` is added over HTTPS so the cookie is never sent in the clear. */
function cookieAttrs(secure) {
  return `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function sessionCookie(token, secure = false) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; ${cookieAttrs(secure)}; Max-Age=${maxAge}`;
}

export function clearSessionCookie(secure = false) {
  return `${COOKIE_NAME}=; ${cookieAttrs(secure)}; Max-Age=0`;
}

/**
 * Whether the session cookie should carry the `Secure` flag for this request.
 * True behind an HTTPS proxy (Render/Caddy set x-forwarded-proto), or when
 * KAIRO_SECURE_COOKIES=1 forces it. Local plain-HTTP dev stays usable.
 */
export function secureForRequest(req) {
  if (process.env.KAIRO_SECURE_COOKIES === '1') return true;
  if (process.env.KAIRO_SECURE_COOKIES === '0') return false;
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

// --- tiny in-memory rate limiter for login attempts ---
const attempts = new Map(); // ip -> {count, resetAt}

export function loginRateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 20; // 20 attempts / 10 minutes
}
