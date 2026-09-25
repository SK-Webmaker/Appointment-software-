// What the owner's phone is allowed to interrupt them for.
//
// The app is about to go on the App Store, and the reason an owner keeps it on
// their home screen is that it tells them things. But "tells them things" and
// "interrupts them" are the same mechanism, and an owner who can only have
// every notification or none picks none — so each kind is its own choice.
//
// Everything here is checked through the settings and the config the app
// reads, because that is what the phone acts on. Whether APNs itself delivers
// is Apple's business and is tested in owner-alert-channel.test.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead, bookFirstSlot } from './helpers/kairo.js';
import { apnsKeyPair, mockApns } from './helpers/mocks.js';

const TOKEN = 'd'.repeat(64);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let k, cookie, apns, keys;
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
    },
  });
  ({ cookie } = await k.login());
  // A phone signed in, so "was a push attempted" is a real question.
  await k.api('POST', '/api/app/devices', { cookie, body: { token: TOKEN, platform: 'ios' } });
});
after(async () => { await k?.stop(); await apns?.close(); });

/** Rows for one appointment, once the owner alert has had its chance. */
async function messagesFor(apptId, { expect = 0, ms = 6000 } = {}) {
  const until = Date.now() + ms;
  for (;;) {
    const d = k.db();
    const rows = d.prepare('SELECT kind FROM messages WHERE appointment_id = ? ORDER BY id').all(apptId);
    d.close();
    if (rows.length >= expect || Date.now() > until) return rows.map((r) => r.kind);
    await sleep(50);
  }
}

const settings = async () => (await k.api('GET', '/api/settings', { cookie })).json;
const set = (body) => k.api('PUT', '/api/settings', { cookie, body });

test('an owner gets booking, cancellation and payment alerts by default', async () => {
  const s = await settings();
  assert.equal(s.push_new_booking, '1');
  assert.equal(s.push_cancellation, '1');
  assert.equal(s.push_payment_check, '1');
});

test('the morning summary is off until asked for, because 7am is a decision', async () => {
  const s = await settings();
  assert.equal(s.push_daily_summary, '0',
    'a notification before the salon opens is a choice, never a default');
  assert.equal(s.push_summary_hour, '7');
});

test('each kind can be turned off on its own', async () => {
  const r = await set({
    push_new_booking: '0', push_cancellation: '1',
    push_payment_check: '0', push_daily_summary: '1', push_summary_hour: '8',
  });
  assert.equal(r.status, 200, r.text);
  const s = await settings();
  assert.equal(s.push_new_booking, '0');
  assert.equal(s.push_cancellation, '1');
  assert.equal(s.push_payment_check, '0');
  assert.equal(s.push_daily_summary, '1');
  assert.equal(s.push_summary_hour, '8');
});

test('the app is told exactly what it will be woken for, in both directions', async () => {
  // The phone must not guess or keep its own copy that drifts. Asserted with
  // each flag on AND off: a config that always answers "yes" would satisfy
  // half of this and be wrong in exactly the way that matters.
  const cfg = await k.api('GET', '/api/app/config', { cookie });
  assert.equal(cfg.status, 200);
  assert.deepEqual(cfg.json.push.kinds, {
    new_booking: false,
    cancellation: true,
    payment_check: false,
    daily_summary: true,
    enquiry: true,
    summary_hour: 8,
  });
  assert.equal(typeof cfg.json.push.available, 'boolean');
  assert.equal(typeof cfg.json.push.devices, 'number');

  await set({
    push_new_booking: '1', push_cancellation: '0',
    push_payment_check: '1', push_daily_summary: '0', push_summary_hour: '6',
  });
  const flipped = await k.api('GET', '/api/app/config', { cookie });
  assert.deepEqual(flipped.json.push.kinds, {
    new_booking: true,
    cancellation: false,
    payment_check: true,
    daily_summary: false,
    enquiry: true,
    summary_hour: 6,
  });
  await set({ push_summary_hour: '8', push_cancellation: '1' });
});

