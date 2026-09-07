// Where Kai can take you, and what day it puts you on when it gets there.
//
// The owner's words: "a business owner wanting to see their calendar in two
// days, their booking schedule in three days, whatever it is — Kai points to
// that, Kai shows in that day." Kai could already CHANGE things by asking; it
// could not GO anywhere by asking, which is most of what anybody does in a
// working day.
//
// This is deliberately not the same thing as the search half. Search offers
// rows you can press; this is a destination Kai takes you to on Enter, on the
// day you named, and says where it put you — "Here's Friday 18 September" —
// because an assistant that moves the screen without saying so is unnerving.
//
// Three rules keep it out of the way of everything else:
//
//   1. IT NEEDS A REASON TO FIRE. Either a pointing word — show, open, go to,
//      take me to, where, bring up — or a sentence that is nothing but the name
//      of a place. "What did we take last week" is a question with an answer,
//      not a request to be shown the dashboard.
//   2. A CHANGE ALWAYS WINS. The caller reads changes first. "Close on Mondays"
//      is not a request to visit the hours screen.
//   3. IT NEVER CHANGES ANYTHING. Every destination here is a hash and a query
//      string. Nothing in this file writes.
import { db, getSetting } from './db.js';
import {
  normalise, tokenise, readDate, dateLabel, readWeekdays, DAY_NAMES,
} from './kai-language.js';

/**
 * The words that make a sentence a request to be taken somewhere.
 *
 * "Where do I change my logo" is a navigation request that happens to start
 * like a question, so this is checked independently of the question guard in
 * kai-actions.js rather than after it.
 */
const POINTING = new RegExp([
  // Plain pointers.
  /\b(show|see|view|open|opens|goto|bring|brings|pull|pulls|jump|jumps|navigate|display)\b/.source,
  // "Go to", but not "go ahead" or "days to go".
  /\bgo\s+(?:to|back\s+to|into)\b/.source,
  // "Take me to" only. Bare "take" is takings — "what did we take last week" is
  // a question with an answer, and jumping to a screen instead of answering it
  // is the single most annoying thing an assistant can do.
  /\btakes?\s+(?:me|us)\b/.source,
  /\bwhere(?:abouts)?\s+(?:is|are|do|can|would|the|my)\b/.source,
  /\bhow\s+do\s+i\s+(?:get|find|change|edit|set)\b/.source,
  /\blet me see\b/.source,
  /\bwhats on\b/.source,
].join('|'));

/**
 * A sentence that wants an answer rather than a screen.
 *
 * "Who owes me" is covered word-for-word by the billing vocabulary, and the
 * search half answers it with the actual list of who owes what. Jumping to the
 * Billing screen instead would be a strictly worse reply to a better question.
 */
const QUESTION = /^(what|whats|who|whos|how|when|which|why|is|are|do|does|did|has|have|any)\b/;

/**
 * A yes-or-no question, which a day never answers.
 *
 * "Can people book on a Sunday" names one weekday and mentions booking, so it
 * looked exactly like "show me Sunday" to the day-led rule. It is not: it wants
 * to know whether Sunday is open, and the search half answers that. "What's on
 * tomorrow" is a wh-question and genuinely does want the day shown, which is
 * why this is narrower than QUESTION rather than the same list.
 */
const YES_NO = /^(can|could|do|does|did|is|are|was|were|will|would|should|have|has|am|may|might)\b/;

/**
 * Words that carry no destination on their own.
 *
 * Alias lists are written the way people speak — "sign in", "two factor", "my
 * day" — and scoring on every word in them let "in" and "two" from the account
 * card outscore the word "calendar" for "show me my calendar in two days".
 */
const NAV_STOP = new Set([
  'a', 'an', 'the', 'my', 'me', 'mine', 'our', 'ours', 'your', 'i', 'we', 'us',
  'in', 'on', 'at', 'to', 'of', 'for', 'and', 'or', 'is', 'are', 'it', 'this',
  'that', 'up', 'out', 'do', 'does', 'did', 'go', 'get', 'got', 'can', 'please',
  'kai', 'hey', 'show', 'see', 'view', 'open', 'take', 'bring', 'pull', 'jump',
  'where', 'what', 'whats', 'how', 'want', 'need', 'two', 'one', 'new',
]);

