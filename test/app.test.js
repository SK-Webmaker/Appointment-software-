// The app on the owner's phone — the half of it that lives on this side.
//
// The Swift shell cannot be compiled here, so what is proved here is
// everything the shell depends on: that a phone can be registered and
// forgotten, that Apple would accept the token Kairo signs, that a customer's
// booking reaches the owner's lock screen, that a phone Apple says is gone
// stops being sent to, and that an owner can delete their account without
// leaving the app.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, bookFirstSlot, openDateAhead, ADMIN } from './helpers/kairo.js';
import { apnsKeyPair, mockApns } from './helpers/mocks.js';

const TOKEN_A = 'a'.repeat(64);
const TOKEN_B = 'b'.repeat(64);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The phone is woken after the customer is answered, so give it a moment. */
async function waitForPush(apns, n, ms = 5000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (apns.sent.length >= n) return apns.sent;
    await sleep(50);
  }
  return apns.sent;
}

describe('the app: push, devices and deletion', () => {
  let k; let apns; let keys; let cookie;

  before(async () => {
    keys = apnsKeyPair();
    apns = await mockApns({ keys });
    k = await startKairo({
      env: {
        KAIRO_APNS_HOST: apns.base,
        KAIRO_APNS_KEY: keys.p8,
        KAIRO_APNS_KEY_ID: keys.keyId,
        KAIRO_APNS_TEAM_ID: keys.teamId,
        KAIRO_APNS_BUNDLE_ID: 'com.kairobookings.kairo',
        KAIRO_APPLE_APP_ID: 'TEAM123456.com.kairobookings.kairo',
      },
    });
    ({ cookie } = await k.login());
  });
  after(async () => { await k?.stop(); await apns?.close(); });

  test('the shell is told what to draw before any screen exists', async () => {
    const r = await k.api('GET', '/api/app/config', { cookie });
    assert.equal(r.status, 200);
    assert.equal(typeof r.json.version, 'string');
    assert.ok(r.json.business.name);
    assert.equal(r.json.push.available, true);
    assert.equal(r.json.push.devices, 0);
    // It is the owner's own workspace, not a public page.
    assert.equal((await k.api('GET', '/api/app/config')).status, 401);
  });

  test('a phone signs in, and signing in twice is still one phone', async () => {
    const r = await k.api('POST', '/api/app/devices', {
      cookie, body: { token: TOKEN_A, platform: 'ios', name: "Sha's iPhone" },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.push_available, true);

    // Reinstalling the app hands back the same token: update, never a second row.
    const again = await k.api('POST', '/api/app/devices', {
      cookie, body: { token: TOKEN_A.toUpperCase(), platform: 'ios', name: "Sha's new iPhone" },
    });
    assert.equal(again.status, 200);

    const d = k.db();
    const rows = d.prepare('SELECT * FROM devices').all();
    d.close();
    assert.equal(rows.length, 1, 'the same phone must not accumulate rows');
    assert.equal(rows[0].name, "Sha's new iPhone");
    assert.equal(rows[0].token, TOKEN_A, 'stored lowercased, so case cannot make one phone into two');
  });

  test('something that is not a device token is refused at the door', async () => {
    for (const token of ['not-a-token', 'zz' + 'a'.repeat(62), 'abc', '<script>']) {
      const r = await k.api('POST', '/api/app/devices', { cookie, body: { token } });
      assert.equal(r.status, 400, `${token} should not be stored`);
    }
    const d = k.db();
    assert.equal(d.prepare('SELECT COUNT(*) AS n FROM devices').get().n, 1);
    d.close();
  });

  test('Apple accepts the token Kairo signs, and the alert says what it should', async () => {
    const before_ = apns.sent.length;
    const r = await k.api('POST', '/api/app/push/test', { cookie });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.sent, 1);

    const got = apns.sent[before_];
    assert.ok(got, 'the mock verified the ES256 provider token and the topic');
    assert.equal(got.deviceToken, TOKEN_A);
    assert.equal(got.headers['apns-push-type'], 'alert');
    assert.equal(got.headers['apns-topic'], 'com.kairobookings.kairo');
    assert.match(got.payload.aps.alert.body, /working/i);
  });

  test('the provider token is reused, because Apple refuses one minted too often', async () => {
    const a = apns.sent.at(-1).headers.authorization;
    await k.api('POST', '/api/app/push/test', { cookie });
    const b = apns.sent.at(-1).headers.authorization;
    assert.equal(a, b, 'a fresh JWT per push is how you earn TooManyProviderTokenUpdates');
  });

  test('a customer books, and the owner finds out on their phone', async () => {
    const before_ = apns.sent.length;
    const date = openDateAhead(4);
    const r = await bookFirstSlot(k, {
      date,
      client: { first_name: 'Maya', last_name: 'Okonkwo', email: 'maya@example.com', phone: '0400000111' },
    });
    assert.equal(r.status, 200, r.text);

    const sent = await waitForPush(apns, before_ + 1);
    const got = sent[before_];
    assert.ok(got, 'a booking must reach the phone');
    assert.equal(got.payload.aps.alert.title, 'New booking');
    assert.match(got.payload.aps.alert.body, /Maya Okonkwo/);
    assert.match(got.payload.aps.alert.body, new RegExp(date));
    assert.equal(got.payload.kind, 'booking');
    // Collapsed per appointment: book, cancel and rebook leaves one line on the
    // lock screen rather than three.
    assert.equal(got.headers['apns-collapse-id'], `appt-${r.json.appointment_id}`);
  });

  test('a phone Apple says is gone is struck out, and not tried again', async () => {
    await k.api('POST', '/api/app/devices', { cookie, body: { token: TOKEN_B, name: 'old phone' } });
    apns.kill(TOKEN_B);

    const before_ = apns.sent.length;
    const r = await k.api('POST', '/api/app/push/test', { cookie });
    assert.equal(r.status, 200, 'the phone that still works got it');
    assert.equal(r.json.sent, 1, 'one of the two');

    const d = k.db();
    const dead = d.prepare('SELECT * FROM devices WHERE token = ?').get(TOKEN_B);
    assert.notEqual(dead.failed_at, '', 'a 410 must retire the token');
    assert.equal(dead.failed_reason, 'Unregistered');
    d.close();

    // And it is not offered to Apple again.
    const after_ = apns.sent.length;
    await k.api('POST', '/api/app/push/test', { cookie });
    assert.ok(!apns.sent.slice(after_).some((s) => s.deviceToken === TOKEN_B), 'a dead phone must stop being tried');
    assert.equal(apns.sent.length - after_, 1);
    assert.ok(apns.sent.length > before_);
  });

  test('the checklist notices the phone without anybody ticking anything', async () => {
    const r = await k.api('GET', '/api/checklist', { cookie });
    assert.equal(r.status, 200);
    const app = r.json.items.find((i) => i.id === 'app');
    assert.equal(app.done, true);
    assert.match(app.detail, /phone/);

    const d = k.db();
    const ticked = d.prepare("SELECT value FROM settings WHERE key = 'checklist_app_installed'").get();
    d.close();
    assert.ok(!ticked || ticked.value !== '1', 'done because a phone is signed in, not because a box was ticked');
  });

  test('signing out on a phone stops that phone getting the book', async () => {
    const r = await k.api('DELETE', '/api/app/devices', { cookie, body: { token: TOKEN_A } });
    assert.equal(r.status, 200);
    assert.equal(r.json.removed, 1);

    const before_ = apns.sent.length;
    const t = await k.api('POST', '/api/app/push/test', { cookie });
    assert.equal(t.status, 400, 'no live phone is left');
    assert.equal(apns.sent.length, before_);
  });

  test('universal links open the app for booking pages, and nothing else', async () => {
    const r = await k.api('GET', '/.well-known/apple-app-site-association');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /application\/json/);
    const d = r.json.applinks.details[0];
    assert.equal(d.appID, 'TEAM123456.com.kairobookings.kairo');
    assert.deepEqual(d.paths, ['/book', '/book/*', '/r/*']);
    assert.ok(!d.paths.includes('*'), 'swallowing the whole domain would break the browser for customers');
  });
});

