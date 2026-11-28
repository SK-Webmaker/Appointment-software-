// The free 14-day trial, end to end against a real shard and platform: no card
// to start, the five held-back features refused, the emails in order, the
// pause on day 14, paying to keep the very same salon, and the deletion on
// day 21 that frees the address. The clock is moved by editing the trial's
// dates in the platform's own database; the hourly job runs every 300 ms here.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startKairo, startPlatform } from './helpers/kairo.js';
import { mockStripe, mockAbr, mockResend } from './helpers/mocks.js';
import { sign } from '../src/platform-sign.js';

const KEY = 'platform-key-for-tests-0123456789';
const DOMAIN = 'kairobookings.test';
const PASSWORD = 'a-good-long-passphrase-26';
const DAY = 86400000;
// The founding offer's private code, as KAIRO_FOUNDER_CODE would hold it on the server.
const OFFER = 'founding-code-for-tests-0123';
let shard, platform, stripe, abr, resend, shardDir;

before(async () => {
  stripe = await mockStripe();
  abr = await mockAbr({});
  resend = await mockResend();
  shardDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-trial-'));
  fs.mkdirSync(path.join(shardDir, 'tenants'), { recursive: true });
  shard = await startKairo({
    dataDir: shardDir,
    env: {
      KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_PLATFORM_KEY: KEY,
      KAIRO_SHARED_RESEND_KEY: resend.fullKey, KAIRO_SHARED_FROM: 'bookings@kairobookings.test', RESEND_API_BASE: resend.base,
    },
  });
  platform = await startPlatform({
    shardUrl: shard.base, platformKey: KEY,
    env: {
      KAIRO_BASE_DOMAIN: DOMAIN,
      STRIPE_API_BASE: stripe.base, STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: stripe.webhookSecret,
      ABR_API_BASE: abr.base, ABR_GUID: 'g',
      RESEND_API_KEY: resend.fullKey, PLATFORM_FROM_EMAIL: 'hello@kairobookings.test', RESEND_API_BASE: resend.base,
      PLATFORM_TRIAL_EVERY_MS: '300',
      KAIRO_FOUNDER_CODE: OFFER, KAIRO_FOUNDER_PLACES: '2',
    },
  });
});
after(async () => {
  await platform?.stop(); await shard?.stop();
  await stripe?.close(); await abr?.close(); await resend?.close();
});

let ip = 0;
async function startTrial(slug, { email = `${slug}@salon.example`, phone = `04${String(10000000 + ip * 7919).slice(0, 8)}` } = {}) {
  const r = await platform.api('POST', '/api/signup', {
    body: { business_name: `${slug} studio`, slug, name: 'Ava Lee', email, phone, password: PASSWORD, plan: 'trial', source: 'how-to-start-a-lash-business' },
    headers: { 'cf-connecting-ip': `198.51.100.${++ip}` },
  });
  if (r.status !== 200) return r;
  const { token } = r.json;
  assert.equal((await platform.api('POST', '/api/verify', { body: { token, kind: 'email', code: platform.latestCode('email') } })).status, 200);
  const started = await platform.api('POST', '/api/trial/start', { body: { token } });
  assert.equal(started.status, 200, started.text);
  assert.equal(started.json.state, 'trial');
  return { token, status: 200 };
}
const row = (slug) => { const d = platform.platformDb(); try { return d.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug); } finally { d.close(); } };
const setDates = (slug, { ends, deletes }) => {
  const d = platform.platformDb();
  try {
    if (ends !== undefined) d.prepare('UPDATE businesses SET trial_ends_at = ? WHERE slug = ?').run(new Date(ends).toISOString(), slug);
    if (deletes !== undefined) d.prepare('UPDATE businesses SET trial_deletes_at = ? WHERE slug = ?').run(new Date(deletes).toISOString(), slug);
  } finally { d.close(); }
};
const signed = (method, p, body) => {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const t = Date.now();
  return shard.api(method, p, { body: raw || undefined, headers: { 'x-kairo-signature': `t=${t},v1=${sign(t, method, p, raw, KEY)}`, ...(raw ? { 'content-type': 'application/json' } : {}) } });
};
async function until(fn, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 150));
  }
}
const mailsTo = (to, re) => resend.sent.filter((m) => m.to.includes(to) && re.test(m.subject));

let cookie;
const host = (slug) => `${slug}.${DOMAIN}`;