/**
 * Surfaces you LOOK at, as opposed to hours you trade.
 *
 * "Open my calendar on Saturday" and "open on Saturday" differ by one word and
 * mean opposite things — one is a screen to show, the other is a trading day to
 * start. kai-actions.js suppresses its hours reading when one of these appears,
 * because "calendar" never turns up in a genuine request to open a Saturday and
 * changing what a salon trades on when somebody wanted to look at a day is far
 * worse than the reverse.
 */
export const VIEWING = /\b(calendar|diary|schedule|agenda|dashboard|screen|page|tab|view|list)\b/;

/**
 * Everywhere Kai can go.
 *
 * `words` are what an owner would actually say, not what the tab is called.
 * `dated` marks the destinations where naming a day changes where you land.
 */
const PLACES = [
  {
    id: 'calendar',
    title: 'Calendar',
    href: '#/calendar',
    dated: true,
    words: 'calendar diary schedule agenda appointment appointments booking bookings book day week roster',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    href: '#/dashboard',
    words: 'dashboard home overview front page main screen summary',
  },
  { id: 'clients', title: 'Clients', href: '#/clients', words: 'clients customers people contacts client list database' },
  { id: 'services', title: 'Services', href: '#/services', words: 'services treatments menu price list service list' },
  { id: 'products', title: 'Products', href: '#/products', words: 'products retail stock inventory shop' },
  { id: 'invoices', title: 'Billing', href: '#/invoices', words: 'billing invoices bills payments receipts owed unpaid owing accounts' },
  { id: 'messages', title: 'Messages', href: '#/messages', words: 'messages sent outbox message log texts emails sent items' },
  { id: 'reviews', title: 'Reviews', href: '#/reviews', words: 'reviews ratings feedback stars testimonials' },
  { id: 'growth', title: 'Growth', href: '#/growth', words: 'growth referrals referral marketing new clients word of mouth' },
  { id: 'staff', title: 'Team', href: '#/staff', words: 'team staff stylists barbers therapists employees roster rota' },
  { id: 'pos', title: 'Point of Sale', href: '#/pos', words: 'pos point of sale till checkout counter sell register' },
  { id: 'account', title: 'Your account', href: '#/account', words: 'account password security sign in login my login two factor' },
];

/**
 * The settings screen, section by section.
 *
 * Every card an owner can change is reachable by the words they would use for
 * it — "where do I change my logo" lands on Booking page appearance, not on the
 * top of a screen with sixteen cards on it. Cloudflare is deliberately absent:
 * it is a security layer the owner did not ask for and showing it to them only
 * raises a question they cannot answer.
 */
const SECTIONS = [
  { id: 'profile', title: 'Business profile', words: 'business profile name phone number email address details my business contact' },
  { id: 'hours', title: 'Hours & booking', words: 'hours opening closing times trading slots notice horizon cancellation window' },
  { id: 'brand', title: 'Booking page appearance', words: 'booking page appearance brand branding logo colour color colours theme font cover photo gallery tagline look' },
  { id: 'billing', title: 'Billing defaults', words: 'billing defaults invoice tax gst prefix due days footer' },
  { id: 'notif', title: 'Notifications', words: 'notifications confirmations reminders receipts review requests emails what gets sent' },
  { id: 'sms', title: 'SMS', words: 'sms text messages texting clicksend sender number credit balance twilio telnyx' },
  { id: 'poscard', title: 'In-person card payments', words: 'card payments in person terminal square eftpos surcharge tap' },
  { id: 'payments', title: 'Online deposits', words: 'stripe deposits online payments card online prepay' },
  { id: 'waitlist', title: 'Waitlist', words: 'waitlist wait list gap filling automatic filling cancellations fill' },
  { id: 'noshow', title: 'No-shows', words: 'no shows noshows missed appointments blocking deposit rules' },
  { id: 'safety', title: 'Patch tests & consent', words: 'patch test tests consent allergy contraindication safety ppd colour test' },
  { id: 'marketing', title: 'Marketing automations', words: 'marketing automations campaigns offers win back birthday' },
  { id: 'backup', title: 'Backups', words: 'backup backups restore export database copy' },
  { id: 'locations', title: 'Locations', words: 'locations location sites salons shops branches rooms' },
];

/**
 * The meaningful words of an alias list or a sentence, singular and plural.
 *
 * Both forms of every word go in, on both sides, so an alias list written as
 * "notifications" is still found by somebody who typed "notification". Writing
 * every alias twice by hand is the kind of thing that is right on the day and
 * wrong six months later.
 */
