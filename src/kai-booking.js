// "Book Sarah in for a cut on Friday at 2."
//
// This is the one thing Kai gets asked for most and the one thing it must not
// do on its own. Every other capability writes a setting: reversible, internal,
// and undoable by one word. A booking is not that. It puts a real person in a
// real chair and sends them a confirmation, and there is no undo for a text
// message that has already arrived on somebody's phone.
//
// So Kai does not book. It PREPARES. It reads the sentence, finds the client,
// the service, the day and the time, and hands the owner the booking form with
// every field already filled in and a Book button. One press away, nothing
// sent, everything still editable — including the parts Kai got wrong, which
// are visible in the form rather than hidden behind a promise.
//
// That is not a compromise, it is the right shape. The value in "book Sarah in
// for a cut on Friday at 2" is not the click at the end; it is the four fields
// you did not have to find, and the day you did not have to scroll to.
//
// The rules it holds to:
//
//   1. IT NEVER CREATES ANYTHING. Everything here returns a URL.
//   2. IT NEVER GUESSES A PERSON. Two Sarahs on the book means Kai asks which,
//      because turning up to the wrong Sarah's appointment is a real morning
//      lost and no undo repairs it.
//   3. IT SAYS WHAT IT FILLED IN, in words, before the owner presses anything.
//   4. IT SAYS WHAT IS WRONG WITH IT — closed that day, outside opening hours,
//      or somebody already in that slot — rather than letting them find out.
import crypto from 'node:crypto';
import { db, getSetting } from './db.js';
import { parseDayRules } from '../public/js/hours.js';
import {
  normalise, readDate, dateLabel, readClock, clockLabel, DAY_NAMES,
} from './kai-language.js';

/**
 * The sentence has to be asking for a booking, not asking about bookings.
 *
 * "Turn off online booking", "stop online booking after 3 no-shows" and "let
 * people book up to 60 days ahead" are settings, and they all contain the word.
 * Every one of them is excluded by name rather than by hoping the scoring sorts
 * it out, because a settings change misread as a booking would open a form over
 * the top of what the owner actually asked for.
 */
const BOOKS = new RegExp([
  /\b(book|books|booking|pencil|penciled|pencilled|squeeze|schedule)\b/.source,
  // "Put Bianca down for a colour", "get her in on Friday". The verb is split
  // around the name, which is how most people actually say it — and "put" on
  // its own belongs to the settings toggles ("put booking back on"), so the
  // shape has to include the "in"/"down" that makes it about a person.
  /\b(put|get|pop|slot|fit)\s+\w+\s+(in|down)\b/.source,
].join('|'));
const NOT_A_BOOKING = /\b(online booking|bookings?\s+(on|off)|book\s+(up\s+)?to|days ahead|in advance|noshow|horizon|booking page|booking link)\b/;
/** What makes it about a PERSON rather than a policy. */
const FOR_SOMEBODY = /\b(in for|for a|for an|down for|appointment)\b/;

const clean = (s) => String(s || '').trim();

/**
 * The client a sentence is talking about.
 *
 * Returns every plausible match rather than the best one. A salon with two
 * Sarahs is not an edge case — it is Tuesday — and picking one of them is the
 * single worst thing this file could do.
 *
 * A full name beats a first name, so "Sarah Wilson" is unambiguous even when
 * there is also a Sarah Jones. Only when the sentence gives a bare first name
 * shared by two people does Kai stop and ask.
 */
function matchClients(raw) {
  const rows = db.prepare(
    'SELECT id, first_name, last_name, phone, email, notes FROM clients'
  ).all();
  const hay = ` ${raw} `;
  const full = [];
  const first = [];
  for (const c of rows) {
    const whole = normalise(`${c.first_name || ''} ${c.last_name || ''}`);
    const one = normalise(c.first_name || '');
    // Two letters is not a name, it is a coincidence waiting to happen.
    if (whole.includes(' ') && whole.length > 3 && hay.includes(` ${whole} `)) full.push(c);
    else if (one.length > 2 && hay.includes(` ${one} `)) first.push(c);
  }
  if (full.length) return full;
  return first;
}

/** The service a sentence is talking about, longest name first. */
function matchServices(raw) {
  const rows = db.prepare(
    'SELECT id, name, price_cents, duration_min FROM services WHERE active = 1'
  ).all();
  const hay = ` ${raw} `;
  return rows
    .map((s) => ({ ...s, norm: normalise(s.name) }))
    .filter((s) => s.norm && hay.includes(` ${s.norm} `))
    .sort((a, b) => b.norm.length - a.norm.length);
}

