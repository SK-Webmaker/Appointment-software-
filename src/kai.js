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
  { title: 'Billing', href: '#/invoices', words: 'invoices billing bills payments owed unpaid' },
  { title: 'Messages', href: '#/messages', words: 'messages sent email sms log outbox' },
  { title: 'Reviews', href: '#/reviews', words: 'reviews ratings feedback stars' },
  { title: 'Growth', href: '#/growth', words: 'growth referrals referral link google new clients' },
  { title: 'Team', href: '#/staff', words: 'staff team roster hours rota stylists' },
  { title: 'Point of Sale', href: '#/pos', words: 'pos till checkout sell payment counter' },
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

/** What came in over a period, against the one before it. */
function takings(today, days, label) {
  const from = addDays(today, -(days - 1));
  const prevFrom = addDays(from, -days);
  const prevTo = addDays(from, -1);
  const sum = (a, b) => db.prepare(
    'SELECT COALESCE(SUM(amount_cents), 0) AS v FROM payments WHERE substr(paid_at, 1, 10) BETWEEN ? AND ?'
  ).get(a, b).v;
  const now = sum(from, today);
  const before = sum(prevFrom, prevTo);
  const diff = now - before;
  // Stated as a comparison rather than a lone figure. "$2,140" means nothing on
  // its own; "$2,140, up $310 on the fortnight before" is the whole point.
  const change = before === 0
    ? (now > 0 ? 'nothing to compare it with yet' : 'nothing either period')
    : `${diff >= 0 ? 'up' : 'down'} ${money(Math.abs(diff))} on the ${label} before`;
  return answer({
    kind: 'figure',
    title: money(now),
    detail: `Taken ${label === 'day' ? 'today' : `over the last ${label}`} — ${change}`,
    matched: `takings, last ${label}`,
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
 * Deliberately simple, and deliberately not clever.
 *
 * Every rule here is a phrase somebody would type, matched literally. There is
 * no fuzzy scoring, no stemming and no synonym table beyond the words listed —
 * because a bar that is 80% right and confident is worse than one that is
 * narrow and honest. When nothing matches, Kai says so and offers a client
 * search rather than guessing at the nearest thing.
 */
const INTENTS = [
  { test: /\b(today|on today|whats on|what's on|diary)\b/, run: (t) => todayAt(t) },
  { test: /\b(last week|this week|week)\b/, run: (t) => takings(t, 7, 'week') },
  { test: /\b(last month|this month|month)\b/, run: (t) => takings(t, 30, 'month') },
  { test: /\b(fortnight|two weeks)\b/, run: (t) => takings(t, 14, 'fortnight') },
  { test: /\b(took|takings|revenue|earned|money in|sales)\b/, run: (t) => takings(t, 7, 'week') },
  { test: /\b(owes?|owing|unpaid|outstanding|debt|who owes)\b/, run: (t) => owing(t) },
  { test: /\b(overdue|haven'?t been|not been in|lapsed|drifted|due back)\b/, run: (t) => overdue(t) },
  { test: /\b(no.?shows?|didn'?t turn up|missed)\b/, run: (t) => noShows(t) },
  { test: /\b(booking link|book link|my link|share link)\b/, run: () => bookingLink() },
];

/**
 * Everything Kai can answer for this query, best first.
 *
 * Always returns SOMETHING, even if only "here is where that lives" — a bar
 * that goes blank has taught the owner not to use it again.
 */
export function ask(query, { today }) {
  const raw = String(query || '').trim();
  const q = raw.toLowerCase();
  if (!q) return { query: raw, answers: [] };

  const out = [];
  for (const intent of INTENTS) {
    if (intent.test.test(q)) {
      try { out.push(intent.run(today)); } catch { /* one bad answer must not empty the bar */ }
    }
  }

  // Places, matched on the words an owner would use rather than the page title.
  const terms = q.split(/\s+/).filter(Boolean);
  for (const place of PLACES) {
    const hay = `${place.title.toLowerCase()} ${place.words}`;
    const hits = terms.filter((t) => hay.includes(t)).length;
    if (!hits) continue;
    out.push(answer({
      kind: 'place',
      title: place.title,
      detail: 'Go there',
      matched: 'a page',
      href: place.href,
      // Weaker than a real answer: somebody typing "sarah" wants Sarah, not the
      // Services page because both contain an "s".
      score: 40 + hits * 8 + (hay.startsWith(q) ? 20 : 0),
    }));
  }

  try { out.push(...findClients(raw, today)); } catch { /* names are optional */ }

  out.sort((a, b) => b.score - a.score);
  return { query: raw, answers: out.slice(0, 8) };
}

/** What to show before anybody has typed anything. */
export function suggestions() {
  return [
    'last week',
    'who owes me',
    "haven't been in",
    'no shows',
    'booking link',
    'today',
  ];
}
