// Turning a new salon's email on, in one paste — and the two connectors the
// business owns: their ClickSend account and their own number as the sender.
//
// The mock Resend only marks a domain verified once the records it asked for
// are really in the mock Cloudflare, so this fails if the DNS step is wrong.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startKairo, startPlatform, openDateAhead } from './helpers/kairo.js';
import { mockStripe, mockAbr, mockResend, mockCloudflare, mockClickSend } from './helpers/mocks.js';
import { sign } from '../src/platform-sign.js';

const KEY = 'platform-key-for-tests-0123456789';
const DOMAIN = 'kairobookings.test';
let shard, platform, stripe, abr, resend, cflare, clicksend, shardDir;
let connectToken, ownerCookie;
const HOST = `abchair.${DOMAIN}`;
const PERSON = {
  business_name: 'ABC Hair Studio', name: 'Ada Bell', email: 'ada@abchair.example',
  phone: '0400111222', password: 'a-good-long-passphrase-26', tz: 'Australia/Melbourne',
};

async function provision(overrides = {}) {
  const r = await platform.api('POST', '/api/signup', { body: { ...PERSON, ...overrides }, headers: { 'cf-connecting-ip': `203.0.113.${Math.ceil(Math.random() * 200)}` } });
  assert.equal(r.status, 200, r.text);
  const { token } = r.json;
  await platform.api('POST', '/api/verify', { body: { token, kind: 'email', code: platform.latestCode('email') } });
  await platform.api('POST', '/api/verify', { body: { token, kind: 'phone', code: platform.latestCode('phone') } });
  await platform.api('POST', '/api/checkout', { body: { token } });
  const ev = stripe.pay([...stripe.sessions.keys()].pop());
  const sig = stripe.sign(ev);
  await platform.api('POST', '/api/stripe/webhook', { body: sig.raw, headers: { 'stripe-signature': sig.header, 'content-type': 'application/json' } });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const st = (await platform.api('GET', `/api/status?token=${token}`)).json;
    if (st.state === 'ready') return token;
    await new Promise((r2) => setTimeout(r2, 150));
  }
  throw new Error('never became ready');
}

before(async () => {
  stripe = await mockStripe();
  abr = await mockAbr({});
  cflare = await mockCloudflare({ zone: DOMAIN });
  resend = await mockResend({ dns: cflare });
  clicksend = await mockClickSend();
  shardDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-connect-'));
  fs.mkdirSync(path.join(shardDir, 'tenants'), { recursive: true });
  shard = await startKairo({
    dataDir: shardDir,
    env: {
      KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_PLATFORM_KEY: KEY,
      RESEND_API_BASE: resend.base, CLICKSEND_API_BASE: clicksend.base,
    },
  });
  platform = await startPlatform({
    shardUrl: shard.base, platformKey: KEY,
    env: {
      KAIRO_BASE_DOMAIN: DOMAIN,
      STRIPE_SECRET_KEY: 'sk_test_platform', STRIPE_API_BASE: stripe.base, STRIPE_WEBHOOK_SECRET: stripe.webhookSecret,
      ABR_API_BASE: abr.base, ABR_GUID: 'test-guid', KAIRO_PRICE_CENTS: '41000',
      RESEND_API_BASE: resend.base,
      CLOUDFLARE_API_BASE: cflare.base, CLOUDFLARE_API_TOKEN: 'cf-test-token',
      RESEND_VERIFY_WAIT_MS: '50', RESEND_VERIFY_TRIES: '10',
    },
  });
  await provision({ slug: 'abchair' });
  const d = platform.platformDb();
  connectToken = d.prepare("SELECT connect_token FROM businesses WHERE slug = 'abchair'").get().connect_token;
  d.close();
  ({ cookie: ownerCookie } = await shard.login(PERSON.email, PERSON.password, { host: HOST }));
});
after(async () => {
  await platform.stop(); await shard.stop();
  await Promise.all([stripe.close(), abr.close(), resend.close(), cflare.close(), clicksend.close()]);
  fs.rmSync(shardDir, { recursive: true, force: true });
});