test('a trial starts with no card: the salon is built, on a trial, and the owner is told', async () => {
  const before = stripe.sessions.size;
  await startTrial('glow');
  const b = row('glow');
  assert.equal(b.state, 'trial');
  assert.equal(b.price_cents, 0);
  assert.equal(b.paid_at, '');
  assert.equal(stripe.sessions.size, before, 'Stripe was never asked for anything');
  const days = (Date.parse(b.trial_ends_at) - Date.now()) / DAY;
  assert.ok(days > 13.9 && days <= 14, 'fourteen days');
  assert.equal(Math.round((Date.parse(b.trial_deletes_at) - Date.parse(b.trial_ends_at)) / DAY), 7, 'deleted a week after it ends');
  const salon = await signed('GET', '/api/platform/tenants/glow');
  assert.equal(salon.json.plan_status, 'trial');
  const welcome = mailsTo('glow@salon.example', /free Kairo trial is ready/);
  assert.equal(welcome.length, 1);
  assert.match(welcome[0].text, /Tuesday|Monday|Wednesday|Thursday|Friday|Saturday|Sunday/, 'says the day it ends');
  assert.match(welcome[0].text, /Kai \(your assistant\), text reminders/);

  ({ cookie } = await shard.login('glow@salon.example', PASSWORD, { host: host('glow') }));
  const t = await shard.api('GET', '/api/trial', { cookie, host: host('glow') });
  assert.equal(t.json.trial, true);
  assert.equal(t.json.days_left, 14);
  assert.match(t.json.keep_url, /\/keep\?t=/);
});

test('the five held-back features are refused with a lock; everything else works', async () => {
  const h = host('glow');
  const locked = async (method, p, body, feature) => {
    const r = await shard.api(method, p, { cookie, host: h, body });
    assert.equal(r.status, 402, `${method} ${p}: ${r.status} ${r.text}`);
    assert.equal(r.json.locked, feature);
  };
  await locked('POST', '/api/kai/chats', { text: 'hello' }, 'kai');
  await locked('POST', '/api/campaigns/send', {}, 'marketing');
  await locked('POST', '/api/sms/connect', { username: 'a', api_key: 'b' }, 'sms');
  await locked('PUT', '/api/settings', { clicksend_api_key: 'abc' }, 'sms');
  await locked('PUT', '/api/settings', { stripe_secret_key: 'sk_test_123' }, 'payments');
  await locked('PUT', '/api/settings', { resend_api_key: 're_123' }, 'email');
  const own = await shard.api('PUT', '/api/settings', { cookie, host: h, body: { plan_status: 'active' } });
  assert.equal(own.status, 400, 'an owner cannot end their own trial by typing "active"');
  const ok = await shard.api('PUT', '/api/settings', { cookie, host: h, body: { business_phone: '0400 000 111' } });
  assert.equal(ok.status, 200, 'ordinary settings save');
  const client = await shard.api('POST', '/api/clients', { cookie, host: h, body: { first_name: 'Mia', last_name: 'Trial' } });
  assert.equal(client.status, 200, client.text);
});

test('one trial per email and per mobile, ever', async () => {
  const again = await platform.api('POST', '/api/signup', {
    body: { business_name: 'Glow Two', slug: 'glowtwo', name: 'Ava Lee', email: 'glow@salon.example', phone: '0499999999', password: PASSWORD, plan: 'trial' },
    headers: { 'cf-connecting-ip': '198.51.100.200' },
  });
  assert.equal(again.status, 409);
  const phone = row('glow') && (() => { const d = platform.platformDb(); try { return d.prepare("SELECT o.phone FROM owners o JOIN businesses b ON b.owner_id = o.id WHERE b.slug = 'glow'").get().phone; } finally { d.close(); } })();
  const samePhone = await platform.api('POST', '/api/signup', {
    body: { business_name: 'Other', slug: 'otherone', name: 'Bo Dee', email: 'other@salon.example', phone: phone.replace(/^0/, '+61 '), password: PASSWORD, plan: 'trial' },
    headers: { 'cf-connecting-ip': '198.51.100.201' },
  });
  assert.equal(samePhone.status, 409, samePhone.text);
  assert.match(samePhone.json.error, /mobile number has already had a free trial/);
});

