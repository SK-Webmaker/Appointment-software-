// Getting paid for a booking — Stripe or Square, a deposit or the lot.
//
// The case this was built for, in the owner's words: a barbershop sells a
// haircut and a beard trim. A customer books both and pays for BOTH IN ONE
// PAYMENT — or chooses to pay in person instead.
//
// The lines it holds:
//
//   1. ONE BOOKING, ONE PAYMENT. Two services is one checkout with two lines
//      on it for the combined total — never two transactions in a row, and
//      never one service's price by accident.
//   2. STRIPE AND SQUARE ARE INTERCHANGEABLE to everything above them, and the
//      money is the owner's either way.
//   3. "PAY IN PERSON" STILL BOOKS. Declining to pay now is not an error and
//      does not cost the customer the slot.
//   4. A PAYMENT FAILURE NEVER LOSES THE BOOKING.
//   5. PAID IS VERIFIED, NEVER ASSERTED. "?paid=success" is a claim by whoever
//      typed it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startKairo } from './helpers/kairo.js';

let k, cookie, staffId, haircut, beardId;
let stripeMock, squareMock;
const seen = { stripe: [], square: [] };
let squarePaid = true;

const api = (m, p, body) => k.api(m, p, { cookie, body });
const set = (body) => api('PUT', '/api/settings', body);
const info = async () => (await k.api('GET', '/api/public/info')).json;

/** Mock processors that record exactly what they were asked to charge. */
function mocks() {
  stripeMock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url.startsWith('/v1/checkout/sessions/')) {
        return res.end(JSON.stringify({
          id: 'cs_1', payment_status: 'paid',
          amount_total: seen.stripe.at(-1)?.total || 0, payment_intent: 'pi_1', metadata: {},
        }));
      }
      const p = new URLSearchParams(body);
      const items = [];
      for (let i = 0; p.has(`line_items[${i}][price_data][unit_amount]`); i++) {
        items.push({
          name: p.get(`line_items[${i}][price_data][product_data][name]`),
          cents: Number(p.get(`line_items[${i}][price_data][unit_amount]`)),
        });
      }
      seen.stripe.push({ items, total: items.reduce((t, x) => t + x.cents, 0) });
      res.end(JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' }));
    });
  });
  squareMock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url.startsWith('/v2/orders/')) {
        return res.end(JSON.stringify({
          order: {
            id: 'ord_1', state: squarePaid ? 'COMPLETED' : 'OPEN',
            total_money: { amount: seen.square.at(-1)?.total || 0 },
            net_amount_due_money: { amount: squarePaid ? 0 : 999 },
            tenders: [{ id: 'tender_1' }],
          },
        }));
      }
      const b = JSON.parse(body || '{}');
      const items = (b.order?.line_items || [])
        .map((x) => ({ name: x.name, cents: x.base_price_money.amount }));
      seen.square.push({ items, total: items.reduce((t, x) => t + x.cents, 0), body: b });
      res.end(JSON.stringify({ payment_link: { id: 'pl_1', order_id: 'ord_1', url: 'https://square.test/pl_1' } }));
    });
  });
}

let nextDay = 3;
/** Book the barbershop pair. */
async function bookBoth(payChoice) {
  const d = new Date();
  d.setDate(d.getDate() + (nextDay += 1));
  return k.api('POST', '/api/public/book', {
    body: {
      service_ids: [haircut, beardId], staff_id: staffId,
      date: d.toISOString().slice(0, 10), start_min: 600,
      client: { first_name: 'Pat', last_name: 'Customer', email: 'pat@example.org', phone: '0400777666' },
      origin: 'http://127.0.0.1',
      ...(payChoice ? { pay_choice: payChoice } : {}),
    },
  });
}

before(async () => {
  mocks();
  await new Promise((r) => stripeMock.listen(4961, r));
  await new Promise((r) => squareMock.listen(4962, r));
  k = await startKairo({
    env: { STRIPE_API_BASE: 'http://127.0.0.1:4961', SQUARE_API_BASE: 'http://127.0.0.1:4962' },
  });
  ({ cookie } = await k.login());
  await api('POST', '/api/setup/skip');
  await set({
    business_name: 'Sharp Cuts', business_tz: 'Australia/Melbourne',
    open_days: '0,1,2,3,4,5,6', open_min: '480', close_min: '1200',
    booking_enabled: '1', booking_lead_min: '0', currency_code: 'aud',
    deposit_type: 'none', slot_interval: '15', booking_horizon_days: '120',
  });
  staffId = (await api('POST', '/api/staff', { name: 'Barber' })).json.id;
  haircut = (await api('POST', '/api/services', {
    name: 'Haircut', duration_min: 30, price: 45, price_type: 'fixed',
  })).json.id;
  beardId = (await api('POST', '/api/services', {
    name: 'Beard trim', duration_min: 15, price: 20, price_type: 'fixed',
  })).json.id;
});
after(async () => {
  await k.stop();
  stripeMock.close(); squareMock.close();
});

