// "Forgot password?" — a reset link, by email, to an address the owner has
// confirmed. Nothing else.
//
// The rule that makes this safe to switch on for every salon at once: a link
// is only ever sent to a CONFIRMED address (users.email_verified = 1). Several
// accounts were set up under an email the owner does not personally read — a
// shared inbox, an address somebody made for them — and a reset link landing
// there would hand the business to whoever reads it. Those accounts simply get
// no email; the page says the same thing either way (see below), and support
// remains the way back in until the owner confirms an address of their own in
// Account.
//
// The link itself is built like the front door's sign-in pass:
//   - 256 random bits; only the SHA-256 is stored, so a copy of the database
//     is not a copy of any live link
//   - written into one salon's database, so it means nothing anywhere else
//   - consumed with DELETE ... RETURNING, so it works exactly once
//   - dead after thirty minutes, and replaced by the next one asked for
//   - carried after a '#', so it never reaches a server log or a Referer
//
// And the page that asks for it never says whether the email exists, is
// confirmed, or was throttled. "If that email belongs to an account with a
// confirmed address, a link is on its way" is true in every case, and tells a
// stranger nothing.
//
// docs/13-password-reset.md has the reasoning in full.
import crypto from 'node:crypto';

import { db, getSetting } from './db.js';
import { renderEmail } from './email-html.js';
import { sendEmail } from './notify.js';
import { BASE_DOMAIN, MULTI, listTenantSlugs, getTenant, withTenant, tenantFault } from './tenant.js';
import { loginHost, salonOrigin } from './central-login.js';

/** How long a reset link lives. Long enough to find the email; short enough to be worthless in an old inbox. */
export const RESET_TTL_MS = 30 * 60_000;

/** What every "Forgot password?" answer says, whatever actually happened. */
export const FORGOT_REPLY = 'If that email belongs to a Kairo account with a confirmed email address, '
  + "a reset link is on its way. It works once, for 30 minutes. Nothing there after a few minutes? "
  + 'Check your spam folder, or contact support.';

// ── How often one address can be sent a link ────────────────────────────────
//
// The page is public and answers the same whatever happens, so nothing stops a
// stranger pressing the button a hundred times with somebody's address — and
// the owner would get a hundred emails. At most one a minute and three an hour
// per address, whichever page asked. In memory, like the sign-in lock: the
// shard is one process, and a restart forgiving the count costs nothing.
const GAP_MS = 60_000;
const HOURLY = 3;
const sent = new Map(); // email -> number[] (send times, newest last)

/** May another link go to this address now? Records it if so. */
export function mayEmail(email, now = Date.now()) {
  const key = String(email || '').toLowerCase();
  const times = (sent.get(key) || []).filter((t) => now - t < 60 * 60_000);
  if (times.length && now - times[times.length - 1] < GAP_MS) { sent.set(key, times); return false; }
  if (times.length >= HOURLY) { sent.set(key, times); return false; }
  times.push(now);
  sent.set(key, times);
  if (sent.size > 5000) {
    for (const [k, v] of sent) if (!v.some((t) => now - t < 60 * 60_000)) sent.delete(k);
  }
  return true;
}

/** Tests only: start from a clean slate. */
export function resetThrottleForTests() { sent.clear(); }

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** "sh•••@gmail.com" — enough to recognise your own address, not enough to learn somebody else's. */
export function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return '';
  return `${local.slice(0, Math.min(2, local.length))}${'•'.repeat(3)}@${domain}`;
}

// ── The link. All of these run inside a salon's context. ────────────────────

/**
 * A new link for one user. Every earlier link for them stops working: only the
 * newest email in the inbox is ever the right one to press.
 */
export function mintReset(userId, { ip = '', now = Date.now() } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM password_resets WHERE expires_at <= ? OR user_id = ?').run(sqlTime(now), userId);
  db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at, ip) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, sqlTime(now + RESET_TTL_MS), String(ip).slice(0, 64));
  return token;
}

/** Who a link belongs to, without using it up — so the page can say "link expired" before anyone types. */
export function peekReset(token, { now = Date.now() } = {}) {
  const t = String(token || '');
  if (!TOKEN_RE.test(t)) return null;
  const row = db.prepare('SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?').get(sha256(t));
  if (!row || row.expires_at <= sqlTime(now)) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id) || null;
}

/**
 * Use a link up. One statement finds it and deletes it, so two presses in the
 * same instant cannot both succeed; every other link for the same person goes
 * with it.
 */
export function consumeReset(token, { now = Date.now() } = {}) {
  const t = String(token || '');
  if (!TOKEN_RE.test(t)) return null;
  const row = db.prepare('DELETE FROM password_resets WHERE token_hash = ? RETURNING *').get(sha256(t));
  if (!row) return null;
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
  if (row.expires_at <= sqlTime(now)) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id) || null;
}

/** Every outstanding link for this person, gone. Their email or password just changed. */
export function forgetResets(userId) {
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
}

// ── The emails ──────────────────────────────────────────────────────────────

