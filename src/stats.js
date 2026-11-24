// How the business is doing, over any stretch of time the owner chooses.
//
// Growth is about what to do next. This is the other half: what has actually
// happened. Every figure is counted from the salon's own diary and till, and
// each one is defined once, here, so the page, the emailed report and the
// operator's "send them their numbers" all say the same thing.
//
// THE DEFINITIONS (the page and the email repeat them in plain words)
//
//   Visit            an appointment that was not cancelled and was not a
//                    no-show. A past one still marked "booked" counts: in
//                    practice it happened and nobody tapped Complete.
//   Appointment value  what the visits were worth at the menu prices of their
//                    services. A "from" price counts at its starting price.
//                    This, not takings, is the main money figure, because many
//                    salons take payment outside Kairo.
//   Takings          payments recorded in Kairo, by the day they were paid.
//   Rebooked         a visit whose client already had their next visit booked
//                    by the end of that day, in the salon's own time zone.
//   Came back        a client seen in the period who has visited again since,
//                    or is booked to.
//   Diary full       booked minutes over the minutes the team was rostered
//                    and not blocked out.
//   Run rate         the last 30 days of appointment value, scaled to a month
//                    and a year.
//
// Read-only. Nothing here writes, sends or changes anything; emailing the
// report is the caller's job.
import { db, getSetting } from './db.js';

export const PRESETS = ['this_month', 'last_month', 'last_3_months', 'last_6_months', 'last_12_months', 'this_year'];
/** The longest range one report will cover. Three years of diary is plenty. */
export const MAX_DAYS = 1100;

const DAY_MS = 86400000;
const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY_MS;
const fromDayNum = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const addDays = (d, n) => fromDayNum(dayNum(d) + n);
const monthStart = (d) => `${d.slice(0, 7)}-01`;
const monthEnd = (d) => {
  const y = +d.slice(0, 4); const m = +d.slice(5, 7);
  return fromDayNum(Date.UTC(y, m, 1) / DAY_MS - 1);
};
/** The first day of the month `n` months before the one `d` is in. */
const monthsBack = (d, n) => {
  const y = +d.slice(0, 4); const m = +d.slice(5, 7) - 1 - n;
  return fromDayNum(Date.UTC(y, m, 1) / DAY_MS);
};
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromDayNum(dayNum(s)) === s;
export const daysIn = (from, to) => dayNum(to) - dayNum(from) + 1;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (key) => `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
const shortDate = (d) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1].slice(0, 3)} ${d.slice(0, 4)}`;

/**
 * The dates a preset covers, ending today. "Last 3 months" is this month so
 * far and the two before it, so the newest month is always in the report and
 * every month can be read on its own.
 */
export function presetRange(preset, today) {
  switch (preset) {
    case 'this_month': return { from: monthStart(today), to: today };
    case 'last_month': { const s = monthsBack(today, 1); return { from: s, to: monthEnd(s) }; }
    case 'last_6_months': return { from: monthsBack(today, 5), to: today };
    case 'last_12_months': return { from: monthsBack(today, 11), to: today };
    case 'this_year': return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'last_3_months':
    default: return { from: monthsBack(today, 2), to: today };
  }
}

/**
 * The range to report on, from what was asked. A preset wins over dates; bad
 * or missing dates fall back to the last three months rather than failing,
 * and a range is never longer than MAX_DAYS.
 */
export function resolveRange({ preset = '', from = '', to = '' } = {}, today) {
  if (PRESETS.includes(preset)) return { ...presetRange(preset, today), preset };
  if (isDate(from) && isDate(to)) {
    let [a, b] = from <= to ? [from, to] : [to, from];
    if (daysIn(a, b) > MAX_DAYS) a = addDays(b, -(MAX_DAYS - 1));
    return { from: a, to: b, preset: 'custom' };
  }
  return { ...presetRange('last_3_months', today), preset: 'last_3_months' };
}

/** The calendar months a range touches, each clipped to the range. */
export function monthsOf(from, to, today) {
  const out = [];
  for (let s = monthStart(from); s <= to; s = addDays(monthEnd(s), 1)) {
    const a = s < from ? from : s;
    const e = monthEnd(s);
    const b = e > to ? to : e;
    out.push({
      key: s.slice(0, 7),
      label: monthLabel(s.slice(0, 7)),
      from: a,
      to: b,
      // Not the whole month: the range starts or stops partway through it.
      partial: a !== s || b !== e,
      // This month, so far: still filling up, so it is read with that in mind.
      to_date: a <= today && today <= e && b >= today && today < e,
    });
  }
  return out;
}