test('a new salon knows where to go, and its checklist leads with the email', async () => {
  assert.match(connectToken, /^[A-Za-z0-9_-]{20,}$/);
  const s = await shard.api('GET', '/api/settings', { host: HOST, cookie: ownerCookie });
  assert.equal(s.json.platform_url, platform.base);
  assert.equal(s.json.connect_token, connectToken);

  const c = await shard.api('GET', '/api/checklist', { host: HOST, cookie: ownerCookie });
  assert.equal(c.status, 200);
  assert.equal(c.json.show, true);
  const email = c.json.items.find((i) => i.id === 'email');
  assert.equal(email.done, false);
  assert.equal(email.required, true);
  assert.equal(email.action.url, `${platform.base}/connect?t=${encodeURIComponent(connectToken)}`);
  assert.equal(c.json.required_left, 1);
  assert.equal((await shard.api('GET', '/api/checklist', { host: HOST })).status, 401, 'the checklist needs a session');
});

test('the connect page needs a real token and shows the business behind it', async () => {
  assert.equal((await platform.api('GET', '/connect')).status, 200);
  assert.equal((await platform.api('GET', '/api/connect/status?t=nonsense')).status, 404);
  const s = await platform.api('GET', `/api/connect/status?t=${encodeURIComponent(connectToken)}`);
  assert.equal(s.status, 200);
  assert.equal(s.json.business_name, 'ABC Hair Studio');
  assert.equal(s.json.suggested_domain, HOST);
  assert.equal(s.json.email.state, 'none');
  assert.equal(s.json.refund_days_left, 14);
  assert.equal(s.json.owner_email, PERSON.email);
});

test('a key Resend will not accept is refused at the moment it is pasted', async () => {
  const r = await platform.api('POST', '/api/connect/email', { body: { t: connectToken, resend_key: 'not-a-key' } });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /did not accept that key/i);
  const sendOnly = await platform.api('POST', '/api/connect/email', { body: { t: connectToken, resend_key: 're_send_only_key' } });
  assert.equal(sendOnly.status, 400, 'a sending-only key cannot do the setup');
  assert.equal(cflare.records.length, 0, 'and nothing was written to DNS');
});

