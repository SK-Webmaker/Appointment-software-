// How a business gets paid for a booking.
//
// Two questions, kept apart because they are genuinely separate and owners
// conflate them constantly:
//
//   WHO PROCESSES THE CARD — Stripe or Square. The business connects its own
//   account; the money goes straight to it. Kairo never holds funds and takes
//   no commission, which is the whole pitch, so there is no "Kairo account"
//   in the middle and there never will be.
//
//   HOW MUCH IS DUE AT BOOKING — nothing, a deposit, or the lot. And whether
//   the customer gets to choose between paying now and paying in person, which
//   is the option most small businesses actually want: card online for the
//   people who prefer it, cash at the counter for the people who don't.
//
// The rule that keeps this honest: THE BOOKING IS NEVER LOST. If a provider is
// down, misconfigured, or the customer abandons the checkout, the appointment
// still exists and the salon still sees it. A payment problem must never cost
// somebody their slot — they can pay when they arrive.
import { getSetting } from './db.js';
import {
  stripeConfigured, createBookingCheckout as stripeCheckout, verifyBookingPayment as stripeVerify,
} from './stripe.js';
import {
  squareConfigured, createBookingCheckout as squareCheckout, verifyPayment as squareVerify,
} from './square.js';

/** stripe | square | '' — whichever the owner has actually connected. */
export function payProvider() {
  const chosen = String(getSetting('pay_provider', '') || '').trim();
  if (chosen === 'square' && squareConfigured()) return 'square';
  if (chosen === 'stripe' && stripeConfigured()) return 'stripe';
  // Nothing chosen, or chosen-but-not-finished: fall back to whichever is
  // genuinely usable, so an owner who pasted a Stripe key and never touched the
  // dropdown still takes payments.
  if (stripeConfigured()) return 'stripe';
  if (squareConfigured()) return 'square';
  return '';
}

export function paymentsConfigured() {
  return payProvider() !== '';
}

/**
 * What the customer is asked for at the moment of booking.
 *
 *   none    — nothing. Pay in person, as before.
 *   deposit — the existing deposit rules.
 *   full    — the whole total, online, required.
 *   choice  — the whole total, online, OPTIONAL: pay now or pay in person.
 *
 * Defaults to 'deposit' so an existing salon's behaviour is unchanged by the
 * setting arriving. Nothing here is allowed to turn a working booking page into
 * one that demands a card.
 */
export function payMode() {
  const mode = String(getSetting('pay_mode', 'deposit') || 'deposit').trim();
  if (!['none', 'deposit', 'full', 'choice'].includes(mode)) return 'deposit';
  // A mode that needs a processor is 'none' without one. Otherwise the booking
  // page offers to take a card and then cannot.
  if (mode !== 'none' && !paymentsConfigured()) return 'none';
  return mode;
}

/**
 * What is actually payable online for this basket, in cents.
 *
 * `total` is the combined price of every service chosen — a haircut and a beard
 * trim are one payment, not two. Zero means nothing to collect now.
 */
export function amountDueCents(totalCents, depositCents = 0) {
  const mode = payMode();
  if (mode === 'full' || mode === 'choice') return Math.max(0, Math.round(totalCents));
  if (mode === 'deposit') return Math.max(0, Math.round(depositCents));
  return 0;
}

/**
 * Does this booking need a card before it is confirmed?
 *
 * Only 'full' and a live deposit do. Under 'choice' the customer decides, and
 * under 'none' nobody does — which is why this is a question and not an
 * assumption baked into the booking route.
 */
export function paymentRequired({ payChoice = '' } = {}) {
  const mode = payMode();
  if (mode === 'full') return true;
  if (mode === 'choice') return payChoice === 'now';
  if (mode === 'deposit') return true; // the caller only asks when a deposit is due
  return false;
}

/** What the booking page needs to draw the choice. */
export function paymentInfo() {
  const provider = payProvider();
  return {
    provider,                       // '' when nothing is connected
    configured: provider !== '',
    mode: payMode(),
    // Said plainly on the page rather than left for the customer to infer.
    label: provider === 'square' ? 'Square' : provider === 'stripe' ? 'Stripe' : '',
  };
}

/**
 * Start a hosted checkout with whichever provider is connected.
 *
 * Both providers get the same argument shape and hand back the same three
 * fields, so the booking route has no idea which one it is talking to. That is
 * deliberate: the day a third one is added, this is the only file that learns
 * about it.
 */
export async function createCheckout({ appointmentId, items, origin, idemToken }) {
  const currency = getSetting('currency_code', 'aud') || 'aud';
  const provider = payProvider();
  if (provider === 'square') {
    return squareCheckout({ appointmentId, items, origin, currency, idemToken });
  }
  if (provider === 'stripe') {
    return stripeCheckout({ appointmentId, items, origin, currency, idemToken });
  }
  throw new Error('No payment provider is connected');
}

/** Was it paid? Asked of whichever provider took it. */
export async function verifyPayment(ref, provider = '') {
  const p = provider || payProvider();
  if (p === 'square') return squareVerify(ref);
  if (p === 'stripe') return stripeVerify(ref);
  return { paid: false, amount_cents: 0 };
}