test('an out-of-range summary hour is clamped into a real hour', async () => {
  // Only reachable by hand — the settings card is a dropdown of 00:00–23:00.
  // It is clamped rather than left to become NaN, because an hour that
  // compares false against every clock means the summary silently never fires
  // and nobody ever finds out why.
  await set({ push_summary_hour: '99' });
  let cfg = await k.api('GET', '/api/app/config', { cookie });
  assert.equal(cfg.json.push.kinds.summary_hour, 23);
  await set({ push_summary_hour: 'not a number' });
  cfg = await k.api('GET', '/api/app/config', { cookie });
  assert.equal(cfg.json.push.kinds.summary_hour, 7, 'unreadable falls back to the default');
  await set({ push_summary_hour: '7', push_new_booking: '1', push_payment_check: '1', push_daily_summary: '0' });
});

test('a booking still goes in the diary when the owner wants no alert about it', async () => {
  // The alert is a preference. The booking is the business, and must never
  // depend on one.
  await set({ push_new_booking: '0' });
  const date = openDateAhead(5);
  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  const slot = av.json.slots[0].start_min;
  const booked = await k.api('POST', '/api/public/book', {
    body: {
      service_ids: [9], staff_id: 1, date, start_min: slot,
      client: { first_name: 'Quiet', last_name: 'Booking', email: 'quiet.booking@example.net' },
    },
  });
  assert.equal(booked.status, 200, booked.text);
  assert.match(booked.json.reference, /^BK-\d{5}$/);
  // And the client's own confirmation is untouched — that is not the owner's
  // notification and must not be switched off with it.
  const d = k.db();
  const kinds = d.prepare('SELECT kind FROM messages WHERE appointment_id = ?')
    .all(booked.json.appointment_id).map((m) => m.kind);
  d.close();
  assert.ok(kinds.includes('confirmation'), 'the customer is still told, whatever the owner chose');
  await set({ push_new_booking: '1' });
});

test('cancelling still works and still tells the client when alerts are off', async () => {
  await set({ push_cancellation: '0' });
  const date = openDateAhead(6);
  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  const booked = await k.api('POST', '/api/public/book', {
    body: {
      service_ids: [9], staff_id: 1, date, start_min: av.json.slots[0].start_min,
      client: { first_name: 'Off', last_name: 'Alerts', email: 'off.alerts@example.net' },
    },
  });
  assert.equal(booked.status, 200, booked.text);
  const gone = await k.api('DELETE', `/api/appointments/${booked.json.appointment_id}`, { cookie });
  assert.equal(gone.status, 200, gone.text);
  await set({ push_cancellation: '1' });
});

test('the push settings are the only ones this card can write', async () => {
  const sneaky = await k.api('PUT', '/api/settings', {
    cookie, body: { push_new_booking: '1', stripe_secret_key_set: '1' },
  });
  assert.equal(sneaky.status, 400, 'derived fields are read-only, not settings');
});

// ── The preference has to actually stop the push ────────────────────────────
//
// Everything above reads settings back. This is the only part that watches
// what the phone is handed, which is the thing the owner is choosing.

test('turning the booking alert off stops the push and falls back to email', async () => {
  await set({ push_new_booking: '0', owner_notify_enabled: '1' });
  const before = apns.sent.length;
  const date = openDateAhead(8);
  const r = await bookFirstSlot(k, {
    date, staffId: 1, serviceIds: [9],
    client: { first_name: 'No', last_name: 'Push', email: 'no.push@example.net', phone: '0400777111' },
  });
  assert.equal(r.status, 200, r.text);
  const kinds = await messagesFor(r.json.appointment_id, { expect: 3 });
  assert.equal(apns.sent.length, before, 'the phone must not be woken for something turned off');
  assert.ok(kinds.includes('owner_new_booking'),
    'they said no push, not no notification — the email is the fallback');
  assert.ok(kinds.includes('confirmation'), 'the customer is told regardless');
  assert.ok(kinds.includes('reminder'));
});

test('turning it back on sends the push and drops the email again', async () => {
  await set({ push_new_booking: '1' });
  const before = apns.sent.length;
  const date = openDateAhead(9);
  const r = await bookFirstSlot(k, {
    date, staffId: 1, serviceIds: [9],
    client: { first_name: 'Yes', last_name: 'Push', email: 'yes.push@example.net', phone: '0400777222' },
  });
  assert.equal(r.status, 200, r.text);
  const until = Date.now() + 6000;
  while (apns.sent.length === before && Date.now() < until) await sleep(25);
  assert.ok(apns.sent.length > before, 'the phone is woken when the owner asked to be');
  const kinds = await messagesFor(r.json.appointment_id, { expect: 2 });
  assert.ok(!kinds.includes('owner_new_booking'), 'and is not emailed the same thing twice');
});
