// The things Kai can change, and the undo underneath all of them.
//
// The first version of this proposed a change and waited for a press. That was
// the wrong shape, and the owner said so plainly: what he wants is to say
// "change Sunday from 11 to 4 to 2 to 6" and have it BE two to six, told back to
// him, hands free. A card that needs a button is a form with extra steps.
//
// So the safety model moved rather than disappeared. It used to be
// CONFIRM-BEFORE. It is now DO-THEN-UNDO, and for this kind of change that is
// the stronger of the two:
//
//   - Confirm-before protects you from a misreading you notice IN ADVANCE, on a
//     card you may well skim. It costs a press on every correct change, which is
//     most of them, and it cannot be done hands-free at all.
//   - Do-then-undo shows you the result — "Sunday is now 2pm–6pm" — which is
//     the moment a misreading is actually obvious, and puts it back with one
//     word. Nothing here is irreversible, so there is nothing a press protects
//     that an undo does not.
//
// The line that has NOT moved, and must not:
//
//   1. EVERY CHANGE IS REVERSIBLE, EXACTLY. Each plan records the prior value of
//      precisely the keys it writes — not a blob of everything — so undo puts
//      those back and touches nothing somebody else changed meanwhile.
//   2. KAI NEVER ACTS ON A GUESS. Where two readings are close, it asks which
//      rather than picking. See `decide`.
//   3. A QUESTION IS NEVER A COMMAND. "What time do we close on Friday" changes
//      nothing.
//   4. NOTHING THAT REACHES A CLIENT HAPPENS HERE. Settings are reversible;
//      a text message to four hundred people is not. Anything that sends or
//      deletes is refused with a pointer to the screen that does it.
//   5. IT SAYS WHAT IT DID, IN THE OWNER'S WORDS. `said` is the sentence read
//      back. If that sentence is wrong, the owner knows instantly — which is
//      the whole reason acting immediately is safe.
import crypto from 'node:crypto';
import { db, getSetting, setSetting } from './db.js';
import { parseDayRules } from '../public/js/hours.js';
import {
  DAY_NAMES, listDays, readWeekdays, readTimeRanges, tokenise, normalise,
  clockLabel, readNumbers, readMoney, readDuration, splitClauses, readClock,
} from './kai-language.js';
import { VIEWING } from './kai-nav.js';

/**
 * Sentences that are asking, not instructing.
 *
 * Now that Kai acts rather than proposes, this is the difference between
 * answering a question and doing something nobody asked for.
 */
const ASKING = /^(what|when|who|whom|why|where|which|whats|hows|do|does|did|are|is|was|were|am|will|have|has|had|can|could|should|show|tell|list)\b/;

/**
 * "Don't let clients cancel online" is an instruction that opens with "do".
 *
 * A leading negation is never a question — nobody asks "do not we open on
 * Sunday" — so it is exempted before the guard above sees it. Without this,
 * the whole family of "don't", "never" and "stop" sentences was silently
 * refused for starting with the wrong word.
 */
const NEGATED_ORDER = /^(do not|dont|does not|never|no longer)\b/;

/**
 * "Can you please close Mondays" is an instruction wearing a question mark.
 *
 * Half the sentences an owner says to an assistant start this way, and reading
 * them as questions meant Kai politely did nothing to the politest requests it
 * got. The opener is stripped before deciding, so what is left — "close
 * Mondays" — is judged on its own. "Can people book on a Sunday" keeps its
 * "can" and stays a question, because nothing was stripped.
 */
const POLITE = /^(?:please\s+)?(?:can|could|would)\s+(?:you|we)\s+(?:please\s+)?/;

const csvDays = (v) => String(v || '')
  .split(',').map((d) => Number(String(d).trim()))
  .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  .sort((a, b) => a - b);

const uniqueSorted = (arr) => [...new Set(arr)].sort((a, b) => a - b);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * "By text", "over email", "as an SMS" — a choice of pipe, not a switch.
 *
 * Every message type has both a switch and a channel, and they answer to
 * overlapping words. "Send reminders by text" said to the switch turns on
 * something already on and quietly changes nothing anybody asked for, so each
 * switch stands down when one of these appears and the channel takes it.
 */
const CHANNEL = /\b(?:by|via|over|through|using|as)\s+(?:an?\s+)?(?:email|e mail|sms|text|texts|txt|message|both)\b|\bemail\s+and\s+(?:text|sms)\b|\b(?:text|sms)\s+and\s+email\b/;

function readChannel(raw) {
  if (!CHANNEL.test(raw)) return null;
  const wantsSms = /\b(sms|text|texts|txt)\b/.test(raw);
  const wantsEmail = /\b(email|e mail)\b/.test(raw);
  if (/\bboth\b/.test(raw) || (wantsSms && wantsEmail)) return 'both';
  if (wantsSms) return 'sms';
  if (wantsEmail) return 'email';
  return null;
}

/**
 * The booking page's colour scheme, named the way somebody would say it.
 *
 * These are the eight palettes in public/js/schemes.js. Colour words map to the
 * scheme that IS that colour rather than to an accent, because an owner who
 * says "make my booking page cream" means the whole page, and the accent alone
 * would leave it black.
 */
const SCHEME_LABELS = {
  midnight: 'Midnight', noir: 'Noir', ocean: 'Deep Ocean', mocha: 'Mocha',
  daylight: 'Daylight', cream: 'Cream', blush: 'Blush', sage: 'Sage',
};
const SCHEME_WORDS = [
  [/\b(midnight|navy|default)\b/, 'midnight'],
  [/\b(noir|black|charcoal|monochrome)\b/, 'noir'],
  [/\b(ocean|deep ocean|teal|sea)\b/, 'ocean'],
  [/\b(mocha|brown|coffee|chocolate)\b/, 'mocha'],
  [/\b(daylight|light|white|bright)\b/, 'daylight'],
  [/\b(cream|beige|ivory|warm)\b/, 'cream'],
  [/\b(blush|pink|rose)\b/, 'blush'],
  [/\b(sage|green|olive)\b/, 'sage'],
];

