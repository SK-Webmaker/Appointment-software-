// Things Kai can change, rather than only find.
//
// Up to now Kai answered questions and jumped between screens. Asking it to
// "add Friday from 11 to 2" meant it took you to Settings and you did the work.
// That is a search box wearing an assistant's coat. This is the layer that lets
// it actually do the thing.
//
// Which makes the safety model the whole design, not a footnote:
//
//   1. NOTHING IS APPLIED FROM A SENTENCE. Kai proposes. Every proposal is a
//      plan the owner reads and presses. Enter on a highlighted row navigates;
//      it never changes a setting. Changing one takes its own deliberate press.
//   2. THE PLAN SAYS WHAT IT CHANGES *FROM*. "Friday: closed → 11am–2pm" is
//      checkable at a glance. "Updated your hours" is not.
//   3. THE PLAN SAYS WHAT ELSE IT TOUCHES. Closing Mondays when there are four
//      Monday appointments already booked is something the owner has to know
//      BEFORE pressing, not discover on Monday.
//   4. A QUESTION IS NEVER A COMMAND. "What time do we close on Friday" must
//      not offer to close Fridays. Sentences that open like questions propose
//      nothing at all.
//   5. THE SENTENCE IS RE-READ ON THE SERVER WHEN IT IS APPLIED, and the plan
//      has to still be the same plan. The browser cannot invent a change Kai
//      never offered, and a plan built against settings that have since moved
//      is refused rather than applied to a world it does not describe.
//
// This is also the reason there is still no language model here. Kai can now
// alter the hours a salon trades on; a component that guesses must never be the
// component that acts.
import crypto from 'node:crypto';
import { db, getSetting } from './db.js';
import { parseDayRules } from '../public/js/hours.js';
import { DAY_NAMES, listDays, readWeekdays, readTimeRange, tokenise, normalise, clockLabel } from './kai-language.js';

/**
 * Sentences that are asking, not instructing.
 *
 * "What time do we close on Friday" names a day and the word close, and without
 * this would come back offering to shut Fridays. An owner who has to read every
 * proposal carefully because half of them are misreadings of their own questions
 * will stop reading them, and that is how the one that mattered gets pressed.
 */
const ASKING = /^(what|when|who|whom|why|where|which|whats|hows|do|does|did|are|is|was|were|am|will|have|has|had)\b/;

const csvDays = (v) => String(v || '')
  .split(',').map((d) => Number(String(d).trim()))
  .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  .sort((a, b) => a - b);

const uniqueSorted = (arr) => [...new Set(arr)].sort((a, b) => a - b);

/** The hours settings as they stand, in one object. */
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
  const cadence = rule?.every_weeks > 1 ? ` (every ${rule.every_weeks === 2 ? '2nd' : rule.every_weeks === 3 ? '3rd' : '4th'} week)` : '';
  return `${clockLabel(open)}–${clockLabel(close)}${cadence}`;
}

/**
 * Write hours for a set of days into the settings that would result.
 *
 * When the days being given hours are every day the salon opens and they all get
 * the same times, that is the salon's normal hours — so it writes those and
 * clears any per-day overrides, leaving simple state behind rather than seven
 * identical rules. Otherwise it writes a rule per day.
 *
 * Alternating-week rules are preserved throughout. Somebody who opens every
 * second Sunday and then changes Sunday's hours still opens every second Sunday.
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

/** The settings payload a plan would write, in the shape /api/settings takes. */
function payloadFor(next) {
  return {
    open_days: next.open_days.join(','),
    open_min: String(next.open_min),
    close_min: String(next.close_min),
    day_rules: JSON.stringify(next.rules),
  };
}

/**
 * Appointments already in the diary that this change would sit awkwardly with.
 *
 * Kairo never cancels anything on its own, so these stay booked — but an owner
 * closing Mondays with four Mondays booked needs to know that now, while it is
 * still one sentence to undo.
 */
function futureAppointments(today) {
  // Read once per sentence, not once per day being changed. This runs on every
  // keystroke while somebody types "close on mondays", and a salon with a full
  // diary would otherwise scan it seven times a letter.
  return db.prepare(
    `SELECT date, start_min, end_min FROM appointments
      WHERE date >= ? AND status NOT IN ('cancelled', 'no_show', 'completed')`
  ).all(today).map((r) => ({ ...r, dow: new Date(`${r.date}T12:00:00`).getDay() }));
}

function bookedOn(rows, dow, { outside = null } = {}) {
  return rows.filter((r) => {
    if (r.dow !== dow) return false;
    if (!outside) return true;
    return r.start_min < outside.open_min || r.end_min > outside.close_min;
  }).length;
}

