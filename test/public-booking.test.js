import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead, bookFirstSlot } from './helpers/kairo.js';

let k, cookie;
const date = openDateAhead(3);
const client = { first_name: 'Phase', last_name: 'Six', email: 'phase6@example.com', phone: '0400000006' };

before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
after(async () => { await k.stop(); });

test('public info exposes the menu and staff first names, never clients, keys or revenue', async () => {
  const r = await k.api('GET', '/api/public/info');
  assert.equal(r.status, 200);
  assert.equal(r.json.business_name, 'Luxe Hair Studio');
  assert.ok(r.json.services.length > 5);
  assert.ok(r.json.staff.length === 3);
  assert.ok(r.json.open_dates.length > 30);
  const text = JSON.stringify(r.json);
  assert.doesNotMatch(text, /example\.com/, 'no client emails');
  assert.doesNotMatch(text, /\(555\) 2/, 'no client phones');
  assert.doesNotMatch(text, /\bre_[A-Za-z0-9]{8,}|sk_(live|test)_|session_secret|_api_key/, 'no keys');
  assert.equal(r.json.deposit.enabled, false);
});

test('availability lists 15-minute slots for a stylist and refuses bad input', async () => {
  const r = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  assert.equal(r.status, 200);
  assert.equal(r.json.duration_min, 60);
  assert.ok(r.json.slots.length > 3);
  for (const s of r.json.slots) { assert.equal(s.start_min % 15, 0); assert.equal(s.staff_id, 1); }
  assert.equal((await k.api('GET', `/api/public/availability?date=2020-01-01&staff_id=1&service_ids=9`)).status, 400);
  assert.equal((await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9999`)).status, 400);
  assert.equal((await k.api('GET', `/api/public/availability?date=2026-13-45&staff_id=1&service_ids=9`)).status, 400);
});

test('a booking creates the appointment, the client, the service rows and queues the messages', async () => {
  const r = await bookFirstSlot(k, { date, staffId: 1, serviceIds: [9, 10], client });
  assert.equal(r.status, 200, r.text);
  assert.match(r.json.reference, /^BK-\d{5}$/);
  assert.equal(r.json.date, date);
  assert.equal(r.json.start_min, r.slot);
  assert.equal(r.json.end_min, r.slot + 60 + 45, 'duration is the sum of both services');
  assert.equal(r.json.service, 'Cut & Finish + Blow Dry');
  assert.match(r.json.ics_url, /^\/api\/public\/ics\/\d+\?t=[A-Za-z0-9_-]{32}$/);
  assert.equal(r.json.checkout_url, null);

  const d = k.db();
  const appt = d.prepare('SELECT * FROM appointments WHERE id = ?').get(r.json.appointment_id);
  assert.equal(appt.source, 'online');
  assert.equal(appt.status, 'booked');
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM appointment_services WHERE appointment_id = ?').get(appt.id).n, 2);
  const c = d.prepare('SELECT * FROM clients WHERE id = ?').get(appt.client_id);
  assert.equal(c.email, 'phase6@example.com');
  const kinds = d.prepare('SELECT kind, status, channel FROM messages WHERE appointment_id = ? ORDER BY id').all(appt.id);
  assert.deepEqual(kinds.map((m) => m.kind).sort(), ['confirmation', 'owner_new_booking', 'reminder']);
  for (const m of kinds) assert.equal(m.channel, 'email', 'SMS is off by default');
  assert.equal(kinds.find((m) => m.kind === 'reminder').status, 'queued');
  assert.equal(kinds.find((m) => m.kind === 'confirmation').status, 'skipped', 'no provider → skipped, never lost');
  d.close();
});

test('the same slot cannot be booked twice, even by a hand-crafted request', async () => {
  const first = await bookFirstSlot(k, { date, staffId: 2, serviceIds: [9], client });
  assert.equal(first.status, 200);
  const dup = await k.api('POST', '/api/public/book', {
    body: { service_ids: [9], staff_id: 2, date, start_min: first.slot, client: { first_name: 'Dup', email: 'dup@example.com' } },
  });
  assert.equal(dup.status, 409);
  assert.match(dup.json.error, /just taken/);
  const d = k.db();
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM clients WHERE email = ?').get('dup@example.com').n, 0, 'a refused booking leaves no ghost client');
  d.close();
});

test('forty simultaneous bookings for one slot produce exactly one appointment', async () => {
  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=3&service_ids=10`);
  const slot = av.json.slots[av.json.slots.length - 1].start_min;
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => k.api('POST', '/api/public/book', {
    body: { service_ids: [10], staff_id: 3, date, start_min: slot, client: { first_name: `Racer${i}`, email: `racer${i}@example.com` } },
  })));
  const ok = results.filter((r) => r.status === 200).length;
  const conflicts = results.filter((r) => r.status === 409).length;
  assert.equal(ok, 1, 'exactly one winner');
  assert.equal(conflicts, 39);
  const d = k.db();
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM appointments WHERE staff_id = 3 AND date = ? AND start_min = ? AND status != ?').get(date, slot, 'cancelled').n, 1);
  d.close();
});