function resetEmail(user, url) {
  const business = getSetting('business_name', 'your business');
  const html = renderEmail({
    heading: 'Reset your password',
    greeting: `Hi ${user.name || 'there'},`,
    paragraphs: [
      `Somebody — hopefully you — asked to reset the password for ${user.email} on ${business}'s Kairo account.`,
      'The button below works once, for the next 30 minutes. Choosing a new password signs you out on every other device.',
    ],
    cta: { label: 'Choose a new password', url },
    footNote: "Didn't ask for this? Ignore this email — your password hasn't changed, and nobody can change it without this link.",
  });
  const text = `Reset your Kairo password for ${business}.\n\nOpen this link within 30 minutes (it works once):\n${url}\n\n`
    + "Didn't ask for this? Ignore this email — your password hasn't changed.";
  return sendEmail(user.email, `Reset your Kairo password — ${business}`, text, html);
}

/** "Your password was changed" — to the address, so an owner who did not do it finds out. */
export function sendPasswordChangedEmail(user) {
  const business = getSetting('business_name', 'your business');
  const html = renderEmail({
    heading: 'Your password was changed',
    greeting: `Hi ${user.name || 'there'},`,
    paragraphs: [
      `The password for ${user.email} on ${business}'s Kairo account was just changed, and every other device was signed out.`,
      "If that was you, there's nothing to do.",
    ],
    footNote: "If it wasn't you, reply to this email or contact Kairo support straight away.",
  });
  return sendEmail(user.email, `Your Kairo password was changed — ${business}`,
    `The password for ${user.email} on ${business}'s Kairo account was just changed. If that wasn't you, contact Kairo support straight away.`, html);
}

/** "Your sign-in email was changed" — to the OLD address, which is the one that needs to hear it. */
export function sendEmailChangedNotice(oldEmail, user) {
  const business = getSetting('business_name', 'your business');
  const html = renderEmail({
    heading: 'Your sign-in email was changed',
    greeting: `Hi ${user.name || 'there'},`,
    paragraphs: [
      `The Kairo account for ${business} now signs in with ${user.email} instead of this address.`,
      "If that was you, there's nothing to do.",
    ],
    footNote: "If it wasn't you, contact Kairo support straight away.",
  });
  return sendEmail(oldEmail, `Your Kairo sign-in email was changed — ${business}`,
    `The Kairo account for ${business} now signs in with ${user.email} instead of this address. If that wasn't you, contact Kairo support straight away.`, html);
}

/**
 * The whole of "Forgot password?" for one salon, inside its context.
 *
 * Returns what happened, for logs and tests only — never for the page, which
 * says FORGOT_REPLY whatever this returns.
 */
export async function requestReset(email, { origin, ip = '', now = Date.now() } = {}) {
  const want = String(email || '').trim().toLowerCase();
  if (!want) return { sent: false, why: 'empty' };
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(want);
  if (!user) return { sent: false, why: 'no account' };
  // The rule. An address nobody has proved is theirs gets nothing.
  if (!user.email_verified) return { sent: false, why: 'unconfirmed' };
  if (!mayEmail(want, now)) return { sent: false, why: 'throttled' };
  const token = mintReset(user.id, { ip, now });
  const url = `${String(origin).replace(/\/+$/, '')}/reset#t=${token}`;
  const r = await resetEmail(user, url);
  if (!r.ok) {
    console.error(`password reset: could not email ${maskEmail(want)} — ${String(r.detail || '').slice(0, 160)}`);
    return { sent: false, why: 'email failed', detail: r.detail };
  }
  console.log(`password reset: link sent to ${maskEmail(want)}`);
  return { sent: true };
}

/**
 * "Forgot password?" on login.kairobookings.com, which does not know which
 * salon the owner is in. Asks every salon, exactly as the sign-in there does,
 * and each salon with a confirmed account under this email sends its own link.
 *
 * The throttle is counted once for the address, not once per salon, so asking
 * here cannot be used to send more mail than asking at a salon.
 */
export async function requestResetEverywhere(email, { ip = '', secure = true, now = Date.now() } = {}) {
  const want = String(email || '').trim().toLowerCase();
  const outcomes = [];
  if (!want || !MULTI) return outcomes;
  const targets = [];
  for (const slug of listTenantSlugs()) {
    if (`${slug}.${BASE_DOMAIN}` === loginHost()) continue;
    if (tenantFault(slug)) continue;
    const tenant = getTenant(slug);
    if (!tenant) continue;
    const found = withTenant(tenant, () => db.prepare(
      'SELECT id FROM users WHERE lower(email) = ? AND email_verified = 1'
    ).get(want));
    if (found) targets.push({ slug, tenant });
  }
  if (!targets.length) return outcomes;
  if (!mayEmail(want, now)) return [{ sent: false, why: 'throttled' }];
  for (const { slug, tenant } of targets) {
    const origin = salonOrigin(slug, { secure });
    // eslint-disable-next-line no-await-in-loop -- one or two salons, and each needs its own context
    const r = await withTenant(tenant, async () => {
      const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(want);
      const token = mintReset(user.id, { ip, now });
      const res = await resetEmail(user, `${origin}/reset#t=${token}`);
      if (!res.ok) console.error(`password reset (${slug}): could not email ${maskEmail(want)} — ${String(res.detail || '').slice(0, 160)}`);
      else console.log(`password reset (${slug}): link sent to ${maskEmail(want)}`);
      return { slug, sent: Boolean(res.ok) };
    });
    outcomes.push(r);
  }
  return outcomes;
}