test('one paste: the domain is added, the DNS is written, it verifies, and a scoped key lands in the salon', async () => {
  const r = await platform.api('POST', '/api/connect/email', { body: { t: connectToken, resend_key: resend.fullKey } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.from, `hello@${HOST}`);

  // Their Resend account, their domain.
  const domain = [...resend.domains.values()].find((d) => d.name === HOST);
  assert.ok(domain, 'the domain was added to their account');
  assert.equal(domain.status, 'verified');
  assert.equal(domain.region, 'ap-northeast-1', 'the region nearest Australia');

  // Every record Resend asked for is really in DNS, plus one DMARC for the zone.
  for (const rec of domain.records) assert.ok(cflare.has(rec.type, rec.name, rec.value), `${rec.type} ${rec.name} written`);
  const dmarc = cflare.records.filter((x) => x.name === `_dmarc.${DOMAIN}`);
  assert.equal(dmarc.length, 1, 'exactly one DMARC record for the whole domain');

  // A key that can only send, and only as them.
  const key = [...resend.keys.values()].find((k) => k.name === `Kairo — abchair`);
  assert.ok(key, 'a sending key was minted');
  assert.equal(key.permission, 'sending_access');
  assert.equal(key.domain_id, domain.id);
  assert.ok(resend.deletedKeys.includes('k_setup'), 'and the setup key was deleted from their account');

  // Installed in their Kairo, and proved with a real message.
  const s = await shard.api('GET', '/api/settings', { host: HOST, cookie: ownerCookie });
  assert.equal(s.json.resend_api_key_set, '1');
  assert.equal(s.json.notif_from_email, `hello@${HOST}`);
  assert.equal(s.json.reply_to_effective, PERSON.email);
  assert.doesNotMatch(s.text, /re_send_k/, 'the key itself never comes back to a browser');
  const test = resend.sent.at(-1);
  assert.equal(test.to[0], PERSON.email);
  assert.equal(test.key, key.token, 'sent with the new scoped key, not the setup one');
  assert.match(test.from, /ABC Hair Studio/);

  const log = await shard.api('GET', '/api/messages', { host: HOST, cookie: ownerCookie });
  assert.equal(log.json[0].kind, 'test');
  assert.equal(log.json[0].status, 'sent', 'and it shows in their own Messages log');
});

test('the checklist notices, and the email line goes away', async () => {
  const c = await shard.api('GET', '/api/checklist', { host: HOST, cookie: ownerCookie });
  assert.equal(c.json.items.find((i) => i.id === 'email').done, true);
  assert.equal(c.json.required_left, 0);
  assert.equal(c.json.show, true, 'the optional lines are still there');
  const s = await platform.api('GET', `/api/connect/status?t=${encodeURIComponent(connectToken)}`);
  assert.equal(s.json.email.state, 'done');
});

test('a booking now really sends its confirmation from the salon’s own domain', async () => {
  const wiz = await shard.api('POST', '/api/setup/apply', {
    host: HOST, cookie: ownerCookie,
    body: { team: [{ name: 'Ada', title: 'Owner' }], services: [{ name: 'Cut', category: 'Hair', duration_min: 45, price: 60, price_type: 'fixed' }] },
  });
  assert.equal(wiz.status, 200, wiz.text);
  const info = (await shard.api('GET', '/api/public/info', { host: HOST })).json;
  const date = openDateAhead(3);
  const av = await shard.api('GET', `/api/public/availability?date=${date}&staff_id=${info.staff[0].id}&service_ids=${info.services[0].id}`, { host: HOST });
  const before = resend.sent.length;
  const b = await shard.api('POST', '/api/public/book', {
    host: HOST,
    body: { service_ids: [info.services[0].id], staff_id: info.staff[0].id, date, start_min: av.json.slots[0].start_min, client: { first_name: 'Nia', email: 'nia@customer.example' } },
  });
  assert.equal(b.status, 200, b.text);
  // Kairo answers the customer before it finishes sending, on purpose — a slow
  // provider must never hold up a booking — so wait for the message to land.
  const deadline = Date.now() + 8000;
  let sentNow = [];
  while (Date.now() < deadline) {
    sentNow = resend.sent.slice(before);
    if (sentNow.some((m) => m.to[0] === 'nia@customer.example')) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(sentNow.some((m) => m.to[0] === 'nia@customer.example' && /confirmed/i.test(m.subject)), 'the client got their confirmation');
  assert.ok(sentNow.every((m) => m.from.includes(HOST)), 'from their own domain');
});

test('a DNS record that already exists with a different value stops everything', async () => {
  await provision({ slug: 'clash', business_name: 'Clash Salon', email: 'c@lash.example' });
  const d = platform.platformDb();
  const row = d.prepare("SELECT id, connect_token FROM businesses WHERE slug = 'clash'").get();
  d.close();
  // Somebody, or something, already put a DKIM record there with another value.
  cflare.records.push({ id: 'r_pre', type: 'TXT', name: `resend._domainkey.clash.${DOMAIN}`, content: 'p=SOMEBODY-ELSES-KEY' });
  const r = await platform.api('POST', '/api/connect/email', { body: { t: row.connect_token, resend_key: resend.fullKey } });
  assert.equal(r.status, 502);
  assert.match(r.json.error, /already exists with a different value/i,
    'it says exactly which record, rather than failing later with "not verified"');
  const st = await platform.api('GET', `/api/connect/status?t=${encodeURIComponent(row.connect_token)}`);
  assert.equal(st.json.email.state, 'failed');
  const { cookie } = await shard.login('c@lash.example', PERSON.password, { host: `clash.${DOMAIN}` });
  const s = await shard.api('GET', '/api/settings', { host: `clash.${DOMAIN}`, cookie });
  assert.equal(s.json.resend_api_key_set, '', 'and no key was installed on a half-done setup');
});

test('a salon on its own domain gets the records to add, and is not called done until they exist', async () => {
  await provision({ slug: 'ownd', business_name: 'Own Domain Salon', email: 'o@wnd.example' });
  const d = platform.platformDb();
  const row = d.prepare("SELECT id, connect_token FROM businesses WHERE slug = 'ownd'").get();
  d.close();
  const r = await platform.api('POST', '/api/connect/email', { body: { t: row.connect_token, resend_key: resend.fullKey, domain: 'mail.theirsalon.example' } });
  assert.equal(r.status, 409, 'not verified yet is not an error, but it is not done either');
  assert.match(r.json.error, /Add these records at your registrar/i);
  assert.match(r.json.error, /resend\._domainkey\.mail\.theirsalon\.example/);
  assert.match(r.json.error, /v=spf1 include:amazonses\.com/);
  assert.equal(cflare.records.some((x) => String(x.name).includes('theirsalon.example')), false,
    'their own domain is not ours to write into');
  const { cookie } = await shard.login('o@wnd.example', PERSON.password, { host: `ownd.${DOMAIN}` });
  const s = await shard.api('GET', '/api/settings', { host: `ownd.${DOMAIN}`, cookie });
  assert.equal(s.json.resend_api_key_set, '', 'nothing installed until Resend says the domain is verified');
});

test('connecting texts: the key is checked when pasted, then their own number is verified by a code', async () => {
  const bad = await shard.api('POST', '/api/sms/connect', { host: HOST, cookie: ownerCookie, body: { username: 'wrong@example.com', api_key: 'nope' } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /refused those credentials|ClickSend/i);

  const ok = await shard.api('POST', '/api/sms/connect', { host: HOST, cookie: ownerCookie, body: { username: clicksend.username, api_key: clicksend.apiKey } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.account, 'Test Salon');
  assert.equal(ok.json.balance, 25.5);

  const ask = await shard.api('POST', '/api/sms/own-number', { host: HOST, cookie: ownerCookie, body: { number: '0400111222' } });
  assert.equal(ask.status, 200, ask.text);
  assert.ok(ask.json.verification_id);

  const wrong = await shard.api('POST', '/api/sms/own-number/verify', { host: HOST, cookie: ownerCookie, body: { verification_id: ask.json.verification_id, code: '000000', number: '0400111222' } });
  assert.equal(wrong.status, 400, 'a wrong code is refused');

  const right = await shard.api('POST', '/api/sms/own-number/verify', { host: HOST, cookie: ownerCookie, body: { verification_id: ask.json.verification_id, code: clicksend.code, number: '0400111222' } });
  assert.equal(right.status, 200, right.text);
  assert.deepEqual(clicksend.verified, ['0400111222']);
  const s = await shard.api('GET', '/api/settings', { host: HOST, cookie: ownerCookie });
  assert.equal(s.json.clicksend_from, '0400111222', 'their own number is the sender');
  assert.equal(s.json.clicksend_api_key_set, '1');
  assert.doesNotMatch(s.text, /CS-TEST-KEY/, 'and the key never comes back');
});

test('a number sender needs no ACMA line; a name would', async () => {
  await shard.api('PUT', '/api/settings', { host: HOST, cookie: ownerCookie, body: { sms_notifications_enabled: '1' } });
  let c = await shard.api('GET', '/api/checklist', { host: HOST, cookie: ownerCookie });
  assert.equal(c.json.items.find((i) => i.id === 'texts').done, true);
  assert.equal(c.json.items.some((i) => i.id === 'acma'), false, 'their own number needs no register');

  await shard.api('PUT', '/api/settings', { host: HOST, cookie: ownerCookie, body: { clicksend_from: 'ABCHair' } });
  c = await shard.api('GET', '/api/checklist', { host: HOST, cookie: ownerCookie });
  const acma = c.json.items.find((i) => i.id === 'acma');
  assert.ok(acma, 'a sender NAME brings the register line back');
  assert.equal(acma.done, false);
  assert.match(acma.why, /1 July 2026/);
  await shard.api('PUT', '/api/settings', { host: HOST, cookie: ownerCookie, body: { acma_registered: '1' } });
  c = await shard.api('GET', '/api/checklist', { host: HOST, cookie: ownerCookie });
  assert.equal(c.json.items.find((i) => i.id === 'acma').done, true);
  await shard.api('PUT', '/api/settings', { host: HOST, cookie: ownerCookie, body: { clicksend_from: '0400111222' } });
});

test('a pasted payment link is enough to count as taking card payments', async () => {
  let c = await shard.api('GET', '/api/checklist', { host: HOST, cookie: ownerCookie });
  assert.equal(c.json.items.find((i) => i.id === 'payments').done, false);
  await shard.api('PUT', '/api/settings', { host: HOST, cookie: ownerCookie, body: { pos_payment_link: 'https://buy.stripe.com/test_abc' } });
  c = await shard.api('GET', '/api/checklist', { host: HOST, cookie: ownerCookie });
  assert.equal(c.json.items.find((i) => i.id === 'payments').done, true);
});

test('the checklist disappears for good once every line is done', async () => {
  await shard.api('PUT', '/api/settings', { host: HOST, cookie: ownerCookie, body: { checklist_link_shared: '1', checklist_app_installed: '1' } });
  const c = await shard.api('GET', '/api/checklist', { host: HOST, cookie: ownerCookie });
  assert.equal(c.json.items.find((i) => i.id === 'test_booking').done, true, 'the booking earlier counts');
  assert.equal(c.json.complete, true);
  assert.equal(c.json.show, false);
});

test('a self-serve refund inside the window returns the money and closes the salon', async () => {
  const token = await provision({ slug: 'quitter', business_name: 'Quitter Salon', email: 'q@uit.example' });
  const d = platform.platformDb();
  const ct = d.prepare("SELECT connect_token FROM businesses WHERE slug = 'quitter'").get().connect_token;
  d.close();
  const before = stripe.refunds.length;
  const r = await platform.api('POST', '/api/connect/refund', { body: { t: ct, reason: 'not for me' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.refunded, true);
  assert.ok(r.json.exported_bytes > 1000, 'their data was exported first');
  assert.equal(stripe.refunds.length, before + 1);
  assert.equal((await shard.api('GET', '/api/public/info', { host: `quitter.${DOMAIN}` })).status, 404);
  const again = await platform.api('POST', '/api/connect/refund', { body: { t: ct } });
  assert.equal(again.json.already, true, 'asking twice refunds once');
  assert.equal((await platform.api('GET', `/api/status?token=${token}`)).json.state, 'refunded');
});

test('after the window a refund becomes a request, not a refusal', async () => {
  await provision({ slug: 'later', business_name: 'Later Salon', email: 'l@ater.example' });
  const d = platform.platformDb();
  const row = d.prepare("SELECT id, connect_token FROM businesses WHERE slug = 'later'").get();
  d.prepare("UPDATE businesses SET paid_at = datetime('now', '-30 days') WHERE id = ?").run(row.id);
  d.close();
  const st = await platform.api('GET', `/api/connect/status?t=${encodeURIComponent(row.connect_token)}`);
  assert.ok(st.json.refund_days_left <= 0);
  const before = stripe.refunds.length;
  const r = await platform.api('POST', '/api/connect/refund', { body: { t: row.connect_token, reason: 'changed my mind late' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.queued, true);
  assert.equal(stripe.refunds.length, before, 'no money moved on its own');
  assert.equal((await shard.api('GET', '/api/public/info', { host: `later.${DOMAIN}` })).status, 200, 'and the salon keeps working');
  const op = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!' } });
  const cookie = /kairo_operator=[^;]+/.exec(op.headers.get('set-cookie'))[0];
  const queue = await platform.api('GET', '/api/operator/queue', { cookie });
  assert.ok(queue.json.tasks.some((t) => t.kind === 'refund_request' && t.slug === 'later'));
});

test('the owner can connect a salon’s email from the queue, for a business that would rather not', async () => {
  await provision({ slug: 'shy', business_name: 'Shy Salon', email: 's@hy.example' });
  const op = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!' } });
  const cookie = /kairo_operator=[^;]+/.exec(op.headers.get('set-cookie'))[0];
  const queue = await platform.api('GET', '/api/operator/queue', { cookie });
  const task = queue.json.tasks.find((t) => t.slug === 'shy' && t.kind === 'email_setup');
  assert.ok(task, 'every new salon puts one card in the queue');
  const r = await platform.api('POST', `/api/operator/business/${task.business_id}/connect-email`, { cookie, body: { resend_key: resend.fullKey } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.from, `hello@shy.${DOMAIN}`);
  const after = await platform.api('GET', '/api/operator/queue', { cookie });
  assert.equal(after.json.tasks.some((t) => t.slug === 'shy' && t.kind === 'email_setup'), false, 'and the card is gone');

  // Two salons connected now. There must still be exactly one DMARC record:
  // a second one makes receivers treat the whole domain as having none, for
  // every salon on it.
  const dmarc = cflare.records.filter((x) => String(x.name).toLowerCase() === `_dmarc.${DOMAIN}`);
  assert.equal(dmarc.length, 1, 'one DMARC for the domain, however many salons connect');
});

// ---------------------------------------------------------------------------
// The owner's own page: signing out, and the guarantee
// ---------------------------------------------------------------------------
//
// The refund lives on the platform, which took the card. These check the bridge
// the salon's own Kairo uses to ask about it — because an owner who wants their
// money back should not have to find an email from six weeks ago to do it.

test('the app can see the guarantee, and never invents one', async () => {
  const g = await shard.api('GET', '/api/account/guarantee', { host: HOST, cookie: ownerCookie });
  assert.equal(g.status, 200);
  assert.equal(g.json.available, true);
  assert.equal(g.json.days_left, 14, 'counted by the platform, not by the app');
  assert.equal(g.json.refunded, false);
  assert.equal(g.json.window_days, 14);
  assert.equal(g.json.price_cents, 41000, 'what they actually paid');
  assert.equal((await shard.api('GET', '/api/account/guarantee', { host: HOST })).status, 401,
    'and it needs a session');
});

test('signing out everywhere retires every session, including this one', async () => {
  // A second sign-in, standing in for the phone in somebody's bag.
  const { cookie: phone } = await shard.login(PERSON.email, PERSON.password, { host: HOST });
  assert.equal((await shard.api('GET', '/api/account', { host: HOST, cookie: phone })).status, 200);

  const out = await shard.api('POST', '/api/auth/logout-everywhere', { host: HOST, cookie: phone });
  assert.equal(out.status, 200);

  // Both the session that asked AND the one that did not are now dead. That is
  // the whole point of it — an ordinary sign-out cannot reach the other device.
  assert.equal((await shard.api('GET', '/api/account', { host: HOST, cookie: phone })).status, 401);
  assert.equal((await shard.api('GET', '/api/account', { host: HOST, cookie: ownerCookie })).status, 401,
    'the other device is signed out too');

  ({ cookie: ownerCookie } = await shard.login(PERSON.email, PERSON.password, { host: HOST }));
});

test('a refund asked for inside the app reaches the platform and returns the money', async () => {
  // Its own salon, so the refund does not take the one the other tests use.
  const token = await provision({ slug: 'refundme', business_name: 'Refund Me', email: 'ref@abchair.example' });
  const d = platform.platformDb();
  const slug = 'refundme';
  d.close();
  const host = `${slug}.${DOMAIN}`;
  const { cookie } = await shard.login('ref@abchair.example', PERSON.password, { host });

  const before = stripe.refunds.length;
  const r = await shard.api('POST', '/api/account/refund', {
    host, cookie, body: { reason: 'not for me' },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.refunded, true);
  assert.equal(stripe.refunds.length, before + 1, 'the money actually went back');

  // And the platform agrees, which is the half that matters to the bank.
  const st = (await platform.api('GET', `/api/status?token=${token}`)).json;
  assert.equal(st.state, 'refunded');
});

test('a Kairo with no platform behind it says so rather than drawing a countdown', async () => {
  // A hand-installed copy has no platform handles. Inventing "14 days left"
  // there would be a promise about money made by a screen that knows nothing
  // about any payment.
  const solo = await startKairo();
  // try/finally, not a stop() at the end: a failing assertion would otherwise
  // leave the child server running and the whole suite hangs to its timeout
  // instead of failing. A mutation caught by a hang is a much weaker signal
  // than one caught by an assertion, and three minutes slower in CI.
  try {
    const { cookie } = await solo.login();
    const g = await solo.api('GET', '/api/account/guarantee', { cookie });
    assert.equal(g.json.available, false);
    assert.equal(g.json.reason, 'not_platform');

    const r = await solo.api('POST', '/api/account/refund', { cookie, body: {} });
    assert.equal(r.status, 400, 'and asking is refused with a reason, not a crash');
  } finally {
    await solo.stop();
  }
});

test('a refund the platform refuses is never reported as done', async () => {
  // The most dangerous line in the whole flow. An owner told "refunded" who was
  // not finds out from their bank statement, weeks later, and by then the trust
  // is gone whatever the money does.
  //
  // Reachable-but-refused, not unreachable: the connect token is pointed at
  // something the platform will not accept, so it answers 404 rather than
  // timing out. That is the branch a network failure never reaches.
  const token = await provision({ slug: 'refused', business_name: 'Refused Co', email: 'no@abchair.example' });
  const host = `refused.${DOMAIN}`;
  const { cookie } = await shard.login('no@abchair.example', PERSON.password, { host });

  const path = '/api/platform/tenants/refused';
  const body = JSON.stringify({ connect_token: 'not-a-real-connect-token' });
  const t = Date.now();
  const patched = await shard.api('PATCH', path, {
    body, headers: { 'x-kairo-signature': `t=${t},v1=${sign(t, 'PATCH', path, body, KEY)}`, 'content-type': 'application/json' },
  });
  assert.equal(patched.status, 200, patched.text);

  const before = stripe.refunds.length;
  const r = await shard.api('POST', '/api/account/refund', { host, cookie, body: { reason: 'try it' } });
  assert.ok(r.status >= 400, `refused must not read as success — got ${r.status} ${r.text}`);
  assert.notEqual(r.json?.refunded, true, 'and certainly not "refunded: true"');
  assert.equal(stripe.refunds.length, before, 'no money moved');

  // And the salon is still running, because nothing was actually cancelled.
  const st = (await platform.api('GET', `/api/status?token=${token}`)).json;
  assert.equal(st.state, 'ready');
});
