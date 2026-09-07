// Reading a sentence the way an owner actually says it.
//
// Kai's first version matched fixed phrases. Type "last week" and it worked;
// say "hey Kai what did we take last week compared to the one before" and it
// went blank — which taught the owner to stop talking to it and go back to
// typing the magic words. A bar you have to learn the phrasing of is a worse
// menu, not a better one.
//
// So this module does three things, all of them plain and none of them clever:
//
//   1. Reduces a sentence to the words that carry meaning.
//   2. Scores that against what each intent is ABOUT, rather than testing it
//      against a phrase somebody hoped would be typed.
//   3. Pulls out the concrete things — which days, which period, which times —
//      so an intent gets "Monday and Tuesday, 11:00 to 14:00" rather than a
//      string to re-read for itself.
//
// There is still no model in the loop, and after this there is more reason for
// that rather than less: Kai can now change a salon's opening hours, and a thing
// that guesses must never be the thing that acts. Everything here is inspectable
// — you can read why a sentence matched, and the owner is shown the same reason
// before anything happens.
//
// No DOM, no database, no clock of its own. Everything is a pure function of the
// text and the date it is handed, which is what makes it testable to the corner.

/** 0 = Sunday, matching Date.getDay() and the stored open_days. */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// Turning a sentence into words worth matching
// ---------------------------------------------------------------------------

/**
 * Words that carry no signal in a question to a booking system.
 *
 * Being generous here is safe: dropping "please" cannot cause a wrong match, and
 * keeping it lets "please" accidentally count as a hit against a page whose
 * alias list happens to contain it. What must NOT be in this list is anything
 * that distinguishes one intent from another — "today" and "week" earn their
 * place in a sentence, so they stay.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'do', 'does', 'did', 'doing', 'done', 'have', 'has', 'had',
  'i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours', 'you', 'your', 'yours',
  'it', 'its', 'they', 'them', 'their', 'there', 'here',
  'can', 'could', 'would', 'should', 'shall', 'will', 'may', 'might', 'must',
  'please', 'thanks', 'thank', 'hey', 'hi', 'hello', 'ok', 'okay', 'yeah', 'yes',
  'kai', 'kairo',
  'of', 'to', 'for', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'so', 'and',
  'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those',
  'what', 'whats', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  // "only" is NOT here. "Open Tuesday and Thursday only" is a request to
  // replace the whole week rather than add to it, and that word is the entire
  // difference between the two.
  'much', 'many', 'lot', 'some', 'any', 'all', 'just', 'also',
  'get', 'give', 'show', 'tell', 'see', 'look', 'find', 'want', 'need',
  'up', 'out', 'about', 'over', 'into', 'now',
]);

/**
 * Words that mean the same thing to this product.
 *
 * Mapped to one canonical token so an intent can list "takings" once instead of
 * listing every word a person might reach for. An owner says turnover, their
 * bookkeeper says revenue, their partner says "how much did we make" — all three
 * are the same question and should not each need their own rule.
 */
