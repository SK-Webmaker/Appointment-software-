// Kai's week: the owner's marketing assistant.
//
// Every Monday the owner should be able to open one screen and see, in plain
// words, how to fill the week: who to message, what (if anything) to offer,
// and on which days. Each idea has one button, and that button opens the same
// preview every Kairo campaign goes through, with the exact list, the exact
// words and the exact cost. Nothing is sent until the owner presses Send.
//
// This module only ever READS. It joins parts that already exist, rather than
// growing second copies of them:
//
//   the gaps in the diary            opportunities.js (emptyGaps, findings)
//   who is due, gone or a birthday   campaigns.js (recipientsFor)
//   what a post should say           growth-content.js (contentIdeas)
//   what the messages brought in     campaigns.js (attributionSummary)
//
// FOUR RULES.
//
//   KAI ASKS FIRST. Always. The plan is a list of suggestions; sending is the
//   campaign preview's job, and a trial salon sees the plan with sending
//   locked (the send route refuses it, not just the button).
//
//   FREE ADD-ONS BEFORE DISCOUNTS. A perk is a small free extra first. A
//   percentage off is suggested only when the menu has no sensible add-on, and
//   never above the owner's own cap (kai_discount_cap, 15 unless they raise
//   it). A gap or a late regular gets no perk at all: a time slot or a nudge
//   is the message, and money off would be margin given away for nothing.
//
//   NUMBERS COME FROM ROWS. Every figure on the page is counted from the
//   database. Where a figure is an "if they all book" ceiling it says so.
//
//   THE WORDS ARE THE OWNER'S TO CHANGE. Every draft is a starting point in an
//   editable box. The optional AI rewrite (src/kai-agent.js) only rewords a
//   draft the owner is looking at, and it counts against the salon's monthly
//   allowance.
import { db, getSetting } from './db.js';
import { opportunities, emptyGaps } from './opportunities.js';
import { recipientsFor, draftFor, attributionSummary, bookingLinkFor } from './campaigns.js';
import { contentIdeas } from './growth-content.js';
import { getAutomation } from './automations.js';
import { isTrial } from './trial.js';
import { current as currentTenant, MULTI } from './tenant.js';

