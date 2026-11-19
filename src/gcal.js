// A team member's own calendar (Google Calendar, usually) linked to Kairo, both
// ways, without a Google sign-in or any Google app to approve:
//
//   Out: a private feed of their Kairo bookings. Google subscribes to it with
//        "Other calendars → From URL", so bookings show up next to their
//        personal life. Google decides how often it re-reads the feed (every
//        few hours), which is fine for seeing the week ahead.
//   In:  the "Secret address in iCal format" of their own Google calendar.
//        Kairo reads it every 10 minutes and turns each busy event into blocked
//        time, so the booking page never offers a slot over the dentist.
//
// Each direction is its own on/off switch per team member, owner-only.
//
// Imported busy time is stored as ordinary time_blocks rows with
// source = 'gcal', so the booking page, the diary and the clash check all
// respect it without knowing where it came from. Each read replaces that
// member's 'gcal' rows wholesale; a failed read keeps the last good ones.
// Personal event titles are never stored: every block just says "Busy".
import crypto from 'node:crypto';
import { db, getSetting } from './db.js';
import { nowParts, addDaysStr, isValidTimeZone } from './util.js';

export const SYNC_EVERY_MIN = 10;
export const BUSY_REASON = 'Busy (Google Calendar)';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_BLOCKS = 5000;
const DAY = 86400000;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function calendarRow(staffId) {
  return db.prepare('SELECT * FROM staff_calendar WHERE staff_id = ?').get(staffId) || null;
}

function ensureRow(staffId) {
  db.prepare('INSERT OR IGNORE INTO staff_calendar (staff_id, feed_token) VALUES (?, ?)')
    .run(staffId, newToken());
  return calendarRow(staffId);
}

const newToken = () => crypto.randomBytes(16).toString('hex');

/** What the owner's screen shows. The import address is a secret: only its tail comes back. */
export function calendarStatus(staffId, origin = '') {
  const r = calendarRow(staffId) || {};
  return {
    feed_on: r.feed_on ? 1 : 0,
    feed_url: r.feed_on && r.feed_token ? `${origin}/api/public/calendar/${r.feed_token}.ics` : '',
    import_on: r.import_on ? 1 : 0,
    import_set: r.import_url ? 1 : 0,
    import_hint: r.import_url ? maskUrl(r.import_url) : '',
    checked_at: r.checked_at || '',
    error: r.error || '',
    busy_count: r.busy_count || 0,
  };
}

/** e.g. "calendar.google.com …a1b2": enough to recognise, not enough to use. */
function maskUrl(u) {
  try {
    const x = new URL(u);
    const secret = x.pathname.split('/').find((p) => /^private-/i.test(p)) || '';
    return secret ? `${x.host} …${secret.slice(-4)}` : x.host;
  } catch { return 'saved'; }
}

/**
 * Apply the owner's changes. `import_url` of '' clears it. Turning the import
 * off (or clearing the address) removes the busy time it put in straight away.
 */
export function saveCalendar(staffId, { feed_on, new_link, import_on, import_url } = {}) {
  const row = ensureRow(staffId);
  const next = { ...row };
  if (feed_on !== undefined) next.feed_on = feed_on ? 1 : 0;
  if (new_link) next.feed_token = newToken();
  if (import_url !== undefined) {
    const clean = String(import_url || '').trim();
    if (clean) {
      const ok = checkCalendarUrl(clean);
      if (!ok.url) throw Object.assign(new Error(ok.error), { status: 400 });
      if (ok.url !== row.import_url) { next.import_url = ok.url; next.checked_at = ''; next.error = ''; }
    } else {
      next.import_url = '';
    }
  }
  if (import_on !== undefined) {
    next.import_on = import_on ? 1 : 0;
    // Switching back on reads it again now rather than showing an old count.
    if (next.import_on && !row.import_on) next.checked_at = '';
  }
  if (next.import_on && !next.import_url) {
    throw Object.assign(new Error('Paste your Google Calendar\'s secret address first'), { status: 400 });
  }
  db.prepare(
    `UPDATE staff_calendar SET feed_on = ?, feed_token = ?, import_on = ?, import_url = ?, checked_at = ?, error = ?
     WHERE staff_id = ?`
  ).run(next.feed_on, next.feed_token, next.import_on, next.import_url, next.checked_at || '', next.error || '', staffId);
  if (!next.import_on || !next.import_url) clearBusy(staffId);
}

