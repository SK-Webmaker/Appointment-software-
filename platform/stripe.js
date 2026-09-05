// Taking A$410 once, and giving it back within fourteen days.
//
// Stripe Checkout, the same plain-HTTPS-no-SDK approach Kairo already uses for
// salon deposits. Two rules that matter more than the code:
//
//   1. Provisioning is driven by the WEBHOOK, never by the browser coming back
//      to a success page. A browser can be closed, replayed, or forged; the
//      webhook is signed by Stripe and is the only thing that says money moved.
//   2. Webhook signatures are verified, and a replayed one is harmless because
//      provisioning is idempotent on the session id.
import crypto from 'node:crypto';

const API_BASE = () => process.env.STRIPE_API_BASE || 'https://api.stripe.com';
const key = () => String(process.env.STRIPE_SECRET_KEY || '').trim();
export const stripeConfigured = () => key().length > 0;

async function call(path, params, idempotencyKey = '') {
  const res = await fetch(`${API_BASE()}/v1${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key()}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
  return data;
}

export async function createCheckout({ businessId, slug, name, email, priceCents, currency = 'aud', origin }) {
  const session = await call('/checkout/sessions', {
    mode: 'payment',
    customer_email: email,
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][unit_amount]': String(priceCents),
    'line_items[0][price_data][product_data][name]': 'Kairo — booking software for one salon',
    'line_items[0][price_data][product_data][description]': `One payment for ${name}. No monthly fee, no commission.`,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/done?b=${slug}`,
    cancel_url: `${origin}/start?cancelled=1&b=${slug}`,
    'metadata[business_id]': String(businessId),
    'metadata[slug]': slug,
    'payment_intent_data[metadata][business_id]': String(businessId),
  }, `kairo-signup-${businessId}`);
  return { url: session.url, id: session.id };
}

export const getSession = (id) => call(`/checkout/sessions/${encodeURIComponent(id)}`);

export async function refund(paymentIntent, reason = 'requested_by_customer') {
  return call('/refunds', { payment_intent: paymentIntent, reason }, `kairo-refund-${paymentIntent}`);
}

/**
 * Verify Stripe's signature over the raw body. Rejects anything older than
 * five minutes so a captured webhook cannot be replayed days later.
 */
export function verifyWebhook(rawBody, header, secret = process.env.STRIPE_WEBHOOK_SECRET || '') {
  if (!secret) return { ok: false, reason: 'no STRIPE_WEBHOOK_SECRET set' };
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')));
  const t = Number(parts.t);
  if (!Number.isFinite(t)) return { ok: false, reason: 'no timestamp' };
  if (Math.abs(Date.now() / 1000 - t) > 300) return { ok: false, reason: 'timestamp outside window' };
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(String(parts.v1 || ''), 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature mismatch' };
  return { ok: true };
}