const SYNONYMS = new Map(Object.entries({
  takings: 'takings', taking: 'takings', took: 'takings', take: 'takings',
  revenue: 'takings', turnover: 'takings', income: 'takings', earnings: 'takings',
  earned: 'takings', earn: 'takings', made: 'takings', money: 'takings',
  sales: 'takings', sold: 'takings', takings_: 'takings',
  stats: 'takings', statistics: 'takings', numbers: 'takings', figures: 'takings',

  owe: 'owing', owes: 'owing', owed: 'owing', owing: 'owing',
  unpaid: 'owing', outstanding: 'owing', debt: 'owing', debts: 'owing',
  invoice: 'owing', invoices: 'owing',
  // "bill" and "bills" are deliberately NOT here. They are a fair word for an
  // invoice and a very common first name, and the name has to win: somebody
  // typing "bill" is looking for Bill far more often than for the Billing page,
  // and a synonym that swallows a person is worse than a synonym that is
  // missing. "Who owes me", "unpaid" and "outstanding" all still work.

  noshow: 'noshow', noshows: 'noshow', 'no-show': 'noshow', 'no-shows': 'noshow',
  missed: 'noshow', skipped: 'noshow', ghosted: 'noshow',

  lapsed: 'overdue', drifted: 'overdue', overdue: 'overdue', stopped: 'overdue',
  disappeared: 'overdue', vanished: 'overdue',

  diary: 'diary', schedule: 'diary', agenda: 'diary', appointments: 'diary',
  appointment: 'diary', bookings: 'diary', booking: 'diary', booked: 'diary',
  calendar: 'diary',

  link: 'link', url: 'link', address: 'link', website: 'link',

  open: 'open', opening: 'open', opens: 'open', operate: 'open', trading: 'open',
  close: 'close', closed: 'close', closing: 'close', shut: 'close', shuts: 'close',
  hours: 'hours', hour: 'hours', times: 'hours', time: 'hours', timings: 'hours',

  change: 'change', changed: 'change', set: 'change', make: 'change',
  update: 'change', switch: 'change', move: 'change', adjust: 'change',
  add: 'add', adding: 'add', include: 'add', start: 'add',
  remove: 'remove', delete: 'remove', drop: 'remove', stop: 'remove',
  cancel: 'remove', without: 'remove',

  client: 'client', clients: 'client', customer: 'client', customers: 'client',
  people: 'client', person: 'client',

  // Plurals of the period words, folded so an intent lists each one once.
  // "Last week's takings" reaches here as "weeks" — the apostrophe pass runs
  // first — and an intent that only knew "week" would not match one of the most
  // natural ways an owner asks the question.
  weeks: 'week', months: 'month', years: 'year', days: 'day', day: 'day',
  fortnights: 'fortnight', quarters: 'quarter',
}));

