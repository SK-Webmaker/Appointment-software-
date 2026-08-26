// What the diary is quietly costing the business.
//
// A dashboard that says "revenue this month: $12,430" is a report. It tells an
// owner what already happened, which they largely knew. This module looks for
// the money that did NOT happen and could still be recovered: hours nobody
// booked, regulars who have drifted off, cancellations nobody backfilled, an
// afternoon that is dead every single week, and the handful of clients who
// account for most of the no-shows.
//
// Three rules run through all of it, because a panel like this is trusted or
// ignored and there is no middle:
//
//   1. NEVER GUESS. Every finding is derived from rows that exist. If there
//      isn't enough history to be sure, the finding is withheld rather than
//      softened — telling a three-week-old salon its Tuesdays are weak is
//      worse than saying nothing.
//   2. VALUE CONSERVATIVELY. A gap is worth the CHEAPEST service that fits it,
//      not the dearest, and only on days that historically book. An inflated
//      number is believed once and never again.
//   3. SHOW THE WORKING. Every finding carries the evidence that produced it,
//      so the owner can check rather than trust.
//
// This module only ever READS. Nothing here sends a message, changes an
// appointment or spends a cent — that is deliberate, and it is what makes this
// safe to put in front of a live salon.
import { db, getSetting } from './db.js';
import { suggestionFor } from './campaigns.js';

/** Minutes → "1h 30m" / "45m", for evidence lines. */
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOf = (date) => new Date(`${date}T12:00:00`).getDay();

/** "10:30am" — the way an owner reads a time, not 630. */
function clock(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const ap = h >= 12 ? 'pm' : 'am';
  return `${(h % 12) || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${ap}`;
}

/**
 * The one or two times to name in a message.
 *
 * De-duplicated before it is trimmed to two, because two stylists free at nine
 * o'clock is one time as far as a customer reading it is concerned, and a
 * salon sending out "we've had 8am or 8am come free" looks broken in a way that
 * costs it the booking. Trimming first would give "8am or 8am"; deduping first
 * gives "8am or 10am", which is the useful answer.
 */
const namedTimes = (rows) => [...new Set(rows.map((r) => clock(r.start_min)))].slice(0, 2).join(' or ');

/**
 * Every finding has the same shape, so the dashboard can render a list it does
 * not have to understand and new kinds can be added without touching the UI.
 *
 * `worth_cents` is what is recoverable, not what was lost — the two differ and
 * only one of them is actionable.
 */
const finding = (o) => ({
  kind: o.kind,
  kicker: o.kicker,
  title: o.title,
  detail: o.detail,
  worth_cents: o.worth_cents ?? 0,
  worth_label: o.worth_label || '',
  evidence: o.evidence || [],
  actions: o.actions || [],
  // What to actually do about it, and — where a message is the answer — the
  // context the campaign builder needs to pick the right people.
  suggestion: suggestionFor(o.kind, o.context || {}),
  campaign: o.campaign || null,
});

// ---------------------------------------------------------------------------
// 1. Empty time in the days ahead
// ---------------------------------------------------------------------------

/**
 * Bookable holes in the next few days, valued at what could realistically fill
 * them.
 *
 * Two limits stop this becoming a fantasy number, and both were added after
 * watching it claim 95 hours of "lost" time on a real diary:
 *
 *   - A gap must be big enough for the SHORTEST active service. A 10-minute
 *     sliver between two colours is not a lost booking, it is how diaries work.
 *   - A gap must be no LONGER than MAX_GAP. A nine-hour hole is not a gap
 *     somebody might fill on Thursday, it is a day nobody is rostered for —
 *     a rostering question, not a marketing one, and counting it as recoverable
 *     revenue is how a panel like this stops being believed.
 *
 * And a member with nothing at all booked that day is skipped entirely, for
 * the same reason: an empty column is not a set of gaps.
 */
