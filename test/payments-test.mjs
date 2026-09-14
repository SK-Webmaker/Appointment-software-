// Getting paid for a booking — Stripe or Square, deposit or the lot.
//
// The case this was built for, in the owner's words: a barbershop sells a
// haircut and a beard trim. A customer books both, and pays for BOTH IN ONE
// PAYMENT, or chooses to pay in person instead.
//
// What it holds to:
//
//   1. ONE BOOKING, ONE PAYMENT. Two services is one checkout with two lines
//      on it, for the combined total — never two transactions in a row, and
//      never one service's price by accident.
//   2. THE PROVIDER IS THE OWNER'S CHOICE and the money is the owner's money.
//      Stripe and Square are interchangeable to everything above them.
//   3. "PAY IN PERSON" STILL BOOKS. Choosing not to pay now is not an error,
//      and it does not cost the customer the slot.
//   4. THE BOOKING SURVIVES A PAYMENT FAILURE. A provider that is down must
//      never lose an appointment the salon could otherwise honour.
//   5. PAID IS VERIFIED, NEVER ASSERTED. "?paid=success" in the address bar is
//      a claim by whoever typed it.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4949;
const B = `http://localhost:${PORT}`;
const DIR = '/tmp/kairo-payments-test';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { console.log((c ? '✅' : '❌') + ' ' + n + (e ? ' — ' + e : '')); c ? pass++ : fail++; };

// --- mock processors --------------------------------------------------------
// Stand-ins for Stripe and Square that record exactly what they were asked to
// charge. The point of the suite is the REQUEST Kairo builds: the total, and
// the line items making it up.
const seen = { stripe: [], square: [] };
let squarePaid = true;

const stripeMock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/v1/checkout/sessions/')) {
      return res.end(JSON.stringify({
        id: 'cs_test_1', payment_status: 'paid', amount_total: seen.stripe.at(-1)?.total || 0,
        payment_intent: 'pi_1', metadata: {},
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
    res.end(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1' }));
  });
});

const squareMock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/v2/orders/')) {
      return res.end(JSON.stringify({
        order: {
          id: 'ord_1', state: squarePaid ? 'COMPLETED' : 'OPEN',
          total_money: { amount: seen.square.at(-1)?.total || 0, currency: 'AUD' },
          net_amount_due_money: { amount: squarePaid ? 0 : 999 },
          tenders: [{ id: 'tender_1' }],
        },
      }));
    }
    const b = JSON.parse(body || '{}');
    const items = (b.order?.line_items || []).map((x) => ({ name: x.name, cents: x.base_price_money.amount }));
    seen.square.push({ items, total: items.reduce((t, x) => t + x.cents, 0), body: b });
    res.end(JSON.stringify({ payment_link: { id: 'pl_1', order_id: 'ord_1', url: 'https://square.test/pl_1' } }));
  });
});

await new Promise((r) => stripeMock.listen(4951, r));
await new Promise((r) => squareMock.listen(4952, r));

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
process.env.KAIRO_DATA_DIR = DIR;

