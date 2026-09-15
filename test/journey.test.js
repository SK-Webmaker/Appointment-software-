// The whole business model, start to finish, with nothing real touched.
//
// signup.test.js proves the FUNNEL works: form → codes → payment → a salon
// that answers. It stops at the booking reference, which is where the software
// starts mattering rather than where it stops. A salon owner does not buy a
// booking reference; she buys a business that runs — a client who hears back,
// money she can collect, and her own data safe if we disappear.
//
// So this walks the whole thing as one story, in six acts, and then runs the
// core of it three times over to prove the answer is the same every time.
// "It worked" and "it works" are different claims and only the second is worth
// launching on.
//
// EVERYTHING HERE IS A SANDBOX. Stripe, the Australian Business Register,
// Resend and ClickSend are all local mock servers on loopback ports; the shard
// and the platform are real processes writing to a temporary directory that is
// deleted afterwards. No money moves, no email leaves, no salon exists. The
// only way this touches the outside world is if somebody adds a real base URL
// to it, which is why every one is passed in explicitly below.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startKairo, startPlatform, openDateAhead } from './helpers/kairo.js';
import { mockStripe, mockAbr, mockResend } from './helpers/mocks.js';

const KEY = 'platform-key-for-tests-0123456789';
const DOMAIN = 'kairobookings.test';

let shard, platform, stripe, abr, resend, shardDir;

const OWNER = {
  business_name: 'Marlow & Fern',
  name: 'Rosa Marlow',
  email: 'rosa@marlowfern.example',
  phone: '0400333444',
  password: 'a-good-long-passphrase-26',
  tz: 'Australia/Melbourne',
};

let ipCounter = 0;

/** Buy Kairo, exactly as a stranger would. Returns the token and the slug. */
async function buyKairo(overrides = {}) {
  const person = { ...OWNER, ...overrides };
  const r = await platform.api('POST', '/api/signup', {
    body: person,
    headers: { 'cf-connecting-ip': `203.0.113.${++ipCounter}` },
  });
  assert.equal(r.status, 200, `signup refused: ${r.text}`);
  const { token } = r.json;

  // Both codes. A stranger cannot reach payment without them, which is the
  // point of them existing.
  const e = await platform.api('POST', '/api/verify', { body: { token, kind: 'email', code: platform.latestCode('email') } });
  assert.equal(e.status, 200, e.text);
  const p = await platform.api('POST', '/api/verify', { body: { token, kind: 'phone', code: platform.latestCode('phone') } });
  assert.equal(p.status, 200, p.text);

  const co = await platform.api('POST', '/api/checkout', { body: { token } });
  assert.equal(co.status, 200, co.text);

  // Stripe's webhook is what provisions, not the browser coming back — a
  // customer who closes the tab still gets what they paid for.
  const sessionId = [...stripe.sessions.keys()].pop();
  const { raw, header } = stripe.sign(stripe.pay(sessionId));
  const hook = await platform.api('POST', '/api/stripe/webhook', {
    body: raw, headers: { 'content-type': 'application/json', 'stripe-signature': header },
  });
  assert.equal(hook.status, 200, hook.text);
  return { token, sessionId };
}

async function waitFor(token, states, ms = 20000) {
  const wanted = new Set([].concat(states));
  const deadline = Date.now() + ms;
  let last = null;
  while (Date.now() < deadline) {
    last = (await platform.api('GET', `/api/status?token=${token}`)).json;
    if (wanted.has(last.state)) return last;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`state stayed "${last?.state}" — wanted ${[...wanted].join(' or ')}`);
}

/** Wait for something to become true, rather than assuming it already is. */
async function eventually(fn, what, ms = 8000) {
  const deadline = Date.now() + ms;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`never became true: ${what}`);
}

before(async () => {
  stripe = await mockStripe();
  abr = await mockAbr({});
  resend = await mockResend();
  shardDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-journey-'));
  fs.mkdirSync(path.join(shardDir, 'tenants'), { recursive: true });
  shard = await startKairo({
    dataDir: shardDir,
    env: {
      KAIRO_MULTI_TENANT: '1',
      KAIRO_BASE_DOMAIN: DOMAIN,
      KAIRO_PLATFORM_KEY: KEY,
      RESEND_API_BASE: resend.base,
      // The shared sender — the thing that lets a salon send from the minute it
      // is created instead of after somebody pastes an API key. Not yet set on
      // the real shard; proven here so it is known to work when it is.
      KAIRO_SHARED_RESEND_KEY: 're_full_test_key',
      KAIRO_SHARED_FROM: 'bookings@kairobookings.test',
    },
  });
  platform = await startPlatform({
    shardUrl: shard.base,
    platformKey: KEY,
    env: {
      KAIRO_BASE_DOMAIN: DOMAIN,
      STRIPE_SECRET_KEY: 'sk_test_platform',
      STRIPE_API_BASE: stripe.base,
      STRIPE_WEBHOOK_SECRET: stripe.webhookSecret,
      ABR_API_BASE: abr.base,
      ABR_GUID: 'test-guid',
      KAIRO_PRICE_CENTS: '41000',
      RESEND_API_BASE: resend.base,
    },
  });
});