describe('a server with no Apple credentials', () => {
  let k; let cookie;
  before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
  after(async () => { await k?.stop(); });

  test('says so, and a booking still works', async () => {
    const cfg = await k.api('GET', '/api/app/config', { cookie });
    assert.equal(cfg.json.push.available, false);
    assert.equal((await k.api('POST', '/api/app/push/test', { cookie })).status, 400);

    // The phone can still be registered — the app is useful without push, and
    // the credentials may arrive tomorrow.
    assert.equal((await k.api('POST', '/api/app/devices', { cookie, body: { token: TOKEN_A } })).status, 200);

    const r = await bookFirstSlot(k, {
      date: openDateAhead(5),
      client: { first_name: 'Tom', last_name: 'Reed', email: 't@example.com', phone: '0400000222' },
    });
    assert.equal(r.status, 200, 'no Apple key must never cost a customer their booking');
  });

  test('the app site association is absent rather than wrong', async () => {
    const r = await k.api('GET', '/.well-known/apple-app-site-association');
    assert.equal(r.status, 404, 'an association naming no app would only break links');
  });
});

describe('deleting the account from inside the app', () => {
  let k; let cookie;
  before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
  after(async () => { await k?.stop(); });

  test('the wrong password deletes nothing', async () => {
    const r = await k.api('POST', '/api/account/delete', {
      cookie, body: { password: 'not-the-password', confirm: 'Kairo Demo Salon' },
    });
    assert.equal(r.status, 403);
    assert.equal((await k.api('GET', '/api/checklist', { cookie })).status, 200, 'still signed in');
  });

  test('the business name must be typed out, exactly', async () => {
    const name = (await k.api('GET', '/api/settings', { cookie })).json.business_name;
    const r = await k.api('POST', '/api/account/delete', {
      cookie, body: { password: ADMIN.password, confirm: 'delete' },
    });
    assert.equal(r.status, 400);
    assert.match(r.json.error, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  test('done properly, the salon shuts at once and the data goes in seven days', async () => {
    const name = (await k.api('GET', '/api/settings', { cookie })).json.business_name;
    await k.api('POST', '/api/app/devices', { cookie, body: { token: TOKEN_A } });

    const r = await k.api('POST', '/api/account/delete', {
      cookie, body: { password: ADMIN.password, confirm: name.toUpperCase() },
    });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.files_removed_after_days, 7);
    assert.equal(r.json.platform_notified, false, 'no platform is configured here, and that must not be an error');
    assert.match(r.json.message, /7 days/);

    // Shut: nobody is signed in anywhere, and the booking page is off.
    assert.equal((await k.api('GET', '/api/checklist', { cookie })).status, 401, 'every session retired');
    const info = await k.api('GET', '/api/public/info');
    assert.ok(info.status !== 200 || info.json.booking_enabled === false, 'the booking page must stop taking bookings');

    const d = k.db();
    assert.equal(d.prepare('SELECT COUNT(*) AS n FROM devices').get().n, 0, 'no phone keeps getting pushes');
    assert.ok(d.prepare("SELECT value FROM settings WHERE key = 'deletion_requested_at'").get().value);
    // The book itself is still there: that is the point of the seven days.
    assert.ok(d.prepare('SELECT COUNT(*) AS n FROM clients').get().n > 0);
    d.close();
  });
});