function emptyTime({ today, horizonDays = 3, hoursFor, staffWindow, blocksFor }) {
  const MAX_GAP = 180;
  const staff = db.prepare('SELECT id, name FROM staff WHERE active = 1').all();
  const services = db.prepare(
    'SELECT name, duration_min, price_cents FROM services WHERE active = 1 AND price_cents > 0 ORDER BY duration_min'
  ).all();
  if (!staff.length || !services.length) return null;

  const shortest = services[0];
  const days = [];

  for (let i = 1; i <= horizonDays; i++) {
    const date = addDays(today, i);
    if (!hoursFor(date)) continue; // shut that day
    for (const member of staff) {
      const win = staffWindow(member.id, date);
      if (!win) continue; // rostered off
      const appts = db.prepare(
        `SELECT start_min, end_min FROM appointments
         WHERE staff_id = ? AND date = ? AND status NOT IN ('cancelled', 'no_show')`
      ).all(member.id, date);
      // Nothing booked at all is an empty column, not a list of gaps.
      if (!appts.length) continue;
      const busy = [...appts, ...blocksFor(member.id, date)].sort((a, b) => a.start_min - b.start_min);

      let cursor = win.open;
      const holes = [];
      for (const b of busy) {
        if (b.end_min <= cursor) continue;
        if (b.start_min > cursor) holes.push({ start_min: cursor, end_min: Math.min(b.start_min, win.close) });
        cursor = Math.max(cursor, b.end_min);
        if (cursor >= win.close) break;
      }
      if (cursor < win.close) holes.push({ start_min: cursor, end_min: win.close });

      for (const h of holes) {
        const length = h.end_min - h.start_min;
        if (length < shortest.duration_min || length > MAX_GAP) continue;
        // The best-value service that actually fits, valued at the cheapest
        // option of that length — deliberately the low estimate.
        const fits = services.filter((s) => s.duration_min <= length);
        const worth = fits.length ? Math.min(...fits.map((s) => s.price_cents)) : 0;
        days.push({ date, staff_id: member.id, staff_name: member.name, ...h, minutes: length, worth_cents: worth });
      }
    }
  }
  if (!days.length) return null;
  const real = days;

  const soonest = real.filter((g) => g.date === real[0].date);
  const totalWorth = real.reduce((n, g) => n + g.worth_cents, 0);
  const totalMin = real.reduce((n, g) => n + g.minutes, 0);
  const when = real[0].date === addDays(today, 1) ? 'tomorrow' : DAY_NAMES[weekdayOf(real[0].date)];

  return finding({
    kind: 'empty_time',
    kicker: `Empty time · ${when}`,
    title: soonest.length === 1
      ? `A ${dur(soonest[0].minutes)} gap ${when} nobody has taken`
      : `${soonest.length} gaps ${when} that could still be filled`,
    detail: `${soonest.slice(0, 3).map((g) => `<b>${clock(g.start_min)}</b> (${dur(g.minutes)})`).join(', ')}`
      + `${soonest.length > 3 ? ` and ${soonest.length - 3} more` : ''} ${soonest.length === 1 ? 'is' : 'are'} open `
      + `between existing bookings.`
      + (real.length > soonest.length
        ? ` Across the next ${horizonDays} days there are <b>${real.length}</b>, totalling <b>${dur(totalMin)}</b>.`
        : ''),
    worth_cents: totalWorth,
    worth_label: 'if they all filled',
    evidence: real.slice(0, 8).map((g) => ({
      label: `${DAY_NAMES[weekdayOf(g.date)].slice(0, 3)} ${clock(g.start_min)}–${clock(g.end_min)}`,
      sub: `${g.staff_name} · ${dur(g.minutes)} free`,
      date: g.date,
    })),
    actions: [{ label: 'Open the calendar', href: `#/calendar?date=${real[0].date}`, icon: 'calendar' }],
    campaign: {
      kind: 'gap_offer',
      weekday: weekdayOf(real[0].date),
      when: real[0].date === addDays(today, 1) ? 'tomorrow' : `on ${DAY_NAMES[weekdayOf(real[0].date)]}`,
      times: namedTimes(soonest),
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Regulars who are late coming back
// ---------------------------------------------------------------------------

/**
 * Overdue against each client's OWN rhythm, not one number for everybody.
 *
 * A fixed "8 weeks and we call you lapsed" is wrong in both directions at once:
 * it nags the client who genuinely comes quarterly, and it misses the one who
 * used to come every fortnight and vanished a month ago. Their own median gap
 * is the only honest yardstick — median rather than mean so one gap year
 * doesn't drag the whole picture.
 */
function overdueRegulars({ today }) {
  const rows = db.prepare(
    `SELECT client_id, date FROM appointments
     WHERE client_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show') AND date <= ?
     ORDER BY client_id, date`
  ).all(today);
  if (!rows.length) return null;

  const byClient = new Map();
  for (const r of rows) {
    if (!byClient.has(r.client_id)) byClient.set(r.client_id, []);
    byClient.get(r.client_id).push(r.date);
  }

  const booked = new Set(db.prepare(
    `SELECT DISTINCT client_id FROM appointments
     WHERE date > ? AND status IN ('booked','confirmed') AND client_id IS NOT NULL`
  ).all(today).map((r) => r.client_id));

  const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
  const out = [];

  for (const [clientId, dates] of byClient) {
    // Three visits gives two gaps, the minimum for a median that means
    // anything. Two visits is a coincidence, not a rhythm.
    if (dates.length < 3 || booked.has(clientId)) continue;
    const gaps = [];
    for (let i = 1; i < dates.length; i++) gaps.push(daysBetween(dates[i - 1], dates[i]));
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    if (median < 7 || median > 240) continue; // not a rhythm worth acting on

    const since = daysBetween(dates[dates.length - 1], today);
    // Half again past their own gap — early enough to still win them back,
    // late enough that it isn't nagging someone who is simply a bit late.
    if (since < median * 1.5) continue;

    const c = db.prepare('SELECT id, first_name, last_name, email, phone FROM clients WHERE id = ?').get(clientId);
    if (!c) continue;
    const spend = db.prepare(
      `SELECT COALESCE(AVG(sv.price_cents), 0) AS v FROM appointments a
       JOIN services sv ON sv.id = a.service_id
       WHERE a.client_id = ? AND a.status NOT IN ('cancelled','no_show')`
    ).get(clientId).v;

    out.push({
      ...c, visits: dates.length, last_visit: dates[dates.length - 1],
      usual_days: median, overdue_days: since - median, worth_cents: Math.round(spend),
    });
  }
  if (!out.length) return null;

  // Most overdue first, but weight loyalty — losing an 11-visit regular costs
  // more than losing someone on their third haircut.
  out.sort((a, b) => (b.visits * b.worth_cents) - (a.visits * a.worth_cents));
  const totalWorth = out.reduce((n, c) => n + c.worth_cents, 0);
  const top = out[0];

  return finding({
    kind: 'overdue_regulars',
    kicker: 'Overdue for rebooking',
    title: out.length === 1
      ? `${top.first_name} is overdue for a visit`
      : `${out.length} regulars are late coming back`,
    detail: out.length === 1
      ? `${top.first_name} normally comes every <b>${Math.round(top.usual_days / 7)} weeks</b> but it has been `
        + `<b>${Math.round((top.usual_days + top.overdue_days) / 7)}</b>. ${top.visits} visits so far.`
      : `Each is well past their own usual gap and none has anything booked. `
        + `Between them they are worth about <b>${money(totalWorth)}</b> a round of visits.`,
    worth_cents: totalWorth,
    worth_label: 'a full round of visits',
    evidence: out.slice(0, 6).map((c) => ({
      label: `${c.first_name} ${c.last_name}`.trim(),
      sub: `${c.visits} visits · usually every ${Math.round(c.usual_days / 7)} wks · ${Math.round((c.usual_days + c.overdue_days) / 7)} wks ago`,
      client_id: c.id,
    })),
    actions: [{ label: 'Review the list', href: '#/clients', icon: 'users' }],
    campaign: { kind: 'rebook_nudge' },
  });
}

// ---------------------------------------------------------------------------
// 3. Cancelled slots nobody backfilled
// ---------------------------------------------------------------------------

/**
 * A cancellation is money that was already earned and then handed back. It is
 * the single most recoverable thing on this panel — the client wanted that
 * time, so somebody else probably does too.
 *
 * Only counts a cancelled slot if the time is genuinely still free; if the
 * owner already put someone else in it, there is nothing to report.
 */
function unfilledCancellations({ today, staffWindow }) {
  const cancelled = db.prepare(
    `SELECT a.id, a.date, a.start_min, a.end_min, a.staff_id, s.name AS staff_name,
            COALESCE(sv.price_cents, 0) AS price_cents, sv.name AS service_name
     FROM appointments a
     LEFT JOIN staff s ON s.id = a.staff_id
     LEFT JOIN services sv ON sv.id = a.service_id
     WHERE a.status = 'cancelled' AND a.date >= ?
     ORDER BY a.date, a.start_min`
  ).all(today);
  if (!cancelled.length) return null;

  const stillOpen = cancelled.filter((c) => {
    const win = staffWindow(c.staff_id, c.date);
    if (!win) return false; // nobody works then anyway
    // And the slot has to be inside the hours somebody could actually take it
    // in. A cancelled midnight booking — left behind by an hours change, or an
    // import — is not recoverable revenue, and reporting it as such is exactly
    // the kind of nonsense that makes an owner stop reading the panel.
    if (c.start_min < win.open || c.end_min > win.close) return false;
    const taken = db.prepare(
      `SELECT COUNT(*) AS n FROM appointments
       WHERE staff_id = ? AND date = ? AND status NOT IN ('cancelled','no_show')
         AND start_min < ? AND end_min > ?`
    ).get(c.staff_id, c.date, c.end_min, c.start_min).n;
    return taken === 0;
  });
  if (!stillOpen.length) return null;

  // A free or deleted service would otherwise report "$0 still recoverable",
  // which reads as a bug. Value those at what a typical booking is worth
  // instead, so the figure means something either way.
  const typical = db.prepare(
    'SELECT COALESCE(AVG(price_cents), 0) AS v FROM services WHERE active = 1 AND price_cents > 0'
  ).get().v;
  const worth = stillOpen.reduce((n, c) => n + (c.price_cents || Math.round(typical)), 0);
  return finding({
    kind: 'unfilled_cancellations',
    kicker: 'Cancellations',
    title: stillOpen.length === 1
      ? '1 cancelled slot nobody has taken'
      : `${stillOpen.length} cancelled slots nobody has taken`,
    detail: `${stillOpen.slice(0, 3).map((c) => `<b>${DAY_NAMES[weekdayOf(c.date)].slice(0, 3)} ${clock(c.start_min)}</b>`).join(', ')}`
      + `${stillOpen.length > 3 ? ` and ${stillOpen.length - 3} more` : ''} — still open, and someone wanted `
      + `${stillOpen.length === 1 ? 'that time' : 'those times'} recently enough to book ${stillOpen.length === 1 ? 'it' : 'them'}.`,
    worth_cents: worth,
    worth_label: 'still recoverable',
    evidence: stillOpen.slice(0, 6).map((c) => ({
      label: `${DAY_NAMES[weekdayOf(c.date)].slice(0, 3)} ${clock(c.start_min)}`,
      sub: `${c.service_name || 'Appointment'} · ${c.staff_name || 'any'}`,
      date: c.date,
    })),
    actions: [{ label: 'Open the calendar', href: `#/calendar?date=${stillOpen[0].date}`, icon: 'calendar' }],
    campaign: {
      kind: 'gap_offer',
      weekday: weekdayOf(stillOpen[0].date),
      when: stillOpen[0].date === addDays(today, 1) ? 'tomorrow' : `on ${DAY_NAMES[weekdayOf(stillOpen[0].date)]}`,
      times: namedTimes(stillOpen),
    },
  });
}

// ---------------------------------------------------------------------------
// 4. The weekly dead spot
// ---------------------------------------------------------------------------

/**
 * The block of the week that is consistently emptiest.
 *
 * Needs real history to mean anything, so it is withheld below 6 weeks of
 * trading and below a minimum number of appointments. A new salon being told
 * its Tuesdays are weak, on the basis of two Tuesdays, is worse than useless —
 * it is confidently wrong, and that is what costs trust.
 */
function weakestPeriod({ today, hoursFor }) {
  const WEEKS = 8, MIN_WEEKS = 6, MIN_APPTS = 40;
  const from = addDays(today, -WEEKS * 7);

  const total = db.prepare(
    `SELECT COUNT(*) AS n FROM appointments WHERE date >= ? AND date < ? AND status NOT IN ('cancelled')`
  ).get(from, today).n;
  if (total < MIN_APPTS) return null;

  const firstEver = db.prepare('SELECT MIN(date) AS d FROM appointments').get().d;
  if (!firstEver) return null;
  const tradingWeeks = Math.round((new Date(`${today}T12:00:00`) - new Date(`${firstEver}T12:00:00`)) / (7 * 86400000));
  if (tradingWeeks < MIN_WEEKS) return null;

  // Booked minutes against open minutes, per weekday × 3-hour block.
  const blocks = new Map(); // "dow|band" -> { booked, open }
  for (let i = 1; i <= WEEKS * 7; i++) {
    const date = addDays(today, -i);
    const hrs = hoursFor(date);
    if (!hrs) continue;
    const dow = weekdayOf(date);
    for (let band = Math.floor(hrs.open / 180); band <= Math.floor((hrs.close - 1) / 180); band++) {
      const bStart = Math.max(hrs.open, band * 180);
      const bEnd = Math.min(hrs.close, (band + 1) * 180);
      if (bEnd <= bStart) continue;
      const key = `${dow}|${band}`;
      if (!blocks.has(key)) blocks.set(key, { booked: 0, open: 0, dow, band });
      const cell = blocks.get(key);
      cell.open += bEnd - bStart;
      const appts = db.prepare(
        `SELECT start_min, end_min FROM appointments
         WHERE date = ? AND status NOT IN ('cancelled','no_show') AND start_min < ? AND end_min > ?`
      ).all(date, bEnd, bStart);
      for (const a of appts) cell.booked += Math.min(a.end_min, bEnd) - Math.max(a.start_min, bStart);
    }
  }

  const cells = [...blocks.values()].filter((c) => c.open >= 180 * MIN_WEEKS * 0.5);
  if (cells.length < 4) return null;

  const rates = cells.map((c) => ({ ...c, rate: c.booked / c.open }));
  const overall = rates.reduce((n, c) => n + c.booked, 0) / rates.reduce((n, c) => n + c.open, 0);
  rates.sort((a, b) => a.rate - b.rate);
  const worst = rates[0];
  // Only worth saying if it is genuinely an outlier, not just the lowest of a
  // flat set. Half the average, or it isn't a finding.
  if (worst.rate > overall * 0.55 || overall <= 0) return null;

  const emptyMinPerWeek = ((worst.open / WEEKS) * (1 - worst.rate));
  const rate = db.prepare(
    'SELECT COALESCE(AVG(price_cents * 1.0 / duration_min), 0) AS v FROM services WHERE active = 1 AND price_cents > 0'
  ).get().v;
  // Half of it filling is the realistic upside, not all of it.
  const worthPerWeek = Math.round(emptyMinPerWeek * rate * 0.5);

  return finding({
    kind: 'weakest_period',
    kicker: 'Weakest period',
    title: `${DAY_NAMES[worst.dow]} ${clock(worst.band * 180)}–${clock((worst.band + 1) * 180)} is your quiet spot`,
    detail: `Only <b>${Math.round(worst.rate * 100)}% booked</b> over the last ${WEEKS} weeks, against `
      + `<b>${Math.round(overall * 100)}%</b> across the week. That is about <b>${dur(Math.round(emptyMinPerWeek))}</b> `
      + 'standing empty every week.',
    worth_cents: worthPerWeek,
    worth_label: 'a week if half of it filled',
    context: { label: `${DAY_NAMES[worst.dow]} ${clock(worst.band * 180)}–${clock((worst.band + 1) * 180)}` },
    evidence: rates.slice(0, 3).map((c) => ({
      label: `${DAY_NAMES[c.dow]} ${clock(c.band * 180)}–${clock((c.band + 1) * 180)}`,
      sub: `${Math.round(c.rate * 100)}% booked`,
    })),
    actions: [{ label: 'See the calendar', href: '#/calendar', icon: 'calendar' }],
  });
}

// ---------------------------------------------------------------------------
// 5. The few clients behind most of the no-shows
// ---------------------------------------------------------------------------

/**
 * No-shows are rarely spread evenly — usually a handful of people account for
 * most of them, which is exactly why a blanket deposit rule is the wrong
 * answer. Naming them lets the owner deal with three people instead of
 * penalising everybody.
 */
function repeatNoShows({ today }) {
  const from = addDays(today, -90);
  const rows = db.prepare(
    `SELECT a.client_id, COUNT(*) AS n, COALESCE(SUM(sv.price_cents), 0) AS lost
     FROM appointments a LEFT JOIN services sv ON sv.id = a.service_id
     WHERE a.status = 'no_show' AND a.date >= ? AND a.client_id IS NOT NULL
     GROUP BY a.client_id HAVING n >= 2 ORDER BY n DESC`
  ).all(from);
  if (!rows.length) return null;

  const people = rows.map((r) => {
    const c = db.prepare('SELECT id, first_name, last_name FROM clients WHERE id = ?').get(r.client_id);
    return c ? { ...c, misses: r.n, lost_cents: r.lost } : null;
  }).filter(Boolean);
  if (!people.length) return null;

  const totalMisses = people.reduce((n, p) => n + p.misses, 0);
  const lost = people.reduce((n, p) => n + p.lost_cents, 0);

  return finding({
    kind: 'repeat_no_shows',
    kicker: 'No-shows',
    title: people.length === 1
      ? `${people[0].first_name} has missed ${people[0].misses} appointments`
      : `${people.length} clients account for most of your no-shows`,
    detail: `<b>${totalMisses} missed appointments</b> in the last 90 days`
      + `${people.length > 1 ? ' between them' : ''}`
      + `${lost ? `, worth about <b>${money(lost)}</b>` : ''}. `
      + `A deposit for just ${people.length > 1 ? 'these few' : 'this one client'} leaves everyone else booking as normal.`,
    worth_cents: lost,
    worth_label: 'lost in 90 days',
    evidence: people.slice(0, 6).map((p) => ({
      label: `${p.first_name} ${p.last_name}`.trim(),
      sub: `${p.misses} no-shows${p.lost_cents ? ` · ${money(p.lost_cents)}` : ''}`,
      client_id: p.id,
    })),
    actions: [{ label: 'Set up deposits', href: '#/settings', icon: 'card' }],
  });
}

function money(cents) {
  const cur = getSetting('currency', '$') || '$';
  return `${cur}${((Number(cents) || 0) / 100).toFixed(2).replace(/\.00$/, '')}`;
}

// ---------------------------------------------------------------------------

/**
 * Everything worth acting on, most valuable first.
 *
 * `helpers` are passed in rather than imported so this module stays free of the
 * API's routing and session code — which is what lets the tests drive it
 * directly with a fixed date instead of waiting for real time to pass.
 */
export function opportunities({ today, hoursFor, staffWindow, blocksFor, horizonDays = 3 }) {
  const found = [
    emptyTime({ today, horizonDays, hoursFor, staffWindow, blocksFor }),
    unfilledCancellations({ today, staffWindow }),
    overdueRegulars({ today }),
    weakestPeriod({ today, hoursFor }),
    repeatNoShows({ today }),
  ].filter(Boolean);

  found.sort((a, b) => b.worth_cents - a.worth_cents);

  // The headline. Deliberately excludes anything already counted as lost
  // rather than recoverable — a no-show last month is not money on the table
  // this week, and adding it in would make the total a fiction.
  const RECOVERABLE = new Set(['empty_time', 'unfilled_cancellations', 'overdue_regulars', 'weakest_period']);
  const total = found.filter((f) => RECOVERABLE.has(f.kind)).reduce((n, f) => n + f.worth_cents, 0);

  return { findings: found, total_worth_cents: total, generated_for: today };
}