const words = (s) => {
  const out = new Set();
  for (const w of normalise(s).split(' ')) {
    if (!w || NAV_STOP.has(w)) continue;
    out.add(w);
    if (w.length > 3) out.add(w.endsWith('s') ? w.slice(0, -1) : `${w}s`);
  }
  return out;
};

/**
 * How well a sentence points at one destination.
 *
 * A word from the destination's own NAME counts for more than one from its
 * alias list: "logo" is a good clue for Booking page appearance, but "booking"
 * is the word in its title and ought to win a tie against a page that merely
 * lists it as an alias.
 */
function scoreFor(said, aliasSet, title) {
  const titleWords = words(title);
  let hits = 0;
  for (const k of said) {
    if (aliasSet.has(k)) hits += titleWords.has(k) ? 3 : 2;
  }
  return hits;
}

/**
 * Every destination a sentence points at, best first.
 *
 * The search half draws these as rows to press; `readNav` takes the top one
 * when the sentence is actually asking to be taken there. One catalogue serves
 * both, so a section that Kai can navigate to is also a section you can find by
 * typing a word from it — "logo" offers Booking page appearance either way.
 */
export function matchPlaces(text) {
  const raw = normalise(text);
  if (!raw) return [];
  const said = words(raw);
  const out = [];

  for (const p of PLACES) {
    const hits = scoreFor(said, words(p.words), p.title);
    if (hits) out.push({ ...p, hits, kind: 'place' });
  }

  // "Settings" on its own goes to the top of the screen; a section named inside
  // it beats that, so an owner who says "sms settings" lands on the SMS card.
  const saidSettings = /\b(settings?|preferences|options|setup|configure|config)\b/.test(raw);
  for (const s of SECTIONS) {
    const hits = scoreFor(said, words(s.words), s.title);
    if (!hits) continue;
    out.push({
      id: `settings-${s.id}`,
      title: `Settings → ${s.title}`,
      href: `#/settings?open=${s.id}`,
      // No bonus for being a section: a tie between a page and a card that
      // share a word goes to the page, because "go to billing" means the
      // Billing screen and not the two invoice defaults on the settings page.
      hits: hits + (saidSettings ? 2 : 0),
      kind: 'section',
      section: s.id,
      words: s.words,
    });
  }
  if (saidSettings) {
    out.push({
      id: 'settings',
      title: 'Settings',
      href: '#/settings',
      hits: 2,
      kind: 'place',
      words: 'settings preferences options setup configure config',
    });
  }

  return out.sort((a, b) => b.hits - a.hits);
}

/**
 * Somewhere to go, or nothing.
 *
 * Returns a plan-shaped object so the caller can treat it like any other thing
 * Kai does: a title, a sentence to say, and — instead of settings to write — an
 * href to move the screen to.
 */
