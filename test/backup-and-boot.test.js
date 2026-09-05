import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startKairo, gunzip } from './helpers/kairo.js';

let k, cookie;
before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
after(async () => { await k.stop(); });

test('the downloadable backup is a valid gzipped SQLite database of the whole business', async () => {
  assert.equal((await k.api('GET', '/api/backup/download')).status, 401);
  const r = await k.api('GET', '/api/backup/download', { cookie, raw: true });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/gzip');
  const raw = gunzip(r.buffer);
  assert.equal(raw.subarray(0, 15).toString(), 'SQLite format 3');
  const st = await k.api('GET', '/api/backup/status', { cookie });
  assert.equal(st.json.enabled, true);
  assert.equal(st.json.frequency, 'weekly');
});

test('the scheduled email backup records an honest failure when email is not configured', async () => {
  const r = await k.api('POST', '/api/backup/email', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, false);
  assert.match(r.json.detail, /Email not configured|No business email/);
});

test('a version change takes a backup before migrating, and settings survive a restart', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { business_name: 'Restart Salon' } });
  const dir = k.dataDir;
  const d = k.db();
  d.prepare("UPDATE settings SET value = '1.0.0' WHERE key = 'app_version'").run();
  d.close();
  await k.stop({ keepData: true });
  k = await startKairo({ dataDir: dir });
  const backups = fs.readdirSync(dir).filter((f) => /^backup-v1\.0\.0-.*\.db$/.test(f));
  assert.equal(backups.length, 1, 'one pre-update backup named for the old version');
  const bk = fs.statSync(path.join(dir, backups[0]));
  assert.ok(bk.size > 50_000);
  ({ cookie } = await k.login());
  const s = await k.api('GET', '/api/settings', { cookie });
  assert.equal(s.json.business_name, 'Restart Salon');
  const d2 = k.db();
  assert.notEqual(d2.prepare("SELECT value FROM settings WHERE key = 'app_version'").get().value, '1.0.0');
  d2.close();
});

test('first boot creates the owner from the environment, only once, and flags the handover password', async () => {
  let k2 = null, k3 = null, dir = null;
  try {
    k2 = await startKairo({ env: { KAIRO_ADMIN_EMAIL: 'Owner@Salon.example', KAIRO_ADMIN_PASSWORD: 'handover-pass-2026!' } });
    dir = k2.dataDir;
    assert.equal((await k2.api('POST', '/api/auth/login', { body: { email: 'admin@kairo.local', password: 'admin123' } })).status, 401);
    // Typed with capitals at provisioning, signed in lowercase — must work.
    const { cookie: c } = await k2.login('owner@salon.example', 'handover-pass-2026!');
    const me = await k2.api('GET', '/api/auth/me', { cookie: c });
    assert.equal(me.json.settings.handover_password_active, '1');
    assert.equal(me.json.settings.default_password_active, '0');
    assert.equal(me.json.settings.setup_complete, '', 'a brand-new business meets the wizard');
    await k2.stop({ keepData: true });
    k2 = null;
    k3 = await startKairo({ dataDir: dir, env: { KAIRO_ADMIN_EMAIL: 'someone@else.example', KAIRO_ADMIN_PASSWORD: 'other-pass-2026!' } });
    assert.equal((await k3.api('POST', '/api/auth/login', { body: { email: 'someone@else.example', password: 'other-pass-2026!' } })).status, 401, 'later boots ignore the variables');
    assert.equal((await k3.api('POST', '/api/auth/login', { body: { email: 'owner@salon.example', password: 'handover-pass-2026!' } })).status, 200);
  } finally {
    if (k2) await k2.stop({ keepData: true });
    if (k3) await k3.stop({ keepData: true });
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the public URL from the environment wins over the setting and is shown as pinned', async () => {
  const k2 = await startKairo({ env: { KAIRO_PUBLIC_URL: 'https://pinned.kairobookings.com/' } });
  try {
    const { cookie: c } = await k2.login();
    const before = await k2.api('GET', '/api/settings', { cookie: c });
    assert.equal(before.json.public_url_effective, 'https://pinned.kairobookings.com');
    assert.equal(before.json.public_url_from_env, '1');
    await k2.api('PUT', '/api/settings', { cookie: c, body: { public_url: 'https://other.example' } });
    const after = await k2.api('GET', '/api/settings', { cookie: c });
    assert.equal(after.json.public_url_effective, 'https://pinned.kairobookings.com', 'the setting cannot override the environment');
  } finally { await k2.stop(); }
});
