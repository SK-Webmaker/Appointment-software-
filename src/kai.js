// Kai — the thing you ask instead of hunting through screens.
//
// A command bar that answers what owners actually ask, out of their own data,
// with no model in the loop. Every answer below maps to a query that already
// existed somewhere in this codebase; what was missing was a way in.
//
// WHY NO LANGUAGE MODEL
//
//   Cost. Every question would be an API call — small, permanent, and paid per
//   business, on a product sold once for $400 and $0 a month forever.
//
//   Privacy. Once Kairo holds treatment notes, sending a question that could
//   quote them to an overseas model is cross-border disclosure of health
//   information under Australian Privacy Principle 8. That is exposure for the
//   salon and for whoever built the pipe.
//
//   And the founding rule: nothing acts silently. A model that can act is the
//   opposite of that — "cancel Sarah's appointment", with two Sarahs in the
//   book, is somebody's afternoon. So Kai NEVER acts on a guess. It shows what
//   it matched, and the owner presses the thing.
//
// This is also the right first step even if a model does arrive later. An
// assistant is only as good as the functions it can call; building that layer
// properly is the work, and bolting a model onto it afterwards is a weekend.
// Done in the other order you get a chatbot that guesses.
import { db, getSetting, publicUrl } from './db.js';
import { clientRhythms } from './opportunities.js';
import { tokenise, scoreIntent, readPeriod, readWeekdays } from './kai-language.js';
import { readActions } from './kai-actions.js';

