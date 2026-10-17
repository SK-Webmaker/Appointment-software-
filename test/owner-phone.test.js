// Every alert an owner should get, on the phone that is signed in to Kairo.
//
// A fake Apple that checks the provider token exactly as Apple does sits in
// front of a real Kairo, so each assertion is about what actually reached the
// phone: its title, its words, and that nothing else arrived beside it. The
// failure cases matter as much: a phone Apple says is gone is struck off, a
// refusal is recorded against the phone and explained in plain words, and the
// owner can prove it all works with one button.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead, bookFirstSlot } from './helpers/kairo.js';
import { apnsKeyPair, mockApns, mockClickSend } from './helpers/mocks.js';

const PHONE = 'a1'.repeat(32);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let k, cookie, apns, keys, clicksend;

before(async () => {
  keys = apnsKeyPair();
  apns = await mockApns({ keys });
  clicksend = await mockClickSend();
  k = await startKairo({
    env: {
      KAIRO_APNS_HOST: apns.base,
      KAIRO_APNS_KEY: keys.p8,
      KAIRO_APNS_KEY_ID: keys.keyId,
      KAIRO_APNS_TEAM_ID: keys.teamId,
      KAIRO_APNS_BUNDLE_ID: 'com.kairobookings.kairo',
      CLICKSEND_API_BASE: clicksend.base,
    },
  });
  ({ cookie } = await k.login());
  const reg = await k.api('POST', '/api/app/devices', { cookie, body: { token: PHONE, platform: 'ios', name: "Sha's iPhone" } });
  assert.equal(reg.status, 200, reg.text);
});
after(async () => { await k?.stop(); await apns?.close(); await clicksend?.close(); });

/** The alerts that reached the phone after `from`, waiting a moment for them. */
async function alerts(from, { atLeast = 1, ms = 6000 } = {}) {
  const until = Date.now() + ms;
  while (apns.sent.length - from < atLeast && Date.now() < until) await sleep(25);
  return apns.sent.slice(from).map((x) => ({ kind: x.payload.kind, title: x.payload.aps.alert.title, body: x.payload.aps.alert.body }));
}
/** Wait until the owner has been told about this booking, so it is not mistaken for what comes next. */
async function told(b) {
  const id = b.json.appointment_id;
  const until = Date.now() + 6000;
  while (!apns.sent.some((x) => x.payload.appointment_id === id) && Date.now() < until) await sleep(25);
  assert.ok(apns.sent.some((x) => x.payload.appointment_id === id), `the booking ${id} reached the phone`);
}
/** And give anything that should NOT come a fair chance to arrive first. */
const settle = () => sleep(400);
const ownerMail = (id, kind) => {
  const d = k.db();
  try { return d.prepare('SELECT COUNT(*) AS n FROM messages WHERE appointment_id = ? AND kind = ?').get(id, kind).n; } finally { d.close(); }
};
const client = (n) => ({ first_name: 'Ava', last_name: `Test${n}`, email: `ava${n}@example.com` });

test('a client moving their own booking is one alert that says where it went', async () => {
  const date = openDateAhead(3);
  const first = await bookFirstSlot(k, { date, staffId: 1, serviceIds: [9], client: client(1) });
  assert.equal(first.status, 200, first.text);
  await told(first);
  const d = k.db();
  const token = d.prepare('SELECT cancel_token FROM appointments WHERE id = ?').get(first.json.appointment_id).cancel_token;
  d.close();

  const from = apns.sent.length;
  const later = openDateAhead(5);
  const av = await k.api('GET', `/api/public/availability?date=${later}&staff_id=1&service_ids=9`);
  const moved = await k.api('POST', '/api/public/book', {
    body: { service_ids: [9], staff_id: 1, date: later, start_min: av.json.slots[1].start_min, client: client(1), reschedule_token: token },
  });
  assert.equal(moved.status, 200, moved.text);
  const got = await alerts(from);
  await settle();
  const all = apns.sent.slice(from).map((x) => x.payload.aps.alert.title);
  assert.deepEqual(all, ['Booking moved'], 'one alert, not "Cancellation" and "New booking"');
  assert.match(got[0].body, new RegExp(`Ava Test1 moved .* to ${later} .*\\(was ${date} `));
  assert.equal(ownerMail(first.json.appointment_id, 'owner_cancellation'), 0, 'and no "cancelled" email about a booking that only moved');
  assert.equal(ownerMail(moved.json.appointment_id, 'owner_new_booking'), 0, 'the phone got it, so no email either');
});

