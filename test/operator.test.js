// The operator's dashboard: the numbers it shows are the platform's own
// records, it is closed without the password, and its actions do what they say.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startKairo, startPlatform } from './helpers/kairo.js';
import { mockStripe, mockAbr, mockResend } from './helpers/mocks.js';

const KEY = 'platform-key-for-tests-0123456789';
const DOMAIN = 'kairobookings.test';
let shard, platform, stripe, abr, resend, cookie;

before(async () => {
  stripe = await mockStripe();
  abr = await mockAbr({});
  resend = await mockResend();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-op-'));
  fs.mkdirSync(path.join(dir, 'tenants'), { recursive: true });
  shard = await startKairo({
    dataDir: dir,
    env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_PLATFORM_KEY: KEY, KAIRO_SHARED_RESEND_KEY: resend.fullKey, KAIRO_SHARED_FROM: 'b@kairobookings.test', RESEND_API_BASE: resend.base },
  });
  platform = await startPlatform({
    shardUrl: shard.base, platformKey: KEY,
    env: {
      KAIRO_BASE_DOMAIN: DOMAIN, STRIPE_API_BASE: stripe.base, STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: stripe.webhookSecret,
      ABR_API_BASE: abr.base, ABR_GUID: 'g', RESEND_API_KEY: resend.fullKey, PLATFORM_FROM_EMAIL: 'hello@kairobookings.test', RESEND_API_BASE: resend.base,
    },
  });
});
after(async () => {
  await platform?.stop(); await shard?.stop();
  await stripe?.close(); await abr?.close(); await resend?.close();
});

let ip = 0;
async function signup(slug, { pay = true } = {}) {
  const r = await platform.api('POST', '/api/signup', {
    body: { business_name: `${slug} studio`, slug, name: 'Ada Bell', email: `${slug}@salon.example`, phone: '0400111222', password: 'a-good-long-passphrase-26' },
    headers: { 'cf-connecting-ip': `203.0.113.${++ip}` },
  });
  assert.equal(r.status, 200, r.text);
  const { token } = r.json;
  await platform.api('POST', '/api/verify', { body: { token, kind: 'email', code: platform.latestCode('email') } });
  if (!pay) return token;
  await platform.api('POST', '/api/checkout', { body: { token } });
  const sig = stripe.sign(stripe.pay([...stripe.sessions.keys()].pop()));
  await platform.api('POST', '/api/stripe/webhook', { body: sig.raw, headers: { 'stripe-signature': sig.header, 'content-type': 'application/json' } });
  for (let i = 0; i < 75; i++) {
    if ((await platform.api('GET', `/api/status?token=${token}`)).json.state === 'ready') return token;
    await new Promise((r2) => setTimeout(r2, 200));
  }
  throw new Error('never became ready');
}

test('the dashboard is closed without the password', async () => {
  assert.equal((await platform.api('GET', '/api/operator/overview')).status, 401);
  const wrong = await platform.api('POST', '/api/operator/login', { body: { password: 'nope' } });
  assert.equal(wrong.status, 401);
  const ok = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!', remember: true } });
  assert.equal(ok.status, 200);
  const set = ok.headers.get('set-cookie');
  assert.match(set, /Max-Age=2592000/, '"keep me signed in" is thirty days');
  assert.match(set, /HttpOnly/);
  cookie = /kairo_operator=[^;]+/.exec(set)[0];
  const short = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!' } });
  assert.match(short.headers.get('set-cookie'), /Max-Age=43200/, 'otherwise twelve hours');
});

