import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead } from './helpers/kairo.js';

// What an owner does to a booking that is already on the calendar: adds a
// service on top, checks it out, sends the client a reminder.

let k, cookie, svc;
const date = openDateAhead(90); // past the demo diary, so the only bookings are these
const STAFF = 2;

before(async () => {
  k = await startKairo();
  ({ cookie } = await k.login());
  const d = k.db();
  svc = Object.fromEntries(d.prepare('SELECT id, name, duration_min, price_cents FROM services WHERE id IN (9, 10)').all().map((r) => [r.id, r]));
  d.close();
});
after(async () => { await k.stop(); });

const book = (start, first, extra = {}) => k.api('POST', '/api/appointments', {
  cookie,
  body: {
    staff_id: STAFF, date, start_min: start, end_min: start + svc[9].duration_min, service_ids: [9],
    new_client: { first_name: first, email: `${first.toLowerCase()}@example.com` }, notify_client: false, force: true, ...extra,
  },
});

test('adding a service that runs into the next booking saves, without the double-booking question', async () => {
  const bobby = await book(600, 'Bobby');
  assert.equal(bobby.status, 200, bobby.text);
  const next = await book(600 + svc[9].duration_min, 'Sarah');
  assert.equal(next.status, 200, next.text);

  const end = 600 + svc[9].duration_min + svc[10].duration_min;
  const r = await k.api('PUT', `/api/appointments/${bobby.json.id}`, {
    cookie, body: { client_id: bobby.json.client_id, staff_id: STAFF, date, start_min: 600, end_min: end, service_ids: [9, 10] },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.service_ids_csv, '9,10');
  assert.equal(r.json.end_min, end);
  assert.equal(r.json.runs_into?.client_name, 'Sarah');

  // Moving it on top of somebody else is still a real double booking.
  const mv = await k.api('PUT', `/api/appointments/${bobby.json.id}`, {
    cookie, body: { client_id: bobby.json.client_id, staff_id: STAFF, date, start_min: 600 + svc[9].duration_min, service_ids: [9, 10], notify_client: false },
  });
  assert.equal(mv.status, 409);
});

test('checkout bills every service, including one added after the bill was started', async () => {
  const a = await book(900, 'Casey');
  const first = await k.api('POST', '/api/invoices/from-appointment', { cookie, body: { appointment_id: a.json.id } });
  assert.equal(first.status, 200, first.text);
  assert.deepEqual(first.json.items.map((i) => i.description), [svc[9].name]);

  const put = await k.api('PUT', `/api/appointments/${a.json.id}`, {
    cookie, body: { client_id: a.json.client_id, staff_id: STAFF, date, start_min: 900, service_ids: [9, 10] },
  });
  assert.equal(put.status, 200, put.text);

  const again = await k.api('POST', '/api/invoices/from-appointment', { cookie, body: { appointment_id: a.json.id } });
  assert.equal(again.json.id, first.json.id);
  assert.deepEqual(again.json.items.map((i) => i.description), [svc[9].name, svc[10].name]);
  assert.equal(again.json.items[1].unit_cents, svc[10].price_cents);
});

test('send reminder: the reminder goes out now, on the channel picked', async () => {
  const a = await book(1020, 'Remi');
  const r = await k.api('POST', `/api/appointments/${a.json.id}/remind`, { cookie, body: { channel: 'email' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.sent, 1);
  const d = k.db();
  const rows = d.prepare("SELECT channel, to_addr, subject, send_after FROM messages WHERE appointment_id = ? AND kind = 'reminder' ORDER BY id").all(a.json.id);
  d.close();
  const now = rows.at(-1);
  assert.equal(now.channel, 'email');
  assert.equal(now.to_addr, 'remi@example.com');
  assert.match(now.subject, /Reminder|Still on/);
  // Due now, not the day before like the scheduled one, which is still there.
  const p = (n) => String(n).padStart(2, '0');
  const t = new Date(Date.now() + 60_000);
  assert.ok(now.send_after <= `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`, now.send_after);
  assert.equal(rows.length, 2);

  const walkIn = await k.api('POST', '/api/appointments', {
    cookie, body: { staff_id: STAFF, date, start_min: 1200, service_ids: [9], force: true, notify_client: false },
  });
  assert.equal((await k.api('POST', `/api/appointments/${walkIn.json.id}/remind`, { cookie, body: {} })).status, 400);

  await k.api('POST', `/api/appointments/${a.json.id}/cancel`, { cookie, body: { notify_client: false } });
  assert.equal((await k.api('POST', `/api/appointments/${a.json.id}/remind`, { cookie, body: {} })).status, 400);
});