/** A team member named outright — "book Sarah in with Jess". */
function matchStaff(raw) {
  const rows = db.prepare('SELECT id, name FROM staff WHERE active = 1').all();
  const hay = ` ${raw} `;
  return rows
    .map((s) => ({ ...s, norm: normalise(s.name) }))
    .filter((s) => s.norm.length > 2 && hay.includes(` ${s.norm} `));
}

/**
 * The team, in the order the booking form shows it.
 *
 * `ORDER BY id` is not decoration: /api/staff hands the browser the same order,
 * and the form selects the first one when no team member is chosen. Kai has to
 * agree with the form about who the booking is against, or it warns about a
 * diary the owner is not looking at.
 */
function activeStaff() {
  try {
    return db.prepare('SELECT id, name FROM staff WHERE active = 1 ORDER BY id').all();
  } catch {
    return [];
  }
}

const fullName = (c) => `${clean(c.first_name)} ${clean(c.last_name)}`.trim() || 'that client';

/** What the salon does on one day, so a prepared booking can warn about it. */
function tradingOn(date) {
  const open = String(getSetting('open_days', '0,1,2,3,4,5,6'))
    .split(',').map((d) => Number(String(d).trim()))
    .filter((d) => Number.isInteger(d));
  const dow = new Date(`${date}T12:00:00`).getDay();
  if (!open.includes(dow)) return { shut: true, dow };
  const rules = parseDayRules(getSetting('day_rules', '{}'));
  const rule = rules[dow];
  return {
    shut: false,
    dow,
    open_min: rule?.open_min ?? Number(getSetting('open_min', '480')),
    close_min: rule?.close_min ?? Number(getSetting('close_min', '1200')),
  };
}

/**
 * Anybody already in that slot, so the owner is told before they press Book.
 *
 * Always about ONE diary. A salon with three chairs nearly always has somebody
 * in a chair, so a check across the whole shop fires on almost every booking —
 * and the client it names belongs to a different stylist, which reads as though
 * THEY are the person being booked. Without a staff id there is nothing
 * meaningful to answer, so it answers nothing.
 */
function clashesAt(date, startMin, endMin, staffId) {
  if (!staffId) return [];
  try {
    const rows = db.prepare(
      `SELECT a.start_min, a.end_min, a.staff_id, c.first_name, c.last_name
         FROM appointments a LEFT JOIN clients c ON c.id = a.client_id
        WHERE a.date = ? AND a.staff_id = ? AND a.status NOT IN ('cancelled', 'no_show')`
    ).all(date, staffId);
    return rows.filter((r) => r.start_min < endMin && r.end_min > startMin);
  } catch {
    return [];
  }
}

/**
 * A booking, filled in but not made.
 *
 * Returns plan-shaped objects so the caller can treat them like anything else
 * Kai does — a title, a sentence, and, instead of settings to write, a URL that
 * opens the form. More than one comes back only when the person is ambiguous,
 * and `decide` turns that into a question rather than a coin toss.
 */
