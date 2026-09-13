// How Kai talks.
//
// The owner asked for personality — "you press enter and it goes like 'no
// worries' and then starts doing the thing". That is a real request and a real
// risk at the same time, so this module exists to keep the two apart:
//
//   THE OPENER IS FLAVOUR. "No worries —", "Righto,", "On it.". It varies, it
//   is warm, and it carries no information at all.
//   THE SENTENCE AFTER IT IS THE FACT, VERBATIM. "Sunday is 2pm–6pm now." That
//   string comes from the plan that actually ran and is never rewritten here.
//
// Keeping them separate is what makes it safe to have a personality. The whole
// safety model rests on an owner being able to check, at a glance, that what
// Kai says it did is what they asked for. A charming assistant that paraphrases
// is a liability; a charming assistant that reads the receipt out is an
// assistant.
//
// Three more rules, learned the hard way from every chatbot anybody has ever
// had to use:
//
//   1. NEVER CHIRPY ABOUT A FAILURE. "No worries! I couldn't work out what to
//      change" is infuriating. Openers are for things that worked.
//   2. NEVER CHIRPY WHEN ASKING. If Kai has to ask which of two readings was
//      meant, the question is the whole message.
//   3. IT VARIES, BUT NOT RANDOMLY. The opener is picked from a rotation keyed
//      to a counter the caller passes in, so the same conversation never says
//      "no worries" twice in a row, and a test can pin it exactly.

/** Warm, short, and Australian, because the two salons using this are. */
const DID = [
  'No worries —',
  'Done —',
  'Righto —',
  'All good —',
  'Easy —',
  'Sorted —',
  'Too easy —',
  'Yep, done —',
  'That\u2019s sorted —',
  'Onto it — done.',
];

/** Said the moment Enter lands, before the work is finished. */
const ON_IT = [
  'On it…',
  'No worries, one sec…',
  'Righto, doing that now…',
  'Got it, one moment…',
  'Yep — hang on…',
  'Easy, give me a second…',
];

/**
 * Advice, not a change.
 *
 * A pathway did not DO anything, so none of the DID openers are honest in
 * front of it — "Done — 9 of 19 done" reads as though something just happened.
 * These say the opposite: here is where I would start.
 */
const ADVICE = [
  'Right —',
  'Here\u2019s where I\u2019d start —',
  'Okay —',
  'Have a look at this —',
];

/**
 * Navigation: brisk, because the screen has already moved.
 *
 * None of these say "here", because the fact almost always starts with it —
 * "Here's Wednesday 9 September" — and "Here you go — Here's Wednesday" is a
 * stutter nobody would write on purpose.
 */
const WENT = [
  '',
  'Righto —',
  'Sure —',
];

/**
 * Nothing to do. Friendly, but it must not sound like something happened.
 *
 * None of these say "already": the fact they sit in front of almost always does
 * — "You're already closed on Monday" — and "Already sorted — you're already
 * closed" is the kind of sentence that makes software feel unread.
 */
const ALREADY = [
  'Nothing to change there —',
  'No change needed —',
  '',
];

const pick = (list, n) => list[Math.abs(Number(n) || 0) % list.length];

/**
 * Dress a result in a voice, without touching what it says.
 *
 * `said` goes through untouched. Only a prefix is added, and only for the kinds
 * where a prefix is honest.
 */
export function speak(kind, said, turn = 0) {
  const fact = String(said || '').trim();
  if (!fact) return fact;
  switch (kind) {
    case 'done': return join(pick(DID, turn), fact);
    case 'went': return join(pick(WENT, turn), fact);
    case 'already': return join(pick(ALREADY, turn), fact);
    // Advice. Warm, but it must never sound like a change was made.
    case 'pathway': return join(pick(ADVICE, turn), fact);
    // An undo announces itself — "Undone — Sunday is back to 11am–4pm" — so an
    // opener in front of it reads as a stutter: "Taken back — Undone — …".
    case 'undone': return fact;
    // 'ambiguous', 'unknown', 'nothing' and anything else: the plain sentence.
    // A question and a refusal are not occasions for a greeting.
    default: return fact;
  }
}

/** What Kai says the instant Enter lands, before it knows what it will do. */
export function acknowledge(turn = 0) {
  return pick(ON_IT, turn);
}

/**
 * Glue an opener to a fact, leaving the fact alone.
 *
 * Not even its capital letter. The first draft lowercased it so the join read
 * as one sentence, and turned "Saturday is 10am–3pm now" into "saturday is
 * 10am–3pm now" — a proper noun eaten by a cosmetic rule.
 *
 * Which gives the invariant this module is really for: `warm` always ENDS WITH
 * `said`, character for character. Whatever personality is added, the receipt
 * underneath it is untouched and an owner can check it word for word.
 */
function join(opener, fact) {
  return opener ? `${opener} ${fact}` : fact;
}

/**
 * The one-line summary Kai reads out loud.
 *
 * The words are the fact, unchanged. What changes is the PUNCTUATION, because
 * text written to be read and text written to be heard are not the same string:
 *
 *   "Sunday is 2pm–6pm now"  read aloud by a browser becomes
 *   "Sunday is 2 p m en dash 6 p m now"
 *
 * An en dash between two times is the word "to". A middle dot between a name
 * and a service is a comma. An em dash is a pause. A bare "$85.00" is "85
 * dollars", not "dollar eighty five point zero zero". None of this rewrites
 * what Kai did — every substitution below is punctuation or a currency symbol,
 * and the test asserts that the words survive intact.
 *
 * This is not cosmetic. The hands-free loop is only usable if the answer is
 * intelligible the first time; a salon that has to lean in and re-listen would
 * rather have typed it.
 */
export function forSpeech(said) {
  let t = String(said || '').trim();
  if (!t) return t;
  return t
    // A range between two clock times is "to". Only an en or em dash, never a
    // plain hyphen: "2026-08-29" is a date, and "2026 to 08 to 29" is how a
    // careless version of this rule reads a patch-test record out loud.
    .replace(/(\d(?::\d\d)?\s*(?:am|pm)?)\s*[–—]\s*(\d)/gi, '$1 to $2')
    // Money, said the way a person says it.
    .replace(/\$(\d[\d,]*)\.00\b/g, '$1 dollars')
    .replace(/\$(\d[\d,]*)\.(\d\d)\b/g, (_m, d, c) => `${d} dollars and ${Number(c)} cents`)
    .replace(/\$(\d[\d,]*)/g, '$1 dollars')
    // Percent reads fine as a word and badly as a symbol after a number.
    .replace(/(\d)\s*%/g, '$1 percent')
    // The separators Kairo uses to stack facts on one line. Spoken, they are
    // pauses — a middle dot is not a word in any language a browser knows.
    .replace(/\s+·\s+/g, ', ')
    .replace(/\s+[–—]\s+/g, ', ')
    // Times read better with a space: "2pm" is fine, "2:30pm" is fine, but
    // "10am–3pm" has already become "10am to 3pm" above.
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * What Kai says out loud the moment a SPOKEN sentence lands.
 *
 * The owner's original brief, almost word for word: "you press enter and it
 * goes like 'no worries' and then starts doing the thing." That is worth having
 * and it is safe to have, because it is said BEFORE the work and separately
 * from the result — it is not glued to the front of the receipt, where it would
 * be standing between an owner and the thing they need to check.
 *
 * Only for spoken input. Typed at a keyboard, an assistant that talks back
 * unprompted is a nuisance.
 */
export function spokenOpener(turn = 0) {
  return pick(ON_IT, turn);
}
