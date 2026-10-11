// Online booking deposits via Stripe Checkout — plain HTTPS API, no SDK.
// Configure in Settings → Payments: stripe_secret_key, deposit_type
// (none|fixed|percent), deposit_value. With no key or type=none, online
// booking simply skips the deposit step.
import { getSetting, publicUrl } from './db.js';
import { resolveScheme } from '../public/js/schemes.js';

export function depositCentsFor(service) {
  const type = getSetting('deposit_type', 'none');
  const value = Number(getSetting('deposit_value', '0')) || 0;
  if (type === 'fixed' && value > 0) return Math.round(value * 100);
  if (type === 'percent' && value > 0 && service?.price_cents) {
    return Math.max(50, Math.round(service.price_cents * (value / 100)));
  }
  return 0;
}

export function stripeConfigured() {
  return Boolean(getSetting('stripe_secret_key'));
}

// Overridable base so the test suite can stand in a local mock Stripe server
// (STRIPE_API_BASE=http://127.0.0.1:PORT). Production always uses the real API.
const API_BASE = process.env.STRIPE_API_BASE || 'https://api.stripe.com';

async function stripeRequest(path, params, idempotencyKey = '', version = '') {
  const key = getSetting('stripe_secret_key');
  const res = await fetch(`${API_BASE}/v1${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      // Stripe replays the original response for a reused key instead of
      // charging twice — our double-tap / retry safety net at the API level.
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(version ? { 'Stripe-Version': version } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe error ${res.status}`);
    err.status = res.status;
    err.param = data?.error?.param || '';
    throw err;
  }
  return data;
}

// ── How the salon's checkout looks ─────────────────────────────────────────
//
// A client tapping Pay on a salon's booking page used to land on a page that
// said whatever the salon's Stripe account happened to be set to — often the
// owner's legal name, on Stripe's default white, with no logo. They had just
// been on a page in the salon's colours and had never heard of the name in
// front of them, which is how a deposit becomes a "what is this charge?" call.
//
// So every checkout carries the salon's own branding: the business name, its
// accent on the button, the background of its booking page, and its logo when
// Stripe can fetch it. Stripe takes these per checkout from API version
// 2025-09-30.clover, so that version is sent on these requests only — every
// other call keeps the account's own version and the shapes Kairo reads.

export const BRANDING_VERSION = '2025-09-30.clover';
const HEX = /^#[0-9a-fA-F]{6}$/;
// Formats Stripe will show. An SVG or WebP logo stays on the booking page and
// the checkout shows the name alone.
const STRIPE_IMAGE = /^data:image\/(png|jpe?g|gif);base64,/i;

export function checkoutBranding() {
  const out = {};
  const name = String(getSetting('business_name', '') || '').trim();
  if (name) out['branding_settings[display_name]'] = name.slice(0, 80);
  const accent = String(getSetting('brand_accent', '') || '');
  if (HEX.test(accent)) out['branding_settings[button_color]'] = accent;
  const scheme = resolveScheme({ scheme: getSetting('brand_scheme', ''), theme: getSetting('brand_theme', '') });
  out['branding_settings[background_color]'] = scheme.bg;
  out['branding_settings[font_family]'] = 'inter';
  out['branding_settings[border_style]'] = 'rounded';
  // Stripe fetches the logo itself, so only from an address it can reach.
  const origin = String(publicUrl() || '').replace(/\/+$/, '');
  if (/^https:\/\//i.test(origin) && STRIPE_IMAGE.test(getSetting('brand_logo', '') || '')) {
    out['branding_settings[icon][type]'] = 'url';
    out['branding_settings[icon][url]'] = `${origin}/api/public/logo`;
  }
  return out;
}

/**
 * Create a Checkout Session in the salon's branding. Branding is a nicety and
 * taking the booking is not: if Stripe turns the branded request away (a logo
 * it could not fetch, a setting it does not accept), the same checkout goes
 * through plain, under its own idempotency key.
 */
