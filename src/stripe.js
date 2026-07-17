// Online booking deposits via Stripe Checkout — plain HTTPS API, no SDK.
// Configure in Settings → Payments: stripe_secret_key, deposit_type
// (none|fixed|percent), deposit_value. With no key or type=none, online
// booking simply skips the deposit step.
import { getSetting } from './db.js';

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

async function stripeRequest(path, params, idempotencyKey = '') {
  const key = getSetting('stripe_secret_key');
  const res = await fetch(`${API_BASE}/v1${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      // Stripe replays the original response for a reused key instead of
      // charging twice — our double-tap / retry safety net at the API level.
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  }
  return data;
}

/**
 * Create a Checkout Session for an appointment deposit.
 * Returns { url, session_id } or throws.
 */
export async function createDepositCheckout({ appointmentId, serviceName, depositCents, origin }) {
  const currency = (getSetting('currency_code', 'usd') || 'usd').toLowerCase();
  const biz = getSetting('business_name', 'Booking');
  const session = await stripeRequest('/checkout/sessions', {
    mode: 'payment',
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
    'payment_intent_data[description]': `POS sale — ${biz}`,
  };
  items.forEach((it, i) => {
    params[`line_items[${i}][price_data][currency]`] = currency;
    params[`line_items[${i}][price_data][unit_amount]`] = String(it.unit_cents);
    params[`line_items[${i}][price_data][product_data][name]`] = it.description.slice(0, 120);
    params[`line_items[${i}][quantity]`] = String(it.qty);
  });
  const session = await stripeRequest('/checkout/sessions', params, `kairo-pos-${idemToken || `inv-${invoiceId}`}`);
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
