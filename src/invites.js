// Booking invites — the consultation-first way into the diary.
//
// A salon that will not let a stranger book unsupervised still needs a way to
// get them booked. The owner has the conversation (Instagram, WhatsApp, the
// phone — Kairo does not care which), agrees a service and a time, and sends
// one link. That link is an invite: one slot, held, for one person.
//
// See docs/09-consultation-first.md for why this is a table of its own rather
// than an appointment with a "provisional" flag. Short version: an appointment
// that might not be real leaks into counts, reminders, reports and the diary,
// and then every one of those has to learn to ignore it. Only a CONFIRMED
// invite has an appointment behind it.
import crypto from 'node:crypto';
import { db, getSetting } from './db.js';
import { addDaysStr, isDateStr } from './util.js';

/** SQLite's datetime('now') format, for comparing against stored timestamps. */
const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/** Statuses past which nothing more can happen. */
const FINAL_STATUSES = ['confirmed', 'expired', 'cancelled', 'declined'];

/**
 * How long a held slot waits for an answer.
 *
 * Bounded at both ends on purpose. Zero would release the slot before the
 * client had finished reading the message, and a year would let one forgotten
 * conversation sit on a Saturday afternoon until somebody noticed.
 */
export function expiryHours() {
  const n = Number(getSetting('invite_expiry_hours', '48'));
  if (!Number.isFinite(n)) return 48;
  return Math.min(720, Math.max(1, Math.floor(n)));
}

/**
 * Which of the three payment routes this salon is on.
 *
 * `checkout` demotes itself to `link` when no processor is actually connected,
 * and `link` demotes itself to `none` when no link has been pasted in. An
 * invite must never show a client a Pay button that goes nowhere — that is a
 * lost booking and the salon never finds out why.
 */
export function payRoute({ configured = false } = {}) {
  const want = String(getSetting('invite_pay', 'link') || 'link').trim();
  const link = String(getSetting('pos_payment_link', '') || '').trim();
  if (want === 'checkout') return configured ? 'checkout' : (link ? 'link' : 'none');
  if (want === 'link') return link ? 'link' : 'none';
  return 'none';
}

/** Is the consultation-first flow switched on for this salon? */
export function consultMode() {
  return getSetting('consult_mode', '0') === '1';
}

/**
 * Retire invites whose time ran out.
 *
 * Called before anything reads invites, rather than on a timer, so a slot is
 * never held by an expiry that simply had not been noticed yet. Cheap: one
 * indexed UPDATE over rows that are almost always already past.
 */
export function expireStale() {
  const info = db.prepare(
    `UPDATE booking_invites SET status = 'expired'
      WHERE status IN ('open', 'claimed', 'paid')
        AND expires_at != '' AND expires_at <= ?`
  ).run(nowSql());
  return info.changes;
}

/**
 * Slots held by live invites for one team member on one date.
 *
 * Shaped exactly like blocksFor() so freeSlotsFor can push it straight onto
 * the busy list: an invite the owner has sent is as real a commitment as an
 * appointment already in the book.
 *
 * `exceptId` lets an invite ignore itself, so re-reading the slot it already
 * holds does not report it as taken.
 */
export function heldSlotsFor(staffId, date, { exceptId = 0 } = {}) {
  // Expiry is applied in the WHERE clause rather than by retiring rows first.
  // This runs once per team member per availability lookup, and a write on a
  // read path — an UPDATE per stylist per page load — is a cost for nothing:
  // the answer is identical either way, and expireStale() still tidies the
  // statuses wherever a status is actually read.
  return db.prepare(
    `SELECT start_min, end_min FROM booking_invites
      WHERE staff_id = ? AND date = ? AND status IN ('open', 'claimed', 'paid') AND id != ?
        AND (expires_at = '' OR expires_at > ?)`
  ).all(staffId, date, Number(exceptId) || 0, nowSql());
}

/** Is any live invite sitting across this range? */
export function heldConflict(staffId, date, startMin, endMin, { exceptId = 0 } = {}) {
  return db.prepare(
    `SELECT * FROM booking_invites
      WHERE staff_id = ? AND date = ? AND status IN ('open', 'claimed', 'paid')
        AND id != ? AND start_min < ? AND end_min > ?
        AND (expires_at = '' OR expires_at > ?)
      LIMIT 1`
  ).get(staffId, date, Number(exceptId) || 0, endMin, startMin, nowSql());
}

/**
 * A token that is the credential.
 *
 * 32 bytes of randomness, base64url. The link is handed to one person in a
 * private conversation and nothing else guards it, so it has to be unguessable
 * — the same standard the cancel link already holds itself to.
 */
export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function byToken(token) {
  if (!token) return null;
  expireStale();
  return db.prepare('SELECT * FROM booking_invites WHERE token = ?').get(String(token)) || null;
}

