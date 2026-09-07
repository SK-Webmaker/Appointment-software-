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
  // "11 a.m." and "11 A.M." are how people write it and how dictation
  // transcribes it. Left alone, the hour parses and the meridiem does not, so
  // "11 a.m. to 4 p.m." silently became something else entirely.
  // No trailing \b: it would force the final dot to be left behind, and
  // "4pm." does not match a time range because the dot sits where the
  // separator has to be. That one stray character was the difference between
  // reading two ranges and reading one.
  [/\b([ap])\.\s?m\.?/g, '$1m'],
  [/\bo'?clock\b/g, ''],
  [/\b(\d{1,2})\s+(am|pm)\b/g, '$1$2'],
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
  // The dollar sign survives: it is the difference between "over 200" meaning
  // an amount and meaning nothing at all, and readMoney is the only thing that
  // can tell a price from a count.
  s = s.replace(/[^\w\s:.$-]/g, ' ');
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
// Longest first, so "sunday" wins the alternation before "sun" can take it.
const DAY_ALT = DAY_WORDS.flat().sort((a, b) => b.length - a.length).join('|');
const DAY_RANGE = new RegExp(
  `\\b(${DAY_ALT})\\s*(?:-|–|—|to|til|till|until|thru|through)\\s*(${DAY_ALT})\\b`, 'g');
const dayIndex = (w) => DAY_WORDS.findIndex((names) => names.includes(w));

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
  // "Monday to Friday" is how opening hours are written on every shop door in
  // the country, and reading it as two days quietly leaves Tuesday out.
  // Wraps, because "Saturday to Wednesday" is a real week for a salon.
  for (const m of joined.matchAll(DAY_RANGE)) {
    const a = dayIndex(m[1]);
    const b = dayIndex(m[2]);
    if (a < 0 || b < 0) continue;
    for (let d = a, n = 0; n < 7; d = (d + 1) % 7, n++) {
      found.add(d);
      if (d === b) break;
    }
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
// Two things in one breath
// ---------------------------------------------------------------------------

/** Words that make a fragment an instruction rather than a list item. */
const CLAUSE_VERBS = /\b(open|close|closed|change|set|make|turn|switch|put|stop|start|enable|disable|shut|pause|resume|send|remind|ask|charge|allow|let|give|take|block|need|want)\b/i;

/** A fragment that is only a day name — the tail of a list, not an instruction. */
const BARE_DAY = new RegExp(`^(?:on\\s+|the\\s+)?(?:${DAY_WORDS.flat().sort((a, b) => b.length - a.length).join('|')})$`, 'i');

/**
 * Split a sentence that asks for more than one thing.
 *
 * People do not speak in single instructions. "Close Mondays and open Saturday
 * ten to three" is one breath and two changes, and reading only the first half
 * of it was the worst behaviour Kai had: it closed Monday, said so, and left the
 * owner believing Saturday was open.
 *
 * Two rules keep the split from doing damage:
 *
 *   1. "Only" and "opening days" are never split. Both scope over the whole
 *      list — "open Thursday and Friday only" means those two days and no
 *      others, and cutting it in half turns it into "Friday only", which closes
 *      the Thursday the owner just asked for.
 *   2. A trailing fragment with no verb of its own inherits the first clause's.
 *      "Open Saturday 10 to 3 and Sunday 11 to 4" becomes two openings rather
 *      than one opening and a stray time.
 *
 * Returns the clauses. A sentence that should be read whole comes back as one.
 */
export function splitClauses(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  if (/\bonly\b/i.test(raw) || /\bopening\s+days\b/i.test(raw)) return [raw];

  const parts = raw.split(/\s*(?:,|;|\band\b|\bthen\b|\balso\b|\bplus\b)\s*/i)
    .map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return [raw];

  // "Close Monday and Tuesday" is a list, not two instructions. A trailing
  // fragment that is nothing but a day name belongs to the sentence it came
  // from — splitting it out and lending it the first clause's verb produced the
  // right week by the wrong route, narrating a state in the middle that was
  // never true.
  if (parts.slice(1).some((p) => BARE_DAY.test(p))) return [raw];

  const lead = parts[0].match(CLAUSE_VERBS)?.[0] || '';
  return parts.map((p, i) => (i === 0 || !lead || CLAUSE_VERBS.test(p) ? p : `${lead} ${p}`));
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

const TIME = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?`;
const RANGE_SRC = `\\b${TIME}\\s*(?:-|–|—|to|til|till|until|thru|through|and)\\s*${TIME}\\b`;
const RANGE = new RegExp(RANGE_SRC, 'i');
const RANGE_ALL = new RegExp(RANGE_SRC, 'gi');

/**
 * "11 to 2", "9:30am til 5", "from 8 until 6" → minutes from midnight.
 *
 * The am/pm guessing is the interesting part. A salon that says "11 to 2" means
 * 11 in the morning and 2 in the afternoon, always — nobody opens at 11pm. So
 * where the hour is not stated, the opening time is read as given and the
 * closing time is pushed past it. That gets 9-to-5, 10-to-6 and 11-to-2 all
 * right without asking.
 *
 * It can still be wrong, which is why the change Kai makes from it is reported
 * back in clock words — "Sunday is 2pm–6pm now" — and can be undone in one
 * press or one word. A guess that says what it guessed is checkable; a guess
 * that goes quiet is not.
 */
export function readTimeRange(text) {
  return readTimeRanges(text).target;
}

/**
 * Every time range in a sentence, and which one the owner actually means.
 *
 * "Change 11am to 4pm on a Sunday to 2 to 6" contains two, and the first is the
 * hours being REPLACED — an owner naturally says what it is now before saying
 * what they want. Reading the first was not a near miss: with "a.m." spelled
 * out, that sentence proposed opening the salon at two in the morning.
 *
 * So the LAST range wins, and the earlier one is returned as `from` so the
 * caller can check it against reality and say "that is not what Sunday says
 * now" rather than silently doing something else.
 *
 * A sentence with one range is unaffected: it is both the first and the last.
 */
export function readTimeRanges(text) {
  const s = normalise(text);
  const all = [...s.matchAll(RANGE_ALL)].map(readOne).filter(Boolean);
  if (!all.length) return { target: null, from: null, count: 0 };
  return {
    target: all[all.length - 1],
    from: all.length > 1 ? all[all.length - 2] : null,
    count: all.length,
  };
}

function readOne(m) {
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

  // Neither hour was spoken with am or pm, which is how everybody says it.
  //
  // Read the opener the way a salon means it: 7 through 12 is morning, 1
  // through 6 is afternoon. Nobody opens at two in the morning, and "2 to 6"
  // used to become exactly that — the old rule only pushed the CLOSER later, so
  // an already-ascending pair like 2→6 was left before dawn and applied.
  // Then the closer is pushed past the opener, which handles 9→5 and 11→2.
  if (!ap1 && !ap2) {
    if (Number(h1) >= 1 && Number(h1) <= 6) open += 12 * 60;
    if (close <= open) close += 12 * 60;
  } else if (!ap1 && ap2 === 'pm' && open + 12 * 60 < close) {
    // "2 to 6pm" — the afternoon was stated once and applies to both ends.
    open += 12 * 60;
  } else if (!ap1 && ap2 && close <= open) {
    // "11 to 2pm" — the opener is the morning.
    open = Number(h1) * 60 + Number(m1 || 0);
  }

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
// Numbers, money and durations
// ---------------------------------------------------------------------------

const WORD_NUMBERS = {
  zero: 0, none: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90,
  a: 1, an: 1, // "an hour's notice"
};

/**
 * Every plain number in a sentence, digits or words.
 *
 * Times are stripped out first. "Open Friday 11 to 2 and give me 3 days notice"
 * has one number in it that matters, and reading 11 and 2 as candidates for the
 * notice period is how an assistant does something nobody asked for.
 */
export function readNumbers(text) {
  const s = normalise(text).replace(RANGE_ALL, ' ');
  const out = [];
  for (const w of s.split(' ')) {
    if (/^\d{1,6}$/.test(w)) out.push(Number(w));
    else if (WORD_NUMBERS[w] !== undefined && w !== 'a' && w !== 'an') out.push(WORD_NUMBERS[w]);
  }
  return out;
}

/** "$85", "85 dollars", "eighty five" → cents. Null when no amount is named. */
export function readMoney(text) {
  const s = normalise(text);
  const m = /\$\s?(\d{1,6})(?:[.](\d{1,2}))?/.exec(s)
    || /\b(\d{1,6})(?:[.](\d{1,2}))?\s*(?:dollars?|bucks)\b/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || '0').padEnd(2, '0'));
}

/**
 * "45 minutes", "2 hours", "an hour and a half", "a day before" → minutes.
 *
 * Days and weeks are here because that is how people say the long ones: nobody
 * asks for a reminder "24 hours before", they ask for one "the day before", and
 * before this understood that, the sentence fell through to plain number
 * reading and set the reminder to one hour.
 */
export function readDuration(text) {
  const s = normalise(text);
  const count = (m) => Number(m) || WORD_NUMBERS[m] || 1;
  let total = 0;
  let found = false;
  // "The day before" is the commonest way anyone says 24 hours, so "the" counts
  // as one here — but only for days and weeks. Letting it count for hours makes
  // "change the hours on Sunday" measure sixty minutes.
  const weeks = /\b(\d{1,2}|an?|the|one|two|three|four)\s*(?:weeks?|wks?)\b/.exec(s);
  if (weeks) { total += 10080 * count(weeks[1]); found = true; }
  const days = /\b(\d{1,3}|an?|the|one|two|three|four|five|six|seven)\s*(?:days?)\b/.exec(s);
  if (days) { total += 1440 * count(days[1]); found = true; }
  const hrs = /\b(\d{1,3}|an?|one|two|three|four)\s*(?:hours?|hrs?|h)\b/.exec(s);
  if (hrs) {
    total += 60 * count(hrs[1]);
    found = true;
    if (/\band a half\b/.test(s)) total += 30;
  }
  const mins = /\b(\d{1,3})\s*(?:minutes?|mins?|m)\b/.exec(s);
  if (mins) { total += Number(mins[1]); found = true; }
  return found && total > 0 ? total : null;
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