function clearBusy(staffId) {
  db.prepare("DELETE FROM time_blocks WHERE staff_id = ? AND source = 'gcal'").run(staffId);
  db.prepare("UPDATE staff_calendar SET busy_count = 0, error = '' WHERE staff_id = ?").run(staffId);
}

// ---------------------------------------------------------------------------
// Fetching someone else's calendar, safely
// ---------------------------------------------------------------------------

// The server fetches an address the owner typed, so it only ever goes to the
// calendar services that publish iCal addresses — never an internal host.
const ALLOWED_HOST = (h) =>
  h === 'calendar.google.com' || h === 'outlook.office365.com' || h === 'outlook.live.com' ||
  /^p\d+-(caldav|calendars)\.icloud\.com$/.test(h);

/** Tests point this at a local server; production never sets it. */
const testOrigin = () => process.env.KAIRO_GCAL_TEST_ORIGIN || '';

export function checkCalendarUrl(raw) {
  let s = String(raw || '').trim();
  if (/^webcal:\/\//i.test(s)) s = 'https://' + s.slice(9);
  const bad = { url: null, error: 'Paste the "Secret address in iCal format" from your Google Calendar settings. It starts with https://calendar.google.com/calendar/ical/' };
  let u;
  try { u = new URL(s); } catch { return bad; }
  if (testOrigin() && u.origin === testOrigin()) return { url: u.href };
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return bad;
  const host = u.hostname.toLowerCase();
  if (!ALLOWED_HOST(host)) return bad;
  if (host === 'calendar.google.com' && !/\/calendar\/ical\/.+\.ics$/i.test(u.pathname)) {
    return { url: null, error: 'That is the calendar\'s web link. In Google Calendar\'s settings, under "Integrate calendar", copy the "Secret address in iCal format" instead.' };
  }
  return { url: u.href };
}

async function fetchCalendar(url) {
  let target = url;
  for (let hop = 0; hop < 4; hop++) {
    let res;
    try {
      res = await fetch(target, {
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
        headers: { accept: 'text/calendar, text/plain;q=0.5', 'user-agent': 'Kairo-Calendar/1.0' },
      });
    } catch {
      throw new Error('Could not reach your calendar. Kairo will try again in a few minutes.');
    }
    if (res.status >= 300 && res.status < 400) {
      const next = checkCalendarUrl(new URL(res.headers.get('location') || '', target).href).url;
      if (!next) throw new Error('Your calendar sent Kairo somewhere it will not follow.');
      target = next;
      continue;
    }
    if ([401, 403, 404].includes(res.status)) {
      throw new Error('Google no longer recognises that address (it may have been reset). Copy the secret address again and paste it here.');
    }
    if (!res.ok) throw new Error(`Your calendar did not answer (error ${res.status}). Kairo will try again in a few minutes.`);
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > MAX_BYTES) throw new Error('That calendar is too big to read (over 5 MB).');
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 4096))) {
      throw new Error('That address did not return a calendar. Use the "Secret address in iCal format".');
    }
    return text;
  }
  throw new Error('Your calendar redirected too many times.');
}

// ---------------------------------------------------------------------------
// iCal parsing
// ---------------------------------------------------------------------------

function parseLine(line) {
  let i = 0;
  let quoted = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ':' && !quoted) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i).split(';');
  const params = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: head[0].toUpperCase(), params, value: line.slice(i + 1).trim() };
}

/** VEVENTs as { props: {NAME: {params, value}}, exdates: [...] }. Alarms inside are skipped. */
export function parseEvents(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let ev = null;
  let nested = 0;
  for (const line of lines) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      if (ev) nested++;
      else if (p.value.toUpperCase() === 'VEVENT') ev = { props: {}, exdates: [] };
      continue;
    }
    if (p.name === 'END') {
      if (nested) nested--;
      else if (ev && p.value.toUpperCase() === 'VEVENT') { events.push(ev); ev = null; }
      continue;
    }
    if (!ev || nested) continue;
    if (p.name === 'EXDATE') ev.exdates.push(p);
    else if (!ev.props[p.name]) ev.props[p.name] = p;
  }
  return events;
}

// --- time zones ------------------------------------------------------------

