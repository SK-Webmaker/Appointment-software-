// The refund's last question: is this really the owner?
//
// A refund ends the business. The money goes back, the booking page goes off,
// everybody is signed out and the data is deleted a week later. So the last
// step is not a tick box that a phone left unlocked on the front desk could
// press: Kairo emails six digits to the owner's own sign-in address, and the
// refund is refused without them.
//
//   - 6 random digits; only a keyed hash is stored, so a copy of the database
//     is not a copy of a live code
//   - one live code per person: asking again replaces the last one
//   - dead after 10 minutes, or after 5 wrong tries, whichever comes first
//   - taken in the same statement that checks it, so two presses at once
//     cannot both spend it
//   - put back if the billing service could not be reached, so a minute's
//     outage does not cost the owner another trip to their inbox
//   - at most one email every 45 seconds, and 5 an hour, per person
//
// All of it is per salon: the table lives in that salon's own database.
import crypto from 'node:crypto';

import { db, getSetting } from './db.js';
import { renderEmail } from './email-html.js';
import { sendEmail } from './notify.js';

/** How long a code lives. Long enough to find the email; short enough to be worthless later. */
export const REFUND_CODE_TTL_MS = 10 * 60_000;
/** Wrong tries before a code stops working. 5 in a million is no odds for a guesser. */
export const REFUND_CODE_TRIES = 5;
/** The wait before another code can be emailed. */
export const REFUND_CODE_GAP_MS = 45_000;
const HOURLY = 5;

/** What each refusal says to the owner. Plain, and always says what to do next. */
export const REFUND_CODE_SAY = {
  // The page never sends fewer than six digits, so this is an Account page
  // still open from before the code existed: it has no box to type one into.
  missing: 'Reload the Account page: a refund now needs a code we email you. Nothing has changed.',
  none: 'Send yourself a code first. Nothing has changed.',
  wrong: "That code doesn't match. Check the newest email from Kairo and try again. Nothing has changed.",
  expired: 'That code has expired. Send a new one. Nothing has changed.',
  used_up: 'Too many wrong codes, so that one no longer works. Send a new one. Nothing has changed.',
};

const hash = (userId, code) => crypto
  .createHmac('sha256', String(getSetting('session_secret', '') || 'kairo'))
  .update(`refund:${userId}:${code}`).digest('hex');

const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const sendsOf = (row, now) => String(row?.sends || '').split(',').map(Number)
  .filter((t) => t && now - t < 60 * 60_000);

/** Seconds until another code may be emailed to this person; 0 means now. */
export function refundCodeWait(userId, now = Date.now()) {
  const row = db.prepare('SELECT sends FROM refund_codes WHERE user_id = ?').get(userId);
  const sends = sendsOf(row, now);
  if (!sends.length) return 0;
  const last = Math.max(...sends);
  if (now - last < REFUND_CODE_GAP_MS) return Math.ceil((REFUND_CODE_GAP_MS - (now - last)) / 1000);
  if (sends.length >= HOURLY) return Math.ceil((Math.min(...sends) + 60 * 60_000 - now) / 1000);
  return 0;
}

/**
 * A new code for one person, replacing any earlier one, and the send recorded
 * against the throttle. Returns the digits, which exist nowhere else after the
 * email has gone.
 */
export function mintRefundCode(userId, now = Date.now()) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const row = db.prepare('SELECT sends FROM refund_codes WHERE user_id = ?').get(userId);
  const sends = [...sendsOf(row, now), now].join(',');
  db.prepare(`INSERT INTO refund_codes (user_id, code_hash, expires_at, tries_left, sends) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at,
      tries_left = excluded.tries_left, sends = excluded.sends`)
    .run(userId, hash(userId, code), now + REFUND_CODE_TTL_MS, REFUND_CODE_TRIES, sends);
  return code;
}

/** The email could not be sent: no code is live, and the attempt does not count against them. */
export function forgetRefundCode(userId, sentAt) {
  const row = db.prepare('SELECT sends FROM refund_codes WHERE user_id = ?').get(userId);
  const sends = String(row?.sends || '').split(',').filter((t) => t && Number(t) !== sentAt).join(',');
  db.prepare("UPDATE refund_codes SET code_hash = '', expires_at = 0, tries_left = 0, sends = ? WHERE user_id = ?")
    .run(sends, userId);
}

/**
 * Check a code and, if it is right, take it, in one go.
 *
 * Returns { ok: true, taken } — `taken` is what putBackRefundCode needs if the
 * refund then fails for a reason that is not the owner's — or { ok: false, why,
 * tries_left }, where `why` is a key of REFUND_CODE_SAY.
 */
export function takeRefundCode(userId, code, now = Date.now()) {
  const typed = String(code || '').replace(/\D/g, '');
  if (typed.length !== 6) return { ok: false, why: 'missing' };
  const row = db.prepare('SELECT * FROM refund_codes WHERE user_id = ?').get(userId);
  if (!row || !row.code_hash) return { ok: false, why: 'none' };
  if (row.expires_at <= now) return { ok: false, why: 'expired' };
  if (row.tries_left <= 0) return { ok: false, why: 'used_up' };
  const want = hash(userId, typed);
  if (!sameHash(want, row.code_hash)) {
    const left = row.tries_left - 1;
    db.prepare('UPDATE refund_codes SET tries_left = ? WHERE user_id = ?').run(left, userId);
    return left > 0 ? { ok: false, why: 'wrong', tries_left: left } : { ok: false, why: 'used_up', tries_left: 0 };
  }
  // The check and the taking are one statement: of two presses in the same
  // instant, only one gets the row back.
  const taken = db.prepare("UPDATE refund_codes SET code_hash = '', tries_left = 0 WHERE user_id = ? AND code_hash = ? RETURNING *")
    .get(userId, want);
  if (!taken) return { ok: false, why: 'none' };
  return { ok: true, taken: { ...taken, code_hash: want, tries_left: row.tries_left } };
}

/** The billing service was unreachable or said no: the same code works again, until it expires. */
export function putBackRefundCode(taken) {
  if (!taken) return;
  db.prepare("UPDATE refund_codes SET code_hash = ?, expires_at = ?, tries_left = ? WHERE user_id = ? AND code_hash = ''")
    .run(taken.code_hash, taken.expires_at, taken.tries_left, taken.user_id);
}

/**
 * The email. Says what the code is for in the first line, because a code that
 * ends a business must never be mistaken for a sign-in code and read out to
 * somebody on the phone.
 */
export async function emailRefundCode(user, code, { amount = '' } = {}) {
  const business = getSetting('business_name', 'your business');
  const what = amount ? `refund ${amount} and close ${business}'s Kairo` : `refund and close ${business}'s Kairo`;
  const html = renderEmail({
    heading: 'Your refund code',
    greeting: `Hi ${user.name || 'there'},`,
    paragraphs: [
      `You asked to ${what}. To confirm it's you, type this code into Kairo:`,
    ],
    code,
    details: [['Works for', '10 minutes'], ['Sent to', user.email]],
    footNote: "Didn't ask for a refund? Don't share this code with anyone, and nothing will happen. "
      + 'Somebody may know your Kairo password, so change it in Account straight away.',
  });
  const text = `Your Kairo refund code is ${code}\n\n`
    + `You asked to ${what}. Type this code into Kairo to confirm it's you. It works for 10 minutes.\n\n`
    + "Didn't ask for a refund? Don't share this code with anyone, and nothing will happen. "
    + 'Somebody may know your Kairo password, so change it in Account straight away.';
  return sendEmail(user.email, `${code} is your Kairo refund code`, text, html);
}
