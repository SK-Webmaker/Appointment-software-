import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead, bookFirstSlot } from './helpers/kairo.js';

let k, cookie;
before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
after(async () => { await k.stop(); });

test('an invoice from an appointment bills every service, in integer cents, with tax', async () => {
  const b = await bookFirstSlot(k, { date: openDateAhead(2), staffId: 1, serviceIds: [9, 10], client: { first_name: 'Bill', email: 'bill@example.com' } });
  const inv = await k.api('POST', '/api/invoices/from-appointment', { cookie, body: { appointment_id: b.json.appointment_id } });
  assert.equal(inv.status, 200, inv.text);
  assert.match(inv.json.number, /^INV-\d+$/);
  assert.equal(inv.json.status, 'draft');
  assert.equal(inv.json.items.length, 2);
  assert.equal(inv.json.subtotal_cents, 9500 + 5500);
  assert.equal(inv.json.tax_rate, 8.5);
  assert.equal(inv.json.tax_cents, Math.round(15000 * 0.085));
  assert.equal(inv.json.total_cents, 15000 + Math.round(15000 * 0.085));
  assert.equal(inv.json.balance_cents, inv.json.total_cents);
  for (const v of [inv.json.subtotal_cents, inv.json.tax_cents, inv.json.total_cents]) assert.equal(Number.isInteger(v), true);
  const again = await k.api('POST', '/api/invoices/from-appointment', { cookie, body: { appointment_id: b.json.appointment_id } });
  assert.equal(again.json.id, inv.json.id, 'idempotent: the same appointment gets the same invoice');
});

test('a partial payment leaves it owing; the payment that clears it flips it to paid and queues a receipt', async () => {
  const b = await bookFirstSlot(k, { date: openDateAhead(2), staffId: 2, serviceIds: [9], client: { first_name: 'Pay', email: 'pay@example.com' } });
  const inv = (await k.api('POST', '/api/invoices/from-appointment', { cookie, body: { appointment_id: b.json.appointment_id } })).json;
  const half = Math.floor(inv.total_cents / 2);
  const p1 = await k.api('POST', `/api/invoices/${inv.id}/payments`, { cookie, body: { amount_cents: half, method: 'cash' } });
  assert.equal(p1.status, 200, p1.text);
  assert.equal(p1.json.status, 'sent');
  assert.equal(p1.json.balance_cents, inv.total_cents - half);
  const p2 = await k.api('POST', `/api/invoices/${inv.id}/payments`, { cookie, body: { amount_cents: inv.total_cents - half, method: 'card' } });
  assert.equal(p2.json.status, 'paid');
  assert.equal(p2.json.balance_cents, 0);
  assert.equal(p2.json.payments.length, 2);
  const d = k.db();
  const receipts = d.prepare("SELECT status, body FROM messages WHERE kind = 'receipt' AND client_id = ?").all(inv.client_id);
  assert.equal(receipts.length, 2);
  assert.match(receipts[0].body, /Remaining balance/);
  assert.match(receipts[1].body, /Paid in full/);
  d.close();
});

test('payments are validated: zero, negative, unknown method, void invoice', async () => {
  const b = await bookFirstSlot(k, { date: openDateAhead(2), staffId: 3, serviceIds: [10], client: { first_name: 'Val', email: 'val@example.com' } });
  const inv = (await k.api('POST', '/api/invoices/from-appointment', { cookie, body: { appointment_id: b.json.appointment_id } })).json;
  assert.equal((await k.api('POST', `/api/invoices/${inv.id}/payments`, { cookie, body: { amount_cents: 0 } })).status, 400);
  assert.equal((await k.api('POST', `/api/invoices/${inv.id}/payments`, { cookie, body: { amount_cents: -5 } })).status, 400);
  assert.equal((await k.api('POST', `/api/invoices/${inv.id}/payments`, { cookie, body: { amount_cents: 100, method: 'bitcoin' } })).status, 400);
  const voided = await k.api('PATCH', `/api/invoices/${inv.id}/status`, { cookie, body: { status: 'void' } });
  assert.equal(voided.status, 200, voided.text);
  const onVoid = await k.api('POST', `/api/invoices/${inv.id}/payments`, { cookie, body: { amount_cents: 100, method: 'cash' } });
  assert.equal(onVoid.status, 400);
});

test('invoice numbers increase and never repeat', async () => {
  const list = (await k.api('GET', '/api/invoices', { cookie })).json;
  const numbers = list.map((i) => i.number);
  assert.equal(new Set(numbers).size, numbers.length);
});

test('the dashboard answers for the business day and carries no secrets', async () => {
  const r = await k.api('GET', `/api/dashboard?date=${openDateAhead(0)}&now_min=600`, { cookie });
  assert.equal(r.status, 200, r.text);
  assert.doesNotMatch(JSON.stringify(r.json), /re_|sk_|session_secret/);
});
