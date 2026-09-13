// How a service business actually grows, as a checklist that checks itself.
//
// Every booking system has a "marketing" tab that is a blank page and a Send
// button. The owner opens it once, has no idea what to write, and never opens
// it again. The missing thing is not a broadcast tool — it is knowing WHAT TO
// DO NEXT, in an order that pays off, with somebody else keeping score.
//
// So this is a plan rather than a feature list. Five stages, in the order the
// money arrives:
//
//   1. GET FOUND        — nobody books a business they cannot find.
//   2. BOOKING IS EASY  — every extra step loses people who already wanted you.
//   3. THEY COME BACK   — a returning client costs nothing to acquire. This is
//                         where almost all the profit in a service business is.
//   4. THEY BRING PEOPLE— your own clients are better at referrals than any
//                         marketplace, and they do not take a commission.
//   5. PROVE IT         — reviews are what turn a stranger into step 1.
//
// Three rules hold it together:
//
//   IT CHECKS ITSELF. A step is done because the database says so — the
//   setting is on, the link is saved, the offer has a value — not because
//   somebody ticked a box to feel good. The handful that genuinely happen
//   outside Kairo (claiming a Google listing, handing a card over the counter)
//   are marked as such and tick manually, and they say they are manual.
//
//   IT IS GENERIC ON PURPOSE. Nothing here mentions hair. A physio, a mobile
//   detailer, a dog groomer and a tattooist grow the same way, and a plan that
//   only fits one trade is a plan Kairo cannot ship to the next customer.
//
//   THREE AT A TIME. Sixteen steps shown at once is a wall somebody bounces
//   off. The page asks for the next three and nothing else, because three is a
//   week's work and a wall is a month of avoidance.
import { db, getSetting, setSetting } from './db.js';