async function createSession(params, idempotencyKey = '') {
  try {
    return await stripeRequest('/checkout/sessions', { ...params, ...checkoutBranding() }, idempotencyKey, BRANDING_VERSION);
  } catch (err) {
    if (err.status !== 400) throw err;
    console.warn(`Stripe would not take the checkout branding (${err.param || err.message}); sending it plain`);
    return stripeRequest('/checkout/sessions', params, idempotencyKey ? `${idempotencyKey}-plain` : '');
  }
}

const money = (cents) => `${getSetting('currency', '$') || '$'}${((Number(cents) || 0) / 100).toFixed(2)}`;
const clock = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** "Tuesday, October 13 at 10:00 AM" — the same words as the confirmation email. */
export function whenLabel(date, startMin) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  const day = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return Number.isFinite(Number(startMin)) ? `${day} at ${clock(Number(startMin))}` : day;
}

/**
 * Create a Checkout Session for an appointment deposit.
 * Returns { url, session_id } or throws.
 */
export async function createDepositCheckout({ appointmentId, serviceName, depositCents, origin, when = '' }) {
  const currency = (getSetting('currency_code', 'usd') || 'usd').toLowerCase();
  const biz = getSetting('business_name', 'Booking');
  const session = await createSession({
    mode: 'payment',
    submit_type: 'book',
    'custom_text[submit][message]': `Your ${money(depositCents)} deposit holds ${serviceName}${when ? ` on ${when}` : ''}. It comes off your total on the day.`,
    'payment_intent_data[description]': `Deposit · ${serviceName}${when ? ` · ${when}` : ''}`,
    'payment_intent_data[metadata][appointment_id]': String(appointmentId),
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][unit_amount]': String(depositCents),
    'line_items[0][price_data][product_data][name]': `Booking deposit — ${serviceName}`,
    'line_items[0][price_data][product_data][description]': `Holds your appointment at ${biz}`,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/book?deposit=success&appt=${appointmentId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book?deposit=cancelled&appt=${appointmentId}`,
    'metadata[appointment_id]': String(appointmentId),
  });
  return { url: session.url, session_id: session.id };
}

/**
 * A Checkout Session for a whole booking, one line item per service.
 *
 * The deposit version above sends a single line reading "Booking deposit —
 * Haircut + Beard trim", which is right for a deposit and wrong for a full
 * payment: somebody paying $65 should see the $45 and the $20 that make it up,
 * or the first thing they do is ring and ask what they were charged for.
 */
export async function createBookingCheckout({ appointmentId, items, origin, currency, idemToken, returnPath = '/book', when = '' }) {
  const cur = String(currency || getSetting('currency_code', 'aud') || 'aud').toLowerCase();
  const biz = getSetting('business_name', 'Booking');
  // Where the customer lands afterwards. Defaults to the booking page, which is
  // where every payment used to come from; a consultation booking link sends
  // them back to its own page instead, because /book cannot confirm an invite
  // and the money would be taken with no booking made.
  const back = `${origin}${returnPath}${returnPath.includes('?') ? '&' : '?'}`;
  const what = items.map((it) => it.name).join(' + ');
  const params = {
    mode: 'payment',
    submit_type: 'book',
    'custom_text[submit][message]': `Paying now confirms ${what}${when ? ` on ${when}` : ''} with ${biz}.`,
    'payment_intent_data[description]': `${what}${when ? ` · ${when}` : ''}`,
    'payment_intent_data[metadata][appointment_id]': String(appointmentId),
    success_url: `${back}paid=success&appt=${appointmentId}&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${back}paid=cancelled&appt=${appointmentId}`,
    'metadata[appointment_id]': String(appointmentId),
  };
  items.forEach((it, i) => {
    params[`line_items[${i}][price_data][currency]`] = cur;
    params[`line_items[${i}][price_data][unit_amount]`] = String(Math.round(it.cents));
    params[`line_items[${i}][price_data][product_data][name]`] = it.name;
    params[`line_items[${i}][price_data][product_data][description]`] = biz;
    params[`line_items[${i}][quantity]`] = '1';
  });
  const session = await createSession(params, idemToken ? `kairo-appt-${appointmentId}-${idemToken}` : '');
  return { url: session.url, session_id: session.id, provider: 'stripe' };
}

/** Was a booking payment actually taken? Same answer shape as Square's. */
export async function verifyBookingPayment(sessionId) {
  if (!sessionId) return { paid: false, amount_cents: 0 };
  const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
  return {
    paid: session.payment_status === 'paid',
    amount_cents: session.amount_total || 0,
    payment_ref: String(session.payment_intent || session.id || ''),
  };
}

/** Verify a Checkout Session actually got paid (called on the success return). */
export async function verifyDepositSession(sessionId) {
  const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
  return {
    paid: session.payment_status === 'paid',
    amount_cents: session.amount_total || 0,
    appointment_id: Number(session.metadata?.appointment_id) || null,
  };
}

/**
 * Create an itemized Checkout Session for a POS sale. The customer pays on
 * the salon phone (card entry) or on their own phone via the shared link,
 * where Apple Pay / Google Pay appear automatically. Idempotent per invoice:
 * retrying after a network blip reuses the same Stripe request.
 * Returns { url, session_id }.
 */
export async function createPosCheckout({ invoiceId, items, origin, idemToken }) {
  const currency = (getSetting('currency_code', 'usd') || 'usd').toLowerCase();
  const biz = getSetting('business_name', 'Point of sale');
  const params = {
    mode: 'payment',
    success_url: `${origin}/pay-done?ok=1`,
    cancel_url: `${origin}/pay-done?cancelled=1`,
    'metadata[invoice_id]': String(invoiceId),
    'payment_intent_data[metadata][invoice_id]': String(invoiceId),
    'payment_intent_data[description]': `Sale · ${biz}`,
    'custom_text[submit][message]': `Thank you for visiting ${biz}.`,
  };
  items.forEach((it, i) => {
    params[`line_items[${i}][price_data][currency]`] = currency;
    params[`line_items[${i}][price_data][unit_amount]`] = String(it.unit_cents);
    params[`line_items[${i}][price_data][product_data][name]`] = it.description.slice(0, 120);
    params[`line_items[${i}][quantity]`] = String(it.qty);
  });
  const session = await createSession(params, `kairo-pos-${idemToken || `inv-${invoiceId}`}`);
  return { url: session.url, session_id: session.id };
}

/**
 * Authoritative payment check for a POS sale: asks Stripe directly whether
 * the session was paid (pull model — no webhook required, can't be spoofed
 * by the client). Returns { paid, amount_cents, payment_intent }.
 */
export async function verifyPosSession(sessionId) {
  const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
  return {
    paid: session.payment_status === 'paid',
    amount_cents: session.amount_total || 0,
    payment_intent: typeof session.payment_intent === 'string'
      ? session.payment_intent : session.payment_intent?.id || '',
  };
}

/**
 * Refund a Stripe payment (full when amountCents is null, else partial).
 * Idempotent per (payment intent, amount) so a double-clicked refund button
 * can never refund twice. Returns { refund_id, amount_cents }.
 */
export async function createStripeRefund(paymentIntent, amountCents = null, salt = 0) {
  const params = { payment_intent: paymentIntent };
  if (amountCents != null) params.amount = String(amountCents);
  // Key includes how much was already refunded (salt): a network retry of the
  // SAME refund reuses the key (no double refund), while a deliberate second
  // refund of the same amount gets a fresh key (already-refunded total moved).
  const refund = await stripeRequest('/refunds', params,
    `kairo-refund-${paymentIntent}-${amountCents == null ? 'full' : amountCents}-${salt}`);
  return { refund_id: refund.id, amount_cents: refund.amount || amountCents || 0 };
}
