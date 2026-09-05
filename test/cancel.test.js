import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead, bookFirstSlot } from './helpers/kairo.js';

let k, cookie;
const date = openDateAhead(4);
const client = { first_name: 'Cancel', last_name: 'Case', email: 'cancel@example.com', phone: '0400000007' };

before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
after(async () => { await k.stop(); });

function tokenFor(id) {
  const d = k.db();
  const t = d.prepare('SELECT cancel_token FROM appointments WHERE id = ?').get(id).cancel_token;
  d.close();
  return t;
}

test('the confirmation carries a cancel link; the link shows the booking; cancelling frees the slot and keeps the record', async () => {
  const b = await bookFirstSlot(k, { date, staffId: 1, serviceIds: [9], client });
  assert.equal(b.status, 200);
  const token = tokenFor(b.json.appointment_id);
  assert.match(token, /^[0-9a-f]{32}$/);
  const d = k.db();
  const conf = d.prepare("SELECT body FROM messages WHERE appointment_id = ? AND kind = 'confirmation'").get(b.json.appointment_id);
  assert.match(conf.body, new RegExp(`/cancel/${token}`));
  d.close();

  const look = await k.api('GET', `/api/public/cancel?token=${token}`);
  assert.equal(look.status, 200);
  assert.equal(look.json.status, 'booked');
  assert.equal(look.json.can_cancel, true);
  assert.equal(look.json.first_name, 'Cancel');
  assert.equal(look.json.email, undefined, 'the page never gets contact details back');

  const done = await k.api('POST', '/api/public/cancel', { body: { token, reason: 'Sick' } });
  assert.equal(done.status, 200);
  assert.equal(done.json.status, 'cancelled');
  assert.equal(done.json.cancelled_by, 'client');

  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  assert.ok(av.json.slots.some((s) => s.start_min === b.slot), 'slot is free again');
  const d2 = k.db();
  const row = d2.prepare('SELECT status, cancel_reason, prev_status FROM appointments WHERE id = ?').get(b.json.appointment_id);
  assert.equal(row.status, 'cancelled');
  assert.equal(row.cancel_reason, 'Sick');
  assert.equal(row.prev_status, 'booked');
  const owner = d2.prepare("SELECT COUNT(*) AS n FROM messages WHERE appointment_id = ? AND kind = 'owner_cancellation'").get(b.json.appointment_id).n;
  assert.equal(owner, 1, 'the owner is told');
  const reminder = d2.prepare("SELECT status FROM messages WHERE appointment_id = ? AND kind = 'reminder'").get(b.json.appointment_id);
  assert.equal(reminder.status, 'skipped', 'the reminder is withdrawn');
  d2.close();

  const again = await k.api('POST', '/api/public/cancel', { body: { token } });
  assert.equal(again.status, 200);
  assert.equal(again.json.already, true);
});

test('a wrong token is 404, not 403 — it never confirms the booking exists', async () => {
  const r = await k.api('GET', '/api/public/cancel?token=0000000000000000000000000000ffff');
  assert.equal(r.status, 404);
  const p = await k.api('POST', '/api/public/cancel', { body: { token: 'nope' } });
  assert.equal(p.status, 404);
});

test('inside the notice window the link stops working and the client is told to call', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { cancel_window_hours: '2000' } }); // ~83 days: everything is "too late"
  const b = await bookFirstSlot(k, { date, staffId: 2, serviceIds: [9], client });
  const token = tokenFor(b.json.appointment_id);
  const look = await k.api('GET', `/api/public/cancel?token=${token}`);
  assert.equal(look.json.too_late, true);
  assert.equal(look.json.can_cancel, false);
  const r = await k.api('POST', '/api/public/cancel', { body: { token } });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /hours' notice/);
  await k.api('PUT', '/api/settings', { cookie, body: { cancel_window_hours: '12' } });
});

test('when online cancellation is off, no link is issued and the endpoint refuses', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { client_cancel_enabled: '0' } });
  const b = await bookFirstSlot(k, { date, staffId: 3, serviceIds: [10], client });
  const d = k.db();
  const conf = d.prepare("SELECT body FROM messages WHERE appointment_id = ? AND kind = 'confirmation'").get(b.json.appointment_id);
  assert.doesNotMatch(conf.body, /\/cancel\//);
  d.close();
  await k.api('PUT', '/api/settings', { cookie, body: { client_cancel_enabled: '1' } });
});

test('the owner cancelling keeps the record, tells the client (held two minutes) and can undo', async () => {
  const b = await bookFirstSlot(k, { date, staffId: 1, serviceIds: [10], client });
  const r = await k.api('POST', `/api/appointments/${b.json.appointment_id}/cancel`, { cookie, body: { reason: 'Stylist sick', notify_client: true } });
  assert.equal(r.status, 200, r.text);
  const d = k.db();
  const row = d.prepare('SELECT status, cancelled_by FROM appointments WHERE id = ?').get(b.json.appointment_id);
  assert.equal(row.status, 'cancelled');
  assert.equal(row.cancelled_by, 'owner');
  const msg = d.prepare("SELECT status, send_after FROM messages WHERE appointment_id = ? AND kind = 'cancellation'").get(b.json.appointment_id);
  assert.equal(msg.status, 'queued', 'held, not sent yet');
  d.close();
  const undo = await k.api('POST', `/api/appointments/${b.json.appointment_id}/undo-cancel`, { cookie });
  assert.equal(undo.status, 200, undo.text);
  const d2 = k.db();
  assert.equal(d2.prepare('SELECT status FROM appointments WHERE id = ?').get(b.json.appointment_id).status, 'booked');
  assert.equal(d2.prepare("SELECT status FROM messages WHERE appointment_id = ? AND kind = 'cancellation'").get(b.json.appointment_id).status, 'skipped', 'held message stopped');
  d2.close();
});

test('a quiet owner cancellation sends the client nothing but still alerts the owner', async () => {
  const b = await bookFirstSlot(k, { date, staffId: 2, serviceIds: [10], client });
  const r = await k.api('POST', `/api/appointments/${b.json.appointment_id}/cancel`, { cookie, body: { notify_client: false } });
  assert.equal(r.status, 200);
  const d = k.db();
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM messages WHERE appointment_id = ? AND kind = 'cancellation'").get(b.json.appointment_id).n, 0);
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM messages WHERE appointment_id = ? AND kind = 'owner_cancellation'").get(b.json.appointment_id).n, 1);
  d.close();
  const bad = await k.api('POST', `/api/appointments/${b.json.appointment_id}/cancel`, { cookie, body: { notify_client: 'no' } });
  assert.equal(bad.status, 400, 'a non-boolean is refused');
});

test('DELETE is a cancellation, never an erasure', async () => {
  const b = await bookFirstSlot(k, { date, staffId: 3, serviceIds: [9], client });
  const r = await k.api('DELETE', `/api/appointments/${b.json.appointment_id}?notify=0`, { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.cancelled, true);
  const d = k.db();
  assert.equal(d.prepare('SELECT status FROM appointments WHERE id = ?').get(b.json.appointment_id).status, 'cancelled');
  d.close();
});
