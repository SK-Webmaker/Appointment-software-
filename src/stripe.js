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

async function stripeRequest(path, params) {
  const key = getSetting('stripe_secret_key');
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
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