const money = (cents) => `${getSetting('currency', '$')}${((cents || 0) / 100).toFixed(2)}`;
const clock = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${(h % 12) || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const prettyDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-AU',
  { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * An answer.
 *
 * `kind` is what the screen draws; `matched` is the phrase Kai believes it
 * understood, shown back before anything happens. That last field is the whole
 * safety model: an owner who sees "matched: overdue clients" and meant
 * something else has lost a second, not an afternoon.
 */
const answer = (o) => ({
  kind: o.kind,
  title: o.title,
  detail: o.detail || '',
  matched: o.matched || '',
  rows: o.rows || [],
  href: o.href || '',
  copy: o.copy || '',
  score: o.score ?? 0,
  // Only on a proposed change: what it would do, what it would undo, and the
  // fingerprint the server checks before it does any of it.
  ...(o.plan ? { plan: o.plan } : {}),
});

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

/**
 * Every screen worth jumping to, with the words an owner would actually use.
 *
 * "sms reminders" is not the name of a page; it is what somebody types when
 * they want to change how texts go out. The aliases matter more than the
 * titles, because the titles are what they could already see in the sidebar.
 */
const PLACES = [
  { title: 'Today', href: '#/dashboard', words: 'dashboard home today overview takings' },
  { title: 'Calendar', href: '#/calendar', words: 'calendar diary book appointments schedule' },
  { title: 'Clients', href: '#/clients', words: 'clients customers people contacts' },
  { title: 'Services', href: '#/services', words: 'services prices price list treatments menu' },
  { title: 'Products', href: '#/products', words: 'products retail stock inventory' },
  // Alias lists have to carry the CANONICAL word as well as the natural ones —
  // "who owes me" reaches the matcher as "owing", and a page that only lists
  // "owed" is invisible to it however obvious the connection looks in writing.
  { title: 'Billing', href: '#/invoices', words: 'invoices billing bills payments owed unpaid owing' },
  { title: 'Messages', href: '#/messages', words: 'messages sent email sms log outbox' },
  { title: 'Reviews', href: '#/reviews', words: 'reviews ratings feedback stars' },
  { title: 'Growth', href: '#/growth', words: 'growth referrals referral link google new clients' },
  { title: 'Team', href: '#/staff', words: 'staff team roster hours rota stylists' },
  { title: 'Point of Sale', href: '#/pos', words: 'pos till checkout sell payment counter' },
  { title: 'Settings → Opening hours', href: '#/settings', words: 'open hours days times closed shut trading roster week' },
  { title: 'Settings → Notifications', href: '#/settings', words: 'sms reminders notifications email confirmations texts resend clicksend' },
  { title: 'Settings → Booking page', href: '#/settings', words: 'booking page brand colours logo online booking' },
  { title: 'Settings → No-shows', href: '#/settings', words: 'no shows noshow deposits blocked rules confirm' },
  { title: 'Settings → Patch tests', href: '#/settings', words: 'patch test allergy consent safety contraindication ppd colour' },
  { title: 'Settings → Marketing', href: '#/settings', words: 'marketing automations campaigns offers' },
  { title: 'Settings → Backups', href: '#/settings', words: 'backup backups restore export database' },
  { title: 'Account', href: '#/account', words: 'account password security login sign in' },
];

// ---------------------------------------------------------------------------
// The questions
// ---------------------------------------------------------------------------

/** Somebody by name — the single most common thing anyone types. */
function findClients(q, today) {
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const rows = db.prepare(
    `SELECT c.id, c.first_name, c.last_name, c.phone, c.email,
            (SELECT MAX(date) FROM appointments WHERE client_id = c.id
              AND status NOT IN ('cancelled','no_show') AND date <= ?) AS last_visit,
            (SELECT MIN(date) FROM appointments WHERE client_id = c.id
              AND status IN ('booked','confirmed') AND date >= ?) AS next_visit,
            COALESCE((SELECT SUM(CAST(ROUND(ii.qty * ii.unit_cents) AS INTEGER))
                        FROM invoice_items ii JOIN invoices i2 ON i2.id = ii.invoice_id
                       WHERE i2.client_id = c.id AND i2.status IN ('sent','draft')), 0)
            - COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN invoices i3 ON i3.id = p.invoice_id
                         WHERE i3.client_id = c.id AND i3.status IN ('sent','draft')), 0) AS owing_cents
       FROM clients c
      WHERE c.first_name LIKE ? OR c.last_name LIKE ?
         OR (c.first_name || ' ' || c.last_name) LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
      ORDER BY (c.first_name LIKE ?) DESC, c.first_name LIMIT 6`
  ).all(today, today, like, like, like, like, like, `${q}%`);

  return rows.map((c) => {
    const bits = [];
    if (c.next_visit) bits.push(`next in ${prettyDate(c.next_visit)}`);
    else if (c.last_visit) bits.push(`last seen ${prettyDate(c.last_visit)}`);
    else bits.push('never been in');
    if (c.owing_cents > 0) bits.push(`owes ${money(c.owing_cents)}`);
    return answer({
      kind: 'client',
      title: `${c.first_name} ${c.last_name || ''}`.trim(),
      detail: bits.join(' · '),
      matched: 'a client',
      href: `#/clients?q=${encodeURIComponent(`${c.first_name} ${c.last_name || ''}`.trim())}`,
      score: 90,
    });
  });
}

/**
 * What came in over a period, against the one before it — and, when the owner
 * named particular days, split across those days.
 *
 * "What were last week's numbers for Monday, Tuesday and Wednesday" is a real
 * question with a real answer, and it used to get the same undifferentiated
 * weekly total as everything else. The split is where the useful part is: three
 * days that look identical on the roster rarely look identical on the takings.
 */
function takingsFor(today, period, weekdays = []) {
  const { from, to, label, days } = period;
  const prevFrom = addDays(from, -days);
  const prevTo = addDays(from, -1);
  const dayFilter = weekdays.length
    ? ` AND CAST(strftime('%w', substr(paid_at, 1, 10)) AS INTEGER) IN (${weekdays.join(',')})`
    : '';
  const sum = (a, b) => db.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) AS v FROM payments
      WHERE substr(paid_at, 1, 10) BETWEEN ? AND ?${dayFilter}`
  ).get(a, b).v;

  const now = sum(from, to);
  const before = sum(prevFrom, prevTo);
  const diff = now - before;
  // Stated as a comparison rather than a lone figure. "$2,140" means nothing on
  // its own; "$2,140, up $310 on the week before" is the whole point.
  const change = before === 0
    ? (now > 0 ? 'nothing to compare it with yet' : 'nothing either period')
    : `${diff >= 0 ? 'up' : 'down'} ${money(Math.abs(diff))} on the ${label} before`;

  const rows = weekdays.length ? weekdays.map((d) => {
    const v = db.prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS v, COUNT(DISTINCT substr(paid_at, 1, 10)) AS n
         FROM payments WHERE substr(paid_at, 1, 10) BETWEEN ? AND ?
          AND CAST(strftime('%w', substr(paid_at, 1, 10)) AS INTEGER) = ?`
    ).get(from, to, d);
    return {
      label: DAYS[d],
      sub: v.n ? `${v.n} day${v.n === 1 ? '' : 's'} in this period` : 'nothing taken',
      value: money(v.v),
    };
  }) : [];

  const scope = weekdays.length ? ` on ${weekdays.map((d) => DAYS[d]).join(', ')}` : '';
  // "last 3 days" already says "last"; "week" does not. Reading back "over the
  // last last 3 days" is the kind of thing that makes an owner trust the number
  // slightly less, for no reason at all.
  const when = /^(today|yesterday)$/.test(label) ? label
    : /^last /.test(label) ? `over the ${label}` : `over the last ${label}`;
  return answer({
    kind: weekdays.length ? 'list' : 'figure',
    title: money(now),
    detail: `Taken ${when}${scope} — ${change}`,
    matched: `takings, ${label}${scope}`,
    rows,
    href: '#/dashboard',
    score: 80,
  });
}

