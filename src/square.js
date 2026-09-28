// Taking a booking payment through Square, as an alternative to Stripe.
//
// Same shape as src/stripe.js on purpose: a plain HTTPS call, no SDK, no
// package manager. Square's Payment Links API is a good fit — one POST creates
// a hosted checkout page with real line items on it, which is what the customer
// needs to see when they are paying for a haircut AND a beard trim in one go.
//
// Two things differ from Stripe and both matter:
//
//   THE MONEY IS THE OWNER'S, ALWAYS. The access token belongs to the business.
//   Kairo never holds funds, never takes a commission, and could not skim one
//   if it wanted to — the charge happens between the customer and the salon's
//   own Square account.
//
//   SQUARE HAS NO "SESSION" TO VERIFY. Stripe hands back a session id that can
//   be asked "was this paid?". Square hands back an ORDER id, and the answer
//   lives on the order. So `verifyPayment` reads the order's state rather than
//   a session's payment_status, and the caller treats both the same way.
import { getSetting } from './db.js';

/** Overridable so the suite can stand in a local mock. Production is Square. */
const API_BASE = process.env.SQUARE_API_BASE || 'https://connect.squareup.com';
const API_VERSION = '2025-01-23';

export function squareConfigured() {
  return Boolean(getSetting('square_access_token') && getSetting('square_location_id'));
}

async function squareRequest(path, body, idempotencyKey = '') {
  const token = getSetting('square_access_token');
  const res = await fetch(`${API_BASE}/v2${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Square-Version': API_VERSION,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify({ ...body, ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}) }) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Square returns a list of errors; the first one is the useful one.
    const msg = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || `Square error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * A hosted checkout for one booking.
 *
 * `items` is one entry per service, so the customer sees what they are paying
 * for rather than a single unexplained total — the difference between "$65.00"
 * and "Haircut $45, Beard trim $20". Square wants amounts in the smallest
 * currency unit, which is what Kairo stores anyway.
 */
export async function createBookingCheckout({ appointmentId, items, origin, currency, idemToken, returnPath = '/book' }) {
  const biz = getSetting('business_name', 'Booking');
  const link = await squareRequest('/online-checkout/payment-links', {
    idempotency_key: idemToken || `kairo-appt-${appointmentId}`,
    order: {
      location_id: getSetting('square_location_id'),
      reference_id: String(appointmentId),
      line_items: items.map((it) => ({
        name: it.name,
        quantity: '1',
        base_price_money: { amount: Math.round(it.cents), currency: String(currency || 'AUD').toUpperCase() },
      })),
    },
    checkout_options: {
      // Same rule as Stripe's: a consultation booking link must come back to
      // its own page, or the money is taken and no booking is made.
      redirect_url: `${origin}${returnPath}${returnPath.includes('?') ? '&' : '?'}paid=success&appt=${appointmentId}&provider=square`,
      merchant_support_email: getSetting('business_email', '') || undefined,
      ask_for_shipping_address: false,
    },
    description: `Booking at ${biz}`,
  });
  const pl = link?.payment_link || {};
  return { url: pl.url, session_id: String(pl.order_id || pl.id || ''), provider: 'square' };
}

/**
 * Was it actually paid?
 *
 * Asked of the ORDER, because that is where Square keeps the answer. Anything
 * other than a completed order counts as unpaid — a booking is never marked
 * paid on an optimistic reading of a half-finished checkout.
 */
export async function verifyPayment(orderId) {
  if (!orderId) return { paid: false, amount_cents: 0 };
  const data = await squareRequest(`/orders/${encodeURIComponent(orderId)}`);
  const order = data?.order || {};
  const paid = order.state === 'COMPLETED'
    || Number(order?.net_amount_due_money?.amount ?? 1) === 0;
  return {
    paid,
    amount_cents: Number(order?.total_money?.amount || 0),
    payment_ref: String(order?.tenders?.[0]?.id || order.id || ''),
  };
}
