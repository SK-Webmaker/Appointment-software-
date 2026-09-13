// "How do I get more clients?"
//
// The other Kai modules answer a sentence that names its own answer — a
// setting, a screen, a booking. This one answers a sentence that does NOT:
// "how do I grow", "what should I do next", "give me something to post".
// The owner does not know what they want changed. They want a plan.
//
// So it hands back a PATHWAY rather than a change: the next few things worth
// doing, in order, each one a place to go and do it. The work of deciding what
// those are already exists in growth-plan.js and growth-content.js — this file
// is only the ear for the question and the shape of the answer.
//
// Two rules, both inherited from the rest of the assistant:
//
//   IT CHANGES NOTHING. A pathway is a list of suggestions with links on them.
//   Nothing here writes a setting, so there is nothing here to undo. Switching
//   one on is a separate, deliberate press on the screen it sends you to.
//
//   IT ANSWERS FROM THE BUSINESS. "Post more on Instagram" is a horoscope.
//   "Wednesday runs 43% quieter than Friday — here is a post about it" is an
//   answer, and it is one only because the number underneath it is real.
import { growthPlan } from './growth-plan.js';
import { contentIdeas } from './growth-content.js';
import { normalise } from './kai-language.js';

/**
 * Asking how to grow.
 *
 * Deliberately narrow. "More clients" and "grow" are the two phrasings almost
 * everybody reaches for; the rest are the ways an owner asks for the next job
 * rather than a specific one. A sentence that names a setting is not this, and
 * is caught earlier anyway — this runs last of the readers.
 */
const ASKING_HOW = new RegExp([
  /\b(more|new) (clients|customers|bookings|business)\b/.source,
  /\bgrow(ing)? (my |the )?(business|salon|shop|books|clients)?\b/.source,
  /\bhow (do|can) i (get|grow|improve|increase|fill)\b/.source,
  /\b(what|whats) (should|shall|can) i do\b/.source,
  /\bwhat(s| is) next\b/.source,
  /\bgrowth plan\b/.source,
  /\b(quiet|slow) (week|month|period|lately|at the moment)\b/.source,
  /\bbusiness is (quiet|slow|dead)\b/.source,
].join('|'));

/** Asking for something to say, rather than something to do. */
const ASKING_CONTENT = new RegExp([
  /\bwhat (should|do) i post\b/.source,
  /\b(give|write|make) me (a |some )?(post|posts|caption|captions|content)\b/.source,
  /\b(post|content|marketing) (idea|ideas)\b/.source,
  /\bsomething to post\b/.source,
  /\b(instagram|facebook|social)\b.*\b(post|idea|content)\b/.source,
  /\bmarketing\b/.source,
].join('|'));

/** Where the answer lives, so "open it" is one press rather than a hunt. */
const GROWTH = '#/growth';

/**
 * Read a growth question.
 *
 * Returns plan-shaped objects like every other Kai reader, so the caller treats
 * them the same way — except that `changes` is always empty, because a pathway
 * is a list of things to consider rather than a thing that happened.
 */
export function readGrowth(text) {
  const raw = normalise(text);
  if (!raw) return null;

  const wantsContent = ASKING_CONTENT.test(raw);
  const wantsPlan = ASKING_HOW.test(raw);
  if (!wantsContent && !wantsPlan) return null;

  // Asked for both — "what should I do about marketing" — the plan comes first,
  // because posting into a business with no referral offer and no review link
  // is pouring water into a bucket with holes in it.
  if (wantsPlan || !wantsContent) return planAnswer();
  return contentAnswer();
}

function planAnswer() {
  let plan;
  try {
    plan = growthPlan();
  } catch {
    return null;
  }
  const next = plan.next || [];

  if (!next.length) {
    return {
      kind: 'pathway',
      said: `You've done all ${plan.total} steps of the growth plan. The two that quietly stop `
        + 'happening are rebooking people at the counter and answering reviews — keep those going.',
      title: 'Growth plan complete',
      href: GROWTH,
      steps: [],
    };
  }

  const first = next[0];
  return {
    kind: 'pathway',
    // Short on purpose. The steps below carry the detail; a sentence that
    // repeats the first one word for word makes the list under it look like an
    // echo, and it has to survive being read out loud in a noisy salon.
    said: `${plan.done} of ${plan.total} done. Next up: ${first.title}.`,
    title: `Your next ${next.length === 1 ? 'step' : `${next.length} steps`}`,
    href: GROWTH,
    steps: next.map((s) => ({
      title: s.title,
      detail: s.why,
      how: s.how || '',
      href: s.goto || GROWTH,
      manual: !!s.manual,
    })),
  };
}

function contentAnswer() {
  let ideas;
  try {
    ideas = contentIdeas();
  } catch {
    return null;
  }
  const top = ideas.slice(0, 3);
  if (!top.length) return null;

  return {
    kind: 'pathway',
    // The count, then the strongest idea by name. An earlier draft read the
    // whole reason out here as well, which the first step then repeated word
    // for word directly underneath it.
    said: `${top.length} ideas from your own numbers. Start with: ${top[0].title}.`,
    title: 'What to post',
    href: GROWTH,
    steps: top.map((i) => ({
      title: i.title,
      detail: i.reason,
      how: i.caption ? `Caption: ${i.caption.split('\n')[0]}…` : (i.doing || ''),
      href: i.goto || GROWTH,
      manual: false,
    })),
  };
}