test('the emails go in order, one at a time, and the trial pauses on day 14', async () => {
  // Day 7 or so: the halfway email (the missed day-3 tips are marked, not sent).
  setDates('glow', { ends: Date.now() + 6.5 * DAY });
  await until(() => mailsTo('glow@salon.example', /Halfway/).length === 1);
  assert.equal(mailsTo('glow@salon.example', /Three things/).length, 0, 'an older email is skipped, not sent late');
  assert.match(mailsTo('glow@salon.example', /Halfway/)[0].text, /1 client/, 'says what they have built');
  // Three days to go.
  setDates('glow', { ends: Date.now() + 2.5 * DAY });
  await until(() => mailsTo('glow@salon.example', /3 days left/).length === 1);
  // The end: paused, read-only, muted, told.
  setDates('glow', { ends: Date.now() - 60000 });
  await until(() => row('glow').state === 'trial_ended');
  const salon = await signed('GET', '/api/platform/tenants/glow');
  assert.equal(salon.json.read_only, true);
  assert.equal(salon.json.muted, true);
  await until(() => mailsTo('glow@salon.example', /has ended/).length === 1);
  const t = await shard.api('GET', '/api/trial', { cookie, host: host('glow') });
  assert.equal(t.json.ended, true);
  const write = await shard.api('POST', '/api/clients', { cookie, host: host('glow'), body: { first_name: 'Nope' } });
  assert.equal(write.status, 503, 'nothing can change while paused');
  assert.equal(mailsTo('glow@salon.example', /Halfway/).length, 1, 'no email ever goes twice');
});

test('paying keeps the very same salon: the locks lift, the pause ends, nothing is lost', async () => {
  const b = row('glow');
  const status = await platform.api('GET', `/api/keep/status?t=${b.connect_token}`);
  assert.equal(status.json.trial, true);
  assert.equal(status.json.state, 'trial_ended');
  const co = await platform.api('POST', '/api/keep/checkout', { body: { t: b.connect_token, plan: 'once' } });
  assert.equal(co.status, 200, co.text);
  const session = [...stripe.sessions.values()].pop();
  assert.match(session.success_url, /\/keep\?t=.*paid=1/);
  const sig = stripe.sign(stripe.pay(session.id));
  await platform.api('POST', '/api/stripe/webhook', { body: sig.raw, headers: { 'stripe-signature': sig.header, 'content-type': 'application/json' } });
  await until(() => row('glow').state === 'ready');
  const kept = row('glow');
  assert.ok(kept.paid_at && kept.converted_at);
  assert.equal(kept.plan, 'once');
  const salon = await signed('GET', '/api/platform/tenants/glow');
  assert.equal(salon.json.plan_status, 'active');
  assert.equal(salon.json.read_only, false);
  assert.equal(salon.json.muted, false);
  assert.equal(salon.json.counts.clients >= 1, true, 'the trial\'s clients are still there');
  const t = await shard.api('GET', '/api/trial', { cookie, host: host('glow') });
  assert.equal(t.json.trial, false);
  const sms = await shard.api('PUT', '/api/settings', { cookie, host: host('glow'), body: { clicksend_api_key: 'abc' } });
  assert.equal(sms.status, 200, 'the locks are gone');
  assert.equal(mailsTo('glow@salon.example', /Full access is on/).length, 1);
  assert.equal(mailsTo('glow@salon.example', /receipt|Receipt/).length >= 1, true);
  // Kept is kept: the trial clock never touches it again.
  setDates('glow', { ends: Date.now() - 30 * DAY, deletes: Date.now() - 20 * DAY });
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(row('glow').state, 'ready');
  const still = await signed('GET', '/api/platform/tenants/glow');
  assert.equal(still.status, 200, 'still switched on');
  assert.equal(still.json.read_only, false, 'and not paused');
});

test("the shard will not delete a salon that paid, even switched off and asked as a trial", async () => {
  assert.equal((await signed('DELETE', '/api/platform/tenants/glow')).status, 200);
  const purge = await signed('POST', '/api/platform/tenants/glow/purge', { trial: true });
  assert.equal(purge.status, 409, purge.text);
  assert.match(purge.json.error, /Only an unpaid free trial/);
  assert.equal(fs.existsSync(path.join(shardDir, 'tenants', 'glow', 'kairo.db')), true, 'its files are untouched');
});