test("a client's cancellation goes to the phone, and the email only if the phone missed it", async () => {
  const date = openDateAhead(6);
  const b = await bookFirstSlot(k, { date, staffId: 1, serviceIds: [9], client: client(2) });
  await told(b);
  const d = k.db();
  const token = d.prepare('SELECT cancel_token FROM appointments WHERE id = ?').get(b.json.appointment_id).cancel_token;
  d.close();
  const from = apns.sent.length;
  assert.equal((await k.api('POST', '/api/public/cancel', { body: { token } })).status, 200);
  const got = await alerts(from);
  assert.equal(got[0].title, 'Cancellation');
  assert.match(got[0].body, /Ava Test2 cancelled/);
  await settle();
  assert.equal(ownerMail(b.json.appointment_id, 'owner_cancellation'), 0, 'not told twice');

  // Apple down: the email comes back.
  const b2 = await bookFirstSlot(k, { date, staffId: 1, serviceIds: [9], client: client(3) });
  await told(b2);
  const d2 = k.db();
  const token2 = d2.prepare('SELECT cancel_token FROM appointments WHERE id = ?').get(b2.json.appointment_id).cancel_token;
  d2.close();
  apns.failWith('InternalServerError');
  try {
    assert.equal((await k.api('POST', '/api/public/cancel', { body: { token: token2 } })).status, 200);
    const until = Date.now() + 8000;
    while (ownerMail(b2.json.appointment_id, 'owner_cancellation') === 0 && Date.now() < until) await sleep(50);
    assert.equal(ownerMail(b2.json.appointment_id, 'owner_cancellation'), 1, 'the owner still hears about it');
  } finally { apns.failWith(null); }
});

test("the owner's own cancellation is not an alert, but is still their emailed record", async () => {
  const b = await bookFirstSlot(k, { date: openDateAhead(7), staffId: 1, serviceIds: [9], client: client(4) });
  await told(b);
  const from = apns.sent.length;
  assert.equal((await k.api('POST', `/api/appointments/${b.json.appointment_id}/cancel`, { cookie, body: {} })).status, 200);
  await settle();
  assert.equal(apns.sent.length, from, 'they know: they did it');
  assert.equal(ownerMail(b.json.appointment_id, 'owner_cancellation'), 1);
});

test('a review reaches the phone, stars and all', async () => {
  const b = await bookFirstSlot(k, { date: openDateAhead(2), staffId: 1, serviceIds: [9], client: client(5) });
  await told(b);
  assert.equal((await k.api('PATCH', `/api/appointments/${b.json.appointment_id}/status`, { cookie, body: { status: 'completed' } })).status, 200);
  const d = k.db();
  const token = d.prepare('SELECT review_token FROM appointments WHERE id = ?').get(b.json.appointment_id).review_token;
  d.close();
  const from = apns.sent.length;
  assert.equal((await k.api('POST', '/api/public/review', { body: { token, rating: 2, comment: 'Running late and rushed' } })).status, 200);
  const got = await alerts(from);
  assert.equal(got[0].title, 'New review ★★☆☆☆');
  assert.equal(got[0].body, 'Ava Test5: "Running late and rushed"');
});