function readScheme(raw) {
  // Only when the sentence is about the page they see. "Turn the light off" is
  // not a request for the Daylight palette.
  if (!/\b(booking page|page|theme|scheme|colour|color|palette|look|style|branding|brand)\b/.test(raw)) return null;
  return SCHEME_WORDS.find(([re]) => re.test(raw))?.[1] || null;
}
const money = (cents) => `${getSetting('currency', '$')}${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
const onOff = (v) => (v === '1' ? 'on' : 'off');
/** "1 day", "2 days" — a unit rounded to days should not read like a bug. */
const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** The hours settings as they stand. */
function currentHours() {
  return {
    open_days: csvDays(getSetting('open_days', '0,1,2,3,4,5,6')),
    open_min: Number(getSetting('open_min', '480')) || 480,
    close_min: Number(getSetting('close_min', '1200')) || 1200,
    rules: parseDayRules(getSetting('day_rules', '{}')),
  };
}

/** What one weekday currently does, in words. */
function describeDay(dow, cur) {
  if (!cur.open_days.includes(dow)) return 'closed';
  const rule = cur.rules[dow];
  const open = rule?.open_min ?? cur.open_min;
  const close = rule?.close_min ?? cur.close_min;
  const cadence = rule?.every_weeks > 1
    ? ` (every ${rule.every_weeks === 2 ? '2nd' : rule.every_weeks === 3 ? '3rd' : '4th'} week)` : '';
  return `${clockLabel(open)}–${clockLabel(close)}${cadence}`;
}

/**
 * Write hours for a set of days.
 *
 * When the days being given hours are every day the salon opens and they all
 * get the same times, that is simply the salon's trading day — so it writes
 * those and clears per-day overrides rather than leaving seven identical rules.
 * Alternating-week rules are preserved: somebody who opens every second Sunday
 * and changes Sunday's hours still opens every second Sunday.
 */
function applyHours(next, days, times) {
  const everyOpenDay = days.length && next.open_days.every((d) => days.includes(d))
    && days.every((d) => next.open_days.includes(d));
  if (everyOpenDay) {
    next.open_min = times.open_min;
    next.close_min = times.close_min;
    for (const d of days) {
      const rule = next.rules[d];
      if (!rule) continue;
      delete rule.open_min;
      delete rule.close_min;
      if (!(rule.every_weeks > 1)) delete next.rules[d];
    }
    return;
  }
  for (const d of days) {
    const rule = next.rules[d] || { every_weeks: 1 };
    rule.open_min = times.open_min;
    rule.close_min = times.close_min;
    next.rules[d] = rule;
  }
}

const hoursPayload = (next) => ({
  open_days: next.open_days.join(','),
  open_min: String(next.open_min),
  close_min: String(next.close_min),
  day_rules: JSON.stringify(next.rules),
});

/**
 * Appointments already booked that a change would sit awkwardly with.
 *
 * Kairo never cancels anything on its own, so these stay — but an owner closing
 * Mondays with four Mondays booked has to be told, and told that they are safe.
 */
function futureAppointments(today) {
  return db.prepare(
    `SELECT date, start_min, end_min FROM appointments
      WHERE date >= ? AND status NOT IN ('cancelled', 'no_show', 'completed')`
  ).all(today).map((r) => ({ ...r, dow: new Date(`${r.date}T12:00:00`).getDay() }));
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------
//
// Each capability reads the sentence and returns a plan, or nothing. A plan is
// inert — it describes a change and records the exact prior values of the keys
// it would write. Nothing below touches the database.

/**
 * Sentences Kai understood but had nothing to do about.
 *
 * "Close Mondays" when Monday is already closed is not a sentence Kai failed to
 * understand — it understood perfectly and there was nothing to change. Saying
 * "I couldn't work out what to change there" sends the owner off to find another
 * way to phrase something that was right the first time. Filled by `makePlan`
 * during a read and drained by `readActions`, which is safe because a read is
 * wholly synchronous.
 */
let noops = [];
const noop = (said) => { noops.push(said); return null; };

/** Build a plan, dropping it when it would change nothing. */
function makePlan(o) {
  const before = {};
  for (const k of Object.keys(o.settings)) before[k] = getSetting(k, '');
  const same = Object.keys(o.settings).every((k) => String(before[k]) === String(o.settings[k]));
  if (same) return noop(o.already || `${o.title} — that is already how it is.`);
  const plan = {
    id: o.id,
    title: o.title,
    said: o.said,
    short: o.short || o.said,
    detail: o.detail || '',
    changes: o.changes || [],
    warnings: o.warnings || [],
    settings: o.settings,
    before,
    score: o.score,
  };
  plan.fingerprint = crypto.createHash('sha256')
    .update(JSON.stringify([plan.id, plan.before, plan.settings]))
    .digest('hex').slice(0, 16);
  return plan;
}

/** A capability that flips one setting between two states. */
function toggle({ id, key, on, off, label, score = 90 }) {
  return (ctx) => {
    // A negation settles it before the two patterns fight. "Don't let clients
    // cancel online" contains "let", which is an on-word, and matched both
    // sides — so Kai read a plain instruction as self-contradictory and did
    // nothing at all with it.
    const negated = /\b(do not|does not|dont|doesnt|never|no longer|stop)\b/.test(ctx.raw);
    const wantsOn = !negated && on.test(ctx.raw);
    const wantsOff = negated ? off.test(ctx.raw) || on.test(ctx.raw) : off.test(ctx.raw);
    if (wantsOn === wantsOff) return null; // neither, or contradictory
    const value = wantsOn ? '1' : '0';
    return makePlan({
      id,
      title: `${label}: ${wantsOn ? 'on' : 'off'}`,
      said: `${label} is ${wantsOn ? 'on' : 'off'} now.`,
      already: `${label} is already ${wantsOn ? 'on' : 'off'}.`,
      changes: [{ label, from: onOff(getSetting(key, '0')), to: wantsOn ? 'on' : 'off' }],
      settings: { [key]: value },
      score,
    });
  };
}

/** A capability that sets one number, read from the sentence. */
function number({ id, key, label, read, format, min, max, score = 88, said }) {
  return (ctx) => {
    const raw = read(ctx);
    if (raw === null || raw === undefined) return null;
    const value = clamp(Math.round(raw), min, max);
    const from = Number(getSetting(key, '0')) || 0;
    return makePlan({
      id,
      title: `${label}: ${format(value)}`,
      said: said ? said(value) : `${label} is ${format(value)} now.`,
      already: `${label} is already ${format(value)}.`,
      changes: [{ label, from: format(from), to: format(value) }],
      settings: { [key]: String(value) },
      score,
    });
  };
}

const CAPABILITIES = [
  // ── Opening days and hours ───────────────────────────────────────────────
  function hours(ctx) {
    const { days, times, cur, today } = ctx;
    // "Open my calendar on Saturday" and "open on Saturday" differ by one word
    // and mean opposite things. Naming a surface you look at — calendar, diary,
    // schedule — means looking, so the hours reading stands down and navigation
    // takes it. Getting this backwards changes what a salon trades on because
    // somebody wanted to see a day, which is the worse of the two mistakes by a
    // wide margin.
    if (VIEWING.test(ctx.raw)) return [];
    const has = (k) => ctx.keys.includes(k);
    const wantsClose = has('close') || has('remove');
    const wantsAdd = has('add');
    const wantsChange = has('change');
    const mentionsOpen = has('open');
    const mentionsHours = has('hours');
    // The most destructive thing here — it closes every day not named — so it
    // needs a signal that is hard to trip over: the phrase "opening days", said
    // as a set, or the word "only". Neither is reachable from "change Friday to
    // an open day", which is a request to open ONE day.
    const replacesWeek = has('opendays') || has('only');
    const out = [];

    let diary = null;
    const booked = (dow, opts = {}) => {
      diary = diary || futureAppointments(today);
      return diary.filter((r) => r.dow === dow
        && (!opts.outside || r.start_min < opts.outside.open_min || r.end_min > opts.outside.close_min)).length;
    };

    if (!wantsClose && !wantsAdd && !mentionsOpen && !mentionsHours
        && !(wantsChange && (days.length || times)) && !(replacesWeek && days.length)) {
      return [];
    }

    if (wantsClose && days.length && !wantsAdd) {
      const closing = days.filter((d) => cur.open_days.includes(d));
      if (!closing.length) noop(`You're already closed on ${listDays(days)}.`);
      if (closing.length) {
        const next = { ...cur, open_days: cur.open_days.filter((d) => !days.includes(d)), rules: clone(cur.rules) };
        const n = closing.reduce((t, d) => t + booked(d), 0);
        out.push(makePlan({
          id: 'close_days',
          title: `Close on ${listDays(closing)}`,
          said: `Closed on ${listDays(closing)}. You're open ${next.open_days.length ? listDays(next.open_days) : 'no days at all'} now.`,
          // Said on its own, this plan recaps the whole trading week. In a
          // sentence that goes on to open a day, that recap is out of date by
          // the time it is spoken, so the compound path uses the short form.
          short: `Closed on ${listDays(closing)}.`,
          detail: next.open_days.length
            ? `Open ${listDays(next.open_days)}.`
            : 'That leaves you closed every day — the booking page will take nothing.',
          changes: closing.map((d) => ({ label: DAY_NAMES[d], from: describeDay(d, cur), to: 'closed' })),
          warnings: [
            ...(n ? [`${n} appointment${n === 1 ? ' is' : 's are'} already booked on ${closing.length === 1 ? `a ${DAY_NAMES[closing[0]]}` : 'those days'}. They stay in your diary — nothing was cancelled.`] : []),
            ...(next.open_days.length ? [] : ['Customers cannot book any day online now.']),
          ],
          settings: hoursPayload(next),
          score: 96,
        }));
      }
    }

    if (!wantsClose && days.length && (wantsAdd || mentionsOpen) && !(replacesWeek && !wantsAdd)) {
      const adding = days.filter((d) => !cur.open_days.includes(d));
      const next = { ...cur, open_days: uniqueSorted([...cur.open_days, ...days]), rules: clone(cur.rules) };
      if (times) applyHours(next, days, times);
      const span = times ? `${clockLabel(times.open_min)}–${clockLabel(times.close_min)}` : '';
      // Writing a per-day rule that says exactly what the salon already says is
      // not a change, however different the stored JSON looks. Asking for
      // Monday-to-Friday nine-to-five when that is already the week reported
      // "9am–5pm → 9am–5pm", which reads as a bug even though nothing broke.
      const moved = days.filter((d) => describeDay(d, cur) !== describeDay(d, next));
      if (!adding.length && !moved.length) {
        noop(`You're already open on ${listDays(days)}${span ? `, ${span}` : ''}.`);
      } else out.push(makePlan({
        id: 'open_days',
        title: adding.length ? `Open on ${listDays(adding)}${span ? `, ${span}` : ''}`
          : `${listDays(days)}: ${span || describeDay(days[0], next)}`,
        said: adding.length
          ? `You're open on ${listDays(adding)} now${span ? `, ${span}` : ''}.`
          : `${listDays(days)} is ${span || describeDay(days[0], next)} now.`,
        already: `You're already open on ${listDays(days)}${span ? `, ${span}` : ''}.`,
        detail: `Open ${listDays(next.open_days)}.`,
        changes: moved.map((d) => ({ label: DAY_NAMES[d], from: describeDay(d, cur), to: describeDay(d, next) })),
        settings: hoursPayload(next),
        score: 95,
      }));
    }

    if (days.length && replacesWeek && !wantsAdd && !wantsClose) {
      const next = { ...cur, open_days: [...days], rules: clone(cur.rules) };
      for (const d of Object.keys(next.rules)) if (!days.includes(Number(d))) delete next.rules[d];
      if (times) applyHours(next, days, times);
      const losing = cur.open_days.filter((d) => !days.includes(d));
      const n = losing.reduce((t, d) => t + booked(d), 0);
      out.push(makePlan({
        id: 'set_open_days',
        title: `Open ${listDays(days)} only${times ? `, ${clockLabel(times.open_min)}–${clockLabel(times.close_min)}` : ''}`,
        said: `You're open ${listDays(days)} only now${times ? `, ${clockLabel(times.open_min)}–${clockLabel(times.close_min)}` : ''}.`,
        already: `You're already open ${listDays(days)} only${times ? `, ${clockLabel(times.open_min)}–${clockLabel(times.close_min)}` : ''}.`,
        detail: losing.length ? `No longer open ${listDays(losing)}.` : 'Only the hours changed.',
        changes: [0, 1, 2, 3, 4, 5, 6]
          .filter((d) => describeDay(d, cur) !== describeDay(d, next))
          .map((d) => ({ label: DAY_NAMES[d], from: describeDay(d, cur), to: describeDay(d, next) })),
        warnings: n ? [`${n} appointment${n === 1 ? ' is' : 's are'} already booked on ${listDays(losing)}. They stay in your diary — nothing was cancelled.`] : [],
        settings: hoursPayload(next),
        score: 97,
      }));
    }

    if (times && (mentionsHours || mentionsOpen || wantsChange) && !wantsClose && !wantsAdd
        && !out.some((p) => p && (p.id === 'set_open_days' || p.id === 'open_days'))) {
      const target = days.length ? days : cur.open_days;
      // Naming a closed day and giving it hours means open it. Writing the rule
      // without opening the day left an invisible setting behind: the owner was
      // told Sunday was two till six and the booking page still said closed.
      const next = {
        ...cur,
        open_days: days.length ? uniqueSorted([...cur.open_days, ...days]) : cur.open_days,
        rules: clone(cur.rules),
      };
      applyHours(next, target, times);
      const n = target.reduce((t, d) => t + booked(d, { outside: times }), 0);
      const span = `${clockLabel(times.open_min)}–${clockLabel(times.close_min)}`;
      out.push(makePlan({
        id: 'set_hours',
        title: `${days.length ? listDays(days) : 'Every open day'}: ${span}`,
        said: days.length
          ? `${listDays(days)} is ${span} now.`
          : `You're open ${span} now, every day you trade.`,
        already: days.length
          ? `${listDays(days)} is already ${span}.`
          : `You're already open ${span} every day you trade.`,
        detail: days.length ? 'Your other days keep the hours they had.' : 'This is your usual trading day now.',
        changes: target
          .filter((d) => describeDay(d, cur) !== describeDay(d, next))
          .map((d) => ({ label: DAY_NAMES[d], from: describeDay(d, cur), to: describeDay(d, next) })),
        warnings: n ? [`${n} appointment${n === 1 ? ' falls' : 's fall'} outside the new hours. They stay booked — you'd be working around them.`] : [],
        settings: hoursPayload(next),
        score: 94,
      }));
    }

    return out.filter(Boolean);
  },

  // ── Online booking on or off ─────────────────────────────────────────────
  // Guarded against no-shows: "stop online booking after 3 no-shows" is a
  // no-show rule, not a request to shut the booking page. Both readings scored
  // close enough that Kai stopped and asked, which was right but unhelpful —
  // the phrase "after N no-shows" settles it.
  (ctx) => (/(booking|book online|online booking|bookings)/.test(ctx.raw) && !/noshow/.test(ctx.raw)
    ? toggle({
      id: 'booking_enabled',
      key: 'booking_enabled',
      label: 'Online booking',
      on: /\b(turn|switch|put)\s+(online\s+)?(booking|bookings)?\s*(back\s+)?on\b|\b(open|resume|enable|start)\s+(online\s+)?bookings?\b/,
      off: /\b(turn|switch|shut|put)\s+(online\s+)?(booking|bookings)?\s*off\b|\b(stop|pause|disable|close)\s+(taking\s+)?(online\s+)?bookings?\b/,
      score: 93,
    })(ctx) : null),

  // ── Waitlist ─────────────────────────────────────────────────────────────
  (ctx) => (/waitlist|wait list/.test(ctx.raw)
    ? toggle({
      id: 'waitlist_enabled',
      key: 'waitlist_enabled',
      label: 'The waitlist',
      on: /\b(turn|switch|put)\s+(the\s+)?(wait\s?list)?\s*(back\s+)?on\b|\b(enable|start|use)\s+(the\s+)?wait\s?list\b/,
      off: /\b(turn|switch|put)\s+(the\s+)?(wait\s?list)?\s*off\b|\b(disable|stop)\s+(the\s+)?wait\s?list\b/,
      score: 92,
    })(ctx) : null),

  // ── Reminders ────────────────────────────────────────────────────────────
  (ctx) => (/remind/.test(ctx.raw)
    ? toggle({
      id: 'reminders_enabled',
      key: 'reminders_enabled',
      label: 'Appointment reminders',
      on: /\b(turn|switch|put)\s+(reminders?)?\s*(back\s+)?on\b|\b(enable|start|send)\s+reminders?\b/,
      off: /\b(turn|switch|put|stop)\s+(sending\s+)?(reminders?)?\s*off\b|\b(disable|stop)\s+(sending\s+)?reminders?\b/,
      score: 91,
    })(ctx) : null),

  // How long before the appointment a reminder goes.
  (ctx) => (/remind/.test(ctx.raw) && !/(turn|switch|stop|disable|enable)/.test(ctx.raw)
    ? number({
      id: 'reminder_hours',
      key: 'reminder_hours',
      label: 'Reminders',
      read: (c) => {
        const d = readDuration(c.raw);
        if (d) return d / 60;
        const n = readNumbers(c.raw)[0];
        return n === undefined ? null : n;
      },
      format: (h) => (h >= 48 && h % 24 === 0 ? `${h / 24} days before` : `${h} hours before`),
      min: 1,
      max: 336,
      said: (h) => `Reminders go ${h >= 48 && h % 24 === 0 ? `${h / 24} days` : `${h} hours`} before the appointment now.`,
      score: 92,
    })(ctx) : null),

  // ── How far ahead people can book ────────────────────────────────────────
  (ctx) => (/(ahead|in advance|horizon|far.*book|book.*far)/.test(ctx.raw)
    ? number({
      id: 'booking_horizon_days',
      key: 'booking_horizon_days',
      label: 'Customers can book',
      read: (c) => readNumbers(c.raw)[0] ?? null,
      format: (d) => `${d} days ahead`,
      min: 1,
      max: 365,
      said: (d) => `Customers can book up to ${d} days ahead now.`,
      score: 90,
    })(ctx) : null),

  // ── Minimum notice ───────────────────────────────────────────────────────
  (ctx) => (/(notice|last minute|lead time|minimum)/.test(ctx.raw)
    ? number({
      id: 'booking_lead_min',
      key: 'booking_lead_min',
      label: 'Minimum notice',
      read: (c) => readDuration(c.raw) ?? (readNumbers(c.raw)[0] ?? null) * 60,
      format: (m) => (m === 0 ? 'none' : m % 60 === 0 ? `${m / 60} hours` : `${m} minutes`),
      min: 0,
      max: 20160,
      said: (m) => `Customers need ${m === 0 ? 'no notice' : m % 60 === 0 ? `${m / 60} hours' notice` : `${m} minutes' notice`} to book online now.`,
      score: 90,
    })(ctx) : null),

  // ── Cancellation window ──────────────────────────────────────────────────
  (ctx) => (/cancel/.test(ctx.raw)
    ? number({
      id: 'cancel_window_hours',
      key: 'cancel_window_hours',
      label: 'Clients can cancel up to',
      read: (c) => {
        const d = readDuration(c.raw);
        if (d) return d / 60;
        const n = readNumbers(c.raw)[0];
        return n === undefined ? null : n;
      },
      format: (h) => `${h} hours before`,
      min: 0,
      max: 720,
      said: (h) => `Clients can cancel online up to ${h} hours before their appointment now.`,
      score: 91,
    })(ctx) : null),

  // ── Slot spacing ─────────────────────────────────────────────────────────
  (ctx) => (/(slot|interval|spacing|increments?)/.test(ctx.raw)
    ? number({
      id: 'slot_interval',
      key: 'slot_interval',
      label: 'Booking slots every',
      read: (c) => readDuration(c.raw) ?? (readNumbers(c.raw)[0] ?? null),
      format: (m) => `${m} minutes`,
      min: 5,
      max: 120,
      said: (m) => `Booking slots are every ${m} minutes now.`,
      score: 90,
    })(ctx) : null),

  // ── No-show rules ────────────────────────────────────────────────────────
  (ctx) => {
    if (!/noshow/.test(ctx.raw)) return null;
    const n = readNumbers(ctx.raw)[0];
    if (n === undefined) return null;
    const blocking = /(block|stop|ban|refuse|bar)/.test(ctx.raw);
    const key = blocking ? 'noshow_block_after' : 'noshow_deposit_after';
    const label = blocking ? 'Stop online booking after' : 'Ask for a deposit after';
    const v = clamp(Math.round(n), 0, 10);
    return makePlan({
      id: key,
      title: `${label} ${v} no-shows`,
      said: v === 0
        ? `${blocking ? 'Nobody is blocked' : 'Nobody is asked for a deposit'} for no-shows now.`
        : `${blocking ? 'Online booking stops' : 'A deposit is asked for'} after ${v} no-show${v === 1 ? '' : 's'} now.`,
      changes: [{ label, from: `${getSetting(key, '0')} no-shows`, to: `${v} no-shows` }],
      warnings: !blocking && v > 0 && getSetting('stripe_secret_key', '') === ''
        ? ['Deposits need Stripe set up in Settings → Payments. Until then this rule has nothing to charge.'] : [],
      settings: { [key]: String(v) },
      score: 93,
    });
  },

  // ── A deposit on anything over an amount ─────────────────────────────────
  (ctx) => {
    if (!/deposit/.test(ctx.raw)) return null;
    // "Over" is what makes this a threshold. Without it, "take a $50 deposit"
    // reads as both the deposit amount and the size of booking that triggers
    // one, and Kai stops to ask about a sentence with only one meaning.
    if (!/\b(over|above|more than|greater than|bigger than|from)\b/.test(ctx.raw)) return null;
    const cents = readMoney(ctx.raw);
    if (cents === null) return null;
    return makePlan({
      id: 'deposit_over_cents',
      title: `Deposit on bookings over ${money(cents)}`,
      said: cents === 0
        ? 'No automatic deposit on big bookings now.'
        : `A deposit is taken on anything over ${money(cents)} now.`,
      changes: [{
        label: 'Deposit on bookings over',
        from: money(Number(getSetting('deposit_over_cents', '0')) || 0),
        to: money(cents),
      }],
      settings: { deposit_over_cents: String(cents) },
      score: 92,
    });
  },

  // ── The messages that go out, one by one ─────────────────────────────────
  //
  // Each of these is a message type an owner turns on or off in Settings →
  // Notifications. Guarded by its own subject word so "stop sending receipts"
  // cannot reach the reminder switch, and each stands down when the sentence is
  // about the CHANNEL rather than the switch — "send receipts by text" is a
  // choice of pipe, not a request to turn receipts on.
  (ctx) => (/(confirmation|confirmations)/.test(ctx.raw) && !CHANNEL.test(ctx.raw)
    ? toggle({
      id: 'confirm_enabled',
      key: 'confirm_enabled',
      label: 'Booking confirmations',
      on: /\b(turn|switch|put)\s+.{0,24}(back\s+)?on\b|\b(enable|start|send)\b/,
      off: /\b(turn|switch|put|stop)\s+.{0,24}off\b|\b(disable|stop)\b/,
      score: 91,
    })(ctx) : null),

  (ctx) => (/receipt/.test(ctx.raw) && !CHANNEL.test(ctx.raw)
    ? toggle({
      id: 'receipts_enabled',
      key: 'receipts_enabled',
      label: 'Receipts',
      on: /\b(turn|switch|put)\s+.{0,24}(back\s+)?on\b|\b(enable|start|send)\b/,
      off: /\b(turn|switch|put|stop)\s+.{0,24}off\b|\b(disable|stop)\b/,
      score: 91,
    })(ctx) : null),

  (ctx) => (/review/.test(ctx.raw) && !CHANNEL.test(ctx.raw) && !/\bhours?\b|\bdays?\b/.test(ctx.raw)
    ? toggle({
      id: 'review_requests_enabled',
      key: 'review_requests_enabled',
      label: 'Review requests',
      on: /\b(turn|switch|put)\s+.{0,24}(back\s+)?on\b|\b(enable|start|send|ask)\b/,
      off: /\b(turn|switch|put|stop)\s+.{0,24}off\b|\b(disable|stop)\b/,
      score: 91,
    })(ctx) : null),

  // How long after a visit the review request goes.
  (ctx) => (/review/.test(ctx.raw) && /\b(hours?|days?|later|after)\b/.test(ctx.raw)
    ? number({
      id: 'review_delay_hours',
      key: 'review_delay_hours',
      label: 'Review requests go',
      read: (c) => { const d = readDuration(c.raw); return d === null ? null : d / 60; },
      format: (h) => (h >= 48 && h % 24 === 0 ? `${h / 24} days after` : `${h} hours after`),
      min: 1,
      max: 720,
      said: (h) => `Review requests go ${h >= 48 && h % 24 === 0 ? `${h / 24} days` : `${h} hours`} after the visit now.`,
      score: 92,
    })(ctx) : null),

  (ctx) => (/\b(text|texts|texting|sms)\b/.test(ctx.raw) && !CHANNEL.test(ctx.raw)
    ? toggle({
      id: 'sms_notifications_enabled',
      key: 'sms_notifications_enabled',
      label: 'Text messages',
      on: /\b(turn|switch|put)\s+.{0,24}(back\s+)?on\b|\b(enable|start)\b/,
      off: /\b(turn|switch|put|stop)\s+.{0,24}off\b|\b(disable|stop)\b/,
      score: 89,
    })(ctx) : null),

  // ── Which pipe a message goes down ───────────────────────────────────────
  //
  // "Send reminders by text" is one of the most useful sentences in the whole
  // catalogue and one of the easiest to get wrong: said to the switch instead
  // of the channel it turns reminders ON when they were already on and changes
  // nothing anybody wanted.
  (ctx) => {
    const chan = readChannel(ctx.raw);
    if (!chan) return null;
    const which = [
      [/remind/, 'chan_reminder', 'Reminders'],
      [/confirmation/, 'chan_confirmation', 'Confirmations'],
      [/receipt/, 'chan_receipt', 'Receipts'],
      [/review/, 'chan_review_request', 'Review requests'],
    ].find(([re]) => re.test(ctx.raw));
    if (!which) return null;
    const [, key, label] = which;
    const asWords = { email: 'email', sms: 'text', both: 'email and text' };
    return makePlan({
      id: key,
      title: `${label}: by ${asWords[chan]}`,
      said: `${label} go by ${asWords[chan]} now.`,
      already: `${label} already go by ${asWords[chan]}.`,
      changes: [{
        label,
        from: `by ${asWords[getSetting(key, 'email')] || 'email'}`,
        to: `by ${asWords[chan]}`,
      }],
      warnings: chan !== 'email' && getSetting('sms_notifications_enabled', '0') !== '1'
        ? ['Texting is switched off in Settings → SMS, so these will not go until you turn it on.'] : [],
      settings: { [key]: chan },
      score: 94,
    });
  },

  // ── Letting clients cancel and rebook themselves ─────────────────────────
  (ctx) => (/cancel/.test(ctx.raw) && /\b(client|clients|customer|customers|them|themselves|people|online)\b/.test(ctx.raw)
    && !readDuration(ctx.raw) && readNumbers(ctx.raw).length === 0
    ? toggle({
      id: 'client_cancel_enabled',
      key: 'client_cancel_enabled',
      label: 'Clients cancelling online',
      on: /\b(turn|switch|put)\s+.{0,24}(back\s+)?on\b|\b(enable|allow|let)\b/,
      off: /\b(turn|switch|put|stop)\s+.{0,24}off\b|\b(disable|stop|dont|do not|prevent)\b/,
      score: 90,
    })(ctx) : null),

  // ── Filling the gaps a cancellation leaves ───────────────────────────────
  (ctx) => (/(autofill|auto fill|automatically fill|fill.{0,12}(gap|cancellation)|gap fill)/.test(ctx.raw)
    ? toggle({
      id: 'waitlist_autofill',
      key: 'waitlist_autofill',
      label: 'Filling cancellations automatically',
      on: /\b(turn|switch|put)\s+.{0,24}(back\s+)?on\b|\b(enable|start|automatically)\b/,
      off: /\b(turn|switch|put|stop)\s+.{0,24}off\b|\b(disable|stop)\b/,
      score: 90,
    })(ctx) : null),

  // ── Asking new clients how they found the salon ──────────────────────────
  (ctx) => (/(heard|found us|find us|how they found|where they came from)/.test(ctx.raw)
    ? toggle({
      id: 'ask_heard_from',
      key: 'ask_heard_from',
      label: 'Asking how they heard about you',
      on: /\b(turn|switch|put)\s+.{0,24}(back\s+)?on\b|\b(enable|start|ask|do)\b/,
      off: /\b(turn|switch|put|stop)\s+.{0,24}off\b|\b(disable|stop|dont|do not)\b/,
      score: 90,
    })(ctx) : null),

  // ── The deposit itself: a flat amount or a share of the price ────────────
  (ctx) => {
    if (!/deposit/.test(ctx.raw)) return null;
    // "over $200" is the threshold rule above, not the deposit amount.
    if (/\bover\b|\babove\b|\bmore than\b/.test(ctx.raw)) return null;
    const pct = /(\d{1,3})\s*(?:%|percent|per cent)/.exec(ctx.raw);
    const cents = readMoney(ctx.raw);
    if (!pct && cents === null) return null;
    const type = pct ? 'percent' : 'fixed';
    const value = pct ? String(clamp(Number(pct[1]), 1, 100)) : String(cents / 100);
    const shown = pct ? `${value}%` : money(cents);
    const wasType = getSetting('deposit_type', 'none');
    const wasValue = getSetting('deposit_value', '');
    const wasShown = wasType === 'none' ? 'no deposit'
      : wasType === 'percent' ? `${wasValue}%` : money(Math.round(Number(wasValue || 0) * 100));
    return makePlan({
      id: 'deposit_amount',
      title: `Deposit: ${shown}`,
      said: `The deposit is ${shown}${pct ? ' of the service price' : ''} now.`,
      already: `The deposit is already ${shown}.`,
      changes: [{ label: 'Deposit', from: wasShown, to: shown }],
      warnings: getSetting('stripe_secret_key', '') === ''
        ? ['Deposits need Stripe set up in Settings → Payments. Until then there is nothing to charge them on.'] : [],
      settings: { deposit_type: type, deposit_value: value },
      score: 93,
    });
  },

  // ── Tax ──────────────────────────────────────────────────────────────────
  (ctx) => {
    if (!/\b(tax|gst|vat)\b/.test(ctx.raw)) return null;
    const pct = /(\d{1,2}(?:\.\d{1,2})?)\s*(?:%|percent|per cent)?/.exec(ctx.raw);
    if (!pct) return null;
    const v = Math.min(100, Math.max(0, Number(pct[1])));
    return makePlan({
      id: 'tax_rate',
      title: `Tax: ${v}%`,
      said: v === 0 ? 'No tax is added to invoices now.' : `Tax is ${v}% now.`,
      already: `Tax is already ${v}%.`,
      changes: [{ label: 'Tax rate', from: `${getSetting('tax_rate', '0')}%`, to: `${v}%` }],
      settings: { tax_rate: String(v) },
      score: 91,
    });
  },

  // ── How long an invoice has to be paid ───────────────────────────────────
  (ctx) => (/invoice/.test(ctx.raw) && /\b(due|payable|terms|pay)\b/.test(ctx.raw)
    ? number({
      id: 'invoice_due_days',
      key: 'invoice_due_days',
      label: 'Invoices are due in',
      read: (c) => { const d = readDuration(c.raw); return d === null ? (readNumbers(c.raw)[0] ?? null) : d / 1440; },
      format: (d) => `${d} days`,
      min: 0,
      max: 365,
      said: (d) => (d === 0 ? 'Invoices are due on the day now.' : `Invoices are due in ${d} days now.`),
      score: 90,
    })(ctx) : null),

  // ── When to suggest the next visit ───────────────────────────────────────
  (ctx) => (/\brebook|\bre book|\bnext visit\b|\bback in\b/.test(ctx.raw)
    ? number({
      id: 'rebook_weeks_default',
      key: 'rebook_weeks_default',
      label: 'Suggest rebooking in',
      read: (c) => { const d = readDuration(c.raw); return d === null ? (readNumbers(c.raw)[0] ?? null) : d / 10080; },
      format: (w) => `${w} weeks`,
      min: 1,
      max: 104,
      said: (w) => `Kairo suggests rebooking in ${w} weeks now.`,
      score: 90,
    })(ctx) : null),

  // ── How the booking page looks ───────────────────────────────────────────
  (ctx) => {
    const scheme = readScheme(ctx.raw);
    if (!scheme) return null;
    return makePlan({
      id: 'brand_scheme',
      title: `Booking page: ${SCHEME_LABELS[scheme]}`,
      said: `Your booking page is ${SCHEME_LABELS[scheme]} now.`,
      already: `Your booking page is already ${SCHEME_LABELS[scheme]}.`,
      changes: [{
        label: 'Booking page',
        from: SCHEME_LABELS[getSetting('brand_scheme', 'midnight')] || 'Midnight',
        to: SCHEME_LABELS[scheme],
      }],
      detail: 'Only what customers see. Your own workspace is unchanged.',
      settings: { brand_scheme: scheme },
      score: 92,
    });
  },

  // ── Patch tests ──────────────────────────────────────────────────────────
  (ctx) => (/(patch|allergy|skin test)/.test(ctx.raw) && /\b(last|valid|good for|expire|month|months)\b/.test(ctx.raw)
    ? number({
      id: 'patch_valid_months',
      key: 'patch_valid_months',
      label: 'A patch test lasts',
      read: (c) => readNumbers(c.raw)[0] ?? null,
      format: (m) => `${m} months`,
      min: 1,
      max: 60,
      said: (m) => `A patch test is good for ${m} months now.`,
      score: 91,
    })(ctx) : null),

  (ctx) => (/(patch|allergy|skin test)/.test(ctx.raw) && /\b(before|notice|ahead|lead|hours?|days?)\b/.test(ctx.raw)
    ? number({
      id: 'patch_lead_hours',
      key: 'patch_lead_hours',
      label: 'A patch test is needed',
      read: (c) => { const d = readDuration(c.raw); return d === null ? null : d / 60; },
      format: (h) => (h % 24 === 0 ? plural(h / 24, 'day') : plural(h, 'hour')) + ' before',
      min: 1,
      max: 336,
      said: (h) => `A patch test has to be ${h % 24 === 0 ? plural(h / 24, 'day') : plural(h, 'hour')} before the appointment now.`,
      score: 91,
    })(ctx) : null),

  // ── Backups ──────────────────────────────────────────────────────────────
  (ctx) => (/back ?up/.test(ctx.raw) && !/\b(daily|weekly|monthly|every)\b/.test(ctx.raw)
    ? toggle({
      id: 'backup_email_enabled',
      key: 'backup_email_enabled',
      label: 'Emailed backups',
      on: /\b(turn|switch|put)\s+.{0,24}(back\s+)?on\b|\b(enable|start|send|email)\b/,
      off: /\b(turn|switch|put|stop)\s+.{0,24}off\b|\b(disable|stop)\b/,
      score: 89,
    })(ctx) : null),

  (ctx) => {
    if (!/back ?up/.test(ctx.raw)) return null;
    const how = /\b(daily|every day|weekly|every week|monthly|every month)\b/.exec(ctx.raw);
    if (!how) return null;
    const freq = /^(daily|every day)$/.test(how[1]) ? 'daily'
      : /^(weekly|every week)$/.test(how[1]) ? 'weekly' : 'monthly';
    return makePlan({
      id: 'backup_frequency',
      title: `Backups: ${freq}`,
      said: `Backups are emailed ${freq} now.`,
      already: `Backups are already emailed ${freq}.`,
      changes: [{ label: 'Backups', from: getSetting('backup_frequency', 'weekly'), to: freq }],
      settings: { backup_frequency: freq, backup_email_enabled: '1' },
      score: 90,
    });
  },

  // ── The hours the calendar itself shows ──────────────────────────────────
  //
  // Not trading hours: how far up and down the grid runs. An owner who starts
  // at seven and finds the diary begins at nine has to scroll every morning.
  (ctx) => {
    // "diary" is what normalise folds calendar, schedule and agenda into.
    if (!/\b(calendar|diary|grid)\b/.test(ctx.raw)) return null;
    if (!/\b(start|starts|begin|begins|run|runs|end|ends|finish|finishes|until|till|from|show|display)\b/.test(ctx.raw)) return null;

    const was = {
      start: Number(getSetting('cal_start_min', '420')) || 420,
      end: Number(getSetting('cal_end_min', '1260')) || 1260,
    };
    let { start, end } = was;
    if (ctx.times) {
      start = ctx.times.open_min;
      end = ctx.times.close_min;
    } else {
      // One time, one side. "Make the calendar start at 7am" is how somebody
      // fixes the thing that annoys them without touching the other end.
      const one = readClock(ctx.raw);
      if (one === null) return null;
      if (/\b(end|ends|finish|finishes|until|till|to)\b/.test(ctx.raw)) end = one;
      else start = one;
    }
    if (end <= start) return null;

    const span = (a, b) => `${clockLabel(a)}–${clockLabel(b)}`;
    return makePlan({
      id: 'cal_window',
      title: `Calendar shows ${span(start, end)}`,
      said: `Your calendar runs ${clockLabel(start)} to ${clockLabel(end)} now.`,
      already: `Your calendar already runs ${clockLabel(start)} to ${clockLabel(end)}.`,
      detail: 'Only what the grid shows. Your trading hours are unchanged.',
      changes: [{ label: 'Calendar grid', from: span(was.start, was.end), to: span(start, end) }],
      settings: { cal_start_min: String(start), cal_end_min: String(end) },
      score: 95,
    });
  },

  // ── Asking clients to confirm ────────────────────────────────────────────
  // Guarded against its near-namesake: "stop sending confirmations" is the
  // confirmation EMAIL, and this is the separate feature that asks a client to
  // confirm they are still coming. Both answered to /confirm/ and Kai rightly
  // refused to guess between them on every sentence containing the word.
  (ctx) => (/confirm/.test(ctx.raw) && !/confirmation/.test(ctx.raw)
    ? toggle({
      id: 'confirm_requests_enabled',
      key: 'confirm_requests_enabled',
      label: 'Asking clients to confirm',
      on: /\b(turn|switch|put)\s+.{0,20}(back\s+)?on\b|\b(enable|start|ask)\b/,
      off: /\b(turn|switch|put|stop)\s+.{0,20}off\b|\b(disable|stop)\b/,
      score: 90,
    })(ctx) : null),

  // ── A service's price or duration ────────────────────────────────────────
  function service(ctx) {
    const svc = matchService(ctx.raw);
    if (!svc) return null;
    const out = [];
    const cents = readMoney(ctx.raw);
    if (cents !== null && /(price|cost|charge|put.*up|put.*down|\$)/.test(ctx.raw)) {
      out.push({
        id: `service_price_${svc.id}`,
        kind: 'service',
        title: `${svc.name}: ${money(cents)}`,
        said: `${svc.name} is ${money(cents)} now.`,
        already: `${svc.name} is already ${money(cents)}.`,
        changes: [{ label: svc.name, from: money(svc.price_cents), to: money(cents) }],
        row: { table: 'services', id: svc.id, column: 'price_cents', value: cents, was: svc.price_cents },
        score: 92,
      });
    }
    const mins = readDuration(ctx.raw);
    if (mins !== null && /(long|duration|minutes?|mins?|hours?|takes?)/.test(ctx.raw)) {
      out.push({
        id: `service_duration_${svc.id}`,
        kind: 'service',
        title: `${svc.name}: ${mins} minutes`,
        said: `${svc.name} takes ${mins} minutes now.`,
        already: `${svc.name} already takes ${mins} minutes.`,
        changes: [{ label: svc.name, from: `${svc.duration_min} minutes`, to: `${mins} minutes` }],
        row: { table: 'services', id: svc.id, column: 'duration_min', value: mins, was: svc.duration_min },
        score: 92,
      });
    }
    return out.map(rowPlan).filter(Boolean);
  },
];