test('an unpaid trial gets a final notice, then is deleted and its address is free again', async () => {
  await startTrial('fade');
  setDates('fade', { ends: Date.now() - 60000 });
  await until(() => row('fade').state === 'trial_ended');
  setDates('fade', { deletes: Date.now() + 1.5 * DAY });
  await until(() => mailsTo('fade@salon.example', /deleted in 2 days/).length === 1);
  setDates('fade', { deletes: Date.now() - 60000 });
  await until(() => row('fade').state === 'trial_deleted');
  assert.equal((await signed('GET', '/api/platform/tenants/fade')).status, 404);
  assert.equal(fs.existsSync(path.join(shardDir, 'tenants', 'fade')), false, 'the files are gone');
  await until(() => mailsTo('fade@salon.example', /has been deleted/).length === 1);
  const slug = await platform.api('GET', '/api/slug?slug=fade');
  assert.equal(slug.json.ok, true, 'and somebody else may have the address');
  const keep = await platform.api('POST', '/api/keep/checkout', { body: { t: row('fade').connect_token, plan: 'once' } });
  assert.equal(keep.status, 409, 'there is nothing left to keep');
  // Deleted is not a second chance: the same email cannot start another.
  const again = await platform.api('POST', '/api/signup', {
    body: { business_name: 'Fade again', slug: 'fadeagain', name: 'Ava Lee', email: 'fade@salon.example', phone: '0477666555', password: PASSWORD, plan: 'trial' },
    headers: { 'cf-connecting-ip': '198.51.100.240' },
  });
  assert.equal(again.status, 409, again.text);
  assert.match(again.json.error, /already had a free trial with this email/);
  // But they can still buy it.
  const buy = await platform.api('POST', '/api/signup', {
    body: { business_name: 'Fade again', slug: 'fadeagain', name: 'Ava Lee', email: 'fade@salon.example', phone: '0477666555', password: PASSWORD, plan: 'once' },
    headers: { 'cf-connecting-ip': '198.51.100.241' },
  });
  assert.equal(buy.status, 200, buy.text);
});

test('a trial can switch to paying before it starts', async () => {
  const r = await platform.api('POST', '/api/signup', {
    body: { business_name: 'Swap studio', slug: 'swap', name: 'Ava Lee', email: 'swap@salon.example', phone: '0411222333', password: PASSWORD, plan: 'trial' },
    headers: { 'cf-connecting-ip': '198.51.100.250' },
  });
  assert.equal(r.status, 200, r.text);
  await platform.api('POST', '/api/verify', { body: { token: r.json.token, kind: 'email', code: platform.latestCode('email') } });
  const pay = await platform.api('POST', '/api/checkout', { body: { token: r.json.token, plan: 'monthly' } });
  assert.equal(pay.status, 200, pay.text);
  assert.equal(row('swap').plan, 'monthly');
  assert.equal(row('swap').trial_ends_at, '', 'no trial was started');
});

// ── The founding offer (owner, 28 Nov 2026): A$200 for the first places, by private link ──
let fip = 0;
async function offerSignup(slug, body = {}) {
  const r = await platform.api('POST', '/api/signup', {
    body: { business_name: `${slug} studio`, slug, name: 'Mia Ross', email: `${slug}@founder.example`, phone: `04${String(30000000 + fip * 7907).slice(0, 8)}`, password: PASSWORD, ...body },
    headers: { 'cf-connecting-ip': `192.0.2.${++fip}` },
  });
  if (r.status === 200) {
    const v = await platform.api('POST', '/api/verify', { body: { token: r.json.token, kind: 'email', code: platform.latestCode('email') } });
    assert.equal(v.status, 200, v.text);
  }
  return r;
}
const payLatest = async () => {
  const session = [...stripe.sessions.values()].pop();
  const sig = stripe.sign(stripe.pay(session.id));
  const hook = await platform.api('POST', '/api/stripe/webhook', { body: sig.raw, headers: { 'stripe-signature': sig.header, 'content-type': 'application/json' } });
  assert.equal(hook.status, 200, hook.text);
  return session;
};
const lastAmount = () => stripe.sessionParams.get([...stripe.sessions.keys()].pop())['line_items[0][price_data][unit_amount]'];

test('the founding price is only behind its private link, and never on the public page', async () => {
  const pub = await platform.api('GET', '/api/price');
  assert.ok(!pub.json.plans.some((p) => p.id === 'founder'), 'the public price list has no founding price');
  assert.deepEqual((await platform.api('GET', '/api/offer?code=not-the-code-00000')).json, { ok: false });
  const good = (await platform.api('GET', `/api/offer?code=${OFFER}`)).json;
  assert.equal(good.ok, true);
  assert.deepEqual([good.plan.cents, good.plan.payments, good.usual_cents, good.places, good.places_left], [20000, 1, 40000, 2, 2]);
  const bad = await offerSignup('badcode', { plan: 'founder', offer: 'not-the-code-00000' });
  assert.equal(bad.status, 400, 'a wrong code is refused, not quietly charged full price');
  // Asking for the plan, or claiming the page, without the code gets the normal price.
  const sneaky = await offerSignup('sneaky', { plan: 'founder', source: 'founder' });
  assert.equal(sneaky.status, 200, sneaky.text);
  assert.deepEqual([row('sneaky').plan, row('sneaky').source], ['once', '']);
  const co = await platform.api('POST', '/api/checkout', { body: { token: sneaky.json.token, plan: 'founder' } });
  assert.equal(co.status, 200, co.text);
  assert.equal(lastAmount(), '40000');
  assert.equal(row('sneaky').plan, 'once');
});