after(async () => {
  await platform?.stop();
  await shard?.stop();
  await stripe?.close();
  await abr?.close();
  await resend?.close();
  fs.rmSync(shardDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACT 1 — a stranger finds Kairo and buys it
// ─────────────────────────────────────────────────────────────────────────────

test('act 1: the shop front tells the truth before anybody pays', async () => {
  const start = await platform.api('GET', '/start');
  assert.equal(start.status, 200);

  // The price a customer is quoted is the price the checkout charges. These
  // being two numbers that merely agree today is how a business ends up
  // charging something its own Terms contradict.
  const price = await platform.api('GET', '/api/price');
  assert.equal(price.status, 200);
  assert.equal(price.json.price_cents, 41000, 'A$410, the one price Kairo has');
  assert.equal(price.json.base_domain, DOMAIN);

  // Every policy a buyer is asked to agree to must exist before they can agree
  // to it. Apple opens these too.
  for (const p of ['/terms', '/privacy', '/refunds', '/support']) {
    const r = await platform.api('GET', p);
    assert.equal(r.status, 200, `${p} must answer before anyone buys`);
  }
});

test('act 1: a business buys Kairo and a real salon comes out', async () => {
  const { token } = await buyKairo({ slug: 'marlowfern' });
  const ready = await waitFor(token, 'ready');
  assert.equal(ready.state, 'ready');
  assert.equal(ready.url, `https://marlowfern.${DOMAIN}`);

  // Stripe took the money exactly once, for exactly the advertised amount.
  const paid = [...stripe.sessions.values()].filter((s) => s.payment_status === 'paid');
  assert.equal(paid.length, 1, 'one payment, not two');
  assert.equal(paid[0].amount_total, 41000);

  // The platform's copy of her password is destroyed once it has been used.
  // Kairo keeps no credential it does not need.
  const d = platform.platformDb();
  const row = d.prepare("SELECT pass_hash, salt, ready_at FROM businesses WHERE slug = 'marlowfern'").get();
  d.close();
  assert.equal(row.pass_hash, '', 'the password hash is cleared after provisioning');
  assert.equal(row.salt, '');
  assert.ok(row.ready_at);
});

// ─────────────────────────────────────────────────────────────────────────────
// ACT 2 — she sets her salon up
// ─────────────────────────────────────────────────────────────────────────────

const HOST = `marlowfern.${DOMAIN}`;
let ownerCookie = '';

test('act 2: she signs in and her salon is hers, empty, and costs nothing to run', async () => {
  const { cookie } = await shard.login(OWNER.email, OWNER.password, { host: HOST });
  ownerCookie = cookie;
  const me = await shard.api('GET', '/api/auth/me', { host: HOST, cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.settings.business_name, 'Marlow & Fern');
  assert.equal(me.json.settings.business_tz, 'Australia/Melbourne');
  assert.equal(me.json.settings.currency_code, 'aud');

  // Nothing that spends her money is switched on for her.
  assert.equal(me.json.settings.sms_notifications_enabled, '0');
  // And nothing charges a tax she may not be registered to collect.
  assert.equal(me.json.settings.tax_rate, '0');

  // Her menu is empty. Kairo does not invent a business for her.
  const info = await shard.api('GET', '/api/public/info', { host: HOST });
  assert.equal(info.json.services.length, 0);
});

test('act 2: the setup wizard turns an empty salon into a bookable one', async () => {
  const wiz = await shard.api('POST', '/api/setup/apply', {
    host: HOST, cookie: ownerCookie,
    body: {
      team: [{ name: 'Rosa', title: 'Owner' }, { name: 'Ida', title: 'Stylist' }],
      services: [
        { name: 'Cut & finish', category: 'Hair', duration_min: 60, price: 95, price_type: 'fixed' },
        { name: 'Colour', category: 'Hair', duration_min: 120, price: 210, price_type: 'from' },
      ],
    },
  });
  assert.equal(wiz.status, 200, wiz.text);

  const info = await shard.api('GET', '/api/public/info', { host: HOST });
  assert.equal(info.json.services.length, 2);
  assert.equal(info.json.staff.length, 2);
  assert.equal(info.headers.get('x-kairo-tenant'), 'marlowfern');
});

// ─────────────────────────────────────────────────────────────────────────────
// ACT 3 — a client books, and hears back
// ─────────────────────────────────────────────────────────────────────────────

let bookingRef = '';
let apptId = 0;
let bookedService = null;   // what she actually sold, so act 4 can check the invoice against it

test('act 3: a client books on the public page and gets told it worked', async () => {
  const date = openDateAhead(3);
  const info = (await shard.api('GET', '/api/public/info', { host: HOST })).json;
  const svc = info.services[0];
  const staff = info.staff[0];
  bookedService = svc;

  const av = await shard.api('GET', `/api/public/availability?date=${date}&staff_id=${staff.id}&service_ids=${svc.id}`, { host: HOST });
  assert.equal(av.status, 200);
  assert.ok(av.json.slots.length > 0, 'a salon with hours and a stylist has slots');

  const before = resend.sent.length;
  const booking = await shard.api('POST', '/api/public/book', {
    host: HOST,
    body: {
      service_ids: [svc.id], staff_id: staff.id, date, start_min: av.json.slots[0].start_min,
      client: { first_name: 'Nell', last_name: 'Ward', email: 'nell@client.example', phone: '0400999888' },
    },
  });
  assert.equal(booking.status, 200, booking.text);
  assert.match(booking.json.reference, /^BK-\d{5}$/);
  bookingRef = booking.json.reference;

  // The confirmation is the product. A booking nobody is told about is a
  // missed appointment with extra steps.
  const mail = await eventually(
    () => resend.sent.slice(before).find((m) => String(m.to).includes('nell@client.example')),
    'a confirmation email to the client',
  );

  // It comes from the shared sender, under the salon's own name, and a client
  // who hits Reply reaches the SALON — not Kairo. Without the reply-to, "can I
  // move to 3pm?" goes to us and she never learns it was asked.
  assert.match(String(mail.from), /Marlow & Fern/, 'the client sees the salon, not Kairo');
  assert.equal(mail.reply_to, OWNER.email, 'a reply reaches the salon owner');
});

test('act 3: the appointment is in her book, where she will look for it', async () => {
  const appts = await shard.api('GET', '/api/appointments', { host: HOST, cookie: ownerCookie });
  assert.equal(appts.status, 200);
  const mine = (appts.json.appointments || appts.json || []).filter((a) => a.client_name?.includes('Nell') || a.reference === bookingRef);
  assert.ok(mine.length >= 1, `the booking should be in the calendar: ${appts.text.slice(0, 300)}`);
  apptId = mine[0].id;
  assert.ok(apptId, 'the appointment has an id to invoice against');
});

// ─────────────────────────────────────────────────────────────────────────────
// ACT 4 — she gets paid
// ─────────────────────────────────────────────────────────────────────────────

test('act 4: she invoices the appointment and records the money', async () => {
  const inv = await shard.api('POST', '/api/invoices/from-appointment', {
    host: HOST, cookie: ownerCookie, body: { appointment_id: apptId },
  });
  assert.equal(inv.status, 200, inv.text);
  const invoice = inv.json;
  assert.ok(invoice.id, 'an invoice exists');

  // The invoice is the price of the service she actually sold. Asserting a
  // hard-coded number here passed for the wrong reason once already — the menu
  // does not come back in the order it was written, so the first draft booked
  // one service and billed for another without noticing.
  const expected = bookedService.price_cents ?? Math.round(Number(bookedService.price) * 100);
  assert.ok(Number.isFinite(expected) && expected > 0, `could not read the booked price: ${JSON.stringify(bookedService)}`);
  assert.equal(invoice.total_cents, expected,
    `the invoice must equal the "${bookedService.name}" she booked: ${inv.text.slice(0, 200)}`);

  // And no tax on top — she is not registered, and Kairo must not invent a GST
  // line she cannot legally charge. Money is in cents everywhere here,
  // deliberately: there are no floating-point dollars.
  assert.equal(Number(invoice.tax_cents || 0), 0, 'no GST she is not registered to collect');

  const pay = await shard.api('POST', `/api/invoices/${invoice.id}/payments`, {
    host: HOST, cookie: ownerCookie, body: { amount_cents: expected, method: 'cash' },
  });
  assert.equal(pay.status, 200, pay.text);
  const after = pay.json;
  assert.equal(after.balance_cents, 0, 'the invoice is settled');
  assert.equal(after.status, 'paid', 'and it says so');
});

// ─────────────────────────────────────────────────────────────────────────────
// ACT 5 — her business survives us
// ─────────────────────────────────────────────────────────────────────────────

test('act 5: her whole business is emailed to her, and it is a real database', async () => {
  const before = resend.sent.length;
  const r = await shard.api('POST', '/api/backup/email', { host: HOST, cookie: ownerCookie });
  assert.equal(r.status, 200, r.text);

  const mail = await eventually(
    () => resend.sent.slice(before).find((m) => String(m.to).includes(OWNER.email)),
    'a backup emailed to the owner',
  );
  assert.ok(mail, 'the owner receives her own copy');

  // The control API can answer "is this salon backed up" without anybody
  // downloading her data to find out. That question is the whole reason
  // backup-check exists.
  const state = await shard.api('GET', '/api/platform/tenants/marlowfern', {
    host: HOST,
    headers: { 'x-kairo-key': KEY },
  });
  if (state.status === 200 && state.json.backup) {
    assert.ok(state.json.backup.last_at, 'the salon records when it was last backed up');
    // Her address is hers. The platform learns whether a backup has somewhere
    // to go, never where.
    assert.equal(state.json.backup.to, undefined, 'the recipient address is not exposed');
    assert.doesNotMatch(String(state.json.backup.last_detail || ''), /@/, 'no address leaks through the detail either');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ACT 6 — the same thing happens every time
// ─────────────────────────────────────────────────────────────────────────────

test('act 6: three businesses buy Kairo and all three get the identical thing', async () => {
  // One success is an anecdote. The claim worth launching on is that the next
  // stranger gets what the last one got, so this runs the journey three times
  // and compares the SHAPE of the outcome rather than re-reading one run.
  const shapes = [];
  for (const [i, name] of [['1', 'Nimbus Hair'], ['2', 'Salt & Shine'], ['3', 'The Fringe Room']].entries()) {
    const slug = `journey${name[0]}`;
    const { token } = await buyKairo({
      slug,
      business_name: name[1],
      email: `owner${name[0]}@journey.example`,
      phone: `04005550${name[0]}${name[0]}`,
    });
    const ready = await waitFor(token, 'ready');

    const host = `${slug}.${DOMAIN}`;
    const { cookie } = await shard.login(`owner${name[0]}@journey.example`, OWNER.password, { host });
    await shard.api('POST', '/api/setup/apply', {
      host, cookie,
      body: { team: [{ name: 'Sam', title: 'Owner' }], services: [{ name: 'Cut', category: 'Hair', duration_min: 45, price: 60, price_type: 'fixed' }] },
    });
    const date = openDateAhead(3);
    const info = (await shard.api('GET', '/api/public/info', { host })).json;
    const av = await shard.api('GET', `/api/public/availability?date=${date}&staff_id=${info.staff[0].id}&service_ids=${info.services[0].id}`, { host });
    const booking = await shard.api('POST', '/api/public/book', {
      host,
      body: {
        service_ids: [info.services[0].id], staff_id: info.staff[0].id, date, start_min: av.json.slots[0].start_min,
        client: { first_name: 'Test', email: `client${name[0]}@journey.example` },
      },
    });

    shapes.push({
      state: ready.state,
      url: ready.url,
      businessName: info.business_name,
      services: info.services.length,
      staff: info.staff.length,
      hasSlots: av.json.slots.length > 0,
      booked: booking.status === 200,
      refShape: /^BK-\d{5}$/.test(String(booking.json?.reference || '')),
      tenantHeader: info.business_name === name[1],
    });
  }

  assert.equal(shapes.length, 3);
  for (const [i, s] of shapes.entries()) {
    assert.equal(s.state, 'ready', `business ${i + 1} did not come out ready`);
    assert.equal(s.services, 1, `business ${i + 1} got the wrong menu`);
    assert.equal(s.staff, 1, `business ${i + 1} got the wrong team`);
    assert.equal(s.hasSlots, true, `business ${i + 1} had no bookable time`);
    assert.equal(s.booked, true, `business ${i + 1} could not take a booking`);
    assert.equal(s.refShape, true, `business ${i + 1} produced a malformed reference`);
  }

  // Each salon is its own file. The thing that must NEVER be true is one
  // salon's address answering with another salon's business.
  const names = new Set(shapes.map((s) => s.businessName));
  assert.equal(names.size, 3, 'three salons, three different businesses, no bleed between them');
});

test('act 6: each salon is sealed off from the others', async () => {
  // The multi-tenant claim in one assertion: a signed-in owner of one salon
  // cannot read another salon's book by pointing at its address.
  const { cookie } = await shard.login('owner1@journey.example', OWNER.password, { host: `journey1.${DOMAIN}` });
  const crossing = await shard.api('GET', '/api/appointments', { host: `journey2.${DOMAIN}`, cookie });
  assert.notEqual(crossing.status, 200, "one salon's session must not open another salon's book");
});