const clone = (o) => JSON.parse(JSON.stringify(o));

/** A plan that writes one column of one row rather than a setting. */
function rowPlan(o) {
  if (String(o.row.value) === String(o.row.was)) return noop(o.already || `${o.title} — that is already how it is.`);
  const plan = { ...o, settings: null, before: null, warnings: o.warnings || [], detail: o.detail || '' };
  plan.fingerprint = crypto.createHash('sha256')
    .update(JSON.stringify([o.id, o.row])).digest('hex').slice(0, 16);
  return plan;
}

/**
 * The service a sentence is talking about.
 *
 * Longest name first, so "Blow Dry & Style" wins over "Blow Dry" when both are
 * on the menu and the owner said the longer one.
 */
function matchService(raw) {
  const rows = db.prepare('SELECT id, name, price_cents, duration_min FROM services WHERE active = 1').all();
  const hay = ` ${raw} `;
  return rows
    .map((s) => ({ ...s, norm: normalise(s.name) }))
    .filter((s) => s.norm && hay.includes(` ${s.norm} `))
    .sort((a, b) => b.norm.length - a.norm.length)[0] || null;
}

// ---------------------------------------------------------------------------
// Reading, deciding, doing
// ---------------------------------------------------------------------------

/**
 * Everything this sentence could be asking Kai to change, best first.
 *
 * `noops` are the readings that landed but had nothing to do — see the comment
 * on the collector. They are the difference between "already closed on Monday"
 * and "I don't know what you mean".
 */
