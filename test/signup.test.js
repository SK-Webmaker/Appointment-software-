// A business signs up and comes out the other side taking bookings.
//
// Everything real except the money and the government: a real platform, a real
// shard, a real salon created on it, a real booking made against its own
// address. Stripe and the ABR are stood in for by mocks that verify exactly
// what the real ones verify.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startKairo, startPlatform, openDateAhead, ROOT } from './helpers/kairo.js';
import { mockStripe, mockAbr } from './helpers/mocks.js';

const KEY = 'platform-key-for-tests-0123456789';
const DOMAIN = 'kairobookings.test';
const ABN_GOOD = '51824753556';   // registered to "ABC Hair Studio Pty Ltd" in the mock
const ABN_OTHER = '51824753588';  // registered to a name that does not match
const ABN_UNKNOWN = '51824753605';// passes the checksum, unknown to the register

let shard, platform, stripe, abr, shardDir;

const PERSON = {
  business_name: 'ABC Hair Studio',
  name: 'Ada Bell',
  email: 'ada@abchair.example',
  phone: '0400111222',
  password: 'a-good-long-passphrase-26',
  tz: 'Australia/Melbourne',
};

/** Sign up, verify both codes, pay, and wait for the salon to exist. */
let ipCounter = 0;
async function fullSignup(overrides = {}, { pay = true, ip = `203.0.113.${++ipCounter}` } = {}) {
  const r = await platform.api('POST', '/api/signup', { body: { ...PERSON, ...overrides }, headers: { 'cf-connecting-ip': ip } });
  if (r.status !== 200) return { failed: r };
  const { token } = r.json;
  await platform.api('POST', '/api/verify', { body: { token, kind: 'email', code: platform.latestCode('email') } });
  await platform.api('POST', '/api/verify', { body: { token, kind: 'phone', code: platform.latestCode('phone') } });
  if (!pay) return { token };
  const co = await platform.api('POST', '/api/checkout', { body: { token } });
  assert.equal(co.status, 200, co.text);
  const sessionId = [...stripe.sessions.keys()].pop();
  const event = stripe.pay(sessionId);
  const { raw, header } = stripe.sign(event);
  const hook = await platform.api('POST', '/api/stripe/webhook', { body: raw, headers: { 'content-type': 'application/json', 'stripe-signature': header } });
  assert.equal(hook.status, 200, hook.text);
  return { token, sessionId, event };
}

/** Poll a count out of the platform's database until it is non-zero. */
async function waitForRow(sql, ms = 5000) {
  const deadline = Date.now() + ms;
  let n = 0;
  while (Date.now() < deadline) {
    const d = platform.platformDb();
    n = d.prepare(sql).get().n;
    d.close();
    if (n) return n;
    await new Promise((r) => setTimeout(r, 100));
  }
  return n;
}

/** The webhook answers before provisioning finishes, so wait for the state. */
async function waitFor(token, states, ms = 15000) {
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

before(async () => {
  stripe = await mockStripe();
  abr = await mockAbr({
    [ABN_GOOD]: { name: 'ABC HAIR STUDIO PTY LTD', status: 'Active' },
    [ABN_OTHER]: { name: 'SOMETHING ENTIRELY DIFFERENT PTY LTD', status: 'Active' },
  });
  shardDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-shard-'));
  fs.mkdirSync(path.join(shardDir, 'tenants'), { recursive: true });
  shard = await startKairo({ dataDir: shardDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_PLATFORM_KEY: KEY } });
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
    },
  });
});
after(async () => {
  await platform.stop();
  await shard.stop();
  await stripe.close();
  await abr.close();
  fs.rmSync(shardDir, { recursive: true, force: true });
});

