// What a particular client is allowed to book, and why.
//
// A no-show is the one loss a salon cannot recover: the slot is gone, there is
// nothing to sell in its place, and the person who caused it is usually the
// same person who caused the last one. Kairo already NAMES repeat offenders on
// the dashboard. This decides what to do about them.
//
// Three things run through everything here, and they are the difference between
// a guard and an insult:
//
//   1. OFF UNTIL ASKED. Every threshold defaults to off. A salon that has never
//      thought about no-shows should not discover Kairo quietly demanding
//      deposits from its clients.
//   2. THE OWNER ALWAYS WINS. Any automatic rule can be overruled per client,
//      in both directions. A rule that cannot be overruled will eventually
//      insult somebody's best client on the strength of two missed
//      appointments in 2023, and the owner will turn the whole feature off
//      rather than argue with it.
//   3. SAY WHY, IN THE CLIENT'S TERMS. "We ask for a deposit on this one" with
//      a reason is a policy. The same thing with no reason is a rejection, and
//      the client takes it personally because they have nothing else to take it
//      as.
//
// Counted over a WINDOW rather than for ever. Somebody who missed twice two
// years ago and has been faultless since is not a risk, and treating them as
// one is how a salon loses a good client to a rule nobody reviewed.
import { db, getSetting } from './db.js';

/** How far back a no-show still counts, per rule. */
export const DEPOSIT_WINDOW_DAYS = 90;
export const BLOCK_WINDOW_DAYS = 180;

const intOr = (key, dflt) => {
  const n = Number(getSetting(key, String(dflt)));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : dflt;
};

/**
 * The salon's own thresholds. Zero means off, which is the default for both —
 * a number here is a decision somebody made, never one Kairo made for them.
 */
export function ruleSettings() {
  return {
    // No-shows within DEPOSIT_WINDOW_DAYS before online booking asks for a deposit.
    deposit_after: intOr('noshow_deposit_after', 0),
    // Within BLOCK_WINDOW_DAYS before online booking is closed to them entirely.
    block_after: intOr('noshow_block_after', 0),
    // A deposit on any booking over this much, whoever it is. Nothing to do
    // with no-shows: it is the salon protecting a four-hour balayage, and it is
    // the one rule that is not about the person.
    deposit_over_cents: Math.max(0, intOr('deposit_over_cents', 0)),
  };
}

/** No-shows for one client in the last `days`. */
export function noShowsFor(clientId, days) {
  if (!clientId) return 0;
  return db.prepare(
    `SELECT COUNT(*) AS n FROM appointments
      WHERE client_id = ? AND status = 'no_show' AND date >= date('now', ?)`
  ).get(clientId, `-${Math.max(1, days)} days`).n;
}

/**
 * What this client may do right now.
 *
 * Returns the decision AND the reason, because every caller needs both: the
 * booking route to enforce it, the booking page to explain it, and the client's
 * own record to show the owner why somebody is flagged. One function so those
 * three can never drift apart and start telling different stories.
 *
 * `priceCents` is the booking being attempted, for the value-based deposit.
 * Left out — on the client's record, say — the value rule simply does not fire.
 */
export function bookingRuleFor(clientId, { priceCents = 0 } = {}) {
  const cfg = ruleSettings();
  const client = clientId
    ? db.prepare('SELECT id, booking_rule FROM clients WHERE id = ?').get(clientId)
    : null;
  const override = client?.booking_rule || '';

  const out = {
    blocked: false,
    deposit_required: false,
    reason: '',
    // Said to the client, so it explains rather than accuses. Never a count:
    // "you have missed 3 appointments" is a true sentence that loses a customer.
    client_note: '',
    override,
    no_shows_90: noShowsFor(clientId, DEPOSIT_WINDOW_DAYS),
    no_shows_180: noShowsFor(clientId, BLOCK_WINDOW_DAYS),
    settings: cfg,
  };

  // The owner's word first, in both directions. Checked before the counts so a
  // trusted client is never even measured against them.
  if (override === 'blocked') {
    out.blocked = true;
    out.reason = 'The owner has set this client to book by phone only';
    out.client_note = 'We book this one in personally — please give us a call and we\'ll sort you out.';
    return out;
  }
  if (override === 'trusted') {
    out.reason = 'The owner has marked this client trusted';
    return out;
  }

  if (cfg.block_after > 0 && out.no_shows_180 >= cfg.block_after) {
    out.blocked = true;
    out.reason = `${out.no_shows_180} no-shows in the last ${BLOCK_WINDOW_DAYS} days `
      + `(your limit is ${cfg.block_after})`;
    out.client_note = 'We\'d rather book this one in with you personally — please give us a call.';
    return out;
  }

  if (cfg.deposit_after > 0 && out.no_shows_90 >= cfg.deposit_after) {
    out.deposit_required = true;
    out.reason = `${out.no_shows_90} no-shows in the last ${DEPOSIT_WINDOW_DAYS} days `
      + `(your limit is ${cfg.deposit_after})`;
    out.client_note = 'We ask for a small deposit on this booking. It comes off the price on the day.';
    return out;
  }

  if (cfg.deposit_over_cents > 0 && priceCents >= cfg.deposit_over_cents) {
    out.deposit_required = true;
    out.reason = 'Booking value is over the deposit threshold';
    out.client_note = 'Longer appointments take a small deposit. It comes off the price on the day.';
    return out;
  }

  return out;
}