const fmts = new Map();
function fmt(tz) {
  if (!fmts.has(tz)) {
    fmts.set(tz, new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return fmts.get(tz);
}

function wallClock(ms, tz) {
  const p = Object.fromEntries(fmt(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

/** The UTC instant at which the clock in `tz` reads y-mo-d h:mi:s. */
function zonedToUtc(y, mo, d, h, mi, s, tz) {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  if (tz === 'UTC') return asUtc;
  const offset = (ms) => {
    const w = wallClock(ms, tz);
    return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - ms;
  };
  let ms = asUtc - offset(asUtc);
  const again = asUtc - offset(ms);
  if (again !== ms) ms = again;
  return ms;
}

/** An instant as the business's own date and minute of the day. */
function localDateMin(ms, tz, roundUp = false) {
  const w = wallClock(ms, tz);
  const min = w.h * 60 + w.mi + (roundUp && w.s ? 1 : 0);
  return { date: `${w.y}-${String(w.mo).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`, min };
}

const dayNum = (y, mo, d) => Date.UTC(y, mo - 1, d) / DAY;
const dayStr = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const weekday = (n) => (((n + 4) % 7) + 7) % 7; // 1 Jan 1970 was a Thursday

/**
 * A DTSTART/DTEND/EXDATE value. All-day values are { day }; timed ones carry
 * the wall clock and zone they were written in (so a weekly 9 am stays 9 am
 * across a daylight-saving change) and the instant.
 */
function parseWhen(value, params, fallbackTz) {
  const v = String(value || '').trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) return { allDay: true, day: dayNum(+m[1], +m[2], +m[3]) };
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] || '0'].map(Number);
  const tz = m[7] ? 'UTC' : (isValidTimeZone(params?.TZID) ? params.TZID : fallbackTz);
  return { allDay: false, tz, y, mo, d, h, mi, s, day: dayNum(y, mo, d), ms: zonedToUtc(y, mo, d, h, mi, s, tz) };
}

function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(String(v || '').trim());
  if (!m) return null;
  const ms = ((+m[2] || 0) * 7 * DAY) + ((+m[3] || 0) * DAY) + ((+m[4] || 0) * 3600000) + ((+m[5] || 0) * 60000) + ((+m[6] || 0) * 1000);
  return m[1] === '-' ? -ms : ms;
}

// --- repeats (RRULE) -------------------------------------------------------

const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const daysInMonth = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Days of month m0 that match a BYDAY entry like TU, 2TU or -1FR. */
function monthWeekdays(y, m0, { n, wd }) {
  const len = daysInMonth(y, m0);
  const all = [];
  for (let d = 1; d <= len; d++) if (weekday(dayNum(y, m0 + 1, d)) === wd) all.push(d);
  if (!n) return all;
  const pick = n > 0 ? all[n - 1] : all[all.length + n];
  return pick ? [pick] : [];
}

/** Every day the rule lands on, in order, from startDay to lastDay. */
function* ruleDays(rule, startDay, lastDay) {
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const byday = rule.BYDAY
    ? rule.BYDAY.split(',').map((x) => {
      const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(x.trim());
      return m && { n: m[1] ? Number(m[1]) : 0, wd: WD[m[2].toUpperCase()] };
    }).filter(Boolean)
    : null;
  const bymd = rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number).filter((n) => n && Math.abs(n) <= 31) : null;
  const bymonth = rule.BYMONTH ? rule.BYMONTH.split(',').map(Number).filter((n) => n >= 1 && n <= 12).sort((a, b) => a - b) : null;
  const start = new Date(startDay * DAY);
  const sy = start.getUTCFullYear(), sm = start.getUTCMonth(), sd = start.getUTCDate();
  const inMonth = (n) => !bymonth || bymonth.includes(new Date(n * DAY).getUTCMonth() + 1);

  // Days of one month the rule picks (MONTHLY, and YEARLY within a month).
  const pickInMonth = (y, m0, defaultDay) => {
    const len = daysInMonth(y, m0);
    let list;
    if (bymd) list = bymd.map((d) => (d > 0 ? d : len + d + 1)).filter((d) => d >= 1 && d <= len);
    else if (byday) list = byday.flatMap((b) => monthWeekdays(y, m0, b));
    else list = defaultDay <= len ? [defaultDay] : [];
    return [...new Set(list)].sort((a, b) => a - b).map((d) => dayNum(y, m0 + 1, d));
  };

  switch (String(rule.FREQ || '').toUpperCase()) {
    case 'DAILY':
      for (let n = startDay; n <= lastDay; n += interval) {
        if (byday && !byday.some((b) => b.wd === weekday(n))) continue;
        if (inMonth(n)) yield n;
      }
      return;
    case 'WEEKLY': {
      const wkst = WD[String(rule.WKST || 'MO').toUpperCase()] ?? 1;
      const days = byday?.length ? byday.map((b) => b.wd) : [weekday(startDay)];
      const offsets = [...new Set(days.map((wd) => (wd - wkst + 7) % 7))].sort((a, b) => a - b);
      for (let w = startDay - ((weekday(startDay) - wkst + 7) % 7); w <= lastDay; w += 7 * interval) {
        for (const o of offsets) {
          const n = w + o;
          if (n >= startDay && n <= lastDay && inMonth(n)) yield n;
        }
      }
      return;
    }
    case 'MONTHLY':
      for (let k = 0; ; k += interval) {
        const y = sy + Math.floor((sm + k) / 12), m0 = (sm + k) % 12;
        if (dayNum(y, m0 + 1, 1) > lastDay) return;
        if (bymonth && !bymonth.includes(m0 + 1)) continue;
        for (const n of pickInMonth(y, m0, sd)) if (n >= startDay && n <= lastDay) yield n;
      }
    case 'YEARLY':
      for (let k = 0; ; k += interval) {
        const y = sy + k;
        if (dayNum(y, 1, 1) > lastDay) return;
        for (const mo of bymonth || [sm + 1]) {
          const list = (bymd || byday) ? pickInMonth(y, mo - 1, sd) : (sd <= daysInMonth(y, mo - 1) ? [dayNum(y, mo, sd)] : []);
          for (const n of list) if (n >= startDay && n <= lastDay) yield n;
        }
      }
    default:
  }
}