const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
  cwd: ROOT,
  env: {
    ...process.env, PORT: String(PORT), KAIRO_DATA_DIR: DIR, KAIRO_RATELIMIT: 'off',
    STRIPE_API_BASE: 'http://127.0.0.1:4951',
    SQUARE_API_BASE: 'http://127.0.0.1:4952',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stdout.on('data', () => {}); srv.stderr.on('data', () => {});
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${B}/api/version`)).ok) break; } catch { /* not up */ }
  await new Promise((r) => setTimeout(r, 250));
}

let cookie = '';
const json = async (m, p, b) => {
  const h = {};
  if (cookie) h.cookie = cookie;
  if (b !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(B + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) });
  if (!cookie && r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
};
const set = (body) => json('PUT', '/api/settings', body);
const info = async () => (await json('GET', '/api/public/info')).data;

const { db } = await import(`${ROOT}/src/db.js`);

/** Book the barbershop pair. Returns the server's answer. */
let nextDay = 3;
async function bookBoth({ payChoice, staffId, haircut, beard }) {
  const d = new Date();
  d.setDate(d.getDate() + (nextDay += 1));
  const date = d.toISOString().slice(0, 10);
  return json('POST', '/api/public/book', {
    service_ids: [haircut, beard],
    staff_id: staffId,
    date,
    start_min: 600,
    client: { first_name: 'Pat', last_name: 'Customer', email: 'pat@example.org', phone: '0400777666' },
    origin: B,
    ...(payChoice ? { pay_choice: payChoice } : {}),
  });
}

try {
  await json('POST', '/api/auth/login', { email: 'admin@kairo.local', password: 'admin123' });
  await json('POST', '/api/setup/skip', {});
  await set({
    business_name: 'Sharp Cuts', business_tz: 'Australia/Melbourne',
    open_days: '0,1,2,3,4,5,6', open_min: '480', close_min: '1200',
    booking_enabled: '1', booking_lead_min: '0', currency_code: 'aud',
    deposit_type: 'none', slot_interval: '15', booking_horizon_days: '120',
  });
  const staffId = (await json('POST', '/api/staff', { name: 'Barber' })).data.id;
  const haircut = (await json('POST', '/api/services', {
    name: 'Haircut', duration_min: 30, price: 45, price_type: 'fixed',
  })).data.id;
  const beard = (await json('POST', '/api/services', {
    name: 'Beard trim', duration_min: 15, price: 20, price_type: 'fixed',
  })).data;
  const beardId = beard.id;

  console.log('\n── 1. nothing connected means nothing is offered');
  {
    await set({ pay_mode: 'choice', stripe_secret_key: '', square_access_token: '' });
    const i = await info();
    ok('the booking page is told there is no card option', i.payment.configured === false,
      JSON.stringify(i.payment));
    ok('and the mode collapses to "none" rather than lying',
      i.payment.mode === 'none', i.payment.mode);
  }

  console.log('\n── 2. Stripe: two services, ONE payment, both lines on it');
  {
    await set({ stripe_secret_key: 'sk_test_x', pay_provider: 'stripe', pay_mode: 'full' });
    const i = await info();
    ok('the page is told Stripe is live', i.payment.configured && i.payment.label === 'Stripe',
      JSON.stringify(i.payment));

    seen.stripe.length = 0;
    const r = await bookBoth({ staffId, haircut, beard: beardId });
    ok('the booking is made', r.status === 200, JSON.stringify(r.data).slice(0, 150));
    ok('and the customer is sent to a checkout', !!r.data.checkout_url, String(r.data.checkout_url));
    ok('exactly one checkout was created', seen.stripe.length === 1, String(seen.stripe.length));
    const chk = seen.stripe[0];
    ok('for the combined total, $65', chk.total === 6500, `${chk.total} cents`);
    ok('with a line for each service',
      chk.items.length === 2 && chk.items.some((x) => /Haircut/.test(x.name))
      && chk.items.some((x) => /Beard/.test(x.name)),
      JSON.stringify(chk.items));
  }

  console.log('\n── 3. Square: the same booking, the same one payment');
  {
    await set({ square_access_token: 'EAAA_test', square_location_id: 'L1', pay_provider: 'square' });
    const i = await info();
    ok('the page is told Square is live', i.payment.label === 'Square', JSON.stringify(i.payment));

    seen.square.length = 0;
    const r = await bookBoth({ staffId, haircut, beard: beardId });
    ok('the booking is made', r.status === 200);
    ok('and the customer is sent to Square', String(r.data.checkout_url).includes('square.test'),
      String(r.data.checkout_url));
    ok('one payment link, for $65', seen.square.length === 1 && seen.square[0].total === 6500,
      JSON.stringify(seen.square.map((x) => x.total)));
    ok('with both services itemised', seen.square[0].items.length === 2,
      JSON.stringify(seen.square[0].items));
    ok('charged against the salon\'s own location',
      seen.square[0].body.order.location_id === 'L1', seen.square[0].body.order.location_id);
  }

  console.log('\n── 4. "their choice": pay now, or pay in person');
  {
    await set({ pay_mode: 'choice' });
    seen.square.length = 0;
    const now = await bookBoth({ payChoice: 'now', staffId, haircut, beard: beardId });
    ok('choosing "pay now" opens a checkout', !!now.data.checkout_url, String(now.data.checkout_url));
    ok('for the whole basket', seen.square.length === 1 && seen.square[0].total === 6500,
      JSON.stringify(seen.square.map((x) => x.total)));

    seen.square.length = 0;
    const later = await bookBoth({ payChoice: 'in_person', staffId, haircut, beard: beardId });
    ok('choosing "pay in person" still books', later.status === 200 && later.data.appointment_id > 0,
      JSON.stringify(later.data).slice(0, 120));
    ok('and takes no payment at all', !later.data.checkout_url && seen.square.length === 0,
      `${seen.square.length} charges, url=${later.data.checkout_url}`);
    const appt = db.prepare('SELECT deposit_cents, deposit_status FROM appointments WHERE id = ?')
      .get(later.data.appointment_id);
    ok('with nothing marked owing online', appt.deposit_cents === 0 && appt.deposit_status === '',
      JSON.stringify(appt));
  }

  console.log('\n── 5. a payment is verified with the provider, never taken on trust');
  {
    await set({ pay_mode: 'full', pay_provider: 'square' });
    squarePaid = true;
    const r = await bookBoth({ staffId, haircut, beard: beardId });
    const apptId = r.data.appointment_id;
    const okRes = await json('POST', '/api/public/confirm-payment', {
      appointment_id: apptId, session_id: 'ord_1',
    });
    ok('a completed order confirms the booking', okRes.data.paid === true, JSON.stringify(okRes.data).slice(0, 120));
    ok('and it remembers which processor took it', okRes.data.provider === 'square', okRes.data.provider);

    // Somebody else's reference must not attach to this booking.
    const wrong = await json('POST', '/api/public/confirm-payment', {
      appointment_id: apptId, session_id: 'ord_SOMEBODY_ELSE',
    });
    ok('a reference this booking was never issued is refused', wrong.status === 400, String(wrong.status));

    // An unfinished order is not a payment.
    squarePaid = false;
    const r2 = await bookBoth({ staffId, haircut, beard: beardId });
    const unpaid = await json('POST', '/api/public/confirm-payment', {
      appointment_id: r2.data.appointment_id, session_id: 'ord_1',
    });
    ok('an abandoned checkout is not treated as paid', unpaid.data.paid === false,
      JSON.stringify(unpaid.data).slice(0, 120));
    squarePaid = true;
  }

  console.log('\n── 6. a payment failure never costs somebody their booking');
  {
    // Point Square at a port with nothing on it: every call fails.
    await set({ square_location_id: 'L1', pay_provider: 'square', pay_mode: 'full' });
    const saved = process.env.SQUARE_API_BASE;
    await new Promise((r) => squareMock.close(r));
    const r = await bookBoth({ staffId, haircut, beard: beardId });
    ok('the appointment still exists', r.status === 200 && r.data.appointment_id > 0,
      JSON.stringify(r.data).slice(0, 140));
    ok('the customer is simply not sent to a checkout', !r.data.checkout_url, String(r.data.checkout_url));
    ok('and the salon can see it in the diary',
      !!db.prepare('SELECT id FROM appointments WHERE id = ?').get(r.data.appointment_id));
    await new Promise((r2) => squareMock.listen(4952, r2));
    process.env.SQUARE_API_BASE = saved;
  }

  console.log('\n── 7. the keys are never handed back to a browser');
  {
    const s = (await json('GET', '/api/settings')).data;
    ok('the Square token is not readable', !s.square_access_token, String(s.square_access_token));
    ok('but the page can tell it is set', s.square_access_token_set === '1', String(s.square_access_token_set));
    const pub = await info();
    ok('and the public booking page never sees either key',
      !JSON.stringify(pub).includes('EAAA_test') && !JSON.stringify(pub).includes('sk_test_x'));
  }
} catch (err) {
  ok('the suite ran', false, err.stack || err.message);
} finally {
  srv.kill('SIGKILL');
  stripeMock.close(); squareMock.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