/** `d` moved by `n` calendar months, kept inside the month it lands in (31 Mar − 1 = 28/29 Feb). */
function shiftMonths(d, n) {
  const y = +d.slice(0, 4); const m = +d.slice(5, 7) - 1 + n; const day = +d.slice(8, 10);
  const first = fromDayNum(Date.UTC(y, m, 1) / DAY_MS);
  const last = +monthEnd(first).slice(8, 10);
  return `${first.slice(0, 8)}${String(Math.min(day, last)).padStart(2, '0')}`;
}

/**
 * What to compare a range with. A range that starts on the 1st is compared
 * with the same stretch of the months before it (1 Sep–24 Nov with 1 Jun–24
 * Aug), so a month is always set against a month; "this year" is compared with
 * the same dates last year. Any other range is compared with the same number of
 * days just before it.
 */
export function previousRange(from, to, preset = '') {
  if (from.endsWith('-01')) {
    // "This year" is compared with the same dates last year.
    const span = preset === 'this_year'
      ? 12
      : (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7)) + 1;
    const pTo = to === monthEnd(to) ? monthEnd(shiftMonths(monthStart(to), -span)) : shiftMonths(to, -span);
    return { from: shiftMonths(from, -span), to: pTo };
  }
  const len = daysIn(from, to);
  const pTo = addDays(from, -1);
  return { from: addDays(pTo, -(len - 1)), to: pTo };
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

/** A UTC "YYYY-MM-DD HH:MM:SS" (SQLite's datetime('now')) as a date in `tz`. */
function localDateOf(fmt, utc) {
  const t = Date.parse(`${String(utc).replace(' ', 'T')}Z`);
  if (!Number.isFinite(t)) return String(utc).slice(0, 10);
  return fmt.format(new Date(t)); // en-CA gives YYYY-MM-DD
}

/**
 * Everything the report needs from the database, read once.
 *
 * Every appointment is loaded, not only the range's, because "new client",
 * "rebooked" and "came back" all depend on what happened before and after.
 * A busy salon has a few thousand rows a year; this is one pass over them.
 */
function load() {
  const tz = getSetting('business_tz', '') || 'Australia/Melbourne';
  let fmt;
  try { fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }); }

  const appts = db.prepare(
    `SELECT a.id, a.client_id, a.staff_id, a.service_id, a.date, a.start_min, a.end_min, a.status, a.source, a.created_at,
            COALESCE(
              (SELECT SUM(sv.price_cents) FROM appointment_services x JOIN services sv ON sv.id = x.service_id WHERE x.appointment_id = a.id),
              (SELECT sv.price_cents FROM services sv WHERE sv.id = a.service_id),
              0) AS value_cents
       FROM appointments a
      ORDER BY a.date, a.start_min, a.id`
  ).all().map((a) => ({ ...a, booked_on: localDateOf(fmt, a.created_at), visit: a.status !== 'cancelled' && a.status !== 'no_show' }));

  // Each client's appointments in date order, and the date of their first visit.
  const byClient = new Map();
  const firstVisit = new Map();
  for (const a of appts) {
    if (a.client_id == null) continue;
    if (!byClient.has(a.client_id)) byClient.set(a.client_id, []);
    byClient.get(a.client_id).push(a);
    if (a.visit && !firstVisit.has(a.client_id)) firstVisit.set(a.client_id, a.date);
  }

  // The services each appointment bundled, for the top-services table.
  const lines = new Map();
  for (const r of db.prepare(
    `SELECT x.appointment_id AS id, sv.id AS service_id, sv.name, sv.price_cents
       FROM appointment_services x JOIN services sv ON sv.id = x.service_id ORDER BY x.sort_order, x.id`
  ).all()) {
    if (!lines.has(r.id)) lines.set(r.id, []);
    lines.get(r.id).push(r);
  }
  const services = new Map(db.prepare('SELECT id, name, price_cents FROM services').all().map((s) => [s.id, s]));
  const staff = db.prepare('SELECT id, name, active FROM staff ORDER BY id').all();
  return { appts, byClient, firstVisit, lines, services, staff };
}

/**
 * The figures for one stretch of dates.
 *
 * `windowFor(staffId, date)` is the bookable window ({open, close} minutes, or
 * null when that person is not working) and `blocksFor(staffId, date)` the
 * blocked-out time in it. They come from the caller so the roster rules live
 * in one place.
 */