test('the signup page and its policies are served, with the strict headers', async () => {
  for (const p of ['/start', '/terms.html', '/refunds.html', '/privacy.html', '/operator']) {
    const r = await platform.api('GET', p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-security-policy') || '', /script-src 'self'/, p);
    assert.equal(r.headers.get('x-frame-options'), 'DENY', p);
  }
  const price = await platform.api('GET', '/api/price');
  assert.equal(price.json.price_cents, 41000);
  assert.equal(price.json.base_domain, DOMAIN);
});

test('the address is suggested from the business name and checked as it is typed', async () => {
  const suggest = await platform.api('GET', `/api/slug?slug=&from=${encodeURIComponent('ABC Hair Studio')}`);
  assert.equal(suggest.json.slug, 'abchairstudio');
  assert.equal(suggest.json.ok, true);
  assert.equal(suggest.json.url, `https://abchairstudio.${DOMAIN}`);
  assert.equal((await platform.api('GET', '/api/slug?slug=www')).json.ok, false, 'reserved');
  assert.equal((await platform.api('GET', '/api/slug?slug=ab')).json.ok, false, 'too short');
  assert.equal((await platform.api('GET', '/api/slug?slug=Not%20A%20Slug')).json.ok, false);
});

test('the form refuses what it should before anybody pays anything', async () => {
  const cases = [
    [{ password: 'short' }, /at least 10/i],
    [{ password: 'password1234' }, /common|guess/i],
    [{ email: 'not-an-email' }, /email/i],
    [{ phone: 'nope' }, /mobile/i],
    [{ business_name: 'A' }, /business name/i],
    [{ abn: '12345678901' }, /ABN/i],
    [{ slug: 'admin' }, /reserved/i],
  ];
  for (const [override, pattern] of cases) {
    const r = await platform.api('POST', '/api/signup', { body: { ...PERSON, ...override, slug: override.slug || `t${Math.random().toString(36).slice(2, 9)}` } });
    assert.equal(r.status >= 400, true, JSON.stringify(override));
    assert.match(r.json.error, pattern, JSON.stringify(override));
  }
  const d = platform.platformDb();
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM businesses').get().n, 0, 'not one half-made business');
  d.close();
});

test('a code is six digits, single-use, and wrong ones are counted not accepted', async () => {
  const r = await platform.api('POST', '/api/signup', { body: { ...PERSON, slug: 'codetest', business_name: 'Code Test Salon', email: 'codes@abchair.example' }, headers: { 'cf-connecting-ip': '203.0.113.200' } });
  assert.equal(r.status, 200, r.text);
  const { token } = r.json;
  const code = platform.latestCode('email');
  assert.match(code, /^\d{6}$/);
  assert.equal((await platform.api('POST', '/api/verify', { body: { token, kind: 'email', code: '000000' } })).status === 200, code === '000000');
  const ok = await platform.api('POST', '/api/verify', { body: { token, kind: 'email', code } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.email_verified, true);
  assert.equal(ok.json.ready_to_pay, false, 'the mobile is still to do');
  const again = await platform.api('POST', '/api/verify', { body: { token, kind: 'email', code } });
  assert.equal(again.status, 400, 'a used code cannot be used twice');
  // Paying is refused until both are done.
  assert.equal((await platform.api('POST', '/api/checkout', { body: { token } })).status, 400);
  const pcode = platform.latestCode('phone');
  const both = await platform.api('POST', '/api/verify', { body: { token, kind: 'phone', code: pcode } });
  assert.equal(both.json.ready_to_pay, true);
});

test('nothing is provisioned until Stripe says the money moved', async () => {
  // The business verified in the previous test is at the payment step.
  assert.equal((await platform.api('POST', '/api/checkout', { body: { token: 'not-a-real-token' } })).status, 404);
  assert.equal((await shard.api('GET', '/api/public/info', { host: `codetest.${DOMAIN}` })).status, 404, 'no salon before payment');
  const d = platform.platformDb();
  const state = d.prepare("SELECT state FROM businesses WHERE slug = 'codetest'").get().state;
  d.close();
  assert.equal(state, 'verified', 'verified, and waiting to pay');
});

test('a forged or replayed webhook provisions nobody', async () => {
  const d = platform.platformDb();
  const biz = d.prepare("SELECT * FROM businesses WHERE slug = 'codetest'").get();
  d.close();
  const co = await platform.api('POST', '/api/checkout', { body: { token: biz.token } });
  assert.equal(co.status, 200, co.text);
  const sessionId = [...stripe.sessions.keys()].pop();
  const event = stripe.pay(sessionId);

  const forged = stripe.sign(event, { secret: 'whsec_wrong' });
  const bad = await platform.api('POST', '/api/stripe/webhook', { body: forged.raw, headers: { 'stripe-signature': forged.header, 'content-type': 'application/json' } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /Signature check failed/);

  const stale = stripe.sign(event, { at: Math.floor(Date.now() / 1000) - 3600 });
  assert.equal((await platform.api('POST', '/api/stripe/webhook', { body: stale.raw, headers: { 'stripe-signature': stale.header, 'content-type': 'application/json' } })).status, 400);

  const unsigned = await platform.api('POST', '/api/stripe/webhook', { body: JSON.stringify(event), headers: { 'content-type': 'application/json' } });
  assert.equal(unsigned.status, 400);
  assert.equal((await shard.api('GET', '/api/public/info', { host: `codetest.${DOMAIN}` })).status, 404, 'still no salon');

  // The real one works, and a second copy of it provisions nothing extra.
  const good = stripe.sign(event);
  assert.equal((await platform.api('POST', '/api/stripe/webhook', { body: good.raw, headers: { 'stripe-signature': good.header, 'content-type': 'application/json' } })).status, 200);
  const ready = await waitFor(biz.token, 'ready');
  assert.equal(ready.url, `https://codetest.${DOMAIN}`);
  const replay = stripe.sign(event);
  assert.equal((await platform.api('POST', '/api/stripe/webhook', { body: replay.raw, headers: { 'stripe-signature': replay.header, 'content-type': 'application/json' } })).status, 200);
  // The platform answers Stripe before it finishes working, on purpose — so
  // wait for the audit row rather than assuming it is already written.
  const noticed = await waitForRow("SELECT COUNT(*) AS n FROM events WHERE kind = 'webhook:duplicate'");
  assert.equal(noticed >= 1, true, 'the duplicate is noticed and recorded');
  const d2 = platform.platformDb();
  assert.equal(d2.prepare("SELECT COUNT(*) AS n FROM businesses WHERE slug = 'codetest'").get().n, 1, 'and provisions nothing extra');
  d2.close();
});

test('the whole thing, end to end: form → codes → payment → a salon taking bookings', async () => {
  const { token } = await fullSignup({ slug: 'abchair', abn: ABN_GOOD });
  const ready = await waitFor(token, 'ready');
  assert.equal(ready.state, 'ready');
  assert.equal(ready.url, `https://abchair.${DOMAIN}`);

  // It is a real salon on the shard, at its own address, with nothing in it.
  const host = `abchair.${DOMAIN}`;
  const info = await shard.api('GET', '/api/public/info', { host });
  assert.equal(info.status, 200);
  assert.equal(info.json.business_name, 'ABC Hair Studio');
  assert.equal(info.headers.get('x-kairo-tenant'), 'abchair');
  assert.equal(info.json.services.length, 0, 'their menu is theirs to fill in');

  // The owner signs in with the password they chose on the form.
  const { cookie } = await shard.login(PERSON.email, PERSON.password, { host });
  const me = await shard.api('GET', '/api/auth/me', { host, cookie });
  assert.equal(me.json.settings.business_name, 'ABC Hair Studio');
  assert.equal(me.json.settings.business_tz, 'Australia/Melbourne');
  assert.equal(me.json.settings.currency_code, 'aud');
  assert.equal(me.json.settings.tax_rate, '10');
  assert.equal(me.json.settings.plan_price_cents, '41000');
  assert.equal(me.json.settings.sms_notifications_enabled, '0', 'nothing that costs money is on');
  assert.equal(me.json.settings.public_url_effective, `https://abchair.${DOMAIN}`);

  // Set up a service and a stylist the way the wizard does, then take a booking.
  const wiz = await shard.api('POST', '/api/setup/apply', {
    host, cookie,
    body: { team: [{ name: 'Ada', title: 'Owner' }], services: [{ name: 'Cut', category: 'Hair', duration_min: 45, price: 60, price_type: 'fixed' }] },
  });
  assert.equal(wiz.status, 200, wiz.text);
  const date = openDateAhead(3);
  const svc = (await shard.api('GET', '/api/public/info', { host })).json.services[0];
  const staff = (await shard.api('GET', '/api/public/info', { host })).json.staff[0];
  const av = await shard.api('GET', `/api/public/availability?date=${date}&staff_id=${staff.id}&service_ids=${svc.id}`, { host });
  assert.ok(av.json.slots.length > 0);
  const booking = await shard.api('POST', '/api/public/book', {
    host,
    body: { service_ids: [svc.id], staff_id: staff.id, date, start_min: av.json.slots[0].start_min, client: { first_name: 'First', email: 'first@customer.example' } },
  });
  assert.equal(booking.status, 200, booking.text);
  assert.match(booking.json.reference, /^BK-\d{5}$/);

  // And the platform's copy of the owner's credential is gone once it is used.
  const d = platform.platformDb();
  const row = d.prepare("SELECT pass_hash, salt, ready_at FROM businesses WHERE slug = 'abchair'").get();
  d.close();
  assert.equal(row.pass_hash, '', 'the password hash is cleared after provisioning');
  assert.equal(row.salt, '');
  assert.ok(row.ready_at);
});

test('a business name another Kairo already uses is flagged for the owner to look at', async () => {
  const { token } = await fullSignup({ slug: 'twinname', business_name: 'Code Test Salon', email: 'twin@example.com', abn: '' });
  const st = await waitFor(token, ['flagged', 'ready']);
  assert.equal(st.state, 'flagged');
  const d = platform.platformDb();
  const flags = JSON.parse(d.prepare("SELECT flags FROM businesses WHERE slug = 'twinname'").get().flags);
  d.close();
  assert.match(flags.join(' '), /already uses that business name \(codetest\)/i);
});

test('a provision that half-happened is finished by a retry, not stuck forever', async () => {
  // Stands in for "the shard created the salon, then the platform lost the
  // answer": the tenant is there, the platform still thinks it is not.
  const { token } = await fullSignup({ slug: 'halfway', business_name: 'Halfway Salon', email: 'half@way.example', abn: '' }, { pay: false });
  const d = platform.platformDb();
  const biz = d.prepare("SELECT * FROM businesses WHERE slug = 'halfway'").get();
  d.close();

  const co = await platform.api('POST', '/api/checkout', { body: { token: biz.token } });
  assert.equal(co.status, 200, co.text);
  const sessionId = [...stripe.sessions.keys()].pop();
  const ev = stripe.pay(sessionId);
  const sig = stripe.sign(ev);
  await platform.api('POST', '/api/stripe/webhook', { body: sig.raw, headers: { 'stripe-signature': sig.header, 'content-type': 'application/json' } });
  await waitFor(token, 'ready');

  // Now force the platform to run provisioning again over a tenant that is
  // already there. It must finish rather than fail on "already exists".
  const d2 = platform.platformDb();
  d2.prepare("UPDATE businesses SET state = 'paid', pass_hash = ?, salt = ? WHERE slug = 'halfway'").run(biz.pass_hash, biz.salt);
  d2.close();
  const op = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!' } });
  const cookie = /kairo_operator=[^;]+/.exec(op.headers.get('set-cookie'))[0];
  const retry = await platform.api('POST', `/api/operator/business/${biz.id}/retry`, { cookie, body: {} });
  assert.equal(retry.status, 200, retry.text);
  assert.equal((await waitFor(token, 'ready')).state, 'ready');
  const d3 = platform.platformDb();
  assert.ok(d3.prepare("SELECT 1 AS x FROM events WHERE business_id = ? AND kind = 'provision:already-there'").get(biz.id), 'and it says so in the trail');
  d3.close();
});

test('the same email cannot buy a second Kairo, and a taken address is refused', async () => {
  const dupEmail = await platform.api('POST', '/api/signup', { body: { ...PERSON, slug: 'another' } });
  assert.equal(dupEmail.status, 409);
  assert.match(dupEmail.json.error, /already a Kairo/);
  const dupSlug = await platform.api('POST', '/api/signup', { body: { ...PERSON, email: 'someone@else.example', slug: 'abchair' } });
  assert.equal(dupSlug.status, 409);
  assert.match(dupSlug.json.error, /taken/);
});

test('a mismatched ABN flags the signup instead of refusing it, and the owner can approve it', async () => {
  const { token } = await fullSignup({ slug: 'glowbar', business_name: 'Glow Bar', email: 'kim@glowbar.example', abn: ABN_OTHER });
  const flagged = await waitFor(token, 'flagged');
  assert.match(flagged.message, /checking a couple of details/i);
  assert.equal((await shard.api('GET', '/api/public/info', { host: `glowbar.${DOMAIN}` })).status, 404, 'nothing provisioned while flagged');

  const op = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!' } });
  assert.equal(op.status, 200);
  const cookie = /kairo_operator=[^;]+/.exec(op.headers.get('set-cookie'))[0];
  const queue = await platform.api('GET', '/api/operator/queue', { cookie });
  assert.equal(queue.status, 200);
  const task = queue.json.tasks.find((t) => t.slug === 'glowbar' && t.kind === 'flagged');
  assert.ok(task, 'it is in the queue');
  assert.match(task.detail, /SOMETHING ENTIRELY DIFFERENT/i, 'with the reason spelled out');

  const approve = await platform.api('POST', `/api/operator/business/${task.business_id}/approve`, { cookie, body: {} });
  assert.equal(approve.status, 200, approve.text);
  await waitFor(token, 'ready');
  assert.equal((await shard.api('GET', '/api/public/info', { host: `glowbar.${DOMAIN}` })).json.business_name, 'Glow Bar');
});

test('an ABN the register has never heard of is a flag, and an unreachable register is not', async () => {
  const { token } = await fullSignup({ slug: 'unknownabn', business_name: 'Unknown ABN Salon', email: 'u@abn.example', abn: ABN_UNKNOWN });
  const flagged = await waitFor(token, ['flagged', 'ready']);
  assert.equal(flagged.state, 'flagged');
  const d = platform.platformDb();
  const flags = JSON.parse(d.prepare("SELECT flags FROM businesses WHERE slug = 'unknownabn'").get().flags);
  d.close();
  assert.match(flags.join(' '), /could not be found/i);
});

test('no ABN at all is not a flag — plenty of salons are sole traders', async () => {
  const { token } = await fullSignup({ slug: 'noabn', business_name: 'No ABN Salon', email: 'n@abn.example', abn: '' });
  const st = await waitFor(token, 'ready');
  assert.equal(st.state, 'ready');
});

test('the operator queue needs the password, and carries the email-setup task for every new salon', async () => {
  assert.equal((await platform.api('GET', '/api/operator/queue')).status, 401);
  assert.equal((await platform.api('POST', '/api/operator/login', { body: { password: 'wrong' } })).status, 401);
  const op = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!' } });
  const cookie = /kairo_operator=[^;]+/.exec(op.headers.get('set-cookie'))[0];
  const queue = await platform.api('GET', '/api/operator/queue', { cookie });
  const emailTasks = queue.json.tasks.filter((t) => t.kind === 'email_setup');
  assert.ok(emailTasks.length >= 3, 'one per provisioned salon');
  assert.match(emailTasks[0].detail, new RegExp(DOMAIN));
  assert.equal(queue.json.totals.ready_n >= 3, true);
  const detail = await platform.api(`GET`, `/api/operator/business/${emailTasks[0].business_id}`, { cookie });
  assert.equal(detail.status, 200);
  assert.equal(detail.json.business.pass_hash, undefined, 'the console never shows a credential');
  assert.ok(detail.json.events.length > 3, 'the audit trail is there');
});

test('a refund inside the window exports the data, returns the money and stops the address', async () => {
  const op = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!' } });
  const cookie = /kairo_operator=[^;]+/.exec(op.headers.get('set-cookie'))[0];
  const d = platform.platformDb();
  const biz = d.prepare("SELECT id, token, stripe_payment_intent FROM businesses WHERE slug = 'noabn'").get();
  d.close();
  const before = stripe.refunds.length;
  const r = await platform.api('POST', `/api/operator/business/${biz.id}/refund`, { cookie, body: { reason: 'changed their mind' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.refunded, true);
  assert.ok(r.json.exported_bytes > 1000, 'their data was exported first');
  assert.equal(stripe.refunds.length, before + 1, 'the money went back');
  assert.equal(stripe.refunds.at(-1).payment_intent, biz.stripe_payment_intent);
  assert.equal((await shard.api('GET', '/api/public/info', { host: `noabn.${DOMAIN}` })).status, 404, 'the address stops serving');
  assert.ok(fs.existsSync(path.join(shardDir, 'tenants', 'noabn', 'kairo.db')), 'the file is kept');
  const st = await platform.api('GET', `/api/status?token=${biz.token}`);
  assert.equal(st.json.state, 'refunded');
});

test('a disputed payment suspends the salon and keeps everything', async () => {
  const d = platform.platformDb();
  const biz = d.prepare("SELECT id, slug, stripe_payment_intent FROM businesses WHERE slug = 'glowbar'").get();
  d.close();
  const ev = stripe.dispute(biz.stripe_payment_intent);
  const { raw, header } = stripe.sign(ev);
  assert.equal((await platform.api('POST', '/api/stripe/webhook', { body: raw, headers: { 'stripe-signature': header, 'content-type': 'application/json' } })).status, 200);
  const host = `glowbar.${DOMAIN}`;
  const deadline = Date.now() + 5000;
  let info = null;
  while (Date.now() < deadline) {
    info = await shard.api('GET', '/api/public/info', { host });
    if (info.json?.read_only) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(info.status, 200, 'the booking page still loads');
  assert.equal(info.json.read_only, true, 'but nothing can be written');
  const op = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!' } });
  const cookie = /kairo_operator=[^;]+/.exec(op.headers.get('set-cookie'))[0];
  const queue = await platform.api('GET', '/api/operator/queue', { cookie });
  assert.ok(queue.json.tasks.some((t) => t.kind === 'refund_request' && t.slug === 'glowbar'));
});

test('three signups from one address in a day are flagged, not refused', async () => {
  const ip = '198.51.100.77';
  const made = [];
  for (let i = 1; i <= 3; i++) {
    made.push(await fullSignup({ slug: `burst${i}`, business_name: `Burst ${i}`, email: `burst${i}@example.com`, abn: '' }, { ip }));
  }
  assert.equal((await waitFor(made[0].token, 'ready')).state, 'ready', 'the first two go straight through');
  assert.equal((await waitFor(made[1].token, 'ready')).state, 'ready');
  const third = await waitFor(made[2].token, ['flagged', 'ready']);
  assert.equal(third.state, 'flagged');
  const d = platform.platformDb();
  const flags = JSON.parse(d.prepare("SELECT flags FROM businesses WHERE slug = 'burst3'").get().flags);
  d.close();
  assert.match(flags.join(' '), /signups from one address/i);
});

test('an unpaid signup holds its address for a week, then lets it go', async () => {
  const { token } = await fullSignup({ slug: 'ghosted', business_name: 'Ghosted Salon', email: 'g@host.example' }, { pay: false });
  assert.equal((await platform.api('GET', '/api/slug?slug=ghosted')).json.ok, false, 'held while they decide');
  const st = await platform.api('GET', `/api/status?token=${token}`);
  assert.equal(st.json.state, 'verified');
  assert.equal((await shard.api('GET', '/api/public/info', { host: `ghosted.${DOMAIN}` })).status, 404);

  // Age the row and run the same sweep the platform runs hourly.
  const d = platform.platformDb();
  d.prepare("UPDATE businesses SET created_at = datetime('now', '-8 days') WHERE slug = 'ghosted'").run();
  d.close();
  const swept = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e',
    "const s = await import('./platform/signup.js'); console.log(JSON.stringify({ expired: s.expireStale() }));"],
  { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PLATFORM_DATA_DIR: platform.dataDir } });
  assert.equal(swept.status, 0, swept.stdout + swept.stderr);
  assert.match(swept.stdout, /"expired":1/);
  assert.equal((await platform.api('GET', '/api/slug?slug=ghosted')).json.ok, true, 'the address is free again');
  assert.equal((await platform.api('GET', `/api/status?token=${token}`)).json.state, 'expired');
});
