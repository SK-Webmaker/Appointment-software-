import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead, bookFirstSlot } from './helpers/kairo.js';

let k, cookie;
before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
after(async () => { await k.stop(); });

test('with no provider configured a test send is reported as skipped, with the fix named', async () => {
  const r = await k.api('POST', '/api/messages/test', { cookie, body: { channel: 'email', to: 'owner@example.com' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, false);
  assert.equal(r.json.status, 'skipped');
  assert.match(r.json.detail, /Resend API key/);
  const log = await k.api('GET', '/api/messages', { cookie });
  assert.equal(log.json[0].kind, 'test');
  assert.equal(log.json[0].status, 'skipped');
});

test('SMS is off by default and a type set to SMS falls back to email until it is on', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { chan_confirmation: 'sms' } });
  const b = await bookFirstSlot(k, { date: openDateAhead(3), staffId: 1, serviceIds: [9], client: { first_name: 'Sms', email: 'sms@example.com', phone: '0400000009' } });
  const d = k.db();
  const conf = d.prepare("SELECT channel FROM messages WHERE appointment_id = ? AND kind = 'confirmation'").all(b.json.appointment_id);
  assert.deepEqual(conf.map((m) => m.channel), ['email']);
  d.close();
  await k.api('PUT', '/api/settings', { cookie, body: { chan_confirmation: 'email' } });
});

test('with SMS on and a provider chosen, the text is attempted and fails honestly without keys', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { sms_notifications_enabled: '1', chan_confirmation: 'both' } });
  const b = await bookFirstSlot(k, { date: openDateAhead(3), staffId: 2, serviceIds: [9], client: { first_name: 'Both', email: 'both@example.com', phone: '0400000010' } });
  const d = k.db();
  const rows = d.prepare("SELECT channel, status, detail FROM messages WHERE appointment_id = ? AND kind = 'confirmation' ORDER BY channel").all(b.json.appointment_id);
  assert.deepEqual(rows.map((m) => m.channel), ['email', 'sms']);
  assert.equal(rows[1].status, 'skipped');
  assert.match(rows[1].detail, /ClickSend/);
  d.close();
  await k.api('PUT', '/api/settings', { cookie, body: { sms_notifications_enabled: '0', chan_confirmation: 'email' } });
});

test('retry re-attempts a message and records the outcome', async () => {
  const log = await k.api('GET', '/api/messages?status=skipped', { cookie });
  const id = log.json[0].id;
  const r = await k.api('POST', `/api/messages/${id}/retry`, { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'skipped');
  assert.equal((await k.api('POST', '/api/messages/999999/retry', { cookie })).status, 404);
});

test('the reminder is queued for N hours before the visit and re-queued when the booking moves', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { reminder_hours: '24' } });
  const date = openDateAhead(4);
  const b = await bookFirstSlot(k, { date, staffId: 3, serviceIds: [10], client: { first_name: 'Rem', email: 'rem@example.com' } });
  const d = k.db();
  const rem = d.prepare("SELECT send_after FROM messages WHERE appointment_id = ? AND kind = 'reminder'").get(b.json.appointment_id);
  const start = new Date(`${date}T00:00:00`); start.setMinutes(b.slot - 24 * 60);
  const p = (n) => String(n).padStart(2, '0');
  const expected = `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())} ${p(start.getHours())}:${p(start.getMinutes())}`;
  assert.equal(rem.send_after, expected);
  d.close();
  // Move it an hour later.
  const mv = await k.api('PUT', `/api/appointments/${b.json.appointment_id}`, {
    cookie, body: { staff_id: 3, date, start_min: b.slot + 60, service_ids: [10], notify_client: true },
  });
  assert.equal(mv.status, 200, mv.text);
  const d2 = k.db();
  const rems = d2.prepare("SELECT status, send_after FROM messages WHERE appointment_id = ? AND kind = 'reminder' ORDER BY id").all(b.json.appointment_id);
  assert.equal(rems[0].status, 'skipped', 'old reminder withdrawn');
  assert.equal(rems[rems.length - 1].status, 'queued', 'new reminder queued');
  assert.ok(rems[rems.length - 1].send_after > rems[0].send_after);
  const moved = d2.prepare("SELECT body FROM messages WHERE appointment_id = ? AND kind = 'reschedule'").get(b.json.appointment_id);
  assert.match(moved.body, /Was:/, 'the move message leads with the old time');
  d2.close();
});

test('a move that never mentions client_id keeps the client on the booking; an explicit null clears it (walk-in)', async () => {
  const date = openDateAhead(5);
  const b = await bookFirstSlot(k, { date, staffId: 1, serviceIds: [10], client: { first_name: 'Keep', email: 'keep@example.com' } });
  const mv = await k.api('PUT', `/api/appointments/${b.json.appointment_id}`, { cookie, body: { staff_id: 1, date, start_min: b.slot + 60 } });
  assert.equal(mv.status, 200, mv.text);
  assert.ok(mv.json.client_id, 'client kept');
  assert.equal(mv.json.client_name, 'Keep');
  assert.equal(mv.json.client_notified, true, 'and told about the move');
  const walkIn = await k.api('PUT', `/api/appointments/${b.json.appointment_id}`, { cookie, body: { staff_id: 1, date, start_min: b.slot + 60, client_id: null } });
  assert.equal(walkIn.status, 200, walkIn.text);
  assert.equal(walkIn.json.client_id, null, 'an explicit null is the editor saying walk-in');
});