function parseRule(value) {
  const rule = {};
  for (const part of String(value || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return rule;
}

/**
 * Busy stretches of time in [fromDay, toDay] (day numbers), as
 * { startMs, endMs } for timed events and { startDay, endDay } (end exclusive)
 * for all-day ones.
 */
export function busyTimes(text, { tz, fromDay, toDay }) {
  const events = parseEvents(text);
  const val = (ev, k) => ev.props[k]?.value || '';

  // A moved or cancelled single instance of a repeating event arrives as its
  // own VEVENT carrying RECURRENCE-ID; the series must skip that instance.
  const replaced = new Map();
  for (const ev of events) {
    const rid = ev.props['RECURRENCE-ID'];
    if (!rid) continue;
    const w = parseWhen(rid.value, rid.params, tz);
    if (!w) continue;
    const uid = val(ev, 'UID');
    if (!replaced.has(uid)) replaced.set(uid, new Set());
    replaced.get(uid).add(w.allDay ? `d${w.day}` : `t${w.ms}`);
  }

  const out = [];
  for (const ev of events) {
    if (val(ev, 'STATUS').toUpperCase() === 'CANCELLED') continue;
    if (val(ev, 'TRANSP').toUpperCase() === 'TRANSPARENT') continue; // marked "Free"
    const start = parseWhen(val(ev, 'DTSTART'), ev.props.DTSTART?.params, tz);
    if (!start) continue;
    const endProp = ev.props.DTEND ? parseWhen(val(ev, 'DTEND'), ev.props.DTEND.params, tz) : null;
    const dur = ev.props.DURATION ? parseDuration(val(ev, 'DURATION')) : null;

    let spanDays = 1;
    let spanMs = 0;
    if (start.allDay) {
      if (endProp?.allDay) spanDays = endProp.day - start.day;
      else if (dur != null) spanDays = Math.round(dur / DAY);
      if (spanDays < 1) spanDays = 1;
    } else {
      if (endProp && !endProp.allDay) spanMs = endProp.ms - start.ms;
      else if (dur != null) spanMs = dur;
      if (spanMs <= 0) continue; // a reminder-style event with no length blocks nothing
    }

    const push = (day, ms) => {
      if (start.allDay) out.push({ startDay: day, endDay: day + spanDays });
      else out.push({ startMs: ms, endMs: ms + spanMs });
    };

    const rrule = ev.props.RRULE && !ev.props['RECURRENCE-ID'] ? parseRule(val(ev, 'RRULE')) : null;
    if (!rrule) {
      const lastDay = start.allDay ? start.day + spanDays - 1 : start.day + Math.ceil(spanMs / DAY) + 1;
      if (lastDay >= fromDay - 1 && start.day <= toDay + 1) push(start.day, start.ms);
      continue;
    }

    const skip = new Set(replaced.get(val(ev, 'UID')) || []);
    for (const ex of ev.exdates) {
      for (const v of ex.value.split(',')) {
        const w = parseWhen(v, ex.params, start.tz || tz);
        if (w) skip.add(w.allDay && !start.allDay ? `x${w.day}` : (w.allDay ? `d${w.day}` : `t${w.ms}`));
      }
    }

    let lastDay = toDay + 1;
    let untilMs = Infinity;
    if (rrule.UNTIL) {
      const u = parseWhen(rrule.UNTIL, {}, start.tz || tz);
      if (u?.allDay) lastDay = Math.min(lastDay, u.day);
      else if (u) { untilMs = u.ms; lastDay = Math.min(lastDay, u.day + 1); }
    }
    const count = Number(rrule.COUNT) || Infinity;

    let seen = 0;
    let steps = 0;
    for (const day of ruleDays(rrule, start.day, lastDay)) {
      if (++steps > 100000 || seen >= count) break;
      let ms = 0;
      if (!start.allDay) {
        const d = new Date(day * DAY);
        ms = zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), start.h, start.mi, start.s, start.tz);
        if (ms > untilMs) break;
      }
      seen++;
      if (skip.has(start.allDay ? `d${day}` : `t${ms}`) || skip.has(`x${day}`)) continue;
      if (day + spanDays + Math.ceil(spanMs / DAY) < fromDay - 1) continue;
      push(day, ms);
    }
  }
  return out;
}