export function readNav(text, { today }) {
  const raw = normalise(text);
  if (!raw) return null;
  const said = words(raw);
  // The sentence as it was SAID, not as normalise leaves it. "Who owes me" is
  // folded to the single word "owing" on its way through, and a question that
  // no longer starts with a question word stops looking like one exactly when
  // it matters most. "What's on" is folded to "diary" the same way, which is
  // why POINTING is tested against both forms.
  const plain = String(text || '').trim().toLowerCase().replace(/[^\w\s]/g, '');
  const pointing = POINTING.test(raw) || POINTING.test(plain);
  const asking = QUESTION.test(plain);
  const date = readDate(text, today);

  const candidates = matchPlaces(text);
  let best = candidates[0] || null;

  // Pointed at a day but not at a screen — "show me next Friday", "what's on in
  // three days". The diary is the only place a day means anything, and this is
  // the commonest thing an owner will ever ask for hands-free.
  // Carries its own score: it was chosen by the date, not by a word, and a
  // destination with no hits is refused further down.
  if (!best && date && pointing) best = { ...PLACES.find((p) => p.id === 'calendar'), hits: 3 };
  if (!best) return null;

  // A sentence needs a reason to move the screen. Any one of three:
  //
  //   POINTING — "show me", "take me to", "where is". Explicit, and it wins
  //     even over a question opener, because "where do I change my logo" is a
  //     request for a screen however it is punctuated.
  //   BARE — the sentence is nothing BUT the name of a place, every meaningful
  //     word of it accounted for by that place's own vocabulary. "Calendar".
  //     "My clients". Not a question, though: "who owes me" is covered by the
  //     billing vocabulary and is still a question with a real answer, and an
  //     assistant that navigates away from your answer is worse than one that
  //     cannot navigate at all.
  //   A DAY, on somewhere a day means something. "My booking schedule in three
  //     days" needs no pointing word to be obvious.
  const vocab = best.words ? words(best.words) : new Set();
  const bare = said.size > 0 && [...said].every((w) => vocab.has(w)) && !asking;
  // A question is never day-led. "When are we open on Saturday" names one day
  // and wants its hours, not its diary; "what's on tomorrow" wants the diary
  // and earns it through POINTING instead.
  const dayLed = Boolean(date) && Boolean(best.dated) && namesOneDay(text, raw)
    && !asking && !YES_NO.test(plain);
  if (!pointing && !bare && !dayLed) return null;
  if (!best.hits && !dayLed) return null;

  const href = best.dated && date ? `${best.href}?date=${date}` : best.href;
  const when = best.dated && date ? dateLabel(date, today) : '';

  return {
    id: `nav_${best.id}`,
    kind: 'nav',
    title: when ? `${best.title} — ${when}` : best.title,
    said: sayWhere(best, when, today, date),
    detail: when ? '' : 'Press Enter and Kai will take you there.',
    href,
    date: best.dated && date ? date : null,
    changes: [],
    warnings: [],
    score: 70 + Math.min(20, best.hits * 2) + (when ? 6 : 0),
  };
}

/**
 * Does this sentence name ONE day, or a stretch of time?
 *
 * The difference decides whether a date is somewhere to go. "What did we take
 * last week" resolves to a Monday, and jumping to that Monday's diary answers a
 * question nobody asked; "what's on tomorrow" resolves to a day, and showing it
 * is the whole point.
 *
 * A question opener cannot be the test. "What's on" is folded to the single
 * word "diary" on its way through normalise, so by the time anything here sees
 * it, the question has stopped looking like one.
 */
function namesOneDay(text, raw) {
  if (/\b(today|tonight|tomorrow|tmrw|yesterday)\b/.test(raw)) return true;
  if (readWeekdays(text).length === 1) return true;
  if (/\bin\s+(\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s*(days?|weeks?|fortnights?|months?)\b/.test(raw)) return true;
  if (/\b\d{1,2}(st|nd|rd|th)\b/.test(raw)) return true;
  if (/\b\d{1,2}\/\d{1,2}\b/.test(raw)) return true;
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(raw)) return true;
  return false;
}

/**
 * What Kai says when it moves the screen.
 *
 * It names the day it landed on rather than repeating the words it was given,
 * because "in two days" is only checkable once it has been turned into a date —
 * and turning words into dates is exactly where this can be wrong.
 */
function sayWhere(place, when, today, date) {
  if (!when) return `Here's ${place.title.replace(/^Settings → /, '')}.`;
  if (when === 'today') return "Here's today.";
  if (when === 'tomorrow') return "Here's tomorrow.";
  if (when === 'yesterday') return "Here's yesterday.";
  const busy = date ? bookedCount(date) : null;
  const tail = busy === null ? ''
    : busy === 0 ? ' — nothing booked yet.'
      : busy === 1 ? ' — one appointment.'
        : ` — ${busy} appointments.`;
  return `Here's ${when}${tail}`;
}

/** How full a day is, so Kai can say something worth hearing when it lands. */
function bookedCount(date) {
  try {
    return db.prepare(
      `SELECT COUNT(*) AS n FROM appointments
        WHERE date = ? AND status NOT IN ('cancelled', 'no_show')`
    ).get(date).n;
  } catch {
    return null;
  }
}

/**
 * Is the salon even open that day? Used to add a word of warning when Kai takes
 * somebody to a day they do not trade — landing on an empty grid with no
 * explanation looks like the software lost the diary.
 */
export function closedOn(date) {
  const open = String(getSetting('open_days', '0,1,2,3,4,5,6'))
    .split(',').map((d) => Number(d.trim()));
  const dow = new Date(`${date}T12:00:00`).getDay();
  return open.includes(dow) ? null : `You're closed on ${DAY_NAMES[dow]}s.`;
}

/** Every day named in a sentence, for callers that want the weekday not the date. */
export const navWeekdays = readWeekdays;