export function readBooking(text, { today }) {
  const raw = normalise(text);
  if (!raw || !BOOKS.test(raw) || NOT_A_BOOKING.test(raw)) return [];

  const people = matchClients(raw);
  if (!people.length && !FOR_SOMEBODY.test(raw)) return [];

  const services = matchServices(raw);
  const staff = matchStaff(raw);
  const date = readDate(text, today);
  // The time, read from whatever is left after the date has taken its share.
  // "Friday at 2" is a day and a time; "the 15th" is only a day, and reading
  // fifteen as a quarter past midnight would be worse than reading nothing.
  const withoutDate = raw.replace(/\b\d{1,2}(st|nd|rd|th)\b/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
  const atTime = /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/.exec(withoutDate);
  const start = atTime ? readClock(atTime[1]) : (/\b\d/.test(withoutDate) ? readClock(withoutDate) : null);

  // Nothing to prepare from: no person, no service, no day, no time.
  if (!people.length && !services.length && !date && start === null) return [];

  const svc = services[0] || null;
  const team = activeStaff();
  // Who the booking is against. Named outright if the sentence named somebody;
  // otherwise the one the form itself will pick, because that is the diary the
  // owner is about to book into whether Kai mentions it or not. Kai then writes
  // that choice into the link, so the form and the warning can never disagree.
  const who = staff[0] || team[0] || null;
  const day = date || today;
  const mins = svc?.duration_min || 60;
  const trading = tradingOn(day);

  const warnFor = (client) => {
    const out = [];
    if (trading.shut) out.push(`You're closed on ${DAY_NAMES[trading.dow]}s — booking this would be an extra day.`);
    else if (start !== null && (start < trading.open_min || start + mins > trading.close_min)) {
      out.push(`That's outside ${DAY_NAMES[trading.dow]}'s hours (${clockLabel(trading.open_min)}–${clockLabel(trading.close_min)}).`);
    }
    if (start !== null && who) {
      const clash = clashesAt(day, start, start + mins, who.id);
      if (clash.length) {
        const names = clash.map((c) => `${clean(c.first_name)} ${clean(c.last_name)}`.trim() || 'someone')
          .slice(0, 2).join(' and ');
        // Whose diary, by name. "Grace Owusu is already booked at that time"
        // does not say whether Grace is the person being booked or the person
        // in the way, and those are opposite problems.
        const free = team
          .filter((s) => s.id !== who.id && !clashesAt(day, start, start + mins, s.id).length)
          .map((s) => clean(s.name)).filter(Boolean).slice(0, 2);
        out.push(`${clean(who.name) || 'That team member'} already has ${names} at that time.${
          free.length ? ` ${free.join(' and ')} ${free.length === 1 ? 'is' : 'are'} free.` : ''}`);
      }
    }
    if (!svc) out.push("I couldn't tell which service, so pick one before you book.");
    if (!client) {
      const heard = unnamed(raw);
      // Naming the name back matters. "I couldn't find that name" leaves the
      // owner wondering which name Kai thought it heard, which is the one thing
      // they need to know to fix it.
      out.push(heard
        ? `I couldn't find ${heard} on your books — add them in the form, or pick somebody else.`
        : 'No client named, so pick one or add them in the form.');
    }
    if (start === null) out.push('No time was named, so check the start before you book.');
    return out;
  };

  const build = (client) => {
    const bits = [
      client ? fullName(client) : (unnamed(raw) || 'a new client'),
      svc ? svc.name : null,
      start !== null ? clockLabel(start) : null,
    ].filter(Boolean);
    const when = dateLabel(day, today);
    const params = new URLSearchParams({ date: day, new: '1' });
    if (client) params.set('client', String(client.id));
    else if (unnamed(raw)) params.set('name', unnamed(raw));
    if (svc) params.set('service', String(svc.id));
    if (who) params.set('staff', String(who.id));
    if (start !== null) params.set('start', String(start));

    return {
      id: `book_${client ? client.id : 'new'}_${day}_${start ?? 'x'}`,
      kind: 'prepare',
      title: `Book ${bits.join(' · ')} — ${when}`,
      // Says what it filled in and, plainly, that nothing has happened yet. The
      // owner is about to press a button that texts somebody.
      said: `I've filled it in — ${bits.join(', ')}, ${when}. Check it and press Book.`,
      short: `Booking form ready — ${bits.join(', ')}, ${when}.`,
      detail: 'Nothing is booked until you press Book. Everything is still editable.',
      href: `#/calendar?${params.toString()}`,
      date: day,
      changes: [],
      warnings: warnFor(client),
      score: 97,
      fingerprint: crypto.createHash('sha256')
        .update(JSON.stringify(['prepare', client?.id || 0, svc?.id || 0, day, start, who?.id || 0]))
        .digest('hex').slice(0, 16),
    };
  };

  if (!people.length) return [build(null)];
  // One plan per candidate. Identical scores, so `decide` asks rather than
  // picking — see rule 2 at the top of this file.
  return people.slice(0, 3).map(build);
}

/**
 * The name in a sentence that matched nobody on the book.
 *
 * "Book Jodie in for a cut on Friday" with no Jodie on file should still get
 * the owner to a form with "Jodie" typed in, rather than an empty one they have
 * to fill from memory. Taken as the word after the booking verb, and only when
 * it looks like a name rather than a piece of the sentence's grammar.
 */
const NOT_A_NAME = new Set([
  'in', 'a', 'an', 'the', 'me', 'us', 'them', 'him', 'her', 'someone', 'somebody',
  'him', 'it', 'for', 'on', 'at', 'and', 'with', 'this', 'that', 'my', 'our',
  'new', 'client', 'customer', 'walk', 'walkin', 'appointment', 'up', 'down', 'out',
]);

function unnamed(raw) {
  const m = /\b(?:book|pencil|squeeze|fit|schedule)\s+(?:in\s+)?([a-z]+)/.exec(raw)
    || /\b(?:put|get|pop|slot)\s+([a-z]+)\s+(?:in|down)\b/.exec(raw);
  const word = m?.[1];
  if (!word || word.length < 3 || NOT_A_NAME.has(word)) return '';
  return word.charAt(0).toUpperCase() + word.slice(1);
}