/** Busy times as the business's own day-by-day blocks, clipped and merged. */
export function toBlocks(times, { tz, fromDate, toDate }) {
  const byDate = new Map();
  const add = (date, start, end) => {
    if (date < fromDate || date > toDate || end <= start) return;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push([start, end]);
  };
  for (const t of times) {
    if (t.startDay !== undefined) {
      for (let n = t.startDay; n < t.endDay; n++) add(dayStr(n), 0, 1440);
      continue;
    }
    const a = localDateMin(t.startMs, tz);
    const b = localDateMin(t.endMs, tz, true);
    for (let d = a.date, guard = 0; d <= b.date && guard < 400; d = addDaysStr(d, 1), guard++) {
      add(d, d === a.date ? a.min : 0, d === b.date ? Math.min(b.min, 1440) : 1440);
    }
  }
  const blocks = [];
  for (const [date, spans] of [...byDate].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    spans.sort((x, y) => x[0] - y[0]);
    let [s, e] = spans[0];
    for (const [s2, e2] of spans.slice(1)) {
      if (s2 <= e) e = Math.max(e, e2);
      else { blocks.push({ date, start: s, end: e }); [s, e] = [s2, e2]; }
    }
    blocks.push({ date, start: s, end: e });
  }
  return blocks.slice(0, MAX_BLOCKS);
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

/** The business's zone; with none set, the server's own (what nowParts falls back to). */
function bizTz() {
  const tz = getSetting('business_tz', '');
  return isValidTimeZone(tz) ? tz : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
}

/** Read one member's calendar now and replace their imported busy time. */
export async function syncMember(staffId) {
  const row = calendarRow(staffId);
  if (!row || !row.import_on || !row.import_url) return calendarStatus(staffId);
  const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  let text;
  try {
    text = await fetchCalendar(row.import_url);
  } catch (err) {
    db.prepare('UPDATE staff_calendar SET checked_at = ?, error = ? WHERE staff_id = ?').run(stamp(), String(err.message).slice(0, 300), staffId);
    return calendarStatus(staffId);
  }
  // The owner may have switched it off while the read was in flight.
  const still = calendarRow(staffId);
  if (!still?.import_on || still.import_url !== row.import_url) return calendarStatus(staffId);

  const tz = bizTz();
  const today = nowParts(getSetting('business_tz', '')).date;
  const horizon = Math.min(400, Math.max(30, Number(getSetting('booking_horizon_days', '90')) || 90));
  const fromDate = addDaysStr(today, -7);
  const toDate = addDaysStr(today, horizon);
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const blocks = toBlocks(
    busyTimes(text, { tz, fromDay: dayNum(fy, fm, fd), toDay: dayNum(ty, tm, td) }),
    { tz, fromDate, toDate }
  );

  db.exec('BEGIN');
  try {
    db.prepare("DELETE FROM time_blocks WHERE staff_id = ? AND source = 'gcal'").run(staffId);
    const ins = db.prepare(
      "INSERT INTO time_blocks (staff_id, date, start_min, end_min, reason, source) VALUES (?, ?, ?, ?, ?, 'gcal')"
    );
    for (const b of blocks) ins.run(staffId, b.date, b.start, b.end, BUSY_REASON);
    db.prepare("UPDATE staff_calendar SET checked_at = ?, error = '', busy_count = ? WHERE staff_id = ?").run(stamp(), blocks.length, staffId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return calendarStatus(staffId);
}

/** Every member of the current business whose calendar is due a read. Runs on the minute tick. */
export async function syncDue() {
  const due = db.prepare(
    `SELECT sc.staff_id FROM staff_calendar sc JOIN staff s ON s.id = sc.staff_id
     WHERE s.active = 1 AND sc.import_on = 1 AND sc.import_url != ''
       AND (sc.checked_at = '' OR sc.checked_at <= datetime('now', ?))`
  ).all(`-${SYNC_EVERY_MIN} minutes`);
  for (const { staff_id } of due) {
    try {
      await syncMember(staff_id);
    } catch (err) {
      console.error('calendar sync:', err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// The feed Google subscribes to
// ---------------------------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

/** Lines over 75 bytes are folded, as the format requires. */
function fold(line) {
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** The calendar file for a feed token, or null when there is no such (switched-on) feed. */
export function feedFor(token) {
  if (!/^[a-f0-9]{32}$/.test(String(token || ''))) return null;
  const row = db.prepare(
    `SELECT sc.staff_id, s.name FROM staff_calendar sc JOIN staff s ON s.id = sc.staff_id
     WHERE sc.feed_on = 1 AND sc.feed_token = ?`
  ).get(token);
  if (!row) return null;

  const zone = getSetting('business_tz', '');
  const tz = isValidTimeZone(zone) ? zone : '';
  const today = nowParts(zone).date;
  const appts = db.prepare(
    `SELECT a.id, a.date, a.start_min, a.end_min, a.status,
            c.first_name, c.last_name, c.phone,
            COALESCE((SELECT group_concat(sv2.name, ' + ') FROM
                        (SELECT x.service_id FROM appointment_services x WHERE x.appointment_id = a.id ORDER BY x.sort_order) xs
                        JOIN services sv2 ON sv2.id = xs.service_id), sv.name) AS services
     FROM appointments a
     LEFT JOIN clients c ON c.id = a.client_id
     LEFT JOIN services sv ON sv.id = a.service_id
     WHERE a.staff_id = ? AND a.date >= ? AND a.date <= ? AND a.status NOT IN ('cancelled', 'no_show')
     ORDER BY a.date, a.start_min LIMIT 3000`
  ).all(row.staff_id, addDaysStr(today, -60), addDaysStr(today, 400));

  const two = (n) => String(n).padStart(2, '0');
  const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const at = (date, min) => {
    const [y, mo, d] = date.split('-').map(Number);
    const h = Math.floor(min / 60), mi = min % 60;
    if (!tz) return `${y}${two(mo)}${two(d)}T${two(h % 24)}${two(mi)}00`; // the business's local time, as written
    return stamp(zonedToUtc(y, mo, d, h, mi, 0, tz));
  };
  const biz = getSetting('business_name', 'Kairo');
  const host = (getSetting('public_url', '') || 'kairo').replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '');
  const now = stamp(Date.now());

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kairo//Bookings//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`${biz} · ${row.name} (Kairo)`)}`,
    ...(tz ? [`X-WR-TIMEZONE:${tz}`] : []),
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M',
  ];
  for (const a of appts) {
    const who = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
    const what = a.services || 'Appointment';
    lines.push(
      'BEGIN:VEVENT',
      `UID:kairo-appt-${a.id}@${host || 'kairo'}`,
      `DTSTAMP:${now}`,
      `DTSTART:${at(a.date, a.start_min)}`,
      // An appointment can run to midnight (end_min 1440): that is 00:00 the next day.
      `DTEND:${a.end_min >= 1440 ? at(addDaysStr(a.date, 1), a.end_min - 1440) : at(a.date, a.end_min)}`,
      `SUMMARY:${esc(who ? `${what} · ${who}` : what)}`,
      `DESCRIPTION:${esc([a.phone ? `Phone: ${a.phone}` : '', `Booked in Kairo (${biz})`].filter(Boolean).join('\n'))}`,
      'STATUS:CONFIRMED', 'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