export function readActions(text, { today }) {
  const raw = normalise(text);
  const asked = raw.replace(POLITE, '');
  if (!asked || (ASKING.test(asked) && !NEGATED_ORDER.test(asked))) {
    return { plans: [], noops: [] };
  }
  const ranges = readTimeRanges(text);
  const ctx = {
    raw,
    text,
    today,
    keys: tokenise(text).keys,
    days: readWeekdays(text),
    times: ranges.target,
    statedFrom: ranges.from,
    cur: currentHours(),
  };
  const plans = [];
  noops = [];
  for (const cap of CAPABILITIES) {
    try {
      const r = cap(ctx);
      if (!r) continue;
      plans.push(...(Array.isArray(r) ? r : [r]));
    } catch { /* one capability failing must not silence the rest */ }
  }
  const said = [...new Set(noops)];
  noops = [];
  return { plans: plans.filter(Boolean).sort((a, b) => b.score - a.score), noops: said };
}

/**
 * Would this sentence be read as more than one instruction, and what would each
 * one do? Reads nothing into the database and writes nothing to it.
 *
 * Separate from `readCompound` so the search half can preview a compound
 * sentence while it is still being typed. A preview that showed only the first
 * half of "close Mondays and open Saturday" would be telling the owner that
 * Enter does less than it does.
 *
 * It only calls a sentence compound when EVERY-clause-alone reading understood
 * at least two of them, so ordinary sentences that merely contain the word
 * "and" — "close Monday and Tuesday", "open Thursday and Friday only" — are
 * read whole by the caller. Clauses that are all already-true still count, and
 * stop here rather than falling through: read whole, "remind them a day before
 * and give them 12 hours to cancel" adds the two durations together and offers
 * thirty-six.
 */