test('with nothing connected, no card is offered', async () => {
  await set({ pay_mode: 'choice', stripe_secret_key: '', square_access_token: '' });
  const i = await info();
  assert.equal(i.payment.configured, false);
  // A page that offers a card the business cannot take is worse than one that
  // never mentions it.
  assert.equal(i.payment.mode, 'none', 'the mode collapses rather than lying');
});

test('Stripe: two services, one payment, both lines on it', async () => {
  await set({ stripe_secret_key: 'sk_test_x', pay_provider: 'stripe', pay_mode: 'full' });
  assert.equal((await info()).payment.label, 'Stripe');

  seen.stripe.length = 0;
  const r = await bookBoth();
  assert.equal(r.status, 200);
  assert.ok(r.json.checkout_url, 'the customer is sent to a checkout');
  assert.equal(seen.stripe.length, 1, 'exactly one checkout');
  assert.equal(seen.stripe[0].total, 6500, 'the combined total, $65');
  assert.equal(seen.stripe[0].items.length, 2, 'a line for each service');
});

test('Square: the same booking, the same one payment', async () => {
  await set({ square_access_token: 'EAAA_test', square_location_id: 'L1', pay_provider: 'square' });
  assert.equal((await info()).payment.label, 'Square');

  seen.square.length = 0;
  const r = await bookBoth();
  assert.ok(String(r.json.checkout_url).includes('square.test'));
  assert.equal(seen.square.length, 1);
  assert.equal(seen.square[0].total, 6500);
  assert.equal(seen.square[0].items.length, 2);
  assert.equal(seen.square[0].body.order.location_id, 'L1', "the salon's own location");
});

test('"their choice": pay now, or pay in person', async () => {
  await set({ pay_mode: 'choice' });
  seen.square.length = 0;
  const now = await bookBoth('now');
  assert.ok(now.json.checkout_url, '"pay now" opens a checkout');
  assert.equal(seen.square[0].total, 6500, 'for the whole basket');

  seen.square.length = 0;
  const later = await bookBoth('in_person');
  assert.equal(later.status, 200, '"pay in person" still books');
  assert.ok(!later.json.checkout_url, 'and takes no payment');
  assert.equal(seen.square.length, 0, 'nothing was charged');
  const d = k.db();
  const appt = d.prepare('SELECT deposit_cents, deposit_status FROM appointments WHERE id = ?')
    .get(later.json.appointment_id);
  d.close();
  assert.equal(appt.deposit_cents, 0);
  assert.equal(appt.deposit_status, '');
});

test('a payment is verified with the provider, never taken on trust', async () => {
  await set({ pay_mode: 'full', pay_provider: 'square' });
  squarePaid = true;
  const r = await bookBoth();
  const id = r.json.appointment_id;
  const good = await k.api('POST', '/api/public/confirm-payment', {
    body: { appointment_id: id, session_id: 'ord_1' },
  });
  assert.equal(good.json.paid, true);
  assert.equal(good.json.provider, 'square', 'it remembers which processor took it');

  // Somebody else's reference must not attach to this booking.
  const wrong = await k.api('POST', '/api/public/confirm-payment', {
    body: { appointment_id: id, session_id: 'ord_SOMEBODY_ELSE' },
  });
  assert.equal(wrong.status, 400);

  squarePaid = false;
  const r2 = await bookBoth();
  const unpaid = await k.api('POST', '/api/public/confirm-payment', {
    body: { appointment_id: r2.json.appointment_id, session_id: 'ord_1' },
  });
  assert.equal(unpaid.json.paid, false, 'an abandoned checkout is not paid');
  squarePaid = true;
});

test('a payment failure never costs somebody their booking', async () => {
  await set({ pay_provider: 'square', pay_mode: 'full' });
  await new Promise((r) => squareMock.close(r));
  const r = await bookBoth();
  assert.equal(r.status, 200, 'the appointment still exists');
  assert.ok(r.json.appointment_id > 0);
  assert.ok(!r.json.checkout_url, 'they are simply not sent to a checkout');
  await new Promise((r2) => squareMock.listen(4962, r2));
});

test('neither key is ever handed to a browser', async () => {
  const s = (await api('GET', '/api/settings')).json;
  assert.ok(!s.square_access_token, 'the token is not readable');
  assert.equal(s.square_access_token_set, '1', 'but the page can tell it is set');
  const pub = JSON.stringify(await info());
  assert.ok(!pub.includes('EAAA_test') && !pub.includes('sk_test_x'),
    'and the public booking page sees neither');
});
