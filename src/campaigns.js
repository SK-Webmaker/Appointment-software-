// Turning a finding into a message the owner actually sends.
//
// The Opportunities panel says "7 regulars are late coming back". This is the
// part that answers the next question — "so what do I do about it?" — by
// building the recipient list, drafting the words, pricing it exactly, and
// then getting out of the way so the owner can edit and decide.
//
// Nothing here sends on its own. Every send is one person pressing one button
// having seen exactly who it goes to and what it costs. Automation comes later
// and will be built on top of this, not instead of it.
//
// Three rules, and they are the whole reason this is safe to put near a real
// salon's client list:
//
//   1. A CLIENT IS NOT SPAMMED. A cooldown applies across every campaign kind,
//      so a client who is both overdue AND matches a gap gets one message, not
//      two. Enforced here, on the server, not in the screen that calls it.
//   2. THE OWNER SEES THE LIST. Every recipient carries the reason they are on
//      it, so a name that looks wrong can be unticked before anything goes.
//   3. KAIRO NEVER INVENTS A DISCOUNT. If an offer is going in the message the
//      owner types it. Software that quietly cuts a business's margins to hit
//      its own numbers is not on their side.
import crypto from 'node:crypto';
import { db, getSetting, publicUrl } from './db.js';

/** Message kinds this module can queue. Kept apart from the transactional
 *  kinds (confirmation, reminder, receipt) because those are expected mail and
 *  these are not — only these are rate-limited by the cooldown. */
export const CAMPAIGN_KINDS = new Set(['gap_offer', 'rebook_nudge']);

/**
 * Who a campaign goes to.
 *
 *   matched  — the people the finding was actually about: due for a visit, and
 *              proven to book that day of the week. A handful of names, high
 *              hit rate, worth a text.
 *   everyone — the whole client list. A long shot rather than a targeted
 *              offer, and the right tool for exactly one job: a slot came free
 *              at short notice and filling it with anybody beats an empty
 *              chair. Two hundred emails cost nothing and one reply pays for
 *              the afternoon.
 *
 * They are separate because the message has to be written differently. "It's
 * yours if you want it" is true when twelve people get it and a lie when two
 * hundred do — the broadcast has to say first come, first served or the owner
 * spends the evening apologising to whoever replied second.
 */
export const AUDIENCES = new Set(['matched', 'everyone']);

/** Everything that counts as "we contacted this client for marketing", for the
 *  cooldown. Waitlist offers are included even though they are not a campaign
 *  the owner sends — one client with one phone does not care which feature
 *  messaged them. */
const COOLED_KINDS = [...CAMPAIGN_KINDS, 'waitlist_offer'];