export function byId(id) {
  expireStale();
  return db.prepare('SELECT * FROM booking_invites WHERE id = ?').get(Number(id) || 0) || null;
}

/**
 * Create the invite.
 *
 * Validation lives in the route, which has the services and the roster to hand.
 * This writes the row and nothing else, so there is one place that decides what
 * a new invite looks like.
 */
export function create({
  staffId, serviceIds, date, startMin, endMin, priceCents = 0,
  note = '', clientId = null, clientName = '', clientEmail = '', clientPhone = '',
  payMode = 'none',
}) {
  const token = newToken();
  const expires = new Date(Date.now() + expiryHours() * 3600000)
    .toISOString().slice(0, 19).replace('T', ' ');
  const info = db.prepare(
    `INSERT INTO booking_invites
       (token, client_id, staff_id, service_ids, date, start_min, end_min, price_cents,
        note, status, client_name, client_email, client_phone, pay_mode, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`
  ).run(token, clientId || null, staffId, serviceIds.join(','), date, startMin, endMin,
    Math.max(0, Math.round(priceCents)), String(note).slice(0, 1000),
    String(clientName).slice(0, 200), String(clientEmail).slice(0, 200).toLowerCase(),
    String(clientPhone).slice(0, 50), payMode, expires);
  return byId(Number(info.lastInsertRowid));
}

/** The client has told us who they are. Still not a booking. */
export function claim(id, { name, email, phone }) {
  db.prepare(
    `UPDATE booking_invites
        SET status = CASE WHEN status = 'open' THEN 'claimed' ELSE status END,
            client_name = ?, client_email = ?, client_phone = ?,
            claimed_at = CASE WHEN claimed_at = '' THEN ? ELSE claimed_at END
      WHERE id = ? AND status IN ('open', 'claimed')`
  ).run(String(name).slice(0, 200), String(email).slice(0, 200).toLowerCase(),
    String(phone).slice(0, 50), nowSql(), Number(id));
  return byId(id);
}

export function markPaid(id, { ref = '', provider = '' } = {}) {
  db.prepare(
    `UPDATE booking_invites SET status = 'paid', paid_at = ?, pay_ref = ?, pay_provider = ?
      WHERE id = ? AND status IN ('open', 'claimed', 'paid')`
  ).run(nowSql(), String(ref).slice(0, 300), String(provider).slice(0, 40), Number(id));
  return byId(id);
}

export function markConfirmed(id, appointmentId) {
  db.prepare(
    `UPDATE booking_invites SET status = 'confirmed', confirmed_at = ?, appointment_id = ?
      WHERE id = ?`
  ).run(nowSql(), Number(appointmentId), Number(id));
  return byId(id);
}

/**
 * Called off, by either side.
 *
 * `declined` and `cancelled` are both dead ends and both release the slot; they
 * are kept apart because "they said no" and "we withdrew it" are different
 * things to read in a list six weeks later.
 */
export function close(id, status = 'cancelled') {
  const next = status === 'declined' ? 'declined' : 'cancelled';
  db.prepare(
    `UPDATE booking_invites SET status = ? WHERE id = ? AND status NOT IN ('confirmed')`
  ).run(next, Number(id));
  return byId(id);
}

/** Everything still waiting on somebody, newest first. */
export function live({ limit = 100 } = {}) {
  expireStale();
  return db.prepare(
    `SELECT * FROM booking_invites WHERE status IN ('open', 'claimed', 'paid')
      ORDER BY date, start_min LIMIT ?`
  ).all(Math.min(500, Math.max(1, Number(limit) || 100)));
}

/** Is this invite still able to move forward? */
export function isLive(inv) {
  return Boolean(inv) && !FINAL_STATUSES.includes(inv.status);
}

/**
 * Has this invite's slot simply gone past?
 *
 * Separate from expiry: an invite can be well inside its 48 hours and still be
 * for a slot that was this morning. Offering a client a time that has already
 * happened is worse than saying it lapsed.
 */
export function slotPassed(inv, { today, nowMin }) {
  if (!inv || !isDateStr(inv.date)) return false;
  if (inv.date < today) return true;
  return inv.date === today && inv.start_min <= nowMin;
}

/** The public link for an invite, given the salon's own address. */
export function linkFor(token, base = '') {
  const root = String(base || '').replace(/\/+$/, '');
  return `${root}/invite/${encodeURIComponent(token)}`;
}

/** Used by the settings screen to warn before an expiry change strands anyone. */
export function countLive() {
  expireStale();
  return db.prepare(
    "SELECT COUNT(*) AS n FROM booking_invites WHERE status IN ('open','claimed','paid')"
  ).get().n;
}

/** Horizon guard shared with the route, so both agree what "too far out" means. */
export function withinHorizon(date, today, days) {
  return date <= addDaysStr(today, days);
}
