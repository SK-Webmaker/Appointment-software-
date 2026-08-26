// The waitlist, and what happens the moment somebody cancels.
//
// A cancellation is the most recoverable money in the whole diary: the slot was
// sold, the client wanted it, and now it is empty. Everything else on the
// Opportunities panel is a guess about who *might* want a time. This is the one
// case where somebody has said in advance, in writing, that they do.
//
// It is also the one case where acting within a minute genuinely beats asking
// first — a Saturday morning that frees up at 8pm on Thursday is worth far more
// than the same slot offered on Friday lunchtime, and an owner cutting hair
// cannot be the one to notice.
//
// So this is the only thing in Kairo that messages a customer without the owner
// pressing a button — and because of that it is OFF on every install, has its
// own switch, caps how many people one slot goes to, and still obeys the
// campaign cooldown so nobody is pestered.
import { db, getSetting, publicUrl } from './db.js';

export const waitlistEnabled = () => getSetting('waitlist_enabled', '0') === '1';
export const autofillEnabled = () => waitlistEnabled() && getSetting('waitlist_autofill', '0') === '1';

const weekdayOf = (date) => new Date(`${date}T12:00:00`).getDay();
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function clock(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${(h % 12) || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
}
function localStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Parse the stored "1,3,5" into a Set. Empty means "any day suits".
 *
 * The filter on empty strings is load-bearing: ''.split(',') gives [''], and
 * Number('') is 0 — so without it, every client who said "any day" was quietly
 * recorded as wanting Sundays and only ever offered a Sunday.
 */
const parseDays = (csv) => new Set(
  String(csv || '').split(',').map((v) => v.trim()).filter(Boolean)
    .map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
);

/**
 * Who on the waitlist actually wants THIS slot.
 *
 * Matched on the things a client genuinely cares about — the service, the
 * person, the day of the week, and whether the date is inside the window they
 * asked about. A waitlist that offers a Tuesday 9am to somebody who only ever
 * wanted Saturdays is worse than no waitlist, because they learn to ignore it.
 *
 * A client who has opted out of offers is excluded even though being on the
 * waitlist is a request to be told. One switch that means "stop messaging me
 * about openings" is easier for an owner to reason about than two rules with an
 * exception between them — and if that is wrong for a particular person, taking
 * them off the waitlist says so plainly.
 */
export function matchesFor({ date, staffId, serviceId, limit = 5 }) {
  const dow = weekdayOf(date);
  const rows = db.prepare(
    `SELECT w.*, c.first_name, c.last_name, c.email, c.phone, sv.name AS service_name
     FROM waitlist w
     JOIN clients c ON c.id = w.client_id
     LEFT JOIN services sv ON sv.id = w.service_id
     WHERE w.status = 'waiting' AND c.marketing_opt_out = 0
     ORDER BY w.created_at`
  ).all();

  return rows.filter((w) => {
    // A specific stylist asked for has to be the one who freed up.
    if (w.staff_id && staffId && w.staff_id !== staffId) return false;
    // Likewise a specific service — a colour slot is no use to somebody
    // waiting on a two-hour braid.
    if (w.service_id && serviceId && w.service_id !== serviceId) return false;
    const days = parseDays(w.weekdays);
    if (days.size && !days.has(dow)) return false;
    if (w.from_date && date < w.from_date) return false;
    if (w.until_date && date > w.until_date) return false;
    // Somewhere to actually send it.
    return Boolean((w.email || '').trim() || (w.phone || '').trim());
  }).slice(0, Math.max(1, limit));
}

/** The message. Short, specific, and honest that it is first come first served. */
function copyFor({ date, startMin, serviceName }) {
  const biz = getSetting('business_name', 'us');
  const link = publicUrl() ? `${publicUrl()}/book` : '';
  const when = `${DAY_NAMES[weekdayOf(date)]} at ${clock(startMin)}`;
  return {
    subject: `A ${when} spot just opened up`,
    body: `Hi {first_name}, you asked us to let you know — ${when} has just come free`
      + `${serviceName ? ` for ${serviceName}` : ''}.`
      + (link ? `\n\nFirst to book gets it: ${link}` : '\n\nGive us a call if you want it.')
      + `\n\n${biz}`,
  };
}

const insMessage = () => db.prepare(
  `INSERT INTO messages (appointment_id, client_id, channel, kind, to_addr, subject, body, html, status, send_after)
   VALUES (NULL, ?, ?, 'waitlist_offer', ?, ?, ?, '', 'queued', ?)`
);

/**
 * A slot just came free — tell the people waiting for it.
 *
 * Returns what it did rather than throwing, because this runs inside the
 * cancellation path: a waitlist that errors must never be the reason an
 * appointment fails to cancel.
 *
 * @param {Set<number>} skipClients  clients inside the campaign cooldown.
 */
export function offerFreedSlot({ date, startMin, staffId, serviceId, serviceName, skipClients = new Set() }) {
  if (!autofillEnabled()) return { offered: 0, skipped: 0, reason: 'off' };

  const limit = Math.max(1, Number(getSetting('waitlist_max_offers', '5')) || 5);
  const channel = ['email', 'sms', 'both'].includes(getSetting('waitlist_channel', 'email'))
    ? getSetting('waitlist_channel', 'email') : 'email';

  const matches = matchesFor({ date, staffId, serviceId, limit });
  if (!matches.length) return { offered: 0, skipped: 0, reason: 'nobody waiting for that' };

  const copy = copyFor({ date, startMin, serviceName });
  const ins = insMessage();
  const now = localStamp();
  const mark = db.prepare("UPDATE waitlist SET status = 'offered', offered_at = ? WHERE id = ?");
  let offered = 0, skipped = 0;

  for (const w of matches) {
    // The same cooldown every other campaign obeys. Someone who got a rebooking
    // nudge this morning does not also get this.
    if (skipClients.has(w.client_id)) { skipped++; continue; }

    const text = copy.body.replaceAll('{first_name}', w.first_name || 'there');
    const wants = [];
    if (channel !== 'sms' && (w.email || '').trim()) wants.push(['email', w.email.trim()]);
    if (channel !== 'email' && (w.phone || '').trim()) wants.push(['sms', w.phone.trim()]);
    if (!wants.length) { skipped++; continue; }

    for (const [ch, to] of wants) ins.run(w.client_id, ch, to, copy.subject, text, now);
    // Marked offered rather than removed: they are still waiting until they
    // actually book, and an owner looking at the list should be able to see
    // that this one has already been told about something.
    mark.run(now, w.id);
    offered++;
    skipClients.add(w.client_id);
  }
  return { offered, skipped, reason: '' };
}

/** Everything on the list, for the owner's screen. */
export function listWaitlist() {
  return db.prepare(
    `SELECT w.*, c.first_name, c.last_name, c.email, c.phone,
            sv.name AS service_name, s.name AS staff_name
     FROM waitlist w
     JOIN clients c ON c.id = w.client_id
     LEFT JOIN services sv ON sv.id = w.service_id
     LEFT JOIN staff s ON s.id = w.staff_id
     WHERE w.status IN ('waiting', 'offered')
     ORDER BY CASE w.status WHEN 'waiting' THEN 0 ELSE 1 END, w.created_at`
  ).all();
}

export function addToWaitlist({ clientId, serviceId = null, staffId = null, weekdays = '', fromDate = '', untilDate = '', note = '' }) {
  const days = [...parseDays(weekdays)].sort().join(',');
  const info = db.prepare(
    `INSERT INTO waitlist (client_id, service_id, staff_id, weekdays, from_date, until_date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(clientId, serviceId || null, staffId || null, days, fromDate || '', untilDate || '', String(note || '').slice(0, 300));
  return Number(info.lastInsertRowid);
}

export function removeFromWaitlist(id) {
  return db.prepare("UPDATE waitlist SET status = 'removed' WHERE id = ?").run(id).changes > 0;
}

/** How the automation has actually been doing, for the Settings panel. */
export function waitlistStats() {
  const waiting = db.prepare("SELECT COUNT(*) AS n FROM waitlist WHERE status = 'waiting'").get().n;
  const offered = db.prepare("SELECT COUNT(*) AS n FROM waitlist WHERE status = 'offered'").get().n;
  const sent = db.prepare(
    "SELECT COUNT(*) AS n FROM messages WHERE kind = 'waitlist_offer' AND created_at >= datetime('now','-30 days')"
  ).get().n;
  return { waiting, offered, offers_sent_30d: sent };
}