/** Contractions written the long way, so one spelling reaches the matcher. */
const EXPANSIONS = [
  [/\bwhat'?s\b/g, 'what is'], [/\bwho'?s\b/g, 'who is'], [/\bthat'?s\b/g, 'that is'],
  [/\bhaven'?t\b/g, 'have not'], [/\bhasn'?t\b/g, 'has not'], [/\bdidn'?t\b/g, 'did not'],
  [/\bdon'?t\b/g, 'do not'], [/\bdoesn'?t\b/g, 'does not'], [/\bisn'?t\b/g, 'is not'],
  [/\bwe'?re\b/g, 'we are'], [/\bi'?m\b/g, 'i am'], [/\bwon'?t\b/g, 'will not'],
  [/\bcan'?t\b/g, 'can not'], [/\bcould'?ve\b/g, 'could have'],
  [/\bno[\s-]?shows?\b/g, 'noshow'],
];

/**
 * Several words that mean one thing.
 *
 * Collapsed before the stopword pass, because most of these are made almost
 * entirely of stopwords — "have not been in" survives as nothing at all
 * otherwise, and it is one of the most natural ways an owner asks the question.
 */
const PHRASES = [
  [/\b(?:have|has|had) not been in\b/g, 'overdue'],
  [/\bnot been in (?:for )?(?:a )?(?:while|ages|long time)\b/g, 'overdue'],
  [/\bdue back\b/g, 'overdue'],
  [/\bfallen off\b/g, 'overdue'],
  [/\bdid not (?:turn up|show up|come in)\b/g, 'noshow'],
  [/\bwho own?es\b/g, 'owing'],
  [/\b(?:booking|book|share|my) link\b/g, 'bookinglink'],
  // "Opening days" and "opening hours" are NOT the same thing here, and
  // collapsing them was briefly catastrophic: "change Sunday hours to 11 to 4"
  // came out meaning "open Sunday and nothing else", which would have shut a
  // salon six days a week from one misread sentence. The word that survives is
  // the word that decides.
  // One token, not two, and the plural matters. "My opening days" is the SET of
  // days a salon trades on; "an open day" is one of them. Reading the second as
  // the first turns "change Friday to an open day" into "open Friday and shut
  // the other six", which is the worst thing this feature could do.
  [/\b(?:opening|trading|open|trade) days\b/g, 'opendays'],
  [/\b(?:opening|trading) (?:hours|times)\b/g, 'open hours'],
  [/\bwhat is on\b/g, 'diary'],
];

/** Lowercase, expand contractions, and reduce punctuation to spaces. */
export function normalise(text) {
  let s = ` ${String(text || '').toLowerCase()} `;
  for (const [re, to] of EXPANSIONS) s = s.replace(re, to);
  for (const [re, to] of PHRASES) s = s.replace(re, to);
  // Apostrophes inside words go before punctuation is stripped, so "sarah's"
  // becomes "sarahs" rather than two tokens.
  s = s.replace(/(\w)'(\w)/g, '$1$2');
  s = s.replace(/[^\w\s:.-]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * The meaningful words of a sentence, canonicalised.
 *
 * Returns both: `words` is everything (needed for name search — somebody's
 * surname might be a stopword), `keys` is what the intent matcher scores.
 */
export function tokenise(text) {
  const words = normalise(text).split(' ').filter(Boolean);
  const keys = [];
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    const canon = SYNONYMS.get(w) || w;
    if (!keys.includes(canon)) keys.push(canon);
  }
  return { words, keys };
}

/**
 * How well a sentence matches what an intent is about.
 *
 * `spec.any` is the words that suggest this intent, each with a weight;
 * `spec.must` (optional) is words at least one of which has to be present, and
 * is what stops "how many clients came in last week" scoring as a request to
 * CHANGE something just because it shares the word "week".
 *
 * Coverage matters as well as raw hits: a two-word sentence that matches both
 * its words is a better fit than a fifteen-word one that matched two, and
 * without that a long rambling question drags every intent up together.
 */
export function scoreIntent(keys, spec) {
  const must = spec.must || null;
  if (must && !must.some((m) => keys.includes(m))) return 0;
  let hits = 0;
  let weight = 0;
  for (const [word, w] of Object.entries(spec.any || {})) {
    if (keys.includes(word)) { hits++; weight += w; }
  }
  if (!hits) return 0;
  const coverage = hits / Math.max(1, keys.length);
  return weight + Math.round(coverage * 12);
}

// ---------------------------------------------------------------------------
// Weekdays
// ---------------------------------------------------------------------------

const DAY_WORDS = [
  ['sunday', 'sundays', 'sun', 'suns'],
  ['monday', 'mondays', 'mon', 'mons'],
  ['tuesday', 'tuesdays', 'tue', 'tues', 'tuesdy'],
  ['wednesday', 'wednesdays', 'wed', 'weds', 'wednes'],
  ['thursday', 'thursdays', 'thu', 'thur', 'thurs'],
  ['friday', 'fridays', 'fri', 'fris'],
  ['saturday', 'saturdays', 'sat', 'sats'],
];

/**
 * Every weekday named in a sentence, in week order and without repeats.
 *
 * Matched on whole words only. "sun" as a token is Sunday; "sunday" inside
 * "sundays" is handled by listing the plural, not by prefix matching — which
 * would make "satisfied" a Saturday.
 */
export function readWeekdays(text) {
  const words = normalise(text).split(' ').filter(Boolean);
  const found = new Set();
  for (const w of words) {
    if (w === 'weekdays' || w === 'weekday') { [1, 2, 3, 4, 5].forEach((d) => found.add(d)); continue; }
    if (w === 'weekends' || w === 'weekend') { [0, 6].forEach((d) => found.add(d)); continue; }
    DAY_WORDS.forEach((names, i) => { if (names.includes(w)) found.add(i); });
  }
  // "every day" / "all week" / "seven days" — said as a phrase, so checked on
  // the joined text rather than word by word.
  const joined = ` ${words.join(' ')} `;
  if (/\b(every ?day|everyday|all week|seven days|7 days|any day)\b/.test(joined)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  return [...found].sort((a, b) => a - b);
}

/** "Monday, Tuesday and Wednesday" from [1,2,3]. */
export function listDays(days) {
  const names = days.map((d) => DAY_NAMES[d]);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

const TIME = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?`;
const RANGE = new RegExp(`\\b${TIME}\\s*(?:-|–|—|to|til|till|until|thru|through|and)\\s*${TIME}\\b`, 'i');

/**
 * "11 to 2", "9:30am til 5", "from 8 until 6" → minutes from midnight.
 *
 * The am/pm guessing is the interesting part. A salon that says "11 to 2" means
 * 11 in the morning and 2 in the afternoon, always — nobody opens at 11pm. So
 * where the hour is not stated, the opening time is read as given and the
 * closing time is pushed past it. That gets 9-to-5, 10-to-6 and 11-to-2 all
 * right without asking.
 *
 * It can still be wrong, and that is exactly why nothing here is applied
 * without the owner seeing "11:00 – 14:00" written out and pressing something.
 */
export function readTimeRange(text) {
  const m = RANGE.exec(normalise(text));
  if (!m) return null;
  const [, h1, m1, ap1, h2, m2, ap2] = m;

  const build = (h, min, ap) => {
    let hour = Number(h);
    if (hour > 24 || (min !== undefined && Number(min) > 59)) return null;
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    return hour * 60 + Number(min || 0);
  };

  let open = build(h1, m1, ap1);
  let close = build(h2, m2, ap2);
  if (open === null || close === null) return null;

  // Neither hour was spoken with am or pm: read the opener literally and push
  // the closer past it.
  if (!ap1 && !ap2 && close <= open) close += 12 * 60;
  // Only the closer was qualified ("11 to 2pm"): the opener is morning.
  else if (!ap1 && ap2 && close <= open) open = Number(h1) * 60 + Number(m1 || 0);

  if (close <= open || close > 24 * 60 || open < 0) return null;
  return { open_min: open, close_min: close };
}

/** 14:00 → "2pm", the way the rest of Kai writes a time. */
export function clockLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${(h % 12) || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
}

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * The stretch of time a question is about.
 *
 * Returns `{ from, to, label, days }`, or null when the sentence names no
 * period at all — in which case the caller picks its own default rather than
 * this module inventing one. Weeks run backwards from today rather than to
 * calendar boundaries: an owner asking on Thursday what they took "last week"
 * means the last seven days, not Monday-to-Sunday of the previous week. Where
 * they mean the calendar week they say "this week", which is handled apart.
 */
export function readPeriod(text, today) {
  const s = normalise(text);
  const span = (days, label, endsToday = true) => ({
    from: addDays(today, -(days - 1)),
    to: endsToday ? today : today,
    label,
    days,
  });

  if (/\b(today|todays|so far today|this morning)\b/.test(s)) {
    return { from: today, to: today, label: 'today', days: 1 };
  }
  if (/\byesterday\b/.test(s)) {
    const y = addDays(today, -1);
    return { from: y, to: y, label: 'yesterday', days: 1 };
  }
  const lastN = /\b(?:last|past|previous)\s+(\d{1,5})\s*(day|days|week|weeks|month|months)\b/.exec(s);
  if (lastN) {
    const n = Number(lastN[1]);
    const unit = lastN[2].startsWith('day') ? 1 : lastN[2].startsWith('week') ? 7 : 30;
    const asked = n * unit;
    const days = Math.min(730, Math.max(1, asked));
    // Two years is as far back as this looks. When the ask is longer the label
    // says what was actually measured rather than what was asked for — a figure
    // headed "last 9999 days" that covers two of them is a wrong number wearing
    // a right one's clothes.
    if (days !== asked) return span(days, `last ${days} days`);
    return span(days, `last ${n} ${lastN[2].replace(/s$/, '')}${n === 1 ? '' : 's'}`);
  }
  // Plurals matter more than they look. "Last week's takings" survives the
  // apostrophe pass as "weeks", and a reader that only knew "week" quietly
  // returned no period at all for one of the most natural ways to ask.
  if (/\b(fortnights?|two weeks|2 weeks)\b/.test(s)) return span(14, 'fortnight');
  if (/\b(years?|12 months|twelve months)\b/.test(s)) return span(365, 'year');
  if (/\b(quarters?|3 months|three months)\b/.test(s)) return span(90, 'quarter');
  if (/\bmonths?\b/.test(s)) return span(30, 'month');
  if (/\b(weeks?|7 days|seven days)\b/.test(s)) return span(7, 'week');
  return null;
}
