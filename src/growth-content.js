// What to post, and what to send, worked out from the business rather than
// from a blank page.
//
// The owner's brief was a content tool they already use: it looks at what a
// business has, and turns that into campaigns and posts. The part worth
// stealing is not the writing — it is that the IDEA comes from the data. An
// empty caption box is the reason every "marketing" tab in every booking system
// goes unopened; a caption box with "your Tuesdays are 40% emptier than your
// Saturdays, here is a post about it" is a different object entirely.
//
// So this module answers one question — what is true about this business this
// month that is worth saying out loud — and hands back something ready to use.
//
// FOUR RULES.
//
//   EVERY IDEA CITES ITS REASON. "Post a before-and-after of a Balayage"
//   is advice. "Balayage earned you $2,140 last month, more than anything else
//   — post one" is a reason. An owner acts on the second and ignores the first.
//
//   NOTHING IS INVENTED. Every number in every caption comes out of the
//   database. There is no language model here and there is not going to be
//   one: it would cost money every month on a product sold once, and a thing
//   that guesses must never be the thing that speaks for somebody's business.
//   The copy is a template; the facts in it are real.
//
//   THE OWNER SENDS IT. Kairo writes the post and puts it on the clipboard.
//   It does not have, and will never ask for, the keys to anybody's Instagram.
//   Where an idea maps to something Kairo CAN send — a win-back, a gap offer —
//   it links to the existing machinery rather than growing a second one.
//
//   QUIET MONTHS STILL GET A PLAN. A new business has no top service and no
//   lapsed clients. The fallbacks are the evergreen posts every service
//   business can run in week one, so the page is never empty.
import { db, getSetting } from './db.js';

const money = (cents) => `$${(Math.round(Number(cents) || 0) / 100).toFixed(2).replace(/\.00$/, '')}`;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function rows(sql, ...args) {
  try {
    return db.prepare(sql).all(...args);
  } catch {
    return [];
  }
}

function one(sql, ...args) {
  try {
    return db.prepare(sql).get(...args) || null;
  } catch {
    return null;
  }
}

/**
 * What is true about this business right now.
 *
 * One pass, because the page renders from it and a screen that fires eleven
 * queries to draw four cards is a screen that feels slow on a phone in a shop.
 */
export function businessFacts({ today = new Date().toISOString().slice(0, 10) } = {}) {
  const ninety = new Date(`${today}T12:00:00`);
  ninety.setDate(ninety.getDate() - 90);
  const since = ninety.toISOString().slice(0, 10);

  const name = String(getSetting('business_name', '') || 'your business').trim();

  const topService = one(
    `SELECT s.name, COUNT(*) AS n, COALESCE(SUM(s.price_cents), 0) AS cents
       FROM appointments a JOIN services s ON s.id = a.service_id
      WHERE a.date >= ? AND a.status = 'completed'
      GROUP BY s.id ORDER BY cents DESC LIMIT 1`, since
  );

  // Which weekday actually earns least. Counted over completed visits only, and
  // only across days the business is open — a closed Sunday is not a quiet day,
  // it is a Sunday.
  const openDays = new Set(String(getSetting('open_days', '0,1,2,3,4,5,6'))
    .split(',').map((d) => Number(String(d).trim())).filter(Number.isInteger));
  const byDay = rows(
    `SELECT CAST(strftime('%w', a.date) AS INTEGER) AS dow, COUNT(*) AS n
       FROM appointments a WHERE a.date >= ? AND a.status = 'completed'
      GROUP BY dow`, since
  ).filter((r) => openDays.has(r.dow));
  const quietest = byDay.length > 1
    ? byDay.reduce((lo, r) => (r.n < lo.n ? r : lo), byDay[0]) : null;
  const busiest = byDay.length > 1
    ? byDay.reduce((hi, r) => (r.n > hi.n ? r : hi), byDay[0]) : null;

  const lapsed = Number(one(
    `SELECT COUNT(*) AS n FROM clients c
      WHERE EXISTS (SELECT 1 FROM appointments a WHERE a.client_id = c.id AND a.status = 'completed')
        AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.client_id = c.id AND a.date >= ?)`,
    since
  )?.n || 0);

  const newThisMonth = Number(one(
    "SELECT COUNT(*) AS n FROM clients WHERE substr(created_at, 1, 7) = substr(?, 1, 7)", today
  )?.n || 0);

  const reviews = one('SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE rating >= 4');
  const products = rows(
    'SELECT name FROM products WHERE active = 1 AND stock_qty > 0 ORDER BY retail_cents DESC LIMIT 1'
  );
  const services = rows('SELECT name FROM services WHERE active = 1 ORDER BY price_cents DESC LIMIT 3');

  return {
    name,
    since,
    top_service: topService ? { name: topService.name, visits: topService.n, cents: topService.cents } : null,
    quietest_day: quietest ? { dow: quietest.dow, label: DAYS[quietest.dow], visits: quietest.n } : null,
    busiest_day: busiest ? { dow: busiest.dow, label: DAYS[busiest.dow], visits: busiest.n } : null,
    lapsed_clients: lapsed,
    new_this_month: newThisMonth,
    happy_reviews: Number(reviews?.n || 0),
    top_product: products[0]?.name || '',
    services: services.map((s) => s.name),
    referral_on: getSetting('referral_reward_type', 'none') !== 'none'
      && Number(getSetting('referral_reward_value', '0')) > 0,
    referral_value: Number(getSetting('referral_reward_value', '0')) || 0,
    booking_link: String(getSetting('public_url', '') || '').trim(),
  };
}