const fingerprint = (plan) => crypto.createHash('sha256')
  .update(JSON.stringify([plan.id, plan.before, plan.settings]))
  .digest('hex').slice(0, 16);

/**
 * Every change this sentence could reasonably be asking for, best first.
 *
 * Returns plans, not results. A plan is inert: it describes a change, the state
 * it was built against, and the exact settings it would write. Nothing here
 * touches the database.
 */
export function readActions(text, { today }) {
  const raw = normalise(text);
  if (!raw || ASKING.test(raw)) return [];

  const { keys } = tokenise(text);
  const days = readWeekdays(text);
  const times = readTimeRange(text);
  const cur = currentHours();
  // Fetched lazily: a sentence that changes no days never touches the diary.
  let diary = null;
  const booked = (dow, opts) => bookedOn(diary || (diary = futureAppointments(today)), dow, opts);

  const has = (k) => keys.includes(k);
  const wantsClose = has('close') || has('remove');
  const wantsAdd = has('add');
  const wantsChange = has('change');
  const mentionsOpen = has('open');
  const mentionsHours = has('hours');
  /**
   * Is this about WHICH DAYS the salon trades, rather than one of them?
   *
   * The most destructive thing Kai can propose — it closes every day not named —
   * so it needs a signal that is hard to trip over. Two qualify, and only two:
   * the phrase "opening days" (the set, said as a set), and the word "only".
   * Neither can be reached from "change Friday to an open day", which is a
   * request to open one day and once read as a request to shut six.
   */
  const replacesWeek = has('opendays') || has('only');

  // Nothing here is about opening hours at all.
  //
  // "My opening days are Tuesday and Thursday" carries no verb Kai recognises —
  // the phrase collapses to one token and takes the word "open" with it — so it
  // is let through on the strength of that phrase plus a day. It is still only
  // a proposal with a Confirm on it.
  if (!wantsClose && !wantsAdd && !mentionsOpen && !mentionsHours
      && !(wantsChange && (days.length || times)) && !(replacesWeek && days.length)) {
    return [];
  }

  const plans = [];
  const plan = (o) => {
    const p = {
      id: o.id,
      title: o.title,
      detail: o.detail || '',
      changes: o.changes || [],
      warnings: o.warnings || [],
      before: payloadFor(cur),
      settings: o.settings,
      matched: o.matched,
      score: o.score,
    };
    // A plan that changes nothing is not an offer, it is noise.
    if (JSON.stringify(p.before) === JSON.stringify(p.settings)) return;
    p.fingerprint = fingerprint(p);
    plans.push(p);
  };

  // ── Close these days ─────────────────────────────────────────────────────
  if (wantsClose && days.length && !wantsAdd) {
    const closing = days.filter((d) => cur.open_days.includes(d));
    if (closing.length) {
      const next = {
        ...cur,
        open_days: cur.open_days.filter((d) => !days.includes(d)),
        rules: JSON.parse(JSON.stringify(cur.rules)),
      };
      const bookedCount = closing.reduce((n, d) => n + booked(d), 0);
      plan({
        id: 'close_days',
        title: `Close on ${listDays(closing)}`,
        detail: next.open_days.length
          ? `You would be open ${listDays(next.open_days)}.`
          : 'That would leave you closed every day — the booking page would take nothing.',
        changes: closing.map((d) => ({ label: DAY_NAMES[d], from: describeDay(d, cur), to: 'closed' })),
        warnings: [
          ...(bookedCount ? [`${bookedCount} appointment${bookedCount === 1 ? ' is' : 's are'} already booked on ${
            closing.length === 1 ? `a ${DAY_NAMES[closing[0]]}` : 'those days'} after today. They stay in your diary — nothing is cancelled.`] : []),
          ...(next.open_days.length ? [] : ['Customers would not be able to book any day online.']),
        ],
        settings: payloadFor(next),
        matched: 'closing a day',
        score: 96,
      });
    }
  }

  // ── Open these days (optionally with hours) ──────────────────────────────
  // Skipped when the sentence is asking to replace the whole week instead;
  // the guard mirrors that branch's condition exactly so the two can never
  // both fire on one sentence.
  if (!wantsClose && days.length && (wantsAdd || mentionsOpen) && !(replacesWeek && !wantsAdd)) {
    const adding = days.filter((d) => !cur.open_days.includes(d));
    const next = {
      ...cur,
      open_days: uniqueSorted([...cur.open_days, ...days]),
      rules: JSON.parse(JSON.stringify(cur.rules)),
    };
    if (times) applyHours(next, days, times);
    const label = times ? `, ${clockLabel(times.open_min)}–${clockLabel(times.close_min)}` : '';
    plan({
      id: 'open_days',
      title: adding.length
        ? `Open on ${listDays(adding)}${label}`
        : `Set ${listDays(days)} to ${clockLabel(times?.open_min ?? cur.open_min)}–${clockLabel(times?.close_min ?? cur.close_min)}`,
      detail: `You would be open ${listDays(next.open_days)}.`,
      changes: days.map((d) => ({
        label: DAY_NAMES[d],
        from: describeDay(d, cur),
        to: describeDay(d, next),
      })),
      warnings: [],
      settings: payloadFor(next),
      matched: 'opening a day',
      score: 95,
    });
  }

  // ── Replace the whole set of open days ───────────────────────────────────
  //
  // "Change my opening days to Monday, Tuesday and Wednesday" qualifies, and so
  // does "open Tuesday and Thursday only". "Change Sunday hours to 11 to 4" does
  // not, and once did — which read as an instruction to shut the other six.
  if (days.length && replacesWeek && !wantsAdd && !wantsClose) {
    const next = {
      ...cur,
      open_days: [...days],
      rules: JSON.parse(JSON.stringify(cur.rules)),
    };
    // Rules for days that are no longer open would sit there invisibly, waiting
    // to surprise whoever reopens that day months later.
    for (const d of Object.keys(next.rules)) {
      if (!days.includes(Number(d))) delete next.rules[d];
    }
    if (times) applyHours(next, days, times);
    const losing = cur.open_days.filter((d) => !days.includes(d));
    const bookedCount = losing.reduce((n, d) => n + booked(d), 0);
    plan({
      id: 'set_open_days',
      title: `Open ${listDays(days)} only${times ? `, ${clockLabel(times.open_min)}–${clockLabel(times.close_min)}` : ''}`,
      detail: losing.length
        ? `You would no longer open ${listDays(losing)}.`
        : 'Your opening days stay as they are; only the hours change.',
      changes: [0, 1, 2, 3, 4, 5, 6]
        .filter((d) => describeDay(d, cur) !== describeDay(d, next))
        .map((d) => ({ label: DAY_NAMES[d], from: describeDay(d, cur), to: describeDay(d, next) })),
      warnings: bookedCount
        ? [`${bookedCount} appointment${bookedCount === 1 ? ' is' : 's are'} already booked on ${listDays(losing)} after today. They stay in your diary — nothing is cancelled.`]
        : [],
      settings: payloadFor(next),
      matched: 'setting your opening days',
      score: 97,
    });
  }

  // ── Hours only ───────────────────────────────────────────────────────────
  if (times && (mentionsHours || mentionsOpen || wantsChange) && !wantsClose && !wantsAdd
      && !plans.some((p) => p.id === 'set_open_days' || p.id === 'open_days')) {
    const target = days.length ? days : cur.open_days;
    const next = { ...cur, rules: JSON.parse(JSON.stringify(cur.rules)) };
    applyHours(next, target, times);
    const outside = target.reduce((n, d) => n + booked(d, { outside: times }), 0);
    plan({
      id: 'set_hours',
      title: `${days.length ? listDays(days) : 'Every open day'}: ${clockLabel(times.open_min)}–${clockLabel(times.close_min)}`,
      detail: days.length
        ? 'Your other days keep the hours they have.'
        : 'This becomes your usual trading day.',
      changes: target
        .filter((d) => describeDay(d, cur) !== describeDay(d, next))
        .map((d) => ({ label: DAY_NAMES[d], from: describeDay(d, cur), to: describeDay(d, next) })),
      warnings: outside
        ? [`${outside} appointment${outside === 1 ? ' falls' : 's fall'} outside the new hours. They stay booked — you would be working around them.`]
        : [],
      settings: payloadFor(next),
      matched: 'changing your hours',
      score: 94,
    });
  }

  return plans.sort((a, b) => b.score - a.score);
}

/**
 * Find the plan the owner actually pressed, from the sentence they said.
 *
 * The sentence is re-read here rather than the browser's version of the plan
 * being trusted, and the fingerprint has to still match — which it will not if
 * somebody edited the hours in another tab in the meantime. Refusing is the
 * right answer there: the plan on screen described a world that has moved.
 */
export function planFor(text, fingerprintWanted, { today }) {
  const plans = readActions(text, { today });
  return plans.find((p) => p.fingerprint === fingerprintWanted) || null;
}
