// Sending email without the salon having to set anything up.
//
// Before this, a salon paid A$410, its booking page worked, and not one
// confirmation sent until somebody pasted a Resend key into Settings — five
// steps in a dashboard a hairdresser has never seen. Now a salon with no
// account of its own sends through the platform's, under its own business
// name, with replies going to its own inbox.
//
// The two properties that matter are the two that could quietly go wrong:
//   1. A salon that HAS its own account must keep using it. Sha and Hora are
//      set up that way and nothing about them may change.
//   2. The reply-to must be the salon's. The From address is Kairo's on the
//      shared path, so without a reply-to a client hitting Reply reaches Kairo
//      and the salon never learns the message existed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo } from './helpers/kairo.js';
import { mockResend } from './helpers/mocks.js';

const SHARED_FROM = 'bookings@kairobookings.com';
let resend;

before(async () => { resend = await mockResend(); });
after(async () => { await resend.close(); });

/** A Kairo running on a shard that has a platform sending account. */
const withSharedSender = (extra = {}) => ({
  RESEND_API_BASE: resend.base,
  KAIRO_SHARED_RESEND_KEY: resend.fullKey,
  KAIRO_SHARED_FROM: SHARED_FROM,
  ...extra,
});

/**
 * Send one real message and return what the provider received.
 *
 * /api/messages/test goes through the same sendEmail path a confirmation does
 * and delivers immediately. The first draft of this waited on the background
 * scheduler instead, which made every assertion below a race — it passed, but
 * on timing rather than on anything the test did.
 */
async function sendAndCollect(k, { cookie, to = 'client@example.com' }) {
  const before = resend.sent.length;
  const r = await k.api('POST', '/api/messages/test', { cookie, body: { channel: 'email', to } });
  assert.equal(r.status, 200, `test send failed: ${r.text}`);
  return { sent: resend.sent.slice(before), result: r.json };
}

test('a salon with no account of its own sends through Kairo, as itself', async () => {
  const k = await startKairo({ env: withSharedSender() });
  try {
    const { cookie } = await k.login();
    await k.api('PUT', '/api/settings', {
      cookie,
      body: { business_name: 'Fresh Salon', business_email: 'owner@freshsalon.example' },
    });

    const { sent } = await sendAndCollect(k, { cookie });
    assert.equal(sent.length, 1, 'a message must send with nothing configured by the salon');
    const [msg] = sent;

    // The client sees the salon, not Kairo.
    assert.match(msg.from, /^"Fresh Salon" </, `the display name must be the salon's: ${msg.from}`);
    assert.ok(msg.from.includes(SHARED_FROM), `sent via the platform address: ${msg.from}`);
    assert.equal(msg.key, resend.fullKey, "the platform's key, since the salon has none");

    // And a reply reaches the salon, not Kairo. This is the whole ballgame.
    assert.equal(msg.reply_to, 'owner@freshsalon.example');
    assert.ok(!String(msg.reply_to).includes('kairobookings.com'),
      'a reply must never come back to Kairo');
  } finally { await k.stop(); }
});

test('a salon with its own account keeps using it — nothing changes for Sha or Hora', async () => {
  const k = await startKairo({ env: withSharedSender() });
  try {
    const { cookie } = await k.login();
    // Exactly how an existing salon is set up: its own key, its own domain.
    const ownKey = resend.fullKey; // the mock accepts this as a full-access key
    await k.api('PUT', '/api/settings', {
      cookie,
      body: {
        business_name: 'Hair By Sha',
        business_email: 'sha@hairbysha.example',
        resend_api_key: ownKey,
        notif_from_email: 'hello@mail.hairbyshacamberwell.com',
      },
    });

    const { sent } = await sendAndCollect(k, { cookie });
    assert.equal(sent.length, 1, 'her message must still send');
    const [msg] = sent;

    assert.ok(msg.from.includes('hello@mail.hairbyshacamberwell.com'),
      `her own sending address must be used, not the platform's: ${msg.from}`);
    assert.ok(!msg.from.includes(SHARED_FROM),
      'a salon with its own account must never be silently moved onto the shared one');
    assert.equal(msg.reply_to, 'sha@hairbysha.example');
  } finally { await k.stop(); }
});

test('with neither its own nor a platform account, sending is skipped rather than failed', async () => {
  const k = await startKairo({ env: { RESEND_API_BASE: resend.base } });
  try {
    const { cookie } = await k.login();
    const before = resend.sent.length;
    const r = await k.api('POST', '/api/messages/test', {
      cookie, body: { channel: 'email', to: 'nobody@example.com' },
    });
    assert.equal(resend.sent.length, before, 'nothing may be sent with no sender at all');
    assert.match(JSON.stringify(r.json), /not configured/i,
      'and it must say so, rather than reporting a silent success');
  } finally { await k.stop(); }
});

test('the checklist stops calling email a blocker once it sends', async () => {
  const shared = await startKairo({ env: withSharedSender() });
  try {
    const { cookie } = await shared.login();
    const r = await shared.api('GET', '/api/checklist', { cookie });
    const item = (r.json.items || []).find((i) => i.id === 'email');
    assert.ok(item, 'the email item must still exist');
    assert.equal(item.done, true, 'sending works, so it is done');
    assert.equal(item.required, false, 'and it is no longer a blocker');
    assert.match(item.note, /own domain/i, 'it should offer the upgrade instead');
  } finally { await shared.stop(); }

  // With no sender at all it is still a blocker, because it still is one.
  const bare = await startKairo();
  try {
    const { cookie } = await bare.login();
    const r = await bare.api('GET', '/api/checklist', { cookie });
    const item = (r.json.items || []).find((i) => i.id === 'email');
    assert.equal(item.done, false);
    assert.equal(item.required, true, 'with nothing configured it must still block');
  } finally { await bare.stop(); }
});

test('the settings say how this salon sends, so no screen has to guess', async () => {
  const k = await startKairo({ env: withSharedSender() });
  try {
    const { cookie } = await k.login();
    let s = await k.api('GET', '/api/settings', { cookie });
    assert.equal(s.json.email_sending, 'kairo');

    await k.api('PUT', '/api/settings', {
      cookie,
      body: { resend_api_key: resend.fullKey, notif_from_email: 'hello@theirown.example' },
    });
    s = await k.api('GET', '/api/settings', { cookie });
    assert.equal(s.json.email_sending, 'own', 'their own account must be reported as theirs');
  } finally { await k.stop(); }

  const bare = await startKairo();
  try {
    const { cookie } = await bare.login();
    const s = await bare.api('GET', '/api/settings', { cookie });
    assert.equal(s.json.email_sending, 'none');
  } finally { await bare.stop(); }
});
