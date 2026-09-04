// Bringing new people in, without a marketplace.
//
// Fresha's pitch to a salon is discovery: they send you clients, and take a
// commission on every one. The honest counter is that a salon's own clients are
// better at this than any marketplace — they know who wants what, they are
// trusted by the person they're recommending to, and they cost nothing.
//
// What is missing is only the plumbing: a link that identifies who sent whom,
// an offer worth passing on, and a record of what it actually produced. That is
// this module.
//
// Two rules run through it, and both exist because the alternative is a number
// the owner stops believing:
//
//   1. A REFERRAL IS A NEW PERSON. Somebody who is already a client of the
//      salon cannot be referred into it. Without that, a client texts their own
//      link to their partner who has been coming for years, and the salon pays
//      a discount for a customer it already had.
//   2. IT IS ONLY COUNTED WHEN THEY TURN UP. Booked is not enough — a booking
//      that no-shows or cancels has introduced nobody, and a scoreboard that
//      counts them is a scoreboard that flatters the feature.
import crypto from 'node:crypto';
import { db, getSetting, publicUrl } from './db.js';

/** Nothing is offered until the owner sets one up. */
export function referralSettings() {
  const type = getSetting('referral_reward_type', 'none'); // none|fixed|percent
  const value = Number(getSetting('referral_reward_value', '0')) || 0;
  return {
    enabled: type !== 'none' && value > 0,
    type,
    value,
    // What the person being referred gets, if anything. Often the more
    // effective half: the friend needs a reason to try somewhere new, and the
    // client doing the referring mostly wants to have been helpful.
    friend_type: getSetting('referral_friend_type', 'none'),
    friend_value: Number(getSetting('referral_friend_value', '0')) || 0,
  };
}

/** A reward in cents against a booking of `priceCents`. */
export function rewardCents(type, value, priceCents) {
  if (type === 'fixed' && value > 0) return Math.round(value * 100);
  if (type === 'percent' && value > 0 && priceCents > 0) {
    return Math.max(0, Math.round(priceCents * (value / 100)));
  }
  return 0;
}

/**
 * A client's own referral link, minting the token the first time it is asked
 * for.
 *
 * Short — 8 characters of base64url, 48 bits. Long enough that nobody guesses
 * their way to somebody else's, short enough to be read out over a counter or
 * fit in a text the salon pays for by the character. Unlike an unsubscribe
 * token, guessing one buys an attacker nothing except a discount they could
 * have had by asking a friend.
 */
export function referralTokenFor(clientId) {
  const row = db.prepare('SELECT referral_token FROM clients WHERE id = ?').get(clientId);
  if (!row) return '';
  if (row.referral_token) return row.referral_token;
  for (let i = 0; i < 5; i++) {
    const token = crypto.randomBytes(6).toString('base64url');
    try {
      db.prepare('UPDATE clients SET referral_token = ? WHERE id = ?').run(token, clientId);
      return token;
    } catch { /* astronomically unlikely collision — try again */ }
  }
  return '';
}

export function referralLinkFor(clientId) {
  const token = referralTokenFor(clientId);
  const base = publicUrl();
  if (!token) return '';
  return base ? `${base}/book?ref=${token}` : `/book?ref=${token}`;
}

/**
 * Who a referral token belongs to.
 *
 * Resolves the token and nothing else. Whether a booking may CLAIM the referral
 * is decided by the caller, because only the caller knows whether the person
 * booking is new — and "were they already a client?" has exactly one
 * trustworthy answer: did this booking have to create their record.
 *
 * Returns null rather than throwing for every kind of no. An invalid token must
 * never stop somebody booking; the worst outcome is an ordinary booking with
 * nobody credited, which is what would have happened without the link at all.
 */
export function referrerFor(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  return db.prepare(
    "SELECT id, first_name, last_name FROM clients WHERE referral_token = ? AND referral_token != ''"
  ).get(t) || null;
}

/**
 * Every referral that has actually produced a visit.
 *
 * Counted on completed appointments only. A booking that was never kept
 * introduced nobody, and an owner who works that out for themselves stops
 * trusting the rest of the screen too.
 */
export function referralSummary({ since = '' } = {}) {
  const args = [];
  let where = 'WHERE a.referrer_client_id IS NOT NULL';
  if (since) { where += ' AND a.date >= ?'; args.push(since); }

  const rows = db.prepare(
    `SELECT r.id, r.first_name, r.last_name,
            COUNT(DISTINCT a.client_id) AS people,
            SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS visits,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN sv.price_cents ELSE 0 END), 0) AS earned_cents
       FROM appointments a
       JOIN clients r ON r.id = a.referrer_client_id
       LEFT JOIN services sv ON sv.id = a.service_id
       ${where}
      GROUP BY r.id
      ORDER BY visits DESC, people DESC`
  ).all(...args);

  return {
    referrers: rows,
    people: rows.reduce((n, r) => n + r.people, 0),
    visits: rows.reduce((n, r) => n + r.visits, 0),
    earned_cents: rows.reduce((n, r) => n + r.earned_cents, 0),
  };
}

/**
 * How new clients say they found the salon.
 *
 * The half of this that matters commercially is the "discovery" answers —
 * Google, a walk-past, Instagram. A referral from an existing client would
 * never have come through a marketplace, so counting it as commission saved
 * overstates the case, and an owner who checks will find that out. The two are
 * reported apart so the honest number is the one on screen.
 */
export const HEARD_OPTIONS = [
  ['friend', 'A friend told me'],
  ['google', 'Google'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['walk_past', 'Walked past'],
  ['returning', "I've been before"],
  ['other', 'Somewhere else'],
];
const DISCOVERY = new Set(['google', 'instagram', 'facebook', 'walk_past', 'other']);

export function heardFromSummary({ since = '' } = {}) {
  const args = [];
  let where = "WHERE a.heard_from != ''";
  if (since) { where += ' AND a.date >= ?'; args.push(since); }
  const rows = db.prepare(
    `SELECT a.heard_from AS source, COUNT(*) AS n,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN sv.price_cents ELSE 0 END), 0) AS earned_cents
       FROM appointments a LEFT JOIN services sv ON sv.id = a.service_id
       ${where} GROUP BY a.heard_from ORDER BY n DESC`
  ).all(...args);
  const label = Object.fromEntries(HEARD_OPTIONS);
  return {
    sources: rows.map((r) => ({ ...r, label: label[r.source] || r.source, discovery: DISCOVERY.has(r.source) })),
    // Only the ones a marketplace could plausibly have introduced. This is the
    // number worth comparing against a commission, and the only one that
    // survives an owner checking it.
    discovery_count: rows.filter((r) => DISCOVERY.has(r.source)).reduce((n, r) => n + r.n, 0),
    discovery_cents: rows.filter((r) => DISCOVERY.has(r.source)).reduce((n, r) => n + r.earned_cents, 0),
  };
}
