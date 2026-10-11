// What a client sees when they pay, and what they get afterwards.
//
//   - The salon's checkout carries the salon's branding, and taking the booking
//     never depends on Stripe accepting it.
//   - Receipts read like receipts: itemised, numbered, dated, with GST and the
//     ABN when the salon has them.
//   - Kairo's own checkout and receipt carry Kairo's.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startKairo } from './helpers/kairo.js';

// ── a Stripe that writes down exactly what it was asked ─────────────────────
const asked = [];
let refuseBranding = false;
const stripe = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const params = new URLSearchParams(raw);
    asked.push({ method: req.method, url: req.url, params, version: req.headers['stripe-version'] || '', idem: req.headers['idempotency-key'] || '' });
    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
      if (refuseBranding && [...params.keys()].some((k) => k.startsWith('branding_settings'))) {
        return send(400, { error: { type: 'invalid_request_error', param: 'branding_settings[icon][url]', message: 'Invalid image URL' } });
      }
      return send(200, { id: `cs_${asked.length}`, url: `https://checkout.stripe.test/cs_${asked.length}` });
    }
    if (req.method === 'GET' && req.url.startsWith('/v1/checkout/sessions/')) {
      return send(200, { id: 'cs_x', payment_status: 'paid', amount_total: 5000, payment_intent: 'pi_x', metadata: {} });
    }
    if (req.method === 'GET' && req.url.startsWith('/v1/payment_intents/pi_card')) {
      return send(200, {
        id: 'pi_card', amount: 41000, amount_received: 41000,
        latest_charge: { receipt_url: 'https://pay.stripe.test/receipts/abc', payment_method_details: { card: { brand: 'visa', last4: '4242', wallet: { type: 'apple_pay' } } } },
      });
    }
    return send(404, { error: { message: 'not mocked' } });
  });
});

let k; let cookie;
const api = (m, p, body) => k.api(m, p, { cookie, body });
const set = (body) => api('PUT', '/api/settings', body);
const sessionsAsked = () => asked.filter((a) => a.method === 'POST' && a.url === '/v1/checkout/sessions');
let staffId, colourId, blowId, nextDay = 5;
const PNG = `data:image/png;base64,${Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a00000000049454e44ae426082', 'hex').toString('base64')}`;

async function book(extra = {}) {
  const d = new Date();
  d.setDate(d.getDate() + (nextDay += 1));
  return k.api('POST', '/api/public/book', {
    body: {
      service_ids: [colourId], staff_id: staffId, date: d.toISOString().slice(0, 10), start_min: 600,
      client: { first_name: 'Amara', last_name: 'Osei', email: 'amara@example.org', phone: '0400111222' },
      origin: 'https://luxe.example', ...extra,
    },
  });
}

before(async () => {
  await new Promise((r) => stripe.listen(0, '127.0.0.1', r));
  k = await startKairo({ env: { STRIPE_API_BASE: `http://127.0.0.1:${stripe.address().port}` } });
  ({ cookie } = await k.login());
  await api('POST', '/api/setup/skip');
  await set({
    business_name: 'Luxe Hair', brand_accent: '#7c5cbf', brand_scheme: 'cream', currency_code: 'aud', currency: '$',
    open_days: '0,1,2,3,4,5,6', open_min: '480', close_min: '1200', booking_enabled: '1', booking_lead_min: '0',
    booking_horizon_days: '120', stripe_secret_key: 'sk_test_x', pay_provider: 'stripe', pay_mode: 'deposit',
    deposit_type: 'fixed', deposit_value: '50',
  });
  staffId = (await api('POST', '/api/staff', { name: 'Maya' })).json.id;
  colourId = (await api('POST', '/api/services', { name: 'Full Colour', duration_min: 120, price: 165, price_type: 'fixed' })).json.id;
  blowId = (await api('POST', '/api/services', { name: 'Blow Dry', duration_min: 45, price: 55, price_type: 'fixed' })).json.id;
});
after(async () => { await k?.stop(); stripe.close(); });

test('the deposit checkout is in the salon\'s branding, and says what the deposit does', async () => {
  asked.length = 0;
  const r = await book();
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.checkout_url, 'sent to a checkout');
  const [s] = sessionsAsked();
  const p = s.params;
  assert.equal(p.get('branding_settings[display_name]'), 'Luxe Hair');
  assert.equal(p.get('branding_settings[button_color]'), '#7c5cbf');
  assert.equal(p.get('branding_settings[background_color]'), '#faf6ef', 'the booking page\'s own background (Cream)');
  assert.equal(p.get('branding_settings[font_family]'), 'inter');
  assert.equal(s.version, '2025-09-30.clover', 'the API version that knows about per-checkout branding');
  assert.equal(p.get('submit_type'), 'book');
  assert.match(p.get('custom_text[submit][message]'), /\$50\.00 deposit holds Full Colour on \w+day, \w+ \d+ at 10:00 AM\. It comes off your total on the day\./);
  assert.match(p.get('payment_intent_data[description]'), /^Deposit · Full Colour · /);
  // No public https address, so no logo for Stripe to fetch.
  assert.equal(p.get('branding_settings[icon][type]'), null);
});