export function previewCompound(text, { today }) {
  const clauses = splitClauses(text);
  if (clauses.length < 2) return null;
  // A service called "Cut and Blow Dry" is one thing, not two.
  const svc = matchService(normalise(text));
  if (svc && / and /.test(` ${svc.norm} `)) return null;

  const dry = clauses.map((clause) => {
    const read = readActions(clause, { today });
    return { clause, plan: decide(read.plans).plan, already: read.noops[0] || null };
  });
  return dry.filter((d) => d.plan || d.already).length >= 2 ? dry : null;
}

/**
 * Read a sentence that asks for more than one thing, doing each in turn.
 *
 * This is the difference between an assistant and a command line. An owner
 * says "close Mondays and open Saturday ten to three" in one breath, and until
 * this existed Kai did the first half, said so, and let them walk away
 * believing both had happened.
 *
 * It only takes the compound path when EVERY-clause-alone reading finds at
 * least two real changes, so ordinary sentences that merely contain the word
 * "and" — "close Monday and Tuesday", "open Thursday and Friday only" — are
 * still read whole by the caller. Clauses are applied in order and each is
 * re-read against the salon as the previous one left it, so the recorded
 * before-states undo cleanly in reverse.
 *
 * Returns null when the sentence is not compound, and the caller carries on.
 */