const COOLDOWN_DEFAULT = 14;
const cooldownDays = () => {
  const n = Number(getSetting('marketing_cooldown_days', String(COOLDOWN_DEFAULT)));
  return Number.isFinite(n) && n >= 0 ? n : COOLDOWN_DEFAULT;
};

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOf = (date) => new Date(`${date}T12:00:00`).getDay();
function clock(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${(h % 12) || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
}

/**
 * Who has heard from us lately.
 *
 * Counted across ALL campaign kinds together on purpose. Someone who is both
 * overdue for a visit and free at tomorrow's gap is one person with one phone,
 * and two "just for you" messages in a morning is how a salon's regulars start
 * ignoring them.
 */
export function recentlyMessagedSet() { return recentlyMessaged(); }

function recentlyMessaged() {
  const days = cooldownDays();
  if (!days) return new Set();
  const cutoff = addDays(new Date().toISOString().slice(0, 10), -days);
  const rows = db.prepare(
    `SELECT DISTINCT client_id FROM messages
     WHERE client_id IS NOT NULL AND kind IN (${COOLED_KINDS.map(() => '?').join(',')})
       AND substr(created_at, 1, 10) >= ?`
  ).all(...COOLED_KINDS, cutoff);
  return new Set(rows.map((r) => r.client_id));
}

/**
 * Clients who have asked not to be sent offers.
 *
 * Checked everywhere a campaign is built AND again when it is sent, for the
 * same reason the cooldown is: the list on screen may be an hour old, and
 * "sorry, that was a stale tab" is not an answer anybody accepts about a
 * message they explicitly asked not to receive.
 */
function optedOut() {
  const rows = db.prepare('SELECT id FROM clients WHERE marketing_opt_out = 1').all();
  return new Set(rows.map((r) => r.id));
}

/** Contactable on the chosen channel — an address we could actually reach. */
function reachable(c, channel) {
  const hasEmail = Boolean((c.email || '').trim());
  const hasPhone = Boolean((c.phone || '').trim());
  if (channel === 'email') return hasEmail;
  if (channel === 'sms') return hasPhone;
  return hasEmail || hasPhone; // both: either will do
}

/**
 * What one message costs to send.
 *
 * SMS is billed per 160-character segment (153 once a message spills into
 * more than one), so a long message is not one text. Showing the owner
 * "about $1.12" when it is really $2.24 would be the same lie as an inflated
 * revenue estimate, just in the other direction.
 */
export function messageCost(body, channel, recipients) {
  const len = String(body || '').length;
  const segments = len <= 160 ? 1 : Math.ceil(len / 153);
  const perSms = Number(getSetting('sms_cost_cents', '8')) || 8;
  let smsCount = 0;
  if (channel === 'sms') smsCount = recipients.filter((r) => r.phone).length;
  if (channel === 'both') smsCount = recipients.filter((r) => r.phone).length;
  return {
    segments,
    sms_messages: smsCount,
    // Email is free at the volumes a salon sends; Resend's free tier is 3,000
    // a month and nobody here is close.
    cents: smsCount * segments * perSms,
  };
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

const bookingLink = () => (publicUrl() ? `${publicUrl()}/book` : '');

/**
 * A booking link that knows which message it came from.
 *
 * 12 characters of base64url — 72 bits, so unguessable, and short enough that
 * it doesn't push an SMS into a second segment. Every character in a text
 * costs the salon money, which is why this isn't a UUID.
 */
export function mintToken() {
  return crypto.randomBytes(9).toString('base64url');
}

/** The link a specific message hands out, or the plain one if nothing is set. */
export function bookingLinkFor(token) {
  const base = bookingLink();
  if (!base) return '';
  return token ? `${base}?m=${token}` : base;
}

/**
 * Substitute the merge tokens a message body may carry.
 *
 * {booking_link} is resolved per message rather than baked into the draft,
 * because the whole point is that each recipient's link is different — that is
 * what makes "this text brought back a $85 client" a fact rather than a hope.
 */
export function fillTokens(text, { firstName = 'there', token = '', businessName = '' } = {}) {
  return String(text ?? '')
    .replaceAll('{first_name}', firstName || 'there')
    .replaceAll('{business_name}', businessName)
    .replaceAll('{booking_link}', bookingLinkFor(token));
}

/**
 * The words, as a starting point rather than a finished thing.
 *
 * Written to sound like the salon rather than like software: short, no
 * exclamation marks, no "Dear valued customer". {first_name} is substituted
 * per recipient at send time so the owner can see the shape while editing.
 */
export function draftFor(kind, context = {}, audience = 'matched') {
  const biz = getSetting('business_name', 'us');
  // A merge token, not a finished URL: the link has to differ per recipient so
  // a booking can be traced back to the message that caused it. The owner sees
  // {booking_link} while editing, the same way they see {first_name}, and the
  // preview shows them what a real one looks like.
  const linkLine = bookingLink() ? '\n\nBook here: {booking_link}' : '';

  // Going to the whole list, so the words change: nobody has been singled out,
  // it cannot be promised to any one of them, and the people receiving it did
  // not ask to hear about open slots — so it says how to stop.
  if (audience === 'everyone') {
    const when = context.when || 'this week';
    const times = context.times || '';
    if (kind === 'gap_offer') {
      return {
        subject: `${times ? `${times} ` : 'A time '}just came free ${when}`,
        body: `Hi {first_name}, quick one — we've had ${times ? `${times} ` : 'a time '}come free ${when}`
          + ` and thought we'd put it out to everyone rather than let it sit empty.`
          + `\n\nFirst to book gets it.${linkLine}`
          + `\n\n${biz}`
          + `\n\nDon't want these? Reply and we'll take you off the list.`,
      };
    }
    return {
      subject: `A few spaces left at ${biz}`,
      body: `Hi {first_name}, we've got room in the diary ${when} if you've been meaning to get in.${linkLine}`
        + `\n\n${biz}`
        + `\n\nDon't want these? Reply and we'll take you off the list.`,
    };
  }

  if (kind === 'gap_offer') {
    const when = context.when || 'tomorrow';
    const times = context.times || '';
    return {
      subject: `A spot has opened up at ${biz}`,
      body: `Hi {first_name}, we've had ${times ? `${times} ` : 'a time '}come free ${when}. `
        + `If you've been meaning to get in, it's yours.${linkLine}\n\n${biz}`,
    };
  }
  if (kind === 'rebook_nudge') {
    return {
      subject: `Time for your next visit?`,
      body: `Hi {first_name}, it's been a little while since we saw you — about when you'd normally be due. `
        + `No rush, but the diary fills up, so grab a time whenever suits.${linkLine}\n\n${biz}`,
    };
  }
  return { subject: '', body: '' };
}

/**
 * What to actually do about a finding, in plain terms.
 *
 * Shown next to every finding, including the ones with nothing to send — a
 * quiet Tuesday is not fixed by a message, it is fixed by giving people a
 * reason to come on a Tuesday, and saying so is more use than a send button
 * that would not have helped.
 */
export function suggestionFor(kind, context = {}) {
  switch (kind) {
    case 'empty_time':
      return {
        headline: 'Offer it to people who are already due',
        body: 'A last-minute gap fills best with someone who was going to book anyway. '
          + 'Kairo picks clients who are past their usual gap AND have booked this weekday before, '
          + 'so the message lands as helpful rather than as an advert.',
        tip: 'Same-day gaps do better by text; anything two or more days out is fine by email.',
        can_send: true,
      };
    case 'unfilled_cancellations':
      return {
        headline: 'Somebody wanted that exact time',
        body: 'A cancelled slot is money already earned and handed back, and the time itself is proven '
          + 'popular — someone chose it. Offer it to clients who are due and have booked that day of the week before.',
        tip: 'Worth texting even if you normally email. A slot two days out has a short shelf life.',
        can_send: true,
      };
    case 'overdue_regulars':
      return {
        headline: 'One quiet nudge, not a campaign',
        body: 'These are people who liked you enough to come back repeatedly and have simply drifted. '
          + 'A short, personal note works far better than a discount — most of them just forgot to rebook.',
        tip: 'Lead with "it\'s been a while", not with money off. Save discounts for people who don\'t come back after this.',
        can_send: true,
      };
    case 'weakest_period':
      return {
        headline: 'Give people a reason to come at a dead time',
        body: `${context.label || 'This period'} is not going to fill by itself. The two things that reliably work `
          + 'are a standing discount on that slot, or a service only offered then — a quick tidy-up, '
          + 'a mid-week treatment — so it feels like a different thing rather than a cheaper version of the same one.',
        tip: 'Add it as its own service in Services, priced for the quiet hours, then it shows on your booking page automatically.',
        can_send: false,
        action: { label: 'Add a quiet-hours service', href: '#/services' },
      };
    case 'repeat_no_shows':
      return {
        headline: 'Deal with the few, not the many',
        body: 'A blanket deposit costs you good customers to solve a problem caused by a handful. '
          + 'Turn deposits on and the honest majority barely notice; these few either pay or stop booking, '
          + 'and both outcomes are better than an empty chair.',
        tip: 'A deposit the size of one service tends to be enough. It is about commitment, not recovering the money.',
        can_send: false,
        action: { label: 'Set up deposits', href: '#/settings' },
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/** Every client's visit history, once, so the pickers below stay cheap. */
function visitHistory(today) {
  const rows = db.prepare(
    `SELECT a.client_id, a.date FROM appointments a
     WHERE a.client_id IS NOT NULL AND a.status NOT IN ('cancelled','no_show') AND a.date <= ?
     ORDER BY a.client_id, a.date`
  ).all(today);
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.client_id)) by.set(r.client_id, []);
    by.get(r.client_id).push(r.date);
  }
  return by;
}

/** Their own median gap between visits, or null when there isn't a rhythm yet. */
function cadence(dates) {
  if (dates.length < 3) return null;
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push(daysBetween(dates[i - 1], dates[i]));
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return median >= 7 && median <= 240 ? median : null;
}

/**
 * Build the list for one campaign, each recipient carrying WHY they are on it.
 *
 * The reason is not decoration. An owner who can see "6 visits · due 2 weeks
 * ago · books Thursdays" can spot the one name that is wrong and untick it,
 * which is the difference between a tool they trust with their client list and
 * one they use once.
 */
export function recipientsFor(kind, { today, channel = 'both', context = {}, audience = 'matched' } = {}) {
  const history = visitHistory(today);
  const skip = recentlyMessaged();
  const off = optedOut();
  const booked = new Set(db.prepare(
    `SELECT DISTINCT client_id FROM appointments
     WHERE date > ? AND status IN ('booked','confirmed') AND client_id IS NOT NULL`
  ).all(today).map((r) => r.client_id));

  // The whole list, rather than the people the finding was about.
  //
  // Deliberately not filtered on cadence or weekday: the entire point is that
  // an empty chair this afternoon is worth offering to somebody who has been in
  // once, or who is in the book and has never booked at all. The two exclusions
  // that remain are the ones that would be wrong to ignore — a client already
  // coming in doesn't need telling a slot is free, and a client who opted out
  // asked not to hear from us.
  if (audience === 'everyone') {
    const rows = db.prepare(
      `SELECT id, first_name, last_name, email, phone FROM clients
       ORDER BY first_name COLLATE NOCASE, last_name COLLATE NOCASE`
    ).all();
    const out = [];
    for (const c of rows) {
      if (off.has(c.id)) continue;
      if (booked.has(c.id)) continue;
      if (!reachable(c, channel)) continue;
      const dates = history.get(c.id) || [];
      const why = dates.length
        ? `${dates.length} visit${dates.length === 1 ? '' : 's'} · last in `
          + `${Math.max(1, Math.round(daysBetween(dates[dates.length - 1], today) / 7))} wks ago`
        : 'On your list · no visits yet';
      out.push({ ...c, why, cooling_off: skip.has(c.id) });
    }
    // Best customers first, so if the owner does trim the list by hand they are
    // trimming from the bottom.
    out.sort((a, b) => {
      if (a.cooling_off !== b.cooling_off) return a.cooling_off ? 1 : -1;
      return (history.get(b.id)?.length || 0) - (history.get(a.id)?.length || 0);
    });
    return out;
  }

  const out = [];
  for (const [clientId, dates] of history) {
    if (booked.has(clientId)) continue;            // already coming in
    const median = cadence(dates);
    if (!median) continue;
    const since = daysBetween(dates[dates.length - 1], today);
    const c = db.prepare('SELECT id, first_name, last_name, email, phone FROM clients WHERE id = ?').get(clientId);
    if (!c) continue;

    const weeks = (n) => Math.max(1, Math.round(n / 7));
    let why = '';

    if (kind === 'rebook_nudge') {
      // Well past their own gap — the same population the finding named.
      if (since < median * 1.5) continue;
      why = `${dates.length} visits · usually every ${weeks(median)} wks · last in ${weeks(since)} wks ago`;
    } else if (kind === 'gap_offer') {
      // Due, or nearly. A gap tomorrow is no use to someone who was in last
      // week, and pestering them is how you lose them.
      if (since < median * 0.8) continue;
      // And they have to plausibly come on that day — someone who has only
      // ever booked Saturdays will not take a Tuesday morning.
      const dows = new Set(dates.map(weekdayOf));
      if (context.weekday !== undefined && !dows.has(context.weekday)) continue;
      why = `${dates.length} visits · due now · books ${DAY_NAMES[context.weekday ?? weekdayOf(dates[dates.length - 1])]}s`;
    } else {
      continue;
    }

    if (off.has(clientId)) continue;
    if (!reachable(c, channel)) continue;
    if (skip.has(clientId)) {
      out.push({ ...c, why, cooling_off: true });   // shown, but not selectable
      continue;
    }
    out.push({ ...c, why, cooling_off: false });
  }

  // Loyalty first: the people most worth keeping appear at the top of the list.
  out.sort((a, b) => {
    if (a.cooling_off !== b.cooling_off) return a.cooling_off ? 1 : -1;
    return (history.get(b.id)?.length || 0) - (history.get(a.id)?.length || 0);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

const insMessage = () => db.prepare(
  `INSERT INTO messages (appointment_id, client_id, channel, kind, to_addr, subject, body, html, status, send_after, token)
   VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`
);

function localStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Queue one campaign.
 *
 * The cooldown is re-checked here rather than trusted from the screen. The
 * preview may have been sitting open for an hour, another campaign may have
 * gone out in between, and a client being messaged twice because a browser
 * tab was stale is exactly the failure this is supposed to prevent.
 */
export function sendCampaign(kind, { clientIds = [], channel = 'email', subject = '', body = '', renderEmail } = {}) {
  if (!CAMPAIGN_KINDS.has(kind)) throw new Error('Unknown campaign');
  if (!body.trim()) throw new Error('The message is empty');

  const skip = recentlyMessaged();
  const off = optedOut();
  const ins = insMessage();
  const now = localStamp();
  const biz = getSetting('business_name', '');
  let queued = 0, skipped = 0, refused = 0;

  for (const id of clientIds) {
    // Counted apart from `skipped`, because the two mean different things to
    // the owner: skipped is "not yet", refused is "never, they asked".
    if (off.has(id)) { refused++; continue; }
    if (skip.has(id)) { skipped++; continue; }
    const c = db.prepare('SELECT id, first_name, last_name, email, phone FROM clients WHERE id = ?').get(id);
    if (!c) { skipped++; continue; }

    // One token per client, shared across their email and their text: the two
    // are the same approach to the same person, so a booking that follows is
    // attributed to the approach rather than to whichever one they happened to
    // open.
    const token = mintToken();
    const fill = { firstName: c.first_name, token, businessName: biz };
    const text = fillTokens(body, fill);
    const subj = fillTokens(subject, fill);
    const wants = [];
    if (channel !== 'sms' && (c.email || '').trim()) wants.push(['email', c.email.trim()]);
    if (channel !== 'email' && (c.phone || '').trim()) wants.push(['sms', c.phone.trim()]);
    if (!wants.length) { skipped++; continue; }

    for (const [ch, to] of wants) {
      // Only the email carries an unsubscribe link. A text has no room for one,
      // and the SMS way out is replying STOP — which the copy says.
      const html = ch === 'email' && renderEmail
        ? renderEmail({
          heading: subj || biz,
          greeting: `Hi ${c.first_name || 'there'},`,
          paragraphs: text.split('\n\n').slice(1).filter(Boolean),
          unsubscribeUrl: publicUrl() ? `${publicUrl()}/api/public/unsubscribe?t=${unsubTokenFor(c.id)}` : '',
        })
        : '';
      ins.run(c.id, ch, kind, to, subj, text, html, now, token);
    }
    queued++;
    // Within one campaign too — the same client cannot appear twice because
    // the caller sent their id twice.
    skip.add(id);
  }
  return { queued, skipped, refused };
}

/**
 * Which message, if any, should be credited for a booking.
 *
 * Deliberately strict, because the whole value of this number is that an owner
 * can believe it:
 *
 *   - the token must name a real message;
 *   - that message must have been sent to THIS client, so a link forwarded to
 *     a friend credits nothing rather than crediting the wrong campaign;
 *   - and it must be recent. A win-back text in March did not cause a booking
 *     in September; counting it would quietly make every campaign look better
 *     the longer it sat there.
 *
 * Returns the message id, or null. Never throws — a booking must never fail
 * because the bookkeeping was uncertain.
 */
const ATTRIBUTION_WINDOW_DAYS = 30;

export function attributionFor(token, clientId) {
  const t = String(token || '').trim();
  if (!t || !clientId) return null;
  try {
    const cutoff = addDays(new Date().toISOString().slice(0, 10), -ATTRIBUTION_WINDOW_DAYS);
    const row = db.prepare(
      `SELECT id FROM messages
        WHERE token = ? AND client_id = ? AND substr(created_at, 1, 10) >= ?
        ORDER BY id DESC LIMIT 1`
    ).get(t, clientId, cutoff);
    return row ? row.id : null;
  } catch {
    return null;
  }
}

/**
 * What a campaign actually earned.
 *
 * Counts only bookings that were traced to a message — never an estimate, and
 * never a booking that merely happened to follow one. Cancelled appointments
 * are excluded, because a booking that was cancelled recovered nothing.
 */
export function attributionSummary({ since = '', kind = '' } = {}) {
  const args = [];
  let where = 'WHERE a.source_message_id IS NOT NULL AND a.status != \'cancelled\'';
  if (since) { where += ' AND a.date >= ?'; args.push(since); }
  if (kind) { where += ' AND m.kind = ?'; args.push(kind); }
  return db.prepare(
    `SELECT m.kind,
            COUNT(DISTINCT a.id)            AS bookings,
            COALESCE(SUM(sv.price_cents), 0) AS revenue_cents
       FROM appointments a
       JOIN messages m ON m.id = a.source_message_id
       LEFT JOIN services sv ON sv.id = a.service_id
       ${where}
      GROUP BY m.kind
      ORDER BY revenue_cents DESC`
  ).all(...args);
}

/** The bookings one specific message produced, for the message log. */
export function bookingsFromMessage(messageId) {
  return db.prepare(
    `SELECT a.id, a.date, a.start_min, a.status, sv.name AS service_name, sv.price_cents
       FROM appointments a
       LEFT JOIN services sv ON sv.id = a.service_id
      WHERE a.source_message_id = ?
      ORDER BY a.date`
  ).all(messageId);
}

/** Flip one client's "don't send me offers" switch. */
export function setMarketingOptOut(clientId, optOut) {
  return db.prepare('UPDATE clients SET marketing_opt_out = ? WHERE id = ?')
    .run(optOut ? 1 : 0, clientId).changes > 0;
}

/**
 * The client's own unsubscribe link, minted the first time they need one.
 *
 * A commercial message has to carry a way out that works without the recipient
 * having to ask a human — so this is not a nicety, it is the thing that makes
 * sending to two hundred people at once legitimate.
 */
export function unsubTokenFor(clientId) {
  const row = db.prepare('SELECT unsub_token FROM clients WHERE id = ?').get(clientId);
  if (!row) return '';
  if (row.unsub_token) return row.unsub_token;
  const token = crypto.randomBytes(18).toString('hex');
  db.prepare('UPDATE clients SET unsub_token = ? WHERE id = ?').run(token, clientId);
  return token;
}

/** Who a token belongs to, or null. */
export function clientByUnsubToken(token) {
  const t = String(token || '').trim();
  if (t.length < 20) return null;   // never let a stray short string match
  return db.prepare(
    'SELECT id, first_name, marketing_opt_out FROM clients WHERE unsub_token = ? AND unsub_token != \'\''
  ).get(t) || null;
}

/** When this kind of campaign last went out, so the panel can say so. */
export function lastSent(kind) {
  const row = db.prepare(
    `SELECT COUNT(*) AS n, MAX(created_at) AS at FROM messages
     WHERE kind = ? AND substr(created_at, 1, 10) >= ?`
  ).get(kind, addDays(new Date().toISOString().slice(0, 10), -30));
  return row?.n ? { count: row.n, at: row.at } : null;
}
