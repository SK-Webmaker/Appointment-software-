// When each team member actually works.
//
// A salon's opening hours say when the doors are unlocked. They do not say who
// is standing behind the chair. One stylist starts at 11 and finishes at 7,
// another does Saturdays only, a third is off on Wednesdays — and a customer
// booking online must only ever be offered a time when the person they picked
// is genuinely there.
//
// Resolution for "is this person working on this date, and between what times":
//
//   1. A shift set for that exact date wins. That is how a one-off late start,
//      or a day off, is expressed.
//   2. Otherwise the weekly pattern for that weekday.
//   3. If they have no weekly pattern at all, they follow the salon's hours.
//      This matters: a one-person salon that has never opened this screen must
//      keep taking bookings exactly as before. A roster is opt-in, and only
//      starts constraining someone once it exists.
//
// Deliberately free of DOM and database access, so src/api.js, the owner's
// calendar and the customer's booking page all answer the question with the
// same code — the way hours.js already does for the business as a whole.
import { weekdayOf } from './hours.js';

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const asMin = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 1440 ? n : null;
};

/** Returned when a member has no weekly pattern — they follow the salon. */
export const NO_ROSTER = 'no-roster';

/**
 * Tidy raw shift rows into the shape the resolver wants.
 * Anything malformed is dropped rather than throwing: a bad row must never be
 * able to take the booking page down.
 *
 * @param {Array} rows  [{ weekday, date, start_min, end_min, working }]
 */
export function buildRoster(rows = []) {
  const weekly = {};
  const overrides = {};
  for (const r of rows) {
    const start = asMin(r.start_min);
    const end = asMin(r.end_min);
    const working = r.working === 0 || r.working === false ? false : true;
    // A working shift needs a real window; a day off does not.
    if (working && (start === null || end === null || end <= start)) continue;

    if (isDate(r.date)) {
      overrides[r.date] = working ? { start_min: start, end_min: end, working: true } : { working: false };
      continue;
    }
    const dow = Number(r.weekday);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) continue;
    // A weekly row that says "not working" is the same as having no row for
    // that day, and storing both ways would make the grid ambiguous.
    if (working) weekly[dow] = { start_min: start, end_min: end };
  }
  return { weekly, overrides, hasWeekly: Object.keys(weekly).length > 0 };
}

/**
 * The shift this person is rostered for on a date.
 * @returns {{start_min:number,end_min:number}|null|typeof NO_ROSTER}
 *   an object when they are working, null when they are not, and NO_ROSTER
 *   when they have never been given a pattern.
 */
export function rosteredShift(dateStr, roster) {
  if (!isDate(dateStr) || !roster) return NO_ROSTER;
  const override = roster.overrides?.[dateStr];
  if (override) return override.working ? { start_min: override.start_min, end_min: override.end_min } : null;
  if (!roster.hasWeekly) return NO_ROSTER;
  return roster.weekly?.[weekdayOf(dateStr)] || null;
}

/**
 * The window this person can actually be booked in on a date: their shift,
 * clipped to the salon's own opening hours.
 *
 * Both have to hold. A stylist rostered until 7 cannot take a 6pm booking in a
 * salon that shuts at 5 — there would be nobody to lock up — and a salon open
 * at 9 cannot offer 9am with a stylist who starts at 11.
 *
 * @returns {{open:number,close:number}|null}  null means "not bookable at all"
 */
export function bookableWindow(dateStr, roster, salonHours) {
  if (!salonHours) return null;                   // the salon is shut that day
  const shift = rosteredShift(dateStr, roster);
  if (shift === NO_ROSTER) return { ...salonHours };
  if (!shift) return null;                        // rostered off
  const open = Math.max(salonHours.open, shift.start_min);
  const close = Math.min(salonHours.close, shift.end_min);
  return close > open ? { open, close } : null;
}

/** Total minutes a member is rostered across a list of dates — for the grid. */
export function rosteredMinutes(dates, roster, hoursForDate) {
  let total = 0;
  for (const d of dates) {
    const w = bookableWindow(d, roster, hoursForDate(d));
    if (w) total += w.close - w.open;
  }
  return total;
}

/** "6 hr", "7 hr 30 min", "0 min" — how Fresha's roster totals read. */
export function fmtDuration(min) {
  if (!min) return '0 min';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