test('a founder pays A$200 once, gets the same Kairo, and a place is taken', async () => {
  const r = await offerSignup('firstfounder', { plan: 'founder', offer: OFFER, source: 'preview' });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([row('firstfounder').plan, row('firstfounder').source, row('firstfounder').price_cents], ['founder', 'founder', 20000]);
  const st = (await platform.api('GET', `/api/status?token=${r.json.token}`)).json;
  assert.equal(st.offer.plan.cents, 20000, 'the payment step still shows the founding price');
  // Even asking for the dearer plan on the payment step, a founder pays the founding price.
  const co = await platform.api('POST', '/api/checkout', { body: { token: r.json.token, plan: 'monthly' } });
  assert.equal(co.status, 200, co.text);
  const p = stripe.sessionParams.get([...stripe.sessions.keys()].pop());
  assert.deepEqual([p.mode, p['line_items[0][price_data][unit_amount]']], ['payment', '20000']);
  await payLatest();
  await until(() => row('firstfounder').state === 'ready', 15000);
  assert.equal((await platform.api('GET', `/api/offer?code=${OFFER}`)).json.places_left, 1);
});

test('a founding trial keeps at A$200, the places run out, and a month later the review is asked for once', async () => {
  const r = await offerSignup('foundertrial', { plan: 'trial', offer: OFFER });
  assert.equal(r.status, 200, r.text);
  const started = await platform.api('POST', '/api/trial/start', { body: { token: r.json.token } });
  assert.equal(started.json.state, 'trial');
  const b = row('foundertrial');
  assert.equal(b.source, 'founder');
  // Its trial emails quote the founding price, not the normal one.
  setDates('foundertrial', { ends: Date.now() + 6.5 * DAY });
  await until(() => mailsTo('foundertrial@founder.example', /Halfway/).length === 1);
  const halfway = mailsTo('foundertrial@founder.example', /Halfway/)[0].text;
  assert.match(halfway, /\$200 once, your founding price \(normally \$400\)/);
  assert.doesNotMatch(halfway, /monthly payments/);
  const keep = (await platform.api('GET', `/api/keep/status?t=${b.connect_token}`)).json;
  assert.deepEqual(keep.plans.map((p) => [p.id, p.cents]), [['founder', 20000]]);
  const co = await platform.api('POST', '/api/keep/checkout', { body: { t: b.connect_token, plan: 'once' } });
  assert.equal(co.status, 200, co.text);
  assert.equal(lastAmount(), '20000', 'kept at the founding price');
  await payLatest();
  await until(() => row('foundertrial').state === 'ready', 15000);
  assert.equal(row('foundertrial').plan, 'founder');
  // Both places are gone now.
  assert.equal((await platform.api('GET', `/api/offer?code=${OFFER}`)).json.places_left, 0);
  const late = await offerSignup('toolate', { plan: 'founder', offer: OFFER });
  assert.equal(late.status, 409);
  assert.match(late.json.error, /founding places have been taken/);
  // A month after paying: one honest-review email, and only one.
  assert.equal(mailsTo('foundertrial@founder.example', /How's Kairo going/).length, 0, 'not before the month is up');
  const d = platform.platformDb();
  try { d.prepare("UPDATE businesses SET paid_at = datetime('now', '-31 days') WHERE slug IN ('foundertrial', 'sneaky')").run(); } finally { d.close(); }
  await until(() => mailsTo('foundertrial@founder.example', /How's Kairo going/).length === 1);
  const mail = mailsTo('foundertrial@founder.example', /How's Kairo going/)[0];
  assert.match(mail.text, /honest review/);
  assert.match(mail.text, /Good or bad/);
  await new Promise((res) => setTimeout(res, 1200));
  assert.equal(mailsTo('foundertrial@founder.example', /How's Kairo going/).length, 1, 'asked once, ever');
  assert.equal(mailsTo('sneaky@founder.example', /How's Kairo going/).length, 0, 'only founders are asked');
});