// ---------------------------------------------------------------------------
// Who has it: the rollout switch
// ---------------------------------------------------------------------------
//
// The owner's rollout (25 Nov 2026): the demo salon first, then one pilot
// salon for a few weeks, then everyone. KAIRO_KAI_WEEK says which:
//
//   'demo' (the default)   the demo salon only
//   'demo,hora'            a comma list of salon slugs
//   'all'                  every salon
//   'off'                  nobody
//
// The Monday notification and the monthly report go with it, so a salon not
// yet in the rollout sees and receives nothing new.
export function kaiWeekOn() {
  const v = String(process.env.KAIRO_KAI_WEEK ?? 'demo').trim().toLowerCase();
  if (v === 'all') return true;
  if (!v || v === 'off') return false;
  if (!MULTI) return false;
  let slug = '';
  try { slug = currentTenant()?.slug || ''; } catch { slug = ''; }
  return Boolean(slug) && v.split(',').map((x) => x.trim()).includes(slug);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOf = (date) => new Date(`${date}T12:00:00`).getDay();
function addDays(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
function clock(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${(h % 12) || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
}
function money(cents) {
  const cur = getSetting('currency', '$') || '$';
  return `${cur}${Math.round((Number(cents) || 0) / 100).toLocaleString('en-AU')}`;
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "26 Nov" */
function shortDate(date) {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
}
/** "Tuesday 2 Dec" */
const longDay = (date) => `${DAY_NAMES[weekdayOf(date)]} ${shortDate(date)}`;
/** "Tuesdays and Wednesdays" */
function daysList(dows) {
  const names = dows.map((d) => `${DAY_NAMES[d]}s`);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------
// The perk policy
// ---------------------------------------------------------------------------

export const DISCOUNT_CAP_DEFAULT = 15;

/** The most Kai may suggest taking off, as a whole percentage. The owner's to raise. */
export function discountCap() {
  const n = Number(getSetting('kai_discount_cap', String(DISCOUNT_CAP_DEFAULT)));
  return Number.isFinite(n) ? Math.max(0, Math.min(50, Math.round(n))) : DISCOUNT_CAP_DEFAULT;
}

/** A name that reads like something added to a visit rather than a visit in itself. */
const ADDON_WORDS = /tint|add|upgrade|mask|condition|treatment|toner|gloss|scalp|brow|lip|polish|french|art|massage|serum|ampoule|blow ?dry|fringe|trim|wax|hand|foot|eye|lash lift|k18|olaplex|bond/i;

/**
 * The perk to suggest, or null when there is nothing sensible to offer.
 *
 * A free add-on is a short (30 minutes or less), cheap service from their own
 * menu: no more than 40% of the visit it rides on and $45 at most. Within
 * those, the one that reads like an extra and costs the least. Failing that, a
 * percentage: 10, or the owner's cap if that is lower; and none at all when
 * the cap is 0.
 */
export function suggestPerk({ mainPriceCents = 0, notServiceId = 0 } = {}) {
  const ceiling = Math.min(4500, mainPriceCents > 0 ? Math.round(mainPriceCents * 0.4) : 4500);
  const rows = db.prepare(
    `SELECT id, name, price_cents, duration_min FROM services
      WHERE active = 1 AND price_cents > 0 AND duration_min <= 30 AND price_cents <= ? AND id != ?
      ORDER BY price_cents`
  ).all(ceiling, notServiceId || 0);
  const pick = rows.find((r) => ADDON_WORDS.test(r.name)) || rows[0];
  if (pick) {
    return {
      type: 'addon',
      service_id: pick.id,
      name: pick.name,
      worth_cents: pick.price_cents,
      label: `a free ${pick.name}`,
      short: `free ${pick.name}`,
    };
  }
  const cap = discountCap();
  if (cap <= 0) return null;
  const percent = Math.min(10, cap);
  return { type: 'percent', percent, label: `${percent}% off`, short: `${percent}% off` };
}

// ---------------------------------------------------------------------------
// What a visit is worth, and when the business is quiet
// ---------------------------------------------------------------------------

/** The typical visit, valued at what the menu charges for it, over the last 180 days. */
export function averageVisitCents(today) {
  const row = db.prepare(
    `SELECT AVG(v) AS avg FROM (
       SELECT COALESCE(
         (SELECT SUM(s2.price_cents) FROM appointment_services x JOIN services s2 ON s2.id = x.service_id
           WHERE x.appointment_id = a.id),
         s.price_cents, 0) AS v
         FROM appointments a LEFT JOIN services s ON s.id = a.service_id
        WHERE a.status NOT IN ('cancelled','no_show') AND a.date <= ? AND a.date >= ?)
     WHERE v > 0`
  ).get(today, addDays(today, -180));
  return Math.round(row?.avg || 0);
}

/** The service booked most over the last 180 days, or null. */
export function topService(today) {
  return db.prepare(
    `SELECT s.id, s.name, s.price_cents, s.duration_min, COUNT(*) AS n
       FROM appointments a JOIN services s ON s.id = a.service_id
      WHERE a.status NOT IN ('cancelled','no_show') AND a.date <= ? AND a.date >= ?
        AND s.active = 1 AND s.price_cents > 0
      GROUP BY s.id ORDER BY n DESC, s.price_cents DESC LIMIT 1`
  ).get(today, addDays(today, -180)) || null;
}

function openDays() {
  const raw = String(getSetting('open_days', '1,2,3,4,5,6'));
  const days = raw.split(',').map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return days.length ? days : [1, 2, 3, 4, 5, 6];
}

/**
 * The two quietest days the business is open, from the last twelve weeks.
 *
 * Counted per open weekday as visits per week. Nothing is claimed for a
 * business with under four weeks of bookings: "your Tuesdays are quiet" said
 * on week two is a guess.
 */
export function quietDays(today) {
  const from = addDays(today, -84);
  const first = db.prepare(
    `SELECT MIN(date) AS d FROM appointments WHERE status NOT IN ('cancelled','no_show') AND date >= ? AND date <= ?`
  ).get(from, today)?.d;
  if (!first || daysBetween(first, today) < 28) return { days: [], enough: false };
  const counts = new Map(openDays().map((d) => [d, 0]));
  const rows = db.prepare(
    `SELECT date, COUNT(*) AS n FROM appointments
      WHERE status NOT IN ('cancelled','no_show') AND date >= ? AND date < ? GROUP BY date`
  ).all(first, today);
  for (const r of rows) {
    const dow = weekdayOf(r.date);
    if (counts.has(dow)) counts.set(dow, counts.get(dow) + r.n);
  }
  const ranked = [...counts.entries()].sort((a, b) => a[1] - b[1]);
  if (ranked.length < 3) return { days: [], enough: false };
  const busiest = ranked[ranked.length - 1];
  // Only "quiet" if it really is: under three quarters of the busiest day.
  const days = ranked.slice(0, 2).filter(([, n]) => n < busiest[1] * 0.75).map(([d]) => d);
  return { days, enough: true, busiest: busiest[0] };
}

// ---------------------------------------------------------------------------
// The week
// ---------------------------------------------------------------------------

/** How likely each kind of play is to turn into a booking, for ORDERING only. Never shown as a forecast. */
const LIKELY = { gap: 0.5, rebook: 0.3, birthday: 0.3, winback: 0.15 };

const dayWord = (date, today) => (date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : `on ${DAY_NAMES[weekdayOf(date)]}`);

function selectable(kind, opts) {
  return recipientsFor(kind, opts).filter((r) => !r.cooling_off);
}

/**
 * The gap plays: the two days of the coming week with the most empty time,
 * each one a gap offer pointing at that day's first free slot.
 */
function gapPlays({ gaps, today }) {
  const byDay = new Map();
  for (const g of gaps) {
    if (!byDay.has(g.date)) byDay.set(g.date, []);
    byDay.get(g.date).push(g);
  }
  const days = [...byDay.entries()]
    .map(([date, list]) => ({ date, list, minutes: list.reduce((n, g) => n + g.minutes, 0), cents: list.reduce((n, g) => n + g.worth_cents, 0) }))
    .sort((a, b) => b.cents - a.cents || a.date.localeCompare(b.date))
    .slice(0, 2);

  return days.map(({ date, list, minutes, cents }) => {
    const weekday = weekdayOf(date);
    const times = [...new Set(list.map((g) => clock(g.start_min)))].slice(0, 2).join(' or ');
    const when = dayWord(date, today);
    const context = { weekday, when, times };
    const people = selectable('gap_offer', { today, channel: 'both', context });
    const lead = list.find((g) => g.service_id) || list[0];
    const hours = Math.round((minutes / 60) * 10) / 10;
    const draft = draftFor('gap_offer', context, 'matched');
    return {
      id: `gap-${date}`,
      kind: 'gap',
      icon: 'calendar',
      title: `Fill ${date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : DAY_NAMES[weekday]}: ${plural(list.length, 'gap')} (${times})`,
      why: `${hours} hour${hours === 1 ? '' : 's'} free between bookings on ${longDay(date)}. `
        + (people.length
          ? `${plural(people.length, 'client')} who ${people.length === 1 ? 'is' : 'are'} due back ${people.length === 1 ? 'has' : 'have'} booked a ${DAY_NAMES[weekday]} before.`
          : `Nobody due back usually books ${DAY_NAMES[weekday]}s, so this one is worth sending to everyone by email.`),
      count: people.length,
      worth_cents: cents,
      worth_label: 'if every gap fills',
      perk: null,
      sample: draft.body,
      sample_name: people[0]?.first_name || '',
      score: cents * LIKELY.gap,
      campaign: {
        kind: 'gap_offer', weekday, when, times,
        offer: lead?.service_id ? { service_ids: [lead.service_id], staff_id: lead.staff_id, date: lead.date, start_min: lead.start_min } : null,
        audience: people.length ? 'matched' : 'everyone',
      },
    };
  });
}

function rebookPlay({ today, avg, finding }) {
  const people = selectable('rebook_nudge', { today, channel: 'both' });
  if (!people.length) return null;
  const draft = draftFor('rebook_nudge', {}, 'matched');
  const cents = finding?.worth_cents || people.length * avg;
  return {
    id: 'rebook',
    kind: 'rebook',
    icon: 'clock',
    title: `Nudge ${plural(people.length, 'regular')} who ${people.length === 1 ? 'is' : 'are'} late coming back`,
    why: `They come in like clockwork, and every one of them is now well past their own usual gap. `
      + 'A short note does better than money off: most of them simply forgot to rebook.',
    count: people.length,
    worth_cents: cents,
    worth_label: 'if they all rebook',
    perk: null,
    sample: draft.body,
    sample_name: people[0]?.first_name || '',
    score: cents * LIKELY.rebook,
    campaign: { kind: 'rebook_nudge' },
  };
}

function winbackPlay({ today, avg }) {
  const auto = getAutomation('lapsed_winback');
  if (auto?.enabled) return null; // already on autopilot; one message per person is plenty
  const people = selectable('winback_offer', { today, channel: 'both' });
  if (!people.length) return null;
  const perk = suggestPerk({ mainPriceCents: avg });
  const context = { perk: perk?.label || '' };
  const draft = draftFor('winback_offer', context, 'matched');
  const cents = people.length * avg;
  return {
    id: 'winback',
    kind: 'winback',
    icon: 'users',
    title: `Win back ${plural(people.length, 'client')} who stopped coming`,
    why: `Each of them has been in at least twice, and none of them for 10 weeks or more. `
      + (perk ? `${perk.type === 'addon' ? `A free ${perk.name}` : perk.label} is a reason to come back without cutting your prices.` : 'A friendly note on its own.'),
    count: people.length,
    worth_cents: cents,
    worth_label: 'if they all come back',
    perk,
    sample: draft.body,
    sample_name: people[0]?.first_name || '',
    score: cents * LIKELY.winback,
    campaign: { kind: 'winback_offer', perk: perk?.label || '', perk_short: perk?.short || '', draft },
  };
}

function birthdayPlay({ today, avg }) {
  const auto = getAutomation('birthday');
  if (auto?.enabled) return null;
  const people = selectable('birthday_offer', { today, channel: 'both' });
  if (!people.length) return null;
  const perk = suggestPerk({ mainPriceCents: avg });
  const context = { perk: perk?.label || '' };
  const draft = draftFor('birthday_offer', context, 'matched');
  return {
    id: 'birthday',
    kind: 'birthday',
    icon: 'star',
    title: `${plural(people.length, 'birthday')} this week`,
    why: `${people.map((p) => p.first_name).slice(0, 3).join(', ')}${people.length > 3 ? ' and more' : ''}. `
      + 'A birthday note is the one message nobody minds getting.',
    count: people.length,
    worth_cents: people.length * avg,
    worth_label: 'if they all book',
    perk,
    sample: draft.body,
    sample_name: people[0]?.first_name || '',
    score: people.length * avg * LIKELY.birthday,
    campaign: { kind: 'birthday_offer', perk: perk?.label || '', perk_short: perk?.short || '', draft },
  };
}

/**
 * An occasion close enough to plan for now: six weeks out at most, and at
 * least five days, because a Christmas promo on the 22nd is too late to help.
 */
function occasionPlay({ today, avg }) {
  const occ = occasions(today).find((o) => {
    const n = daysBetween(today, o.date);
    return n >= 5 && n <= 42;
  });
  if (!occ) return null;
  const n = daysBetween(today, occ.date);
  const weeks = Math.max(1, Math.round(n / 7));
  const perk = suggestPerk({ mainPriceCents: avg });
  return {
    id: `occasion-${occ.key}`,
    kind: 'occasion',
    icon: 'star',
    title: `${occ.label} is ${weeks} week${weeks === 1 ? '' : 's'} away`,
    why: `People book for ${occ.label} two to three weeks ahead, so a promo this week catches them while they are deciding.`
      + (perk ? ` Kai would offer ${perk.label}${perk.type === 'addon' ? ', a free add-on rather than money off' : ''}.` : ''),
    count: 0,
    worth_cents: 0,
    perk,
    sample: '',
    score: 0,
    promo: { goal: 'occasion', occasion: occ.key },
  };
}

/** The one post for the week: about the quietest day if there is one, else the best idea going. */
function postIdea({ today, quiet }) {
  let ideas = [];
  try { ideas = contentIdeas({ today }).filter((i) => i.kind === 'post' && i.caption); } catch { ideas = []; }
  const quietIdea = ideas.find((i) => i.id === 'quiet-day');
  const pick = quietIdea || ideas[0];
  if (!pick) return null;
  return {
    id: `post-${pick.id}`,
    kind: 'post',
    icon: 'share',
    title: pick.title,
    why: pick.reason,
    photo: pick.photo || '',
    caption: pick.caption,
    channel: pick.channel || 'Instagram',
    promo: quiet.days.length ? { goal: 'quiet', weekdays: quiet.days } : null,
  };
}

/** What Kai's messages brought in this month, traced booking by booking. */
export function monthResults(today) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastStart = addDays(monthStart, -1).slice(0, 7) + '-01';
  const sum = (rows) => rows.reduce((acc, r) => ({ bookings: acc.bookings + r.bookings, revenue_cents: acc.revenue_cents + r.revenue_cents }), { bookings: 0, revenue_cents: 0 });
  const thisMonth = attributionSummary({ since: monthStart });
  const lastRows = db.prepare(
    `SELECT COUNT(DISTINCT a.id) AS bookings, COALESCE(SUM(sv.price_cents), 0) AS revenue_cents
       FROM appointments a JOIN messages m ON m.id = a.source_message_id
       LEFT JOIN services sv ON sv.id = a.service_id
      WHERE a.status != 'cancelled' AND a.date >= ? AND a.date < ?`
  ).get(lastStart, monthStart);
  const sent = db.prepare(
    `SELECT COUNT(DISTINCT COALESCE(token, id)) AS n FROM messages
      WHERE kind IN ('gap_offer','rebook_nudge','winback_offer','birthday_offer','promo',
                     'due_back','lapsed_winback','first_visit','abandoned_booking','birthday','no_future_booking')
        AND substr(created_at, 1, 10) >= ?`
  ).get(monthStart)?.n || 0;
  return {
    month: monthStart.slice(0, 7),
    ...sum(thisMonth),
    by_kind: thisMonth,
    last_month: { bookings: lastRows?.bookings || 0, revenue_cents: lastRows?.revenue_cents || 0 },
    approaches: sent,
  };
}

/** Monday of the week `today` falls in. */
export function weekOf(today) {
  const dow = weekdayOf(today);
  return addDays(today, dow === 0 ? -6 : 1 - dow);
}

/**
 * The plan.
 *
 * `helpers` (hoursFor, staffWindow, blocksFor) are passed in, as they are to
 * opportunities(), so the tests can drive this with a fixed date.
 */
export function weekPlan({ today, nowMin = -1, hoursFor, staffWindow, blocksFor }) {
  const gaps = emptyGaps({ today, horizonDays: 6, nowMin, hoursFor, staffWindow, blocksFor });
  const emptyMinutes = gaps.reduce((n, g) => n + g.minutes, 0);
  const emptyCents = gaps.reduce((n, g) => n + g.worth_cents, 0);
  let findings = [];
  try { findings = opportunities({ today, hoursFor, staffWindow, blocksFor, horizonDays: 6, nowMin }).findings; } catch { findings = []; }
  const avg = averageVisitCents(today);
  const quiet = quietDays(today);

  const plays = [
    ...gapPlays({ gaps, today }),
    rebookPlay({ today, avg, finding: findings.find((f) => f.kind === 'overdue_regulars') }),
    winbackPlay({ today, avg }),
    birthdayPlay({ today, avg }),
  ].filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 5);
  // The occasion is a plan for later rather than money this week, so it is
  // added after the five, never instead of one of them.
  const occasion = occasionPlay({ today, avg });
  if (occasion) plays.push(occasion);

  const hours = Math.round((emptyMinutes / 60) * 10) / 10;
  const headline = emptyMinutes
    ? `You have ${hours} empty hour${hours === 1 ? '' : 's'} in the next 7 days, worth about ${money(emptyCents)}.`
    : 'The next 7 days are nearly full.';
  const sub = plays.length
    ? `${plays.length === 1 ? 'One way' : `${plays.length} ways`} to ${emptyMinutes ? 'fill them' : 'keep it that way'}, worked out from your own diary and clients.`
    : 'Nothing needs sending this week. Kai will look again tomorrow.';

  return {
    today,
    week_of: weekOf(today),
    headline,
    sub,
    empty_minutes: emptyMinutes,
    empty_cents: emptyCents,
    plays: plays.map(({ score, ...p }) => p),
    post: postIdea({ today, quiet }),
    quiet_days: quiet.days,
    results: monthResults(today),
    discount_cap: discountCap(),
    // Shown, never hidden: a trial sees exactly what Kai would do, with the
    // send locked until a plan is chosen.
    locked: isTrial(),
  };
}

/** One line for the owner's phone on a Monday morning, or '' when there is nothing to say. */
export function weekNote(plan) {
  if (!plan?.plays?.length) return '';
  const lead = plan.empty_minutes ? `${Math.round(plan.empty_minutes / 60)} empty hours this week, about ${money(plan.empty_cents)}.` : 'Your week is nearly full.';
  return `${lead} Kai has ${plural(plan.plays.length, 'way')} to ${plan.empty_minutes ? 'fill them' : 'keep it that way'}. Tap to see them.`;
}

// ---------------------------------------------------------------------------
// The promo builder
// ---------------------------------------------------------------------------

/** The n-th `weekday` (0=Sun) of a month, as YYYY-MM-DD. */
function nthWeekday(year, month, weekday, n) {
  const d = new Date(Date.UTC(year, month, 1, 12));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7);
  return d.toISOString().slice(0, 10);
}

/** The occasions worth a promo, in the order they next come round. Australian dates. */
export function occasions(today) {
  const y = Number(today.slice(0, 4));
  const make = (year) => [
    { key: 'christmas', label: 'Christmas', date: `${year}-12-24`, lead: 'Get ready for Christmas', },
    { key: 'new_year', label: 'New Year', date: `${year + 1}-01-10`, lead: 'Start the year fresh', },
    { key: 'valentines', label: "Valentine's Day", date: `${year}-02-14`, lead: "Valentine's Day is coming", },
    { key: 'mothers_day', label: "Mother's Day", date: nthWeekday(year, 4, 0, 2), lead: "Mother's Day is coming", },
    { key: 'fathers_day', label: "Father's Day", date: nthWeekday(year, 8, 0, 1), lead: "Father's Day is coming", },
  ];
  const all = [...make(y - 1), ...make(y), ...make(y + 1)]
    .filter((o) => o.date >= today && daysBetween(today, o.date) <= 120);
  const seen = new Set();
  return all.sort((a, b) => a.date.localeCompare(b.date)).filter((o) => (seen.has(o.key) ? false : seen.add(o.key)));
}

export const PROMO_GOALS = ['quiet', 'occasion', 'service', 'winback'];

/**
 * A complete promo, ready to preview.
 *
 *   goal      quiet     fill the quietest days, with a perk that applies on them only
 *             occasion  Christmas, Mother's Day and the rest
 *             service   push one service to the people who have had it
 *             winback   the clients who stopped coming
 *
 * Returns the words for a text or email (one draft, {first_name} and
 * {booking_link} filled per person at send time), an Instagram caption, the
 * perk, the dates it runs, and the campaign the preview opens.
 */
export function buildPromo({ today, goal = 'quiet', occasion = '', serviceId = 0, weekdays = null } = {}) {
  if (!PROMO_GOALS.includes(goal)) goal = 'quiet';
  const biz = getSetting('business_name', 'us');
  const top = topService(today);
  const chosen = serviceId
    ? db.prepare('SELECT id, name, price_cents, duration_min FROM services WHERE id = ? AND active = 1').get(Number(serviceId))
    : null;
  const service = chosen || top;
  const avg = averageVisitCents(today);
  const perk = suggestPerk({ mainPriceCents: service?.price_cents || avg, notServiceId: service?.id || 0 });
  const perkText = perk ? (perk.type === 'addon' ? `a free ${perk.name}` : `${perk.percent}% off`) : '';
  // Only when the salon has a public address: "Book here:" with nothing after
  // it is worse than no line at all.
  const linkLine = bookingLinkFor('') ? '\n\nBook here: {booking_link}' : '';
  const why = [];
  let until = addDays(today, 14);
  let days = [];
  let title = '';
  let subject = '';
  let body = '';
  let caption = '';
  let kind = 'promo';
  let campaignContext = {};

  if (goal === 'winback') {
    const people = selectable('winback_offer', { today, channel: 'both' });
    if (!people.length) {
      throw Object.assign(new Error('Nobody has drifted off yet: everyone who has been in twice has been back in the last 10 weeks, or has heard from you recently.'), { status: 400 });
    }
    kind = 'winback_offer';
    title = 'Win back the clients who stopped coming';
    const d = draftFor('winback_offer', { perk: perkText }, 'matched');
    subject = d.subject; body = d.body;
    caption = '';
    why.push(`${plural(people.length, 'client')} have been in at least twice and not for 10 weeks or more.`);
    campaignContext = { perk: perkText };
  } else if (goal === 'occasion') {
    const list = occasions(today);
    const occ = list.find((o) => o.key === occasion) || list[0];
    if (!occ) throw Object.assign(new Error('No occasion in the next four months'), { status: 400 });
    until = occ.date;
    const daysLeft = daysBetween(today, occ.date);
    title = `${occ.label} promo`;
    subject = `${occ.lead} at ${biz}`;
    body = `Hi {first_name}, ${occ.label} is ${daysLeft <= 7 ? 'almost here' : `${Math.max(1, Math.round(daysLeft / 7))} week${Math.round(daysLeft / 7) === 1 ? '' : 's'} away`}`
      + ` and the diary is filling up.`
      + (service ? ` Book your ${service.name} before ${shortDate(occ.date)}` : ` Book in before ${shortDate(occ.date)}`)
      + (perkText ? ` and ${perkText} is on us.` : '.')
      + `${linkLine}\n\n${biz}`;
    caption = `${occ.lead}.\n\n`
      + (service ? `Our ${service.name} is the one to book before ${shortDate(occ.date)}` : `Book in before ${shortDate(occ.date)}`)
      + (perkText ? `, and ${perkText} comes with it` : '') + '.'
      + '\n\nLink in bio to book.';
    why.push(`${occ.label} is ${plural(daysLeft, 'day')} away (${longDay(occ.date)}).`);
    if (service) why.push(`${service.name} is ${chosen ? 'the service you picked' : 'your most booked service over the last six months'}.`);
    campaignContext = { service_id: service?.id || 0 };
  } else if (goal === 'service') {
    if (!service) throw Object.assign(new Error('Pick a service first'), { status: 400 });
    const people = selectable('promo', { today, channel: 'both', context: { service_id: service.id } });
    title = `Bring people back for ${service.name}`;
    subject = `Time for your next ${service.name}?`;
    body = `Hi {first_name}, it's been a while since your last ${service.name} with us.`
      + (perkText ? ` Book one in the next fortnight and ${perkText} is on us.` : ' The diary has room over the next fortnight.')
      + `${linkLine}\n\n${biz}`;
    caption = `${service.name}, done properly.\n\n`
      + (perkText ? `Book one in the next two weeks and ${perkText} comes with it.\n\n` : '')
      + 'Link in bio to book.';
    why.push(`${plural(people.length, 'client')} ${people.length === 1 ? 'has' : 'have'} had a ${service.name} before and ${people.length === 1 ? 'is' : 'are'} not booked in.`);
    campaignContext = { service_id: service.id };
  } else {
    // Quiet days: the perk applies on those days only, so the busy ones are
    // not given away.
    const quiet = quietDays(today);
    days = (Array.isArray(weekdays) && weekdays.length
      ? weekdays.map(Number).filter((d) => d >= 0 && d <= 6).slice(0, 3)
      : [...quiet.days])
      // Said in week order: "Tuesdays and Fridays", not "Fridays and Tuesdays".
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    if (!days.length) {
      throw Object.assign(new Error(quiet.enough
        ? 'Your days are all about as busy as each other, so there is no quiet day to promote.'
        : 'Kai needs about four weeks of bookings to know which days are quiet.'), { status: 400 });
    }
    const dayText = daysList(days);
    title = `Fill your ${dayText}`;
    subject = `${dayText} at ${biz}`;
    body = `Hi {first_name}, ${dayText} are our calmest days, so for the next two weeks`
      + (perkText ? ` anyone who books one gets ${perkText}.` : ' there is plenty of choice of times.')
      + ` No rush, no waiting.${linkLine}\n\n${biz}`;
    caption = `${dayText} are our calmest days.\n\n`
      + (perkText ? `For the next two weeks, book on one and ${perkText} comes with it.\n\n` : 'No rush, no waiting, plenty of times.\n\n')
      + 'Link in bio to book.';
    why.push(`${dayText} have been your quietest days over the last 12 weeks.`);
    why.push('The perk only applies on those days, so your busy days are not given away.');
  }

  if (perk) {
    why.push(perk.type === 'addon'
      ? `${perk.name} is a short, low-cost service on your menu, so it is a real reason to book that costs you little.`
      : `There is no short add-on on your menu to give away, so Kai suggests ${perk.percent}% off. Your cap is ${discountCap()}%.`);
  }

  return {
    goal,
    title,
    perk,
    service: service ? { id: service.id, name: service.name } : null,
    weekdays: days,
    until,
    why,
    subject,
    body,
    caption,
    occasions: occasions(today).map((o) => ({ key: o.key, label: o.label, date: o.date })),
    campaign: {
      kind,
      ...campaignContext,
      perk: perkText,
      perk_short: perk?.short || '',
      draft: { subject, body },
      audience: goal === 'occasion' ? 'everyone' : 'matched',
    },
    locked: isTrial(),
  };
}