test('the logo goes to Stripe only from a public https address, and only as a picture Stripe can show', async () => {
  await set({ public_url: 'https://luxe.kairobookings.test', brand_logo: PNG });
  asked.length = 0;
  await book();
  let p = sessionsAsked()[0].params;
  assert.equal(p.get('branding_settings[icon][type]'), 'url');
  assert.equal(p.get('branding_settings[icon][url]'), 'https://luxe.kairobookings.test/api/public/logo');

  await set({ brand_logo: 'data:image/svg+xml;base64,PHN2Zy8+' });
  asked.length = 0;
  await book();
  p = sessionsAsked()[0].params;
  assert.equal(p.get('branding_settings[icon][type]'), null, 'an SVG stays on the booking page');
  await set({ public_url: '', brand_logo: '' });
});

test('if Stripe turns the branding away, the booking still gets its checkout — plain', async () => {
  refuseBranding = true;
  try {
    asked.length = 0;
    const r = await book();
    assert.equal(r.status, 200, r.text);
    assert.ok(r.json.checkout_url, 'a payment page all the same');
    const [first, second] = sessionsAsked();
    assert.ok([...first.params.keys()].some((x) => x.startsWith('branding_settings')));
    assert.ok(second, 'asked again');
    assert.ok(![...second.params.keys()].some((x) => x.startsWith('branding_settings')), 'the second time without branding');
    assert.equal(second.version, '', 'and on the account\'s own API version');
    assert.equal(second.params.get('submit_type'), 'book', 'the wording still goes');
  } finally { refuseBranding = false; }
});

test('a paid-in-full booking lists every service and confirms the time', async () => {
  await set({ pay_mode: 'full' });
  asked.length = 0;
  const r = await book({ service_ids: [colourId, blowId] });
  assert.equal(r.status, 200, r.text);
  const p = sessionsAsked()[0].params;
  assert.equal(p.get('line_items[0][price_data][product_data][name]'), 'Full Colour');
  assert.equal(p.get('line_items[1][price_data][product_data][name]'), 'Blow Dry');
  assert.match(p.get('custom_text[submit][message]'), /^Paying now confirms Full Colour \+ Blow Dry on .+ with Luxe Hair\.$/);
  assert.equal(p.get('branding_settings[display_name]'), 'Luxe Hair');
  // Checking the payment afterwards keeps the account's own API version.
  asked.length = 0;
  await k.api('POST', '/api/public/confirm-payment', { body: { appointment_id: r.json.appointment_id, session_id: 'cs_1' } }).catch(() => {});
  for (const a of asked.filter((x) => x.method === 'GET')) assert.equal(a.version, '');
  await set({ pay_mode: 'deposit' });
});

test('a receipt is itemised: number, date, lines, GST, total, what was paid — and the ABN', async () => {
  await set({ business_abn: '12345678901', tax_rate: '10' });
  assert.equal((await api('GET', '/api/settings')).json.business_abn, '12 345 678 901', 'tidied the way the ATO writes it');
  const client = (await api('POST', '/api/clients', { first_name: 'Nell', last_name: 'Park', email: 'nell@example.org' })).json;
  const inv = (await api('POST', '/api/invoices', {
    client_id: client.id, tax_rate: 10,
    items: [{ description: 'Full Colour', qty: 1, unit_cents: 16500 }, { description: 'Olaplex No.3', qty: 2, unit_cents: 4200 }],
  })).json;
  assert.ok(inv.id, JSON.stringify(inv));
  const total = inv.total_cents;
  const r = await api('POST', `/api/invoices/${inv.id}/payments`, { amount_cents: total, method: 'card' });
  assert.equal(r.status, 200, r.text);
  const msg = k.db().prepare("SELECT subject, html FROM messages WHERE kind = 'receipt' AND to_addr = 'nell@example.org' ORDER BY id DESC").get();
  assert.ok(msg, 'a receipt was queued');
  assert.match(msg.subject, new RegExp(`^Tax invoice ${inv.number}: \\$${(total / 100).toFixed(2)} paid · Luxe Hair$`));
  for (const want of ['Tax invoice', inv.number, 'Billed to', 'Nell Park', 'ABN 12 345 678 901', 'Full Colour', 'Olaplex No.3', '2 × $42.00',
    'Includes GST (10%)', '$22.64', `$${(total / 100).toFixed(2)}`, 'Paid in full']) {
    assert.ok(msg.html.includes(want), `the receipt shows ${want}`);
  }
  assert.equal(total, 16500 + 8400, 'the prices already include the GST; nothing is added to them');
});

test('without an ABN it is a receipt, not a tax invoice', async () => {
  await set({ business_abn: '' });
  const client = (await api('POST', '/api/clients', { first_name: 'Ivy', last_name: 'Tran', email: 'ivy@example.org' })).json;
  const inv = (await api('POST', '/api/invoices', { client_id: client.id, tax_rate: 10, items: [{ description: 'Cut', qty: 1, unit_cents: 6000 }] })).json;
  await api('POST', `/api/invoices/${inv.id}/payments`, { amount_cents: 2000, method: 'cash' });
  const msg = k.db().prepare("SELECT subject, html FROM messages WHERE kind = 'receipt' AND to_addr = 'ivy@example.org' ORDER BY id DESC").get();
  assert.match(msg.subject, /^Receipt /);
  assert.ok(!msg.html.includes('Tax invoice'));
  assert.ok(msg.html.includes('Paid · Cash'));
  assert.ok(msg.html.includes('Still to pay'), 'and what is left');
});