test('texts stopping for everybody reaches the phone, once a day', async () => {
  const con = await k.api('POST', '/api/sms/connect', { cookie, body: { username: clicksend.username, api_key: clicksend.apiKey } });
  assert.equal(con.status, 200, con.text);
  assert.equal((await k.api('PUT', '/api/settings', { cookie, body: { sms_notifications_enabled: '1', chan_confirmation: 'sms' } })).status, 200);
  clicksend.smsStatus = 'INSUFFICIENT_CREDIT';
  try {
    const from = apns.sent.length;
    const one = await bookFirstSlot(k, { date: openDateAhead(8), staffId: 1, serviceIds: [9], client: { first_name: 'Text', last_name: 'One', phone: '0400111001' } });
    await told(one);
    const got = await alerts(from, { atLeast: 2 });
    const stopped = got.filter((a) => a.title === 'Texts have stopped');
    assert.equal(stopped.length, 1, `told once: ${JSON.stringify(got.map((a) => a.title))}`);
    assert.match(stopped[0].body, /ClickSend credit has run out/);

    const again = apns.sent.length;
    const two = await bookFirstSlot(k, { date: openDateAhead(8), staffId: 1, serviceIds: [9], client: { first_name: 'Text', last_name: 'Two', phone: '0400111002' } });
    await told(two);
    await settle();
    assert.equal(apns.sent.slice(again).filter((x) => x.payload.aps.alert.title === 'Texts have stopped').length, 0, 'not again the same day');
  } finally {
    clicksend.smsStatus = 'SUCCESS';
    await k.api('PUT', '/api/settings', { cookie, body: { sms_notifications_enabled: '0', chan_confirmation: 'email' } });
  }
});

test('the owner can prove it works: the test button, and the phones it reached', async () => {
  const from = apns.sent.length;
  const t = await k.api('POST', '/api/app/push/test', { cookie });
  assert.equal(t.status, 200, t.text);
  assert.equal(t.json.sent, 1);
  const got = await alerts(from);
  assert.match(got[0].body, /Notifications are working/);

  const list = await k.api('GET', '/api/app/devices', { cookie });
  assert.equal(list.status, 200);
  const phone = list.json.devices.find((x) => x.name === "Sha's iPhone");
  assert.ok(phone, 'the phone is listed by the name it gave');
  assert.ok(phone.last_push_at, 'with when it last received one');
  assert.equal(phone.problem, '');
  assert.ok(!JSON.stringify(list.json).includes(PHONE), 'and never its token');

  // Apple refusing: said in words, and remembered against the phone.
  apns.failWith('InternalServerError');
  try {
    const bad = await k.api('POST', '/api/app/push/test', { cookie });
    assert.equal(bad.status, 400);
    assert.match(bad.json.error, /Apple didn't accept it \(500 InternalServerError\)/);
    const after1 = (await k.api('GET', '/api/app/devices', { cookie })).json.devices.find((x) => x.id === phone.id);
    assert.match(after1.problem, /Apple didn't accept it/);
  } finally { apns.failWith(null); }
  assert.equal((await k.api('POST', '/api/app/push/test', { cookie })).status, 200);
  const cleared = (await k.api('GET', '/api/app/devices', { cookie })).json.devices.find((x) => x.id === phone.id);
  assert.equal(cleared.problem, '', 'the next one Apple takes clears it');
});

test("a token from another app is struck off, and a phone can be taken off from anywhere", async () => {
  const other = 'b2'.repeat(32);
  await k.api('POST', '/api/app/devices', { cookie, body: { token: other, platform: 'ios', name: 'Old iPad' } });
  apns.foreign(other);
  await k.api('POST', '/api/app/push/test', { cookie });
  const names = (await k.api('GET', '/api/app/devices', { cookie })).json.devices.map((x) => x.name);
  assert.ok(!names.includes('Old iPad'), 'never tried again');

  const spare = 'c3'.repeat(32);
  await k.api('POST', '/api/app/devices', { cookie, body: { token: spare, platform: 'ios', name: 'Spare phone' } });
  const id = (await k.api('GET', '/api/app/devices', { cookie })).json.devices.find((x) => x.name === 'Spare phone').id;
  assert.equal((await k.api('DELETE', `/api/app/devices/${id}`, { cookie })).status, 200);
  assert.equal((await k.api('DELETE', `/api/app/devices/${id}`, { cookie })).status, 404);
  const from = apns.sent.length;
  await k.api('POST', '/api/app/push/test', { cookie });
  assert.ok(apns.sent.slice(from).every((x) => x.deviceToken !== spare), 'a removed phone gets nothing');
});