test('the numbers are the platform’s own: money net of refunds, live salons, the funnel', async () => {
  await signup('alpha');
  await signup('bravo');
  await signup('charlie', { pay: false });
  // One refunded: its money leaves the revenue and is counted as refunded.
  const d = platform.platformDb();
  const bravo = d.prepare("SELECT id FROM businesses WHERE slug = 'bravo'").get().id;
  d.close();
  assert.equal((await platform.api('POST', `/api/operator/business/${bravo}/refund`, { cookie, body: { reason: 'test' } })).status, 200);

  const o = (await platform.api('GET', '/api/operator/overview', { cookie })).json;
  assert.equal(o.money.net, 41000, 'one sale kept');
  assert.equal(o.money.refunded, 41000);
  assert.equal(o.money.refunded_n, 1);
  assert.equal(o.counts.live, 1);
  assert.equal(o.counts.unpaid, 1);
  assert.equal(o.counts.started_30d, 3);
  assert.equal(o.counts.verified_30d, 3);
  assert.equal(o.counts.paid_30d, 2);
  assert.equal(o.counts.in_window, 1, 'alpha could still ask for its money back');
  assert.equal(o.weeks.length, 12);
  assert.equal(o.weeks.at(-1).paid, 2, 'this week: two sold');
  assert.equal(o.weeks.at(-1).cents, 41000, 'and one of them refunded');
  assert.equal(o.salons.find((s) => s.slug === 'alpha').refund_days_left, 14);
  assert.equal(o.health.shard.ok, true);
  assert.equal(o.health.stripe, 'test');
  assert.equal(o.health.email, true);
  assert.equal(o.base_domain, DOMAIN);
  assert.ok(o.activity.some((e) => e.kind === 'state:ready' && e.slug === 'alpha' && e.label === 'Went live'));
  assert.ok(!o.activity.some((e) => /^code:/.test(e.kind)), 'plumbing stays out of the feed');
  assert.equal(o.labels['state:provisioning'], 'Building their salon');
});

test('a removed test record leaves every figure', async () => {
  const d = platform.platformDb();
  const charlie = d.prepare("SELECT id FROM businesses WHERE slug = 'charlie'").get().id;
  d.close();
  assert.equal((await platform.api('POST', `/api/operator/business/${charlie}/remove`, { cookie, body: {} })).status, 200);
  const o = (await platform.api('GET', '/api/operator/overview', { cookie })).json;
  assert.equal(o.counts.unpaid, 0);
  assert.equal(o.counts.started_30d, 2);
  assert.equal(o.salons.some((s) => s.slug === 'charlie'), false);
});

test('resend welcome reaches the owner, and only for a live salon', async () => {
  const d = platform.platformDb();
  const ids = Object.fromEntries(d.prepare("SELECT slug, id FROM businesses WHERE slug IN ('alpha','bravo')").all().map((r) => [r.slug, r.id]));
  d.close();
  const before = resend.sent.length;
  const r = await platform.api('POST', `/api/operator/business/${ids.alpha}/welcome`, { cookie, body: {} });
  assert.equal(r.status, 200, r.text);
  const mail = resend.sent.slice(before).find((m) => /Welcome to Kairo/.test(m.subject));
  assert.ok(mail, 'sent');
  assert.deepEqual(mail.to, ['alpha@salon.example']);
  assert.match(mail.text, /Welcome to Kairo, Ada\./);
  const refunded = await platform.api('POST', `/api/operator/business/${ids.bravo}/welcome`, { cookie, body: {} });
  assert.equal(refunded.status, 409, 'nothing to welcome a refunded salon to');
});

test('the console installs to a home screen, and signing out signs out', async () => {
  const page = await platform.api('GET', '/operator');
  assert.match(page.text, /rel="manifest" href="\/operator\.webmanifest"/);
  assert.match(page.text, /apple-touch-icon/);
  const man = await platform.api('GET', '/operator.webmanifest');
  assert.equal(man.status, 200);
  assert.match(man.headers.get('content-type'), /manifest\+json/);
  assert.equal(JSON.parse(man.text).start_url, '/operator');
  assert.equal((await platform.api('GET', '/icons/kairo-180.png')).status, 200);
  const out = await platform.api('POST', '/api/operator/logout', { cookie, body: {} });
  assert.equal(out.status, 200);
  assert.match(out.headers.get('set-cookie'), /kairo_operator=;.*Max-Age=0/);
});