function figures(data, from, to, { today, windowFor, blocksFor }) {
  const inRange = data.appts.filter((a) => a.date >= from && a.date <= to);
  const visits = inRange.filter((a) => a.visit);
  const cancelled = inRange.filter((a) => a.status === 'cancelled').length;
  const noShows = inRange.filter((a) => a.status === 'no_show').length;
  const value = visits.reduce((n, a) => n + a.value_cents, 0);
  const online = visits.filter((a) => a.source === 'online').length;

  const takings = db.prepare(
    'SELECT COALESCE(SUM(amount_cents), 0) AS v FROM payments WHERE substr(paid_at, 1, 10) >= ? AND substr(paid_at, 1, 10) <= ?'
  ).get(from, to).v;

  // Clients: who was seen, who was new, who rebooked, who came back.
  const seen = new Map(); // client_id → last visit date in the range
  for (const a of visits) if (a.client_id != null) seen.set(a.client_id, a.date);
  let newClients = 0;
  for (const id of seen.keys()) {
    const f = data.firstVisit.get(id);
    if (f && f >= from && f <= to) newClients++;
  }
  // Rebooked: only visits that have already happened can have been rebooked.
  const done = visits.filter((a) => a.client_id != null && a.date <= today);
  let rebooked = 0;
  for (const v of done) {
    const later = data.byClient.get(v.client_id) || [];
    if (later.some((x) => x.id !== v.id && x.status !== 'cancelled' && x.date > v.date && x.booked_on <= v.date)) rebooked++;
  }
  let cameBack = 0;
  for (const [id, last] of seen) {
    if ((data.byClient.get(id) || []).some((x) => x.visit && x.date > last)) cameBack++;
  }

  // How full the diary was: the team's rostered minutes, less blocked time,
  // against the minutes booked into them.
  const working = new Set(data.staff.filter((s) => s.active).map((s) => s.id));
  for (const a of visits) working.add(a.staff_id);
  let available = 0;
  let booked = 0;
  const bookedBy = new Map();
  for (const a of visits) {
    const k = `${a.staff_id}|${a.date}`;
    bookedBy.set(k, (bookedBy.get(k) || 0) + Math.max(0, a.end_min - a.start_min));
  }
  const perStaff = new Map();
  // Days before the salon's first appointment in Kairo are not empty diary,
  // they are before Kairo: counting them would make a salon that moved across
  // in September look a quarter full all year.
  const started = data.appts.length ? data.appts[0].date : to;
  for (let d = from < started ? started : from; d <= to; d = addDays(d, 1)) {
    for (const id of working) {
      const w = windowFor(id, d);
      let open = 0;
      if (w && w.close > w.open) {
        open = w.close - w.open;
        // Blocked minutes inside the window, overlaps counted once.
        const spans = (blocksFor(id, d) || [])
          .map((b) => [Math.max(w.open, b.start_min), Math.min(w.close, b.end_min)])
          .filter(([s, e]) => e > s)
          .sort((x, y) => x[0] - y[0]);
        let cur = -1;
        for (const [s, e] of spans) {
          const start = Math.max(s, cur);
          if (e > start) { open -= e - start; cur = e; }
        }
      }
      // Time booked outside the roster (an after-hours favour) is not counted
      // against it, and a day can never be more than full.
      if (open <= 0) continue;
      const b = Math.min(bookedBy.get(`${id}|${d}`) || 0, open);
      available += open;
      booked += b;
      const ps = perStaff.get(id) || { available: 0, booked: 0 };
      ps.available += open;
      ps.booked += b;
      perStaff.set(id, ps);
    }
  }

  return {
    value_cents: value,
    takings_cents: takings,
    visits: visits.length,
    cancelled,
    no_shows: noShows,
    cancel_rate: pct(cancelled, inRange.length),
    no_show_rate: pct(noShows, visits.length + noShows),
    online,
    online_share: pct(online, visits.length),
    avg_value_cents: visits.length ? Math.round(value / visits.length) : 0,
    clients_seen: seen.size,
    new_clients: newClients,
    returning_clients: seen.size - newClients,
    rebooked,
    rebook_rate: pct(rebooked, done.length),
    came_back: cameBack,
    return_rate: pct(cameBack, seen.size),
    booked_min: booked,
    available_min: available,
    diary_full: pct(booked, available),
    _visits: visits,
    _perStaff: perStaff,
  };
}

const strip = ({ _visits, _perStaff, ...rest }) => rest;

