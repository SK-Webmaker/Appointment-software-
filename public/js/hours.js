// Opening hours for a specific date.
//
// The business has usual hours (open_min/close_min) and the weekdays it opens
// (open_days). On top of that, any weekday can carry a rule: run only every
// 2nd/3rd/4th week, and/or use different hours from the usual ones — which is
// how "we open every second Sunday, 10 till 3" is expressed.
//
// This module is deliberately free of any DOM or database access so the server
// (src/api.js), the owner's calendar and the customer booking page all decide
// "is this date open, and between what times" with exactly the same code.

/** Midnight-UTC day number for a YYYY-MM-DD string — safe to subtract. */
function dayNumber(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** Weekday of a YYYY-MM-DD string, 0=Sun … 6=Sat, free of time-zone drift. */
export function weekdayOf(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const asMin = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);

/**
 * Read the stored day_rules JSON into a clean { [weekday]: rule } map.
 * Anything malformed is dropped rather than throwing — a corrupt rule must
 * never be able to take the booking page down.
 */
export function parseDayRules(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return {};
    try { obj = JSON.parse(raw); } catch { return {}; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    const dow = Number(key);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) continue;
    if (!val || typeof val !== 'object') continue;
    const every = Math.round(Number(val.every_weeks));
    const rule = { every_weeks: every >= 1 && every <= 4 ? every : 1 };
    if (rule.every_weeks > 1 && isDate(val.anchor)) rule.anchor = val.anchor;
    if (rule.every_weeks > 1 && !rule.anchor) rule.every_weeks = 1; // no start date → weekly
    const open = asMin(val.open_min);
    const close = asMin(val.close_min);
    if (open !== null && close !== null && open >= 0 && close <= 1440 && close > open) {
      rule.open_min = open;
      rule.close_min = close;
    }
    // A rule that says nothing different from the defaults is not worth storing.
    if (rule.every_weeks === 1 && rule.open_min === undefined) continue;
    out[dow] = rule;
  }
  return out;
}

/**
 * Is this date one of the weeks a repeating rule runs on?
 * Weeks are counted from the anchor — the first date the owner picked — so
 * "every 2nd week" alternates on and off from that date, in both directions.
 */
export function ruleRunsOn(rule, dateStr) {
  const every = rule?.every_weeks || 1;
  if (every <= 1) return true;
  if (!isDate(rule.anchor)) return true;
  const weeks = Math.floor((dayNumber(dateStr) - dayNumber(rule.anchor)) / 7);
  return ((weeks % every) + every) % every === 0;
}

/**
 * Opening hours for one date, or null when the business is shut that day.
 *
 * `settings` takes the raw stored values: open_days ('1,2,3,4,5,6'),
 * open_min/close_min, and day_rules (JSON string or an already-parsed object).
 */
export function hoursForDate(dateStr, settings = {}) {
  if (!isDate(dateStr)) return null;
  const days = String(settings.open_days ?? '0,1,2,3,4,5,6')
    .split(',').map((d) => Number(String(d).trim())).filter((d) => d >= 0 && d <= 6);
  const dow = weekdayOf(dateStr);
  if (!days.includes(dow)) return null;

  const rule = parseDayRules(settings.day_rules)[dow];
  if (rule && !ruleRunsOn(rule, dateStr)) return null;

  const open = rule?.open_min ?? Number(settings.open_min ?? 480);
  const close = rule?.close_min ?? Number(settings.close_min ?? 1200);
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) return null;
  return { open, close };
}

/** Convenience: is the business open at all on this date? */
export function isOpenOn(dateStr, settings) {
  return hoursForDate(dateStr, settings) !== null;
}

/** The next `count` dates from `fromDate` (inclusive) the business is open. */
export function openDatesFrom(fromDate, settings, count = 14, maxLookahead = 180) {
  const out = [];
  const start = dayNumber(fromDate);
  for (let i = 0; i < maxLookahead && out.length < count; i++) {
    const d = new Date((start + i) * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const h = hoursForDate(dateStr, settings);
    if (h) out.push({ date: dateStr, open_min: h.open, close_min: h.close });
  }
  return out;
}

const ORDINAL = { 2: '2nd', 3: '3rd', 4: '4th' };

/** Plain-English summary of a day's rule, for the settings screen. */
export function describeRule(rule) {
  if (!rule) return 'Every week, usual hours';
  const cadence = rule.every_weeks > 1 ? `Every ${ORDINAL[rule.every_weeks]} week` : 'Every week';
  const hours = rule.open_min === undefined ? 'usual hours' : `${fmtMin(rule.open_min)}–${fmtMin(rule.close_min)}`;
  return `${cadence}, ${hours}`;
}

export function fmtMin(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ap}`;
}