export function readCompound(text, { today }) {
  const dry = previewCompound(text, { today });
  if (!dry) return null;
  const clauses = dry.map((d) => d.clause);

  const done = [];
  const already = [];
  const stuck = [];
  for (const clause of clauses) {
    const read = readActions(clause, { today });
    const { plan } = decide(read.plans);
    if (plan) {
      // Applied one at a time so the next clause is read against the salon as
      // this one left it — "close Monday and open Monday" must end up open.
      writePlan(plan);
      done.push(plan);
    } else if (read.noops.length) {
      already.push(read.noops[0]);
    } else {
      stuck.push(clause);
    }
  }
  if (!done.length) return { done, already, stuck };
  return { done, already, stuck, token: recordUndo(done) };
}

/**
 * Which plan to run, or none.
 *
 * Kai acts on its own only when the reading is unambiguous — one plan, or a
 * clear winner. Where two are close it hands both back and asks, because the
 * cost of guessing wrong is a salon that says something different from what its
 * owner believes, and no amount of undo makes that a good experience.
 */
export function decide(plans) {
  if (!plans.length) return { plan: null, options: [] };
  if (plans.length === 1) return { plan: plans[0], options: [] };
  if (plans[0].score - plans[1].score >= 8) return { plan: plans[0], options: [] };
  return { plan: null, options: plans.slice(0, 3) };
}

