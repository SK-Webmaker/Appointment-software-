import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo } from './helpers/kairo.js';

let k, cookie;
before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
after(async () => { await k.stop(); });

test('secrets are write-only: the API reports only whether they are set', async () => {
  const before = await k.api('GET', '/api/settings', { cookie });
  assert.equal(before.json.resend_api_key, undefined);
  assert.equal(before.json.resend_api_key_set, '');
  assert.equal(before.json.session_secret, undefined);
  assert.equal(before.json.session_secret_set, undefined, 'internal secret never even flagged');

  const put = await k.api('PUT', '/api/settings', { cookie, body: { resend_api_key: 're_test_1234567890' } });
  assert.equal(put.status, 200);
  assert.equal(put.json.resend_api_key_set, '1');
  assert.equal(put.json.resend_api_key, undefined);
  assert.doesNotMatch(JSON.stringify(put.json), /re_test_1234567890/);

  const keep = await k.api('PUT', '/api/settings', { cookie, body: { resend_api_key: '' } });
  assert.equal(keep.json.resend_api_key_set, '1', 'blank means keep');
  const clear = await k.api('PUT', '/api/settings', { cookie, body: { resend_api_key: '__clear__' } });
  assert.equal(clear.json.resend_api_key_set, '');
});

test('only allow-listed settings can be written; internal keys are refused by name', async () => {
  for (const body of [{ session_secret: 'x' }, { app_version: '0.0.1' }, { origin_lock_mode: 'enforce' }, { made_up_key: '1' }]) {
    const r = await k.api('PUT', '/api/settings', { cookie, body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.match(r.json.error, /Unexpected field/);
  }
});

test('a time zone the runtime does not know is refused rather than stored', async () => {
  const bad = await k.api('PUT', '/api/settings', { cookie, body: { business_tz: 'Australia/Melbourn' } });
  assert.equal(bad.status, 400);
  const good = await k.api('PUT', '/api/settings', { cookie, body: { business_tz: 'Australia/Melbourne' } });
  assert.equal(good.status, 200);
  assert.equal(good.json.business_tz, 'Australia/Melbourne');
});

test('a From address Resend would reject is refused at the point it is typed', async () => {
  const bad = await k.api('PUT', '/api/settings', { cookie, body: { notif_from_email: 'hello@send.' } });
  assert.equal(bad.status, 400);
  const trailing = await k.api('PUT', '/api/settings', { cookie, body: { notif_from_email: 'hello@salon.kairobookings.com ' } });
  assert.equal(trailing.status, 200, 'a trailing space is trimmed, not refused');
  assert.equal(trailing.json.notif_from_email, 'hello@salon.kairobookings.com');
});

test('the effective public URL and reply-to are derived, and the raw hosting host is flagged', async () => {
  const r = await k.api('PUT', '/api/settings', { cookie, body: { public_url: 'https://glowbar-booking.onrender.com/', business_email: 'owner@example.com', notif_reply_to: 'not an address' } });
  assert.equal(r.json.public_url_effective, 'https://glowbar-booking.onrender.com');
  assert.equal(r.json.public_url_is_raw, '1');
  assert.equal(r.json.reply_to_invalid, '1');
  assert.equal(r.json.reply_to_effective, 'owner@example.com', 'a typo never beats a good business email');
  const fixed = await k.api('PUT', '/api/settings', { cookie, body: { public_url: 'https://glowbar.kairobookings.com' } });
  assert.equal(fixed.json.public_url_is_raw, '0');
});

test('brand images must be genuine base64 image data URIs', async () => {
  const evil = await k.api('PUT', '/api/settings', { cookie, body: { brand_logo: 'data:image/png,"><img onerror=alert(1)>' } });
  assert.equal(evil.status, 200);
  assert.equal(evil.json.brand_logo, '', 'markup-carrying value is dropped');
  const ok = await k.api('PUT', '/api/settings', { cookie, body: { brand_logo: 'data:image/png;base64,iVBORw0KGgo=' } });
  assert.equal(ok.json.brand_logo, 'data:image/png;base64,iVBORw0KGgo=');
});

test('the setup wizard can start fresh and the public page reflects it immediately', async () => {
  const r = await k.api('POST', '/api/setup/apply', {
    cookie,
    body: {
      fresh: true,
      settings: { business_name: 'Phase Six Salon', business_email: 'owner@example.com', business_tz: 'Australia/Melbourne' },
      team: [{ name: 'Owner', title: 'Stylist' }],
      services: [{ name: 'Cut', category: 'Hair', duration_min: 45, price: 60, price_type: 'fixed' }],
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.services_added, 1);
  const info = await k.api('GET', '/api/public/info');
  assert.equal(info.json.business_name, 'Phase Six Salon');
  assert.equal(info.json.services.length, 1);
  assert.equal(info.json.staff.length, 1);
  const manifest = await k.api('GET', '/manifest.webmanifest');
  assert.equal(manifest.json.name, 'Phase Six Salon');
  const d = k.db();
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM clients').get().n, 0, 'demo clients gone');
  assert.equal(d.prepare("SELECT value FROM settings WHERE key='setup_complete'").get().value, '1');
  d.close();
});

test('the wizard refuses unknown settings keys too', async () => {
  const r = await k.api('POST', '/api/setup/apply', { cookie, body: { settings: { session_secret: 'x' } } });
  assert.equal(r.status, 400);
});