/** Who has not paid, oldest first. */
function owing(today) {
  const rows = db.prepare(
    `SELECT i.number, i.issue_date, i.due_date,
            c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS client_name,
            COALESCE((SELECT CAST(ROUND(SUM(qty * unit_cents)) AS INTEGER) FROM invoice_items WHERE invoice_id = i.id), 0)
            - i.discount_cents
            - COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id = i.id), 0) AS balance_cents
       FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.status IN ('sent', 'draft')
      ORDER BY i.issue_date LIMIT 8`
  ).all().filter((r) => r.balance_cents > 0);

  const total = rows.reduce((n, r) => n + r.balance_cents, 0);
  return answer({
    kind: 'list',
    title: rows.length ? `${money(total)} outstanding` : 'Nothing outstanding',
    detail: rows.length
      ? `Across ${rows.length} invoice${rows.length === 1 ? '' : 's'}, oldest first`
      : 'Every invoice you have sent is paid.',
    matched: 'unpaid invoices',
    rows: rows.map((r) => ({
      label: r.client_name || r.number,
      sub: `${r.number} · ${prettyDate(r.issue_date)}${
        r.due_date && r.due_date < today ? ' · overdue' : ''}`,
      value: money(r.balance_cents),
    })),
    href: '#/invoices',
    score: 85,
  });
}

/** Regulars who have drifted, by their own rhythm rather than one rule. */
function overdue(today) {
  const rows = clientRhythms({ today })
    .filter((r) => !r.has_future && r.ratio >= 1.5)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8);
  const names = rows.length ? db.prepare(
    `SELECT id, first_name, last_name FROM clients WHERE id IN (${rows.map(() => '?').join(',')})`
  ).all(...rows.map((r) => r.client_id)) : [];
  const byId = Object.fromEntries(names.map((c) => [c.id, c]));

  return answer({
    kind: 'list',
    title: rows.length ? `${rows.length} regular${rows.length === 1 ? '' : 's'} overdue` : 'Nobody is overdue',
    detail: rows.length
      ? 'Past their own usual gap, with nothing booked. Measured per person, not one rule for everybody.'
      : 'Every regular is either booked in or still within their usual gap.',
    matched: 'clients who are overdue',
    rows: rows.map((r) => {
      const c = byId[r.client_id];
      return {
        label: c ? `${c.first_name} ${c.last_name || ''}`.trim() : 'Client',
        sub: `usually every ${r.median_days} days · ${r.since_days} since`,
        value: `${r.ratio.toFixed(1)}×`,
      };
    }),
    href: '#/dashboard',
    score: 85,
  });
}

/** No-shows this month, and who. */
function noShows(today) {
  const from = `${today.slice(0, 7)}-01`;
  const rows = db.prepare(
    `SELECT c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS name,
            COUNT(*) AS n, MAX(a.date) AS last
       FROM appointments a LEFT JOIN clients c ON c.id = a.client_id
      WHERE a.status = 'no_show' AND a.date >= ?
      GROUP BY a.client_id ORDER BY n DESC, last DESC LIMIT 8`
  ).all(from);
  const total = rows.reduce((n, r) => n + r.n, 0);
  return answer({
    kind: 'list',
    title: total ? `${total} no-show${total === 1 ? '' : 's'} this month` : 'No no-shows this month',
    detail: total ? 'The slot is gone and there is nothing to sell in its place.'
      : 'Everybody who booked turned up.',
    matched: 'no-shows this month',
    rows: rows.map((r) => ({
      label: r.name || 'Someone',
      sub: `last on ${prettyDate(r.last)}`,
      value: `${r.n}×`,
    })),
    href: '#/settings',
    score: 85,
  });
}

/** The booking link, ready to hand over. */
function bookingLink() {
  const base = publicUrl();
  return answer({
    kind: 'copy',
    title: base ? `${base}/book` : 'No website address set yet',
    detail: base
      ? 'Your booking page. Press Enter to copy it.'
      : 'Set your website address in Settings and this becomes a link you can hand out.',
    matched: 'your booking link',
    copy: base ? `${base}/book` : '',
    href: base ? '' : '#/settings',
    score: 88,
  });
}

