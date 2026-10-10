// Refund and delete: what the "Are you sure?" screen promises, done.
//
// The screen lists, in order: a copy of everything emailed first, the money
// back, the salon switched off, and its data deleted for good a week later.
// Each of those is checked here against the real shard and platform — the
// copy in the owner's inbox with spreadsheets attached, the refund in Stripe,
// the folder gone from the disk — along with the two refusals that keep it
// safe: no refund without the confirmation step, and no deletion of a salon
// that is still switched on or was switched off too recently.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startKairo, startPlatform, openDateAhead } from './helpers/kairo.js';
import { mockStripe, mockAbr, mockResend } from './helpers/mocks.js';
import { sign } from '../src/platform-sign.js';

const KEY = 'platform-key-for-tests-0123456789';
const DOMAIN = 'kairobookings.test';
const PASSWORD = 'a-good-long-passphrase-26';
let shard, platform, stripe, abr, resend, shardDir;

before(async () => {
  stripe = await mockStripe();
  abr = await mockAbr({});
  resend = await mockResend();
  shardDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-refund-'));
  fs.mkdirSync(path.join(shardDir, 'tenants'), { recursive: true });
  shard = await startKairo({
    dataDir: shardDir,
    env: {
      KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_PLATFORM_KEY: KEY,
      KAIRO_SHARED_RESEND_KEY: resend.fullKey, KAIRO_SHARED_FROM: 'bookings@kairobookings.test',
      RESEND_API_BASE: resend.base,
      // About two and a half seconds, so "too soon" and "now it may go" both
      // happen inside one test.
      KAIRO_PURGE_GRACE_DAYS: '0.00003',
    },
  });
  platform = await startPlatform({
    shardUrl: shard.base, platformKey: KEY,
    env: {
      KAIRO_BASE_DOMAIN: DOMAIN,
      STRIPE_API_BASE: stripe.base, STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: stripe.webhookSecret,
      ABR_API_BASE: abr.base, ABR_GUID: 'test-guid',
      KAIRO_DELETE_GRACE_DAYS: '0', PLATFORM_PURGE_EVERY_MS: '300',
    },
  });
});
after(async () => {
  await platform?.stop(); await shard?.stop();
  await stripe?.close(); await abr?.close(); await resend?.close();
});

let ip = 0;
async function buy(slug, email) {
  const r = await platform.api('POST', '/api/signup', {
    body: { business_name: `${slug} salon`, slug, name: 'Ada Bell', email, phone: '0400111222', password: PASSWORD, tz: 'Australia/Melbourne' },
    headers: { 'cf-connecting-ip': `203.0.113.${++ip}` },
  });
  assert.equal(r.status, 200, r.text);
  const { token } = r.json;
  await platform.api('POST', '/api/verify', { body: { token, kind: 'email', code: platform.latestCode('email') } });
  assert.equal((await platform.api('POST', '/api/checkout', { body: { token } })).status, 200);
  const sig = stripe.sign(stripe.pay([...stripe.sessions.keys()].pop()));
  await platform.api('POST', '/api/stripe/webhook', { body: sig.raw, headers: { 'stripe-signature': sig.header, 'content-type': 'application/json' } });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if ((await platform.api('GET', `/api/status?token=${token}`)).json.state === 'ready') return token;
    await new Promise((r2) => setTimeout(r2, 150));
  }
  throw new Error('never became ready');
}

const signed = (method, p) => {
  const t = Date.now();
  return shard.api(method, p, { headers: { 'x-kairo-signature': `t=${t},v1=${sign(t, method, p, '', KEY)}` } });
};
const row = (slug) => {
  const d = platform.platformDb();
  try { return d.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug); } finally { d.close(); }
};