/**
 * The whole report for a range: the totals, each month on its own, the same
 * length of time just before for comparison, the run rate, and what sold.
 */
export function businessStats({ preset = '', from = '', to = '' } = {}, { today, windowFor, blocksFor }) {
  const range = resolveRange({ preset, from, to }, today);
  const data = load();
  const ctx = { today, windowFor, blocksFor };

  const total = figures(data, range.from, range.to, ctx);
  const months = monthsOf(range.from, range.to, today).map((m) => ({ ...m, ...strip(figures(data, m.from, m.to, ctx)) }));

  const len = daysIn(range.from, range.to);
  const { from: prevFrom, to: prevTo } = previousRange(range.from, range.to, range.preset);
  const previous = { from: prevFrom, to: prevTo, ...strip(figures(data, prevFrom, prevTo, ctx)) };

  // Run rate: the last 30 days of appointment value, as a month and a year.
  const last30 = figures(data, addDays(today, -29), today, ctx);
  const thisMonthFrom = monthStart(today);
  const thisMonth = figures(data, thisMonthFrom, today, ctx);
  const elapsed = daysIn(thisMonthFrom, today);
  const monthDays = daysIn(thisMonthFrom, monthEnd(today));
  const ahead = data.appts.filter((a) => a.visit && a.date > today && a.date <= addDays(today, 30));
  const restOfMonth = data.appts.filter((a) => a.visit && a.date > today && a.date <= monthEnd(today));
  const run_rate = {
    last_30_days_cents: last30.value_cents,
    month_cents: Math.round((last30.value_cents / 30) * (365 / 12)),
    year_cents: Math.round((last30.value_cents / 30) * 365),
    takings_last_30_days_cents: last30.takings_cents,
    this_month_so_far_cents: thisMonth.value_cents,
    this_month_pace_cents: Math.round((thisMonth.value_cents / elapsed) * monthDays),
    rest_of_month_booked_cents: restOfMonth.reduce((n, a) => n + a.value_cents, 0),
    next_30_days_booked_cents: ahead.reduce((n, a) => n + a.value_cents, 0),
    next_30_days_booked: ahead.length,
  };

  // What sold, by service. A bundled appointment counts each of its services.
  const bySvc = new Map();
  for (const a of total._visits) {
    const ls = data.lines.get(a.id) || (data.services.get(a.service_id) ? [{ service_id: a.service_id, ...data.services.get(a.service_id) }] : []);
    for (const l of ls) {
      const s = bySvc.get(l.service_id) || { name: l.name, count: 0, value_cents: 0 };
      s.count++; s.value_cents += l.price_cents || 0;
      bySvc.set(l.service_id, s);
    }
  }
  const top_services = [...bySvc.values()].sort((a, b) => b.value_cents - a.value_cents || b.count - a.count).slice(0, 8);

  // Each team member who worked or was booked in the range.
  const team = data.staff.map((s) => {
    const v = total._visits.filter((a) => a.staff_id === s.id);
    const ps = total._perStaff.get(s.id) || { available: 0, booked: 0 };
    return {
      id: s.id, name: s.name, visits: v.length,
      value_cents: v.reduce((n, a) => n + a.value_cents, 0),
      diary_full: pct(ps.booked, ps.available),
    };
  }).filter((t) => t.visits > 0).sort((a, b) => b.value_cents - a.value_cents);

  // The busiest days of the week.
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wk = DAYS.map((name) => ({ name, visits: 0, value_cents: 0 }));
  for (const a of total._visits) {
    const d = wk[new Date(dayNum(a.date) * DAY_MS).getUTCDay()];
    d.visits++; d.value_cents += a.value_cents;
  }

  return {
    ...range,
    today,
    days: len,
    currency: getSetting('currency', '$'),
    business_name: getSetting('business_name', ''),
    total: strip(total),
    months,
    previous,
    run_rate,
    top_services,
    team,
    weekdays: wk,
  };
}

// ── The emailed report ───────────────────────────────────────────────────────