/** What is on today, right now. */
function todayAt(today) {
  const rows = db.prepare(
    `SELECT a.start_min, a.status,
            c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS name,
            s.name AS staff_name, sv.name AS service_name
       FROM appointments a
       LEFT JOIN clients c ON c.id = a.client_id
       LEFT JOIN staff s ON s.id = a.staff_id
       LEFT JOIN services sv ON sv.id = a.service_id
      WHERE a.date = ? AND a.status NOT IN ('cancelled')
      ORDER BY a.start_min LIMIT 10`
  ).all(today);
  return answer({
    kind: 'list',
    title: rows.length ? `${rows.length} in today` : 'Nothing booked today',
    detail: rows.length ? DAYS[new Date(`${today}T12:00:00`).getDay()] : 'The diary is clear.',
    matched: "today's diary",
    rows: rows.map((r) => ({
      label: r.name || 'Walk-in',
      sub: `${r.service_name || ''}${r.staff_name ? ` · ${r.staff_name}` : ''}`,
      value: clock(r.start_min),
    })),
    href: '#/calendar',
    score: 82,
  });
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * What each question is ABOUT, rather than the words somebody has to type.
 *
 * The first version of this was a regex table: "last week" worked, "what did we
 * take last week compared to the week before" did not. That is a bar an owner
 * has to learn the phrasing of, which is a worse menu rather than a better one.
 *
 * So each intent lists the words that point at it, weighted, plus the words at
 * least one of which has to be there. Scoring means a long sentence can carry
 * several signals and the strongest wins, and it means adding a way of saying
 * something is one word in a list rather than another branch of a regex.
 *
 * Still no fuzzy string distance, no stemming, no model. Every match is
 * explainable in one line, and Kai shows the owner which line it was.
 */
const INTENTS = [
  {
    id: 'diary',
    must: ['diary', 'today'],
    any: { diary: 32, today: 26, tomorrow: 10 },
    run: ({ today }) => todayAt(today),
  },
  {
    id: 'takings',
    must: ['takings', 'week', 'month', 'year', 'fortnight', 'quarter', 'yesterday', 'today', 'day'],
    any: {
      takings: 34, week: 20, month: 20, fortnight: 20, quarter: 18,
      year: 18, yesterday: 16, day: 12, today: 10,
    },
    run: ({ today, period, weekdays }) => takingsFor(
      today, period || { from: addDays(today, -6), to: today, label: 'week', days: 7 }, weekdays,
    ),
  },
  { id: 'owing', must: ['owing'], any: { owing: 34, client: 6 }, run: ({ today }) => owing(today) },
  { id: 'overdue', must: ['overdue'], any: { overdue: 34, client: 6 }, run: ({ today }) => overdue(today) },
  { id: 'noshow', must: ['noshow'], any: { noshow: 34, client: 6 }, run: ({ today }) => noShows(today) },
  { id: 'link', must: ['bookinglink', 'link'], any: { bookinglink: 36, link: 22 }, run: () => bookingLink() },
];

/**
 * Everything Kai can do about this sentence, best first.
 *
 * Always returns SOMETHING, even if only "here is where that lives" — a bar
 * that goes blank has taught the owner not to open it again.
 *
 * Changes come back as proposals alongside the answers, never as things already
 * done. See src/kai-actions.js for why that is the whole design rather than a
 * politeness.
 */
export function ask(query, { today }) {
  const raw = String(query || '').trim();
  if (!raw) return { query: raw, answers: [] };

  const { keys } = tokenise(raw);
  const period = readPeriod(raw, today);
  const weekdays = readWeekdays(raw);
  const out = [];

  for (const intent of INTENTS) {
    const score = scoreIntent(keys, intent);
    if (!score) continue;
    try {
      const a = intent.run({ today, period, weekdays });
      // The intent's own confidence, plus how well the sentence pointed at it,
      // so "what did we take last week" outranks the page that shares a word.
      out.push({ ...a, score: a.score + score });
    } catch { /* one bad answer must not empty the bar */ }
  }

  // Things Kai could change, shown as proposals with a Confirm on them.
  try {
    for (const plan of readActions(raw, { today })) {
      out.push(answer({
        kind: 'action',
        title: plan.title,
        detail: plan.detail,
        matched: plan.matched,
        rows: plan.changes.map((c) => ({ label: c.label, sub: c.from, value: c.to })),
        score: plan.score,
        plan,
      }));
    }
  } catch { /* a change Kai cannot work out is simply not offered */ }

  // Places, matched on the words an owner would use rather than the page title.
  for (const place of PLACES) {
    const hay = `${place.title.toLowerCase()} ${place.words}`;
    const hits = keys.filter((t) => hay.includes(t)).length;
    if (!hits) continue;
    out.push(answer({
      kind: 'place',
      title: place.title,
      detail: 'Go there',
      matched: 'a page',
      href: place.href,
      // Weaker than a real answer: somebody typing "sarah" wants Sarah, not the
      // Services page because both contain an "s".
      score: 40 + hits * 8 + (hay.startsWith(keys[0] || ' ') ? 20 : 0),
    }));
  }

  try { out.push(...findClients(raw, today)); } catch { /* names are optional */ }

  out.sort((a, b) => b.score - a.score);
  return { query: raw, answers: out.slice(0, 8) };
}

/** What to show before anybody has typed anything. */
export function suggestions() {
  return [
    'what did we take last week',
    'who owes me',
    "clients who haven't been in",
    'no shows this month',
    'open on Friday from 11 to 2',
    "what's on today",
  ];
}
