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

/** Create a session token: `<userId>.<expiresMs>.<hmac>` */
export function createSession(userId, secret) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the userId for a valid, unexpired token; otherwise null. */
export function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expires, mac] = parts;
  const payload = `${userId}.${expires}`;
  const expected = sign(payload, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expires) < Date.now()) return null;
  return Number(userId);
}

export function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
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
