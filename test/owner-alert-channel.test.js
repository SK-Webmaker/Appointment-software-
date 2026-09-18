// The owner is told once, not twice.
//
// A new online booking used to send the owner a push AND an email, every time.
// An app that duplicates the email it was meant to replace is just a second
// thing to dismiss, so the email is now the fallback rather than the default.
//
// The risk in that change is entirely one-sided. A duplicate email is an
// annoyance; a booking the owner never hears about is lost money and a client
// standing outside a locked door. So the email is skipped ONLY on proof that
// Apple accepted the alert, and nearly every test below is a failure case
// checking that the email comes back.
//
// The customer's own confirmation and reminder are never involved. They have no
// app, and this must not touch them — asserted in every case, not just once.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { startKairo, openDateAhead, bookFirstSlot } from './helpers/kairo.js';
import { apnsKeyPair, mockApns } from './helpers/mocks.js';

const TOKEN = 'c'.repeat(64);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The owner alert is deliberately not awaited by the booking response, so the
 * rows appear shortly after the customer is answered. Poll rather than sleep a
 * fixed amount: a fixed sleep either flakes or wastes time, usually both.
 */
async function messagesFor(k, apptId, { expect = 0, ms = 6000 } = {}) {
  const until = Date.now() + ms;
  let rows = [];
  for (;;) {
    const d = k.db();
    rows = d.prepare('SELECT kind, channel, status FROM messages WHERE appointment_id = ? ORDER BY id').all(apptId);
    d.close();
    if (rows.length >= expect || Date.now() > until) return rows;
    await sleep(50);
  }
}

/**
 * Wait for Apple to actually be handed the alert.
 *
 * The customer's two messages are queued synchronously, so waiting on a row
 * count says nothing about the push — it returns before the push has even been
 * attempted. Anything asserting "no email" has to wait on the push itself and
 * then give the fallback a fair chance to fire, otherwise it passes for the
 * wrong reason: the email had not been written yet.
 */
async function waitForPush(apns, after, ms = 6000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (apns.sent.length > after) return true;
    await sleep(25);
  }
  return false;
}

const kinds = (rows) => rows.map((r) => r.kind).sort();
const ownerMails = (rows) => rows.filter((r) => r.kind === 'owner_new_booking');

/** Every case must leave the customer's two messages alone. */
function assertClientMessagesIntact(rows, where) {
  assert.ok(kinds(rows).includes('confirmation'), `the customer's confirmation is missing ${where}`);
  assert.ok(kinds(rows).includes('reminder'), `the customer's reminder is missing ${where}`);
}

describe('owner alerts: the phone first, the inbox only if that misses', () => {
  let k; let apns; let keys; let cookie;
  const date = openDateAhead(4);
  const client = { first_name: 'Owner', last_name: 'Channel', email: 'oc@example.com', phone: '0400000123' };

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
  });
  after(async () => { await k?.stop(); await apns?.close(); });

  test('with no phone signed in, the owner still gets the email', async () => {
    // This is the state every salon is in on day one, and the state a salon
    // returns to the moment the owner signs out on their phone.
    const r = await bookFirstSlot(k, { date, staffId: 1, serviceIds: [9], client });
    assert.equal(r.status, 200, r.text);
    const rows = await messagesFor(k, r.json.appointment_id, { expect: 3 });
    assert.equal(ownerMails(rows).length, 1, 'no push was possible, so the email must be there');
    assertClientMessagesIntact(rows, 'when no phone is signed in');
  });

  test('once a phone is signed in, the push replaces the email', async () => {
    const reg = await k.api('POST', '/api/app/devices', { cookie, body: { token: TOKEN, platform: 'ios' } });
    assert.equal(reg.status, 200, reg.text);
    assert.equal(reg.json.push_available, true);

    const before_ = apns.sent.length;
    const r = await bookFirstSlot(k, { date: openDateAhead(5), staffId: 1, serviceIds: [9], client });
    assert.equal(r.status, 200, r.text);

    assert.ok(await waitForPush(apns, before_), 'Apple should have been given the alert');
    // The push landed. Now give the email path longer than it would ever need,
    // so "no email" means there is none rather than not yet.
    await sleep(750);
    const rows = await messagesFor(k, r.json.appointment_id, { expect: 2 });
    assert.equal(ownerMails(rows).length, 0,
      `the owner was pushed, so no email: got ${JSON.stringify(kinds(rows))}`);
    assertClientMessagesIntact(rows, 'when the push succeeded');
  });

  test('a phone the app was deleted from falls back to email', async () => {
    // Apple answers 410 Unregistered. The device is struck out, the send is not
    // counted, and the owner must hear about the booking by other means.
    apns.kill(TOKEN);
    const r = await bookFirstSlot(k, { date: openDateAhead(6), staffId: 1, serviceIds: [9], client });
    assert.equal(r.status, 200, r.text);
    const rows = await messagesFor(k, r.json.appointment_id, { expect: 3 });
    assert.equal(ownerMails(rows).length, 1,
      'a dead token is not a delivered push — the email must come back');
    assertClientMessagesIntact(rows, 'when the token was dead');
  });

  test('Apple failing outright falls back to email', async () => {
    apns.failWith('InternalServerError');
    const r = await bookFirstSlot(k, { date: openDateAhead(7), staffId: 1, serviceIds: [9], client });
    assert.equal(r.status, 200, r.text);
    const rows = await messagesFor(k, r.json.appointment_id, { expect: 3 });
    assert.equal(ownerMails(rows).length, 1, 'Apple erroring must not swallow the alert');
    assertClientMessagesIntact(rows, 'when Apple errored');
    apns.failWith(null);
  });

  test('the owner alert never blocks or breaks the customer booking', async () => {
    // Whatever Apple is doing, the person booking gets their reference back.
    apns.failWith('InternalServerError');
    const started = Date.now();
    const r = await bookFirstSlot(k, { date: openDateAhead(8), staffId: 1, serviceIds: [9], client });
    const took = Date.now() - started;
    apns.failWith(null);
    assert.equal(r.status, 200, r.text);
    assert.match(r.json.reference, /^BK-\d{5}$/);
    assert.ok(took < 5000, `the customer waited ${took}ms on the owner's notification`);
  });

  test('turning owner alerts off silences both channels, not just one', async () => {
    // The switch is the owner's and it must still mean what it says. If the
    // fallback ignored it, switching alerts off would start producing emails
    // for a salon that had none before.
    const off = await k.api('PUT', '/api/settings', { cookie, body: { owner_notify_enabled: '0' } });
    assert.equal(off.status, 200, off.text);
    apns.kill(TOKEN); // force the fallback path specifically
    const r = await bookFirstSlot(k, { date: openDateAhead(9), staffId: 1, serviceIds: [9], client });
    assert.equal(r.status, 200, r.text);
    await sleep(750); // an absence needs time to be an absence
    const rows = await messagesFor(k, r.json.appointment_id, { expect: 2 });
    assert.equal(ownerMails(rows).length, 0, 'alerts are off, so the fallback must stay quiet too');
    assertClientMessagesIntact(rows, 'when owner alerts were switched off');
    await k.api('PUT', '/api/settings', { cookie, body: { owner_notify_enabled: '1' } });
  });
});