const money = (cur, cents) => `${cur}${(Math.round(cents) / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const rate = (v) => (v == null ? '–' : `${Math.round(v)}%`);

/** The rows every month is read by, in the order a salon owner thinks of them. */
export function reportRows(r) {
  const cur = r.currency || '$';
  return [
    ['Appointment value', (m) => money(cur, m.value_cents)],
    ['Appointments', (m) => String(m.visits)],
    ['Average appointment', (m) => (m.visits ? money(cur, m.avg_value_cents) : '–')],
    ['Clients seen', (m) => String(m.clients_seen)],
    ['New clients', (m) => String(m.new_clients)],
    ['Rebooked before leaving', (m) => rate(m.rebook_rate)],
    ['Came back or booked again', (m) => rate(m.return_rate)],
    ['Diary full', (m) => rate(m.diary_full)],
    ['Booked online', (m) => rate(m.online_share)],
    ['Cancellations', (m) => `${m.cancelled} (${rate(m.cancel_rate)})`],
    ['No-shows', (m) => `${m.no_shows} (${rate(m.no_show_rate)})`],
    ['Payments taken in Kairo', (m) => money(cur, m.takings_cents)],
  ];
}

const monthHead = (m) => `${m.label.replace(/ \d{4}$/, '')}${m.to_date ? ' (so far)' : m.partial ? ` (${+m.from.slice(8)}–${+m.to.slice(8)})` : ''}`;

/** The report as an email: a subject, a plain-text body and the parts of the HTML one. */
export function reportEmail(r, { greetingName = '' } = {}) {
  const cur = r.currency || '$';
  const rows = reportRows(r);
  const span = r.months.length > 1
    ? `${r.months[0].label.replace(/ \d{4}$/, r.months[0].key.slice(0, 4) === r.months.at(-1).key.slice(0, 4) ? '' : ` ${r.months[0].key.slice(0, 4)}`)} to ${r.months.at(-1).label}`
    : (r.months[0]?.label || `${shortDate(r.from)} to ${shortDate(r.to)}`);
  const subject = `${r.business_name ? `${r.business_name}: ` : ''}your numbers, ${span}`;
  const rr = r.run_rate;
  const t = r.total;

  const summary = [
    `${t.visits} appointments worth ${money(cur, t.value_cents)} at your menu prices, from ${t.clients_seen} clients (${t.new_clients} of them new).`,
    `${rate(t.rebook_rate)} of visits were rebooked before the client left, and the diary was ${rate(t.diary_full)} full.`,
    `At the pace of the last 30 days that's about ${money(cur, rr.month_cents)} a month, or ${money(cur, rr.year_cents)} a year. ${money(cur, rr.next_30_days_booked_cents)} is already booked for the next 30 days.`,
  ];

  // Months as columns, four at a time, so it reads on a phone.
  const tables = [];
  for (let i = 0; i < r.months.length; i += 4) {
    const ms = r.months.slice(i, i + 4);
    const withTotal = r.months.length > 1 && i + 4 >= r.months.length;
    tables.push({
      head: ['', ...ms.map(monthHead), ...(withTotal ? ['Total'] : [])],
      rows: rows.map(([label, f]) => [label, ...ms.map(f), ...(withTotal ? [f(t)] : [])]),
    });
  }

  const text = [
    `${greetingName ? `Hi ${greetingName},` : 'Hi,'}`,
    '',
    `Here's how ${r.business_name || 'the business'} did from ${shortDate(r.from)} to ${shortDate(r.to)}.`,
    '',
    ...summary,
    '',
    ...r.months.flatMap((m) => [
      `${m.label}${m.to_date ? ' (so far)' : m.partial ? ` (${shortDate(m.from)} to ${shortDate(m.to)})` : ''}`,
      ...rows.map(([label, f]) => `  ${label}: ${f(m)}`),
      '',
    ]),
    ...(r.months.length > 1 ? ['Total', ...rows.map(([label, f]) => `  ${label}: ${f(t)}`), ''] : []),
    ...(r.top_services.length ? ['Top services', ...r.top_services.slice(0, 5).map((s) => `  ${s.name}: ${s.count} × ${money(cur, s.value_cents)}`), ''] : []),
    'Appointment value is what the appointments were worth at your menu prices ("from" prices at their starting price), not counting cancellations or no-shows. "Payments taken in Kairo" only counts payments recorded in Kairo.',
    '',
    'You can see these any time, for any dates, under Performance in Kairo.',
  ].join('\n');

  return {
    subject,
    text,
    heading: `Your numbers: ${span}`,
    greeting: greetingName ? `Hi ${greetingName},` : '',
    paragraphs: [`Here's how ${r.business_name || 'the business'} did from ${shortDate(r.from)} to ${shortDate(r.to)}.`, ...summary],
    tables,
    footNote: 'Appointment value is what the appointments were worth at your menu prices ("from" prices at their starting price), not counting cancellations or no-shows. "Payments taken in Kairo" only counts payments recorded in Kairo. See these any time, for any dates, under Performance in Kairo.',
  };
}
