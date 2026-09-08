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
];

/** Said the moment Enter lands, before the work is finished. */
const ON_IT = [
  'On it…',
  'Right, one sec…',
  'Doing that now…',
  'Got it, one moment…',
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
 * Speech gets the fact and nothing else. An opener is a visual courtesy; heard
 * out loud on every single change it becomes a tic, and a salon listening for
 * "Sunday is 2pm–6pm now" should not have to sit through "no worries" first.
 */
export function forSpeech(said) {
  return String(said || '').trim();
}
