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
import { db, getSetting, publicUrl } from './db.js';

/** Message kinds this module can queue. Kept apart from the transactional
 *  kinds (confirmation, reminder, receipt) because those are expected mail and
 *  these are not — only these are rate-limited by the cooldown. */
export const CAMPAIGN_KINDS = new Set(['gap_offer', 'rebook_nudge']);

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
function recentlyMessaged() {
  const days = cooldownDays();
  if (!days) return new Set();
  const cutoff = addDays(new Date().toISOString().slice(0, 10), -days);
  const rows = db.prepare(
    `SELECT DISTINCT client_id FROM messages
     WHERE client_id IS NOT NULL AND kind IN (${[...CAMPAIGN_KINDS].map(() => '?').join(',')})
       AND substr(created_at, 1, 10) >= ?`
  ).all(...CAMPAIGN_KINDS, cutoff);
  return new Set(rows.map((r) => r.client_id));
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
 * The words, as a starting point rather than a finished thing.
 *
 * Written to sound like the salon rather than like software: short, no
 * exclamation marks, no "Dear valued customer". {first_name} is substituted
 * per recipient at send time so the owner can see the shape while editing.
 */
export function draftFor(kind, context = {}) {
  const biz = getSetting('business_name', 'us');
  const link = bookingLink();
  const linkLine = link ? `\n\nBook here: ${link}` : '';

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
export function recipientsFor(kind, { today, channel = 'both', context = {} } = {}) {
  const history = visitHistory(today);
  const skip = recentlyMessaged();
  const booked = new Set(db.prepare(
    `SELECT DISTINCT client_id FROM appointments
     WHERE date > ? AND status IN ('booked','confirmed') AND client_id IS NOT NULL`
  ).all(today).map((r) => r.client_id));

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
  `INSERT INTO messages (appointment_id, client_id, channel, kind, to_addr, subject, body, html, status, send_after)
   VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`
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
  const ins = insMessage();
  const now = localStamp();
  const biz = getSetting('business_name', '');
  let queued = 0, skipped = 0;

  for (const id of clientIds) {
    if (skip.has(id)) { skipped++; continue; }
    const c = db.prepare('SELECT id, first_name, last_name, email, phone FROM clients WHERE id = ?').get(id);
    if (!c) { skipped++; continue; }

    const text = body.replaceAll('{first_name}', c.first_name || 'there');
    const subj = subject.replaceAll('{first_name}', c.first_name || 'there');
    const wants = [];
    if (channel !== 'sms' && (c.email || '').trim()) wants.push(['email', c.email.trim()]);
    if (channel !== 'email' && (c.phone || '').trim()) wants.push(['sms', c.phone.trim()]);
    if (!wants.length) { skipped++; continue; }

    for (const [ch, to] of wants) {
      const html = ch === 'email' && renderEmail
        ? renderEmail({ heading: subj || biz, greeting: `Hi ${c.first_name || 'there'},`,
          paragraphs: text.split('\n\n').slice(1).filter(Boolean) })
        : '';
      ins.run(c.id, ch, kind, to, subj, text, html, now);
    }
    queued++;
    // Within one campaign too — the same client cannot appear twice because
    // the caller sent their id twice.
    skip.add(id);
  }
  return { queued, skipped };
}

/** When this kind of campaign last went out, so the panel can say so. */
export function lastSent(kind) {
  const row = db.prepare(
    `SELECT COUNT(*) AS n, MAX(created_at) AS at FROM messages
     WHERE kind = ? AND substr(created_at, 1, 10) >= ?`
  ).get(kind, addDays(new Date().toISOString().slice(0, 10), -30));
  return row?.n ? { count: row.n, at: row.at } : null;
}