const UNDO_KEY = 'kai_undo';
const UNDO_KEEP = 10;

const readUndo = () => {
  try {
    const v = JSON.parse(getSetting(UNDO_KEY, '[]'));
    return Array.isArray(v) ? v : [];
  } catch { return []; }
};

/**
 * Do it, and record precisely enough to put it back.
 *
 * The undo stack lives in settings rather than in memory so it survives the
 * restart that a deploy causes — an owner who changed their hours a minute
 * before Render redeployed should still be able to say "undo that".
 */
/** Write one plan. Nothing here records how to take it back — that is `recordUndo`. */
function writePlan(plan) {
  if (plan.row) {
    const { table, id, column, value } = plan.row;
    // The table and column are from this file's own catalogue, never from the
    // request — there is no path from a sentence to an arbitrary column name.
    if (table !== 'services' || !['price_cents', 'duration_min'].includes(column)) {
      throw new Error('That is not something Kai can change');
    }
    db.prepare(`UPDATE services SET ${column} = ? WHERE id = ?`).run(value, id);
  } else {
    for (const [k, v] of Object.entries(plan.settings)) setSetting(k, v);
  }
}

/**
 * Remember how to put back everything that just happened, as one entry.
 *
 * One token for the whole sentence, not one per clause: an owner who said two
 * things in a breath and meant neither of them says "undo" once.
 */