test('the page after paying at the counter is in the salon\'s colours', async () => {
  const b = (await k.api('GET', '/api/public/brand')).json;
  assert.equal(b.business_name, 'Luxe Hair');
  assert.equal(b.accent, '#7c5cbf');
  assert.equal(b.scheme, 'cream');
  assert.equal(typeof b.logo, 'boolean', 'whether there is a logo, never the logo itself');
});

// ── Kairo's own ─────────────────────────────────────────────────────────────

test('Kairo\'s own checkout is Kairo\'s, with the refund promise beside the button', async () => {
  process.env.STRIPE_API_BASE = `http://127.0.0.1:${stripe.address().port}`;
  process.env.STRIPE_SECRET_KEY = 'sk_test_platform';
  const ps = await import('../platform/stripe.js');
  asked.length = 0;
  const s = await ps.createCheckout({ businessId: 7, slug: 'luxe', name: 'Luxe Hair', email: 'mia@luxe.example', priceCents: 41000, origin: 'https://start.kairobookings.test' });
  assert.ok(s.url);
  const p = sessionsAsked()[0].params;
  assert.equal(p.get('branding_settings[display_name]'), 'Kairo');
  assert.equal(p.get('branding_settings[icon][url]'), 'https://start.kairobookings.test/icons/kairo-512.png');
  assert.match(p.get('custom_text[submit][message]'), /One payment for Luxe Hair\. No monthly fee, no commission — and a full refund within 14 days/);
  assert.equal(sessionsAsked()[0].version, '2025-09-30.clover');

  refuseBranding = true;
  try {
    asked.length = 0;
    const plain = await ps.createCheckout({ businessId: 8, slug: 'b', name: 'B', email: 'b@b.example', priceCents: 41000, origin: 'https://start.kairobookings.test' });
    assert.ok(plain.url, 'still a checkout');
    assert.equal(sessionsAsked()[1].idem, 'kairo-signup-8-plain', 'under its own idempotency key');
  } finally { refuseBranding = false; }

  const card = await ps.paymentDetails('pi_card');
  assert.deepEqual([card.brand, card.last4, card.wallet, card.receipt_url], ['visa', '4242', 'Apple Pay', 'https://pay.stripe.test/receipts/abc']);
});

test('the owner gets a receipt for Kairo they can hand their accountant', async () => {
  const sent = [];
  const resend = http.createServer((req, res) => {
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => { sent.push(JSON.parse(raw)); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"id":"em_1"}'); });
  });
  await new Promise((r) => resend.listen(0, '127.0.0.1', r));
  Object.assign(process.env, { RESEND_API_KEY: 're_test', PLATFORM_FROM_EMAIL: 'hello@kairobookings.test', RESEND_API_BASE: `http://127.0.0.1:${resend.address().port}` });
  try {
    const { emailReceipt } = await import('../platform/notify.js');
    delete process.env.PLATFORM_ABN; delete process.env.PLATFORM_GST;
    let r = await emailReceipt('mia@luxe.example', {
      receiptNo: 'KRO-00007', ownerName: 'Mia Chen', businessName: 'Luxe Hair', amountCents: 41000,
      card: { brand: 'visa', last4: '4242', wallet: 'Apple Pay' }, receiptUrl: 'https://pay.stripe.test/receipts/abc',
    });
    assert.equal(r.ok, true, r.detail);
    let m = sent.at(-1);
    assert.equal(m.subject, 'Receipt KRO-00007 — Kairo for Luxe Hair');
    const { SELLER } = await import('../platform/seller.js');
    for (const want of ['KRO-00007', 'A$410.00', 'Apple Pay · Visa ending 4242', 'Paid in full', '14 days', 'Mia Chen', 'pay.stripe.test/receipts/abc', '/icons/kairo-180.png', `sold by ${SELLER}`]) {
      assert.ok(m.html.includes(want), `shows ${want}`);
    }
    assert.ok(!m.html.includes('GST'), 'no GST claimed unless the seller says so');

    Object.assign(process.env, { PLATFORM_ABN: '98 765 432 109', PLATFORM_GST: '1' });
    r = await emailReceipt('mia@luxe.example', { receiptNo: 'KRO-00007', ownerName: 'Mia Chen', businessName: 'Luxe Hair', amountCents: 41000 });
    m = sent.at(-1);
    assert.match(m.subject, /^Tax invoice KRO-00007/);
    assert.ok(m.html.includes('ABN 98 765 432 109'));
    assert.ok(m.html.includes('Includes GST') && m.html.includes('A$37.27'), 'one eleventh of the price');
  } finally {
    delete process.env.PLATFORM_ABN; delete process.env.PLATFORM_GST;
    resend.close();
  }
});