/**
 * The ideas.
 *
 * Each one carries WHY it is being suggested, the caption to post, and — where
 * Kairo can actually do the thing — where to go and do it. Scored so the most
 * grounded idea sorts first: an idea built on a real number beats an evergreen
 * one, every time.
 */
export function contentIdeas({ today = new Date().toISOString().slice(0, 10) } = {}) {
  const f = businessFacts({ today });
  // The call to action. A business that has not set its public address yet gets
  // the phrase everyone uses instead — "link in bio" — rather than a sentence
  // with a hole where the URL should be.
  const link = f.booking_link;
  const cta = link ? `Book here: ${link}` : 'Link in bio.';
  const out = [];

  if (f.top_service) {
    out.push({
      id: 'top-service-proof',
      kind: 'post',
      title: `Show off your ${f.top_service.name}`,
      reason: `${f.top_service.name} earned you ${money(f.top_service.cents)} over ${f.top_service.visits} `
        + 'visits in the last 90 days — more than anything else you do.',
      channel: 'Instagram / Facebook',
      photo: `A before-and-after of a ${f.top_service.name}. Same spot, same light, both times.`,
      caption: `${f.top_service.name} never misses.\n\nSwipe for the before — and yes, this is a real `
        + `client, not a stock photo.\n\n${cta}`,
      score: 100,
    });
  }

  if (f.quietest_day && f.busiest_day && f.quietest_day.dow !== f.busiest_day.dow
      && f.quietest_day.visits < f.busiest_day.visits) {
    const gap = Math.round((1 - (f.quietest_day.visits / Math.max(1, f.busiest_day.visits))) * 100);
    out.push({
      id: 'quiet-day',
      kind: 'post',
      title: `Fill your ${f.quietest_day.label}s`,
      reason: `${f.quietest_day.label} runs about ${gap}% quieter than ${f.busiest_day.label}. `
        + 'Same rent, same staff, fewer people in the chair.',
      channel: 'Instagram story / Facebook',
      photo: 'A quiet, tidy shot of the space with nobody in it. Calm, not empty.',
      caption: `${f.quietest_day.label}s are our calmest day — no rush, no waiting, the whole place `
        + `to yourself.\n\nIf you have been putting it off, that is the day to come.\n\n${cta}`,
      score: 90,
    });
  }

  if (f.lapsed_clients >= 5) {
    out.push({
      id: 'winback',
      kind: 'campaign',
      title: `Win back ${f.lapsed_clients} clients who have drifted`,
      reason: `${f.lapsed_clients} people have been in before but not in the last 90 days. They already `
        + 'liked you once — these are the cheapest bookings available to you.',
      channel: 'Text / email, through Kairo',
      caption: 'We have not seen you in a while and wanted to check in. Your spot is still here '
        + 'whenever you want it — just reply or book online.',
      goto: '#/messages',
      doing: 'Messages → Automations → Lapsed win-back switches this on and keeps it running.',
      score: 95,
    });
  }

  if (f.happy_reviews >= 3) {
    out.push({
      id: 'social-proof',
      kind: 'post',
      title: 'Put your reviews where people can see them',
      reason: `You have ${f.happy_reviews} four- and five-star reviews sitting on a page nobody visits. `
        + 'A review shown is worth several a stranger has to go looking for.',
      channel: 'Instagram / Facebook',
      photo: 'Screenshot one review. Plain background, big type, no clutter.',
      caption: 'Still the best part of the job.\n\nThank you — genuinely.',
      score: 80,
    });
  }

  if (f.referral_on) {
    out.push({
      id: 'referral-shout',
      kind: 'post',
      title: 'Tell people your referral offer exists',
      reason: 'Your offer is live but silent. Most clients have no idea it is there, and an offer '
        + 'nobody knows about produces nothing.',
      channel: 'Instagram story, and in person',
      photo: 'You, or your space. People share offers from a face, not a graphic.',
      caption: `Know someone who would like it here?\n\nSend them our way and there is something in it `
        + `for both of you. Ask us for your link next time you are in.\n\n${cta}`,
      score: 75,
    });
  } else {
    out.push({
      id: 'referral-missing',
      kind: 'campaign',
      title: 'Put a referral offer up first',
      reason: 'You have no referral offer running. It is the cheapest new-client channel there is and '
        + 'it costs nothing until it works.',
      channel: 'Kairo → Growth',
      goto: '#/growth',
      doing: 'Set it under Referrals on this page. $10 each way is enough to make people act.',
      score: 85,
    });
  }

  if (f.top_product) {
    out.push({
      id: 'product',
      kind: 'post',
      title: `Sell the ${f.top_product} between visits`,
      reason: 'Retail is the only revenue in a service business that does not cost you a chair-hour.',
      channel: 'Instagram / Facebook',
      photo: `The ${f.top_product} in your space, not on a white background.`,
      caption: `The one thing we recommend to almost everyone: ${f.top_product}.\n\nAsk us about it next `
        + 'time you are in — we would rather you got the right one than the expensive one.',
      score: 60,
    });
  }

  if (f.new_this_month >= 3) {
    out.push({
      id: 'welcome-new',
      kind: 'post',
      title: `Say hello to ${f.new_this_month} new clients this month`,
      reason: `${f.new_this_month} people picked you this month. Saying so publicly makes the next one `
        + 'feel safer about it.',
      channel: 'Instagram story',
      photo: 'Nothing staged — the room, mid-work.',
      caption: `${f.new_this_month} new faces this month. Thank you for taking a chance on us — we do not `
        + 'take it for granted.',
      score: 55,
    });
  }

  // Evergreen. A business in week one has none of the above, and an empty
  // marketing page is exactly the failure this module exists to avoid.
  const evergreen = [
    {
      id: 'meet-the-owner', kind: 'post', title: 'Introduce yourself properly',
      reason: 'People book a person before they book a business. The introduction post outperforms '
        + 'almost everything else a small business puts out.',
      channel: 'Instagram / Facebook',
      photo: 'You, at work, looking at what you are doing rather than at the camera.',
      caption: `Hi — I'm the one behind ${f.name}.\n\nHere is what I do, why I started, and what you can `
        + `expect if you come in.\n\n${cta}`,
      score: 50,
    },
    {
      id: 'price-clarity', kind: 'post', title: 'Post your prices',
      reason: 'A price somebody has to ring up and ask for is a price they assume they cannot afford.',
      channel: 'Instagram / Facebook',
      photo: 'A clean list. Readable at thumbnail size.',
      caption: `What things cost, plainly:\n\n${(f.services.length ? f.services : ['Your services'])
        .map((s) => `• ${s}`).join('\n')}\n\nNo surprises at the counter.\n\n${cta}`,
      score: 45,
    },
    {
      id: 'behind-scenes', kind: 'post', title: 'Show the work, not the result',
      reason: 'Process posts outperform finished-result posts for service businesses, because they are '
        + 'the part nobody else shows.',
      channel: 'Instagram reel / story',
      photo: '30 seconds of the actual work. No music, no talking, no edit.',
      caption: 'The bit nobody sees.\n\nNo filter, no fast-forward — this is just what it looks like.',
      score: 40,
    },
    {
      id: 'faq', kind: 'post', title: 'Answer the question you are asked every week',
      reason: 'The question you are tired of answering is the question stopping other people booking.',
      channel: 'Instagram / Facebook',
      photo: 'Text on a plain background is fine for this one.',
      caption: 'The thing we get asked most:\n\n[the question]\n\nAnd the honest answer: [your answer].\n\n'
        + `Anything else, just ask.\n\n${cta}`,
      score: 35,
    },
  ];

  return [...out, ...evergreen].sort((a, b) => b.score - a.score);
}

/**
 * A month of it, laid out.
 *
 * Four weeks, two ideas a week, most-grounded first. Twice a week is the
 * cadence a working owner can actually keep — a plan that asks for daily posts
 * is abandoned in nine days and takes the rest of the plan with it.
 */
export function contentCalendar({ today = new Date().toISOString().slice(0, 10) } = {}) {
  const ideas = contentIdeas({ today });
  const weeks = [];
  for (let w = 0; w < 4; w++) {
    const slice = [ideas[w * 2], ideas[w * 2 + 1]].filter(Boolean);
    if (!slice.length) break;
    weeks.push({ week: w + 1, ideas: slice });
  }
  return { weeks, total: ideas.length };
}