function recordUndo(plans, who = '') {
  const token = crypto.randomBytes(8).toString('hex');
  const stack = [{
    token,
    at: new Date().toISOString(),
    title: plans.map((p) => p.title).join(' + '),
    said: plans.map((p) => p.said).join(' '),
    who,
    changes: plans.flatMap((p) => p.changes || []),
    steps: plans.map((p) => ({
      settings: p.settings || null,
      before: p.before || null,
      row: p.row || null,
    })),
  }, ...readUndo()].slice(0, UNDO_KEEP);
  setSetting(UNDO_KEY, JSON.stringify(stack));
  return token;
}

export function applyPlan(plan, { who = '' } = {}) {
  writePlan(plan);
  return recordUndo([plan], who);
}

/**
 * How to say an undo out loud.
 *
 * "Put back: Sunday 2pm-6pm" reads as though it just SET two to six, which is
 * the opposite of what happened. The owner needs the state they are back in,
 * not the name of the change that was reversed — the whole safety model rests
 * on them understanding what just happened to their salon.
 */
function undoSaid(entry) {
  const c = (entry.changes || []).filter((x) => x.from);
  if (!c.length) return `Undone — ${entry.title} was put back.`;
  if (c.length === 1) return `Undone — ${c[0].label} is back to ${c[0].from}.`;
  // Read back out loud, so a week's worth of days becomes unlistenable. Three
  // and a count is enough for the owner to know the right thing was reversed.
  const head = c.slice(0, 3).map((x) => `${x.label} back to ${x.from}`).join(', ');
  const rest = c.length - 3;
  return `Undone — ${head}${rest > 0 ? `, and ${rest} more` : ''}.`;
}

/** Put back the last change, or a named one. Returns what was undone. */
export function undoChange(token = '') {
  const stack = readUndo();
  const i = token ? stack.findIndex((e) => e.token === token) : 0;
  if (i < 0 || !stack[i]) return null;
  const entry = stack[i];
  // Entries written before compound sentences existed carry a single step at
  // the top level. An undo stack that survives a deploy has to survive an
  // upgrade too, or the first thing a new version does is strand it.
  const steps = entry.steps || [{ settings: entry.settings, before: entry.before, row: entry.row }];
  let put = 0;
  // Last first: clause two was read against the salon as clause one left it,
  // so its before-state is only true once clause two has been rolled back.
  for (const step of [...steps].reverse()) {
    if (step.row) {
      const { table, id, column, was } = step.row;
      if (table !== 'services' || !['price_cents', 'duration_min'].includes(column)) continue;
      db.prepare(`UPDATE services SET ${column} = ? WHERE id = ?`).run(was, id);
      put++;
    } else if (step.before) {
      // Only the keys this change wrote go back. Anything somebody else altered
      // in the meantime is left exactly as they left it.
      for (const [k, v] of Object.entries(step.before)) setSetting(k, v);
      put++;
    }
  }
  if (!put) return null;
  stack.splice(i, 1);
  setSetting(UNDO_KEY, JSON.stringify(stack));
  return { ...entry, said: undoSaid(entry) };
}

/** What the last change was, for "undo that" and for the bar's footer. */
export function lastChange() {
  return readUndo()[0] || null;
}

/** Is this sentence asking to take the last thing back? */
export function isUndo(text) {
  return /^\s*(undo|undo that|put (that|it) back|revert|never ?mind|cancel that|take that back|reverse that)\b/i
    .test(normalise(text));
}

/**
 * Find the plan the owner pressed, from the sentence they said.
 *
 * Kept for the confirm path — used when Kai could not decide on its own and
 * offered a choice. The sentence is re-read here rather than the browser's copy
 * being trusted, and the fingerprint has to still match the world as it stands.
 */
export function planFor(text, fingerprintWanted, { today }) {
  return readActions(text, { today }).plans.find((p) => p.fingerprint === fingerprintWanted) || null;
}