test('unknown fields are refused, including nested ones', async () => {
  const top = await k.api('POST', '/api/public/book', { body: { service_ids: [9], staff_id: 1, date, start_min: 600, is_admin: true, client } });
  assert.equal(top.status, 400);
  assert.equal(top.json.error, 'Unexpected field: is_admin');
  const nested = await k.api('POST', '/api/public/book', { body: { service_ids: [9], staff_id: 1, date, start_min: 600, client: { ...client, role: 'owner' } } });
  assert.equal(nested.status, 400);
  assert.equal(nested.json.error, 'Unexpected field: client.role');
});

test('a booking needs a first name and a way to reach the person', async () => {
  const r = await k.api('POST', '/api/public/book', { body: { service_ids: [9], staff_id: 1, date, start_min: 600, client: { first_name: 'Nobody' } } });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /phone number or email/);
});

test('past dates, past times today and dates beyond the horizon are refused server-side', async () => {
  const past = await k.api('POST', '/api/public/book', { body: { service_ids: [9], staff_id: 1, date: '2020-01-06', start_min: 600, client } });
  assert.equal(past.status, 400);
  const far = openDateAhead(120);
  const beyond = await k.api('POST', '/api/public/book', { body: { service_ids: [9], staff_id: 1, date: far, start_min: 600, client } });
  assert.equal(beyond.status, 400);
  assert.match(beyond.json.error, /90 days/);
});

test('a closed day offers no slots and refuses a crafted booking with 409', async () => {
  // Close the weekday of `date` for the demo salon.
  const dow = new Date(`${date}T12:00:00`).getDay();
  const open = [1, 2, 3, 4, 5, 6].filter((d) => d !== dow).join(',');
  await k.api('PUT', '/api/settings', { cookie, body: { open_days: open } });
  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  assert.equal(av.json.slots.length, 0);
  const info = await k.api('GET', '/api/public/info');
  assert.ok(!info.json.open_dates.some((d) => d.date === date), 'closed date absent from the picker');
  const r = await k.api('POST', '/api/public/book', { body: { service_ids: [9], staff_id: 1, date, start_min: 600, client } });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /closed that day/);
  await k.api('PUT', '/api/settings', { cookie, body: { open_days: '1,2,3,4,5,6' } });
});

test('blocked time is removed from availability and refused on booking', async () => {
  const d2 = openDateAhead(5);
  const av = await k.api('GET', `/api/public/availability?date=${d2}&staff_id=1&service_ids=10`);
  const slot = av.json.slots[0].start_min;
  const block = await k.api('POST', '/api/time-blocks', { cookie, body: { staff_id: 1, date: d2, start_min: slot, end_min: slot + 45, reason: 'private dentist' } });
  assert.equal(block.status, 200, block.text);
  const after = await k.api('GET', `/api/public/availability?date=${d2}&staff_id=1&service_ids=10`);
  assert.ok(!after.json.slots.some((s) => s.start_min === slot));
  const r = await k.api('POST', '/api/public/book', { body: { service_ids: [10], staff_id: 1, date: d2, start_min: slot, client } });
  assert.equal(r.status, 409);
  assert.doesNotMatch(JSON.stringify(await (await k.api('GET', '/api/public/info')).json), /dentist/, 'the reason is never public');
});

test('switching online booking off hides the page data and refuses bookings', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { booking_enabled: '0' } });
  assert.equal((await k.api('GET', '/api/public/info')).status, 404);
  assert.equal((await k.api('POST', '/api/public/book', { body: { service_ids: [9], staff_id: 1, date, start_min: 600, client } })).status, 404);
  await k.api('PUT', '/api/settings', { cookie, body: { booking_enabled: '1' } });
  assert.equal((await k.api('GET', '/api/public/info')).status, 200);
});
