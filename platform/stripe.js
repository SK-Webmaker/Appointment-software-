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

// Which Stripe the platform is actually wired to.
//
// The boot banner used to say only whether a key was present, which is the one
// thing nobody gets wrong. What people get wrong is believing they switched to
// live when they did not — a Render env var saved without a deploy looks
// identical from the dashboard. In that state every customer pays with a card
// that is never charged and is handed a real salon for nothing, and the first
// evidence is a bank account that stays empty.
//
// 'unset' and 'test' are distinct because they need different sentences: one
// means nobody can pay at all, the other means everybody can pay and none of it
// is real. 'unknown' covers a key shaped like neither, including the restricted
// keys (rk_*) somebody may reach for; it is reported rather than guessed at.
export function stripeMode() {
  const k = key();
  if (!k) return 'unset';
  if (k.startsWith('sk_live_') || k.startsWith('rk_live_')) return 'live';
  if (k.startsWith('sk_test_') || k.startsWith('rk_test_')) return 'test';
  return 'unknown';
}

async function call(path, params, idempotencyKey = '', version = '') {
  const res = await fetch(`${API_BASE()}/v1${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key()}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(version ? { 'Stripe-Version': version } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// The page an owner pays Kairo on: Kairo's name, mark and colours, and the
// three facts that decide a purchase said beside the button — one payment, no
// monthly fee, fourteen days to change your mind. Per-checkout branding needs
// this API version, so it is sent on this request alone; a Stripe that turns
// the branding away gets the same checkout plain rather than no checkout.
export const BRANDING_VERSION = '2025-09-30.clover';
export function kairoBranding(origin = '') {
  const out = {
    'branding_settings[display_name]': 'Kairo',
    'branding_settings[background_color]': '#0a0e16',
    'branding_settings[button_color]': '#2f7fd6',
    'branding_settings[font_family]': 'inter',
    'branding_settings[border_style]': 'rounded',
  };
  const base = String(origin || '').replace(/\/+$/, '');
  if (/^https:\/\//i.test(base)) {
    out['branding_settings[icon][type]'] = 'url';
    out['branding_settings[icon][url]'] = `${base}/icons/kairo-512.png`;
  }
  return out;
}

export async function createCheckout({ businessId, slug, name, email, priceCents, currency = 'aud', origin }) {
  const params = {
    mode: 'payment',
    customer_email: email,
    'custom_text[submit][message]': `One payment for ${name}. No monthly fee, no commission — and a full refund within 14 days if Kairo isn't right for you.`,
    'payment_intent_data[description]': `Kairo for ${name}`,
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
  };
  let session;
  try {
    session = await call('/checkout/sessions', { ...params, ...kairoBranding(origin) }, `kairo-signup-${businessId}`, BRANDING_VERSION);
  } catch (err) {
    if (err.status !== 400) throw err;
    console.warn('Stripe would not take the checkout branding; sending it plain:', err.message);
    session = await call('/checkout/sessions', params, `kairo-signup-${businessId}-plain`);
  }
  return { url: session.url, id: session.id };
}

/**
 * The card and Stripe's own receipt for a payment, for Kairo's receipt email.
 * Never needed for anything to work: the receipt goes out without them.
 */
export async function paymentDetails(paymentIntent) {
  if (!paymentIntent) return {};
  const pi = await call(`/payment_intents/${encodeURIComponent(paymentIntent)}?expand[]=latest_charge`);
  const ch = typeof pi.latest_charge === 'object' && pi.latest_charge ? pi.latest_charge : {};
  const card = ch.payment_method_details?.card || {};
  const wallet = card.wallet?.type || '';
  return {
    brand: String(card.brand || ''),
    last4: String(card.last4 || ''),
    wallet: wallet === 'apple_pay' ? 'Apple Pay' : wallet === 'google_pay' ? 'Google Pay' : '',
    receipt_url: String(ch.receipt_url || ''),
    amount: Number(pi.amount_received || pi.amount || 0),
  };
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