/** The manual ticks, kept as one setting rather than a table for four booleans. */
export function manualTicks() {
  try {
    const raw = JSON.parse(getSetting('growth_ticks', '{}'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function setManualTick(id, on) {
  const ticks = manualTicks();
  if (on) ticks[id] = new Date().toISOString().slice(0, 10);
  else delete ticks[id];
  setSetting('growth_ticks', JSON.stringify(ticks));
  return ticks;
}

const on = (key, dflt = '0') => getSetting(key, dflt) === '1';
const has = (key) => String(getSetting(key, '') || '').trim().length > 0;

function count(sql, ...args) {
  try {
    return Number(db.prepare(sql).get(...args)?.n || 0);
  } catch {
    return 0;
  }
}

function automationOn(kind) {
  return count("SELECT COUNT(*) AS n FROM automations WHERE kind = ? AND enabled = 1", kind) > 0;
}

export const STAGES = [
  {
    id: 'found',
    title: 'Get found',
    why: 'Nobody books a business they cannot find. This stage is a handful of '
      + 'one-off jobs that keep working forever afterwards.',
  },
  {
    id: 'easy',
    title: 'Make booking effortless',
    why: 'Most people who do not book wanted to. They hit a step they could not '
      + 'be bothered with — a phone call, a price they could not see, a form '
      + 'that asked too much.',
  },
  {
    id: 'back',
    title: 'Get them back',
    why: 'A client who returns costs nothing to win. This is where nearly all '
      + 'the profit in a service business lives, and it is the stage most '
      + 'owners skip in favour of chasing strangers.',
  },
  {
    id: 'bring',
    title: 'Get them bringing people',
    why: 'Your own clients are better at recommending you than any listing site '
      + '— they are trusted by the person they are talking to, and they do not '
      + 'charge you a commission.',
  },
  {
    id: 'prove',
    title: 'Prove it in public',
    why: 'Reviews are what turn a stranger into stage one. They are also the '
      + 'one thing you cannot buy and cannot fake for long.',
  },
];

/**
 * The steps.
 *
 * `done` is a function of the business, never of a tick, unless `manual` says
 * the work genuinely happens somewhere Kairo cannot see.
 */
const STEPS = [
  // ---- 1. Get found -------------------------------------------------------
  {
    id: 'link-live', stage: 'found', title: 'Your booking link is live and public',
    why: 'Everything else in this plan points at this link. Until it works, none of it does.',
    how: 'Settings → your booking page address. Put it in your Instagram bio, your '
      + 'Google listing, your email signature and your shop window.',
    done: () => has('public_url') && on('booking_enabled', '1'),
    goto: '#/settings',
  },
  {
    id: 'google-profile', stage: 'found', title: 'Claim your Google Business Profile',
    why: 'It is free, it is the single biggest source of new clients for a local '
      + 'service business, and most owners never claim it.',
    how: 'Search your own business name on Google. If a panel appears with "Own this '
      + 'business?", claim it. Verification is a postcard or a phone call.',
    manual: 'This happens on Google, not in Kairo.',
  },
  {
    id: 'google-booking-field', stage: 'found', title: 'Put your booking link in Google\'s "Appointments" field',
    why: 'Not the website field — the appointments one. It puts a Book button directly '
      + 'on your listing, so people book without ever reaching your site.',
    how: 'Google Business Profile → Edit profile → Booking link.',
    manual: 'This happens on Google, not in Kairo.',
  },
  {
    id: 'ask-heard', stage: 'found', title: 'Ask new clients how they found you',
    why: 'One optional question on the booking form. Without it you are guessing which '
      + 'half of your effort works, and guessing is how marketing budgets disappear.',
    how: 'The switch is on this page, under "How they say they found you".',
    done: () => on('ask_heard_from'),
  },

  // ---- 2. Make booking effortless ----------------------------------------
  {
    id: 'services-priced', stage: 'easy', title: 'Every service has a price and a length',
    why: 'A price somebody has to ring up and ask for is a price they assume they cannot '
      + 'afford. "From $X" is fine — a blank is not.',
    how: 'Services → check each one has a duration and a price, or a "from" price.',
    done: () => count("SELECT COUNT(*) AS n FROM services WHERE active = 1 AND price_type != 'free' AND price_cents <= 0") === 0
      && count('SELECT COUNT(*) AS n FROM services WHERE active = 1') > 0,
    goto: '#/services',
  },
  {
    id: 'branded', stage: 'easy', title: 'Your booking page looks like your business',
    why: 'A page that looks like software makes people check whether they are in the '
      + 'right place. A logo and a cover photo answer that in a second.',
    how: 'Settings → Brand. A logo, a cover image and your colour.',
    done: () => has('brand_logo') && has('brand_cover'),
    goto: '#/settings',
  },
  {
    id: 'clients-can-cancel', stage: 'easy', title: 'Let clients cancel and rebook themselves',
    why: 'Counter-intuitive and worth more than it costs. A cancel button that is hard to '
      + 'find does not stop the cancellation — it turns it into a no-show, which loses '
      + 'the slot AND the chance to sell it.',
    how: 'Settings → Booking rules → let clients cancel online.',
    done: () => on('client_cancel_enabled'),
    goto: '#/settings',
  },
  {
    id: 'confirmations', stage: 'easy', title: 'Confirmations go out automatically',
    why: 'A booking with no confirmation feels like a booking that did not happen, and '
      + 'the client rings to check — which costs you the phone call you were avoiding.',
    how: 'Settings → Notifications.',
    done: () => on('confirm_enabled', '1'),
    goto: '#/settings',
  },

  // ---- 3. Get them back ---------------------------------------------------
  {
    id: 'reminders', stage: 'back', title: 'Reminders before every appointment',
    why: 'The cheapest money in this entire plan. A reminder costs cents and a no-show '
      + 'costs the whole slot.',
    how: 'Settings → Notifications → reminders, and how many hours before.',
    done: () => on('reminders_enabled', '1'),
    goto: '#/settings',
  },
  {
    id: 'due-back', stage: 'back', title: 'Nudge clients when they are due back',
    why: 'Most people do not rebook because nobody asked, not because they left. Kairo '
      + 'works out each client\'s own rhythm and messages them when they are due.',
    how: 'Messages → Automations → "Due back".',
    done: () => automationOn('due_back'),
    goto: '#/messages',
  },
  {
    id: 'winback', stage: 'back', title: 'Win back the ones who have drifted',
    why: 'Every business has a quiet list of people who simply stopped coming. They already '
      + 'liked you once. They are the cheapest bookings you will ever take.',
    how: 'Messages → Automations → "Lapsed win-back".',
    done: () => automationOn('lapsed_winback'),
    goto: '#/messages',
  },
  {
    id: 'rebook-at-counter', stage: 'back', title: 'Book the next one before they leave',
    why: 'The highest-converting moment in the whole business is the thirty seconds after '
      + 'you finish, while they are happy and standing in front of you. No message beats it.',
    how: 'Make it a habit: "same time in six weeks?" before they reach the door.',
    manual: 'This one is a habit, not a setting.',
  },
  {
    id: 'fill-gaps', stage: 'back', title: 'Fill cancellations automatically',
    why: 'A gap found at 9am is worth money; the same gap found at 4pm is worth nothing. '
      + 'Kairo offers it to the people most likely to take it.',
    how: 'Messages → Automations, and the gap offers on your dashboard.',
    done: () => on('waitlist_enabled') || on('waitlist_autofill'),
    goto: '#/messages',
  },

  // ---- 4. Get them bringing people ---------------------------------------
  {
    id: 'referral-offer', stage: 'bring', title: 'Put a referral offer up',
    why: 'A recommendation with nothing attached is a favour people forget to do. A '
      + 'small, specific reward turns it into something they act on that week.',
    how: 'On this page, under "Referrals". $10 each way works; so does a free add-on.',
    done: () => getSetting('referral_reward_type', 'none') !== 'none'
      && Number(getSetting('referral_reward_value', '0')) > 0,
  },
  {
    id: 'referral-friend', stage: 'bring', title: 'Give the friend a reason too',
    why: 'Often the half that matters. The client doing the referring mostly wants to have '
      + 'been helpful — the friend needs a reason to try somewhere new.',
    how: 'The second pair of fields under "Referrals".',
    done: () => getSetting('referral_friend_type', 'none') !== 'none'
      && Number(getSetting('referral_friend_value', '0')) > 0,
  },
  {
    id: 'referral-handed', stage: 'bring', title: 'Hand the link over at the counter',
    why: 'Every client has their own link on their record. It converts when you give it to '
      + 'somebody while they are still pleased with you, and almost never otherwise.',
    how: 'Open a client → copy their referral link → text it to them while they are there.',
    done: () => count('SELECT COUNT(*) AS n FROM appointments WHERE referrer_client_id IS NOT NULL') > 0,
  },

  // ---- 5. Prove it in public ---------------------------------------------
  {
    id: 'review-link', stage: 'prove', title: 'Save your Google review link',
    why: 'Without it, happy clients are thanked and then sent nowhere. This is the most '
      + 'common single gap in the whole plan.',
    how: 'Google Business Profile → "Ask for reviews" gives you a short link. Paste it into '
      + 'Settings → Notifications.',
    done: () => has('google_review_url'),
    goto: '#/settings',
  },
  {
    id: 'review-requests', stage: 'prove', title: 'Ask for a review after every visit',
    why: 'Reviews do not arrive on their own. Asked automatically, a few hours after the '
      + 'appointment, is the difference between four reviews a year and four a month.',
    how: 'Settings → Notifications → review requests.',
    done: () => on('review_requests_enabled'),
    goto: '#/settings',
  },
  {
    id: 'review-answer', stage: 'prove', title: 'Answer every review, especially the bad ones',
    why: 'A calm reply to a one-star is read by everyone who comes after it, and it is worth '
      + 'more to them than the review cost you.',
    how: 'Reply on Google. Never argue; thank, explain once, offer to fix it.',
    manual: 'This happens on Google, not in Kairo.',
  },
];

/**
 * The plan, as it stands for this business right now.
 *
 * `next` is the whole point of the screen: the first three undone steps, in
 * order. Everything else on the page is context for those three.
 */
export function growthPlan() {
  const ticks = manualTicks();
  const steps = STEPS.map((s) => {
    const auto = typeof s.done === 'function';
    let isDone = false;
    try {
      isDone = auto ? !!s.done() : !!ticks[s.id];
    } catch {
      isDone = false;
    }
    // A step that checks itself can still be ticked off by an owner who did it
    // another way — but it can never be un-done by forgetting to tick.
    if (auto && !isDone && ticks[s.id]) isDone = true;
    return {
      id: s.id,
      stage: s.stage,
      title: s.title,
      why: s.why,
      how: s.how,
      manual: s.manual || '',
      goto: s.goto || '',
      checks_itself: auto,
      done: isDone,
      ticked_on: ticks[s.id] || '',
    };
  });

  const done = steps.filter((s) => s.done).length;
  const stages = STAGES.map((st) => {
    const mine = steps.filter((s) => s.stage === st.id);
    return {
      ...st,
      steps: mine,
      done: mine.filter((s) => s.done).length,
      total: mine.length,
    };
  });

  return {
    stages,
    total: steps.length,
    done,
    // The stage still being worked on — the first with anything outstanding.
    current: (stages.find((st) => st.done < st.total) || stages[stages.length - 1]).id,
    next: steps.filter((s) => !s.done).slice(0, 3),
  };
}