test('refund and delete: the copy is emailed first, the money goes back, and the files go a week later', async () => {
  await buy('leaving', 'leaving@salon.example');
  const host = `leaving.${DOMAIN}`;
  const { cookie } = await shard.login('leaving@salon.example', PASSWORD, { host });

  // A client already booked, whose name a spreadsheet would try to run.
  const wiz = await shard.api('POST', '/api/setup/apply', {
    host, cookie,
    body: { team: [{ name: 'Ada', title: 'Owner' }], services: [{ name: 'Cut', category: 'Hair', duration_min: 45, price: 60, price_type: 'fixed' }] },
  });
  assert.equal(wiz.status, 200, wiz.text);
  const info = (await shard.api('GET', '/api/public/info', { host })).json;
  const date = openDateAhead(3);
  const av = await shard.api('GET', `/api/public/availability?date=${date}&staff_id=${info.staff[0].id}&service_ids=${info.services[0].id}`, { host });
  const booked = await shard.api('POST', '/api/public/book', {
    host,
    body: { service_ids: [info.services[0].id], staff_id: info.staff[0].id, date, start_min: av.json.slots[0].start_min,
      client: { first_name: '=HYPERLINK("http://evil.example")', last_name: 'Nia', email: 'nia@customer.example' } },
  });
  assert.equal(booked.status, 200, booked.text);

  // The warning counts the clients who stop getting reminders.
  const acct = await shard.api('GET', '/api/account', { host, cookie });
  assert.equal(acct.json.usage.upcoming, 1);

  // One press is not a refund: without the confirmation step nothing moves.
  const refundsBefore = stripe.refunds.length;
  const blind = await shard.api('POST', '/api/account/refund', { host, cookie, body: {} });
  assert.equal(blind.status, 400, blind.text);
  assert.match(blind.json.error, /confirm/i);
  assert.equal(stripe.refunds.length, refundsBefore, 'no money moved');
  assert.equal((await shard.api('GET', '/api/public/info', { host })).status, 200, 'and the salon is still on');

  const sentBefore = resend.sent.length;
  const r = await shard.api('POST', '/api/account/refund', { host, cookie, body: { confirm: 'refund-and-delete' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.refunded, true);
  assert.equal(r.json.copy_emailed, true);
  assert.ok(r.json.files_deleted_after, 'the deletion is scheduled');
  assert.equal(stripe.refunds.length, refundsBefore + 1, 'the money went back');
  assert.equal((await shard.api('GET', '/api/public/info', { host })).status, 404, 'the booking page is off');

  // The copy: to the owner, with the spreadsheets and the database attached.
  const mail = resend.sent.slice(sentBefore).find((m) => /data from Kairo/.test(m.subject));
  assert.ok(mail, 'the copy was emailed');
  assert.deepEqual(mail.to, ['leaving@salon.example']);
  const files = Object.fromEntries(mail.attachments.map((a) => [a.filename, Buffer.from(a.content, 'base64')]));
  for (const f of ['clients.csv', 'appointments.csv', 'invoices.csv', 'payments.csv', 'services.csv']) {
    assert.ok(files[f], `${f} is attached`);
  }
  assert.ok(Object.keys(files).some((f) => f.endsWith('.db.gz')), 'and the whole database');
  const clients = files['clients.csv'].toString('utf8');
  assert.match(clients, /'=HYPERLINK/, 'a formula is kept as text, not run');
  assert.match(files['appointments.csv'].toString('utf8'), new RegExp(`${date},.*Cut`));
  assert.match(mail.text, /deleted for good 7 days/);

  // Too soon by the shard's own clock: refused, whoever asks.
  const early = await signed('POST', '/api/platform/tenants/leaving/purge');
  assert.equal(early.status, 409, early.text);
  assert.match(early.json.error, /kept until/);
  assert.ok(fs.existsSync(path.join(shardDir, 'tenants', 'leaving', 'kairo.db')), 'kept until the grace is over');

  // Then the platform's job deletes it, once, and says so.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !row('leaving').files_purged_at) await new Promise((r2) => setTimeout(r2, 200));
  assert.ok(row('leaving').files_purged_at, 'the platform recorded the deletion');
  assert.equal(fs.existsSync(path.join(shardDir, 'tenants', 'leaving')), false, 'the folder is gone from the disk');
  assert.equal((await shard.api('GET', '/api/public/info', { host })).status, 404);
  assert.equal(fs.existsSync(path.join(shardDir, 'tenants', 'leaving')), false, 'and a visit does not make a blank one');
  const again = await signed('POST', '/api/platform/tenants/leaving/purge');
  assert.equal(again.status, 200);
  assert.equal(again.json.gone, true, 'asking again is harmless');
});

test('a salon that is still switched on can never be purged', async () => {
  await buy('staying', 'staying@salon.example');
  const r = await signed('POST', '/api/platform/tenants/staying/purge');
  assert.equal(r.status, 409, r.text);
  assert.match(r.json.error, /still on/);
  assert.ok(fs.existsSync(path.join(shardDir, 'tenants', 'staying', 'kairo.db')));
  assert.equal((await shard.api('GET', '/api/public/info', { host: `staying.${DOMAIN}` })).status, 200);
});

test('when the copy cannot be emailed, nothing is deleted until a person has sent it', async () => {
  await buy('unsent', 'unsent@salon.example');
  const host = `unsent.${DOMAIN}`;
  const { cookie } = await shard.login('unsent@salon.example', PASSWORD, { host });

  resend.down = true;
  let r;
  try {
    r = await shard.api('POST', '/api/account/refund', { host, cookie, body: { confirm: 'refund-and-delete' } });
  } finally {
    resend.down = false;
  }
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.refunded, true, 'the money is theirs either way');
  assert.equal(r.json.copy_emailed, false);
  assert.equal(r.json.files_deleted_after, '');
  assert.equal((await shard.api('GET', '/api/public/info', { host })).status, 404, 'and the salon is off');

  // The job runs every few hundred milliseconds here. Give it time to do the
  // wrong thing, then check it did not.
  await new Promise((r2) => setTimeout(r2, 3500));
  assert.ok(fs.existsSync(path.join(shardDir, 'tenants', 'unsent', 'kairo.db')), 'nothing deleted that was not sent');
  assert.equal(row('unsent').files_purge_at, '');

  const op = await platform.api('POST', '/api/operator/login', { body: { password: 'operator-pass-2026!!' } });
  const opCookie = /kairo_operator=[^;]+/.exec(op.headers.get('set-cookie'))[0];
  const queue = await platform.api('GET', '/api/operator/queue', { cookie: opCookie });
  const task = queue.json.tasks.find((t) => t.slug === 'unsent' && t.kind === 'parting_copy');
  assert.ok(task, 'the operator is asked to send it');

  // The salon is switched off, and its owner's copy is still sendable.
  const sentBefore = resend.sent.length;
  const send = await platform.api('POST', `/api/operator/business/${task.business_id}/send-copy`, { cookie: opCookie, body: {} });
  assert.equal(send.status, 200, send.text);
  const mail = resend.sent.slice(sentBefore).find((m) => /data from Kairo/.test(m.subject));
  assert.ok(mail && mail.to[0] === 'unsent@salon.example', 'the copy went to the owner');
  assert.ok(row('unsent').files_purge_at, 'and only now is the deletion scheduled');
  const after = await platform.api('GET', '/api/operator/queue', { cookie: opCookie });
  assert.equal(after.json.tasks.some((t) => t.slug === 'unsent' && t.kind === 'parting_copy'), false, 'the task is done');

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !row('unsent').files_purged_at) await new Promise((r2) => setTimeout(r2, 200));
  assert.equal(fs.existsSync(path.join(shardDir, 'tenants', 'unsent')), false, 'then the files go');
});
