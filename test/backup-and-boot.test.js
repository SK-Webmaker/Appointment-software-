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

// ── How often, and what happens when it fails ───────────────────────────────

test('a failed scheduled backup backs off instead of retrying every minute', async () => {
  // On the live shard the demo salon was logging the same "Email not
  // configured" line 1,440 times a day: a failed attempt never stamped
  // backup_last_scheduled_at, so it stayed due and the scheduler tried again on
  // the very next tick. For a salon with a real provider having a bad hour,
  // that is 1,440 send attempts rather than one an hour.
  //
  // Driven through a real restart rather than a helper, because the scheduled
  // path is the one that was broken: the manual "send one now" button is a
  // person watching and is deliberately never held off.
  const dir = k.dataDir;
  await k.api('PUT', '/api/settings', { cookie, body: { backup_frequency: 'weekly', backup_email_enabled: '1' } });
  const d = k.db();
  d.prepare("INSERT INTO settings (key, value) VALUES ('backup_email_to', 'owner@example.test') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
  d.prepare("DELETE FROM settings WHERE key IN ('backup_retry_after', 'backup_last_scheduled_at')").run();
  d.close();

  // The scheduler runs a tick at boot, so this restart is what attempts it.
  await k.stop({ keepData: true });
  k = await startKairo({ dataDir: dir });
  ({ cookie } = await k.login());

  let st;
  for (let i = 0; i < 40; i++) {
    st = (await k.api('GET', '/api/backup/status', { cookie })).json;
    if (st.retry_after) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.equal(st.last_ok, false, 'the scheduled attempt really did fail');
  assert.ok(st.retry_after, 'a failed scheduled backup must set a retry-after stamp');
  assert.ok(Date.parse(st.retry_after) > Date.now(), 'and it must be in the future');
  assert.equal(st.due, false, 'so it is not due again on the very next tick');
});

test('every frequency offered is one the salon can actually act on', async () => {
  // "monthly" was settable from Kai long before FREQUENCIES had a monthly, so
  // it silently became weekly. Anything offered must mean something.
  for (const [freq, days] of [['daily', 1], ['weekly', 7], ['fortnightly', 14], ['monthly', 30], ['bimonthly', 60], ['off', 0]]) {
    const r = await k.api('PUT', '/api/settings', { cookie, body: { backup_frequency: freq } });
    assert.equal(r.status, 200, `${freq} must be accepted: ${r.text}`);
    const st = await k.api('GET', '/api/backup/status', { cookie });
    assert.equal(st.json.frequency, freq);
    assert.equal(st.json.every_days, days, `${freq} must mean ${days} days`);
  }
});

test('a frequency that means nothing is refused, not quietly turned into weekly', async () => {
  const r = await k.api('PUT', '/api/settings', { cookie, body: { backup_frequency: 'occasionally' } });
  assert.equal(r.status, 400, r.text);
  assert.match(r.text, /not a backup frequency/i);
  assert.match(r.text, /bimonthly/, 'and it should say what is allowed');

  const st = await k.api('GET', '/api/backup/status', { cookie });
  assert.notEqual(st.json.frequency, 'occasionally', 'nothing unusable may be stored');
});

test('choosing never stops the schedule', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { backup_frequency: 'off', backup_email_enabled: '1' } });
  const d = k.db();
  d.prepare("DELETE FROM settings WHERE key IN ('backup_retry_after','backup_last_scheduled_at')").run();
  d.close();
  const st = await k.api('GET', '/api/backup/status', { cookie });
  assert.equal(st.json.every_days, 0);
  assert.equal(st.json.due, false, '"never" must never be due, even with the checkbox on');
});

test('the Settings dropdown offers exactly the frequencies that exist', async () => {
  // The dropdown lives in the browser and FREQUENCIES lives on the server, so
  // they cannot import one another. Left to drift, the screen offers a choice
  // that silently means something else — which is the whole reason "monthly"
  // was broken. This fails the day they disagree.
  const { FREQUENCIES } = await import('../src/backup.js');
  const ui = fs.readFileSync(new URL('../public/js/pages/settings.js', import.meta.url), 'utf8');
  const block = /backup_frequency"[\s\S]{0,120}?\$\{(\[[\s\S]*?\])\s*\n?\s*\.map/.exec(ui);
  assert.ok(block, 'the backup_frequency dropdown should still be built from a list of pairs');
  const offered = [...block[1].matchAll(/\['([a-z]+)',/g)].map((m) => m[1]);
  assert.ok(offered.length >= 4, `expected several options, found ${JSON.stringify(offered)}`);
  for (const v of offered) {
    assert.ok(Object.hasOwn(FREQUENCIES, v), `the screen offers "${v}", which FREQUENCIES does not have`);
  }
});

test('the tick-box and the frequency never contradict each other', async () => {
  // The screen has both, so an owner can say "off" in two places. Without this
  // they reopen Settings to find "Email me a backup automatically" ticked next
  // to a schedule of Never, and no way to tell which one is winning.
  await k.api('PUT', '/api/settings', { cookie, body: { backup_frequency: 'weekly', backup_email_enabled: '1' } });

  await k.api('PUT', '/api/settings', { cookie, body: { backup_frequency: 'off' } });
  let s = (await k.api('GET', '/api/settings', { cookie })).json;
  assert.equal(s.backup_frequency, 'off');
  assert.equal(s.backup_email_enabled, '0', 'choosing Never must switch it off, not leave the box ticked');

  // And back: ticking the box while the schedule says Never would otherwise
  // turn on a thing that still sends nothing.
  await k.api('PUT', '/api/settings', { cookie, body: { backup_email_enabled: '1' } });
  s = (await k.api('GET', '/api/settings', { cookie })).json;
  assert.equal(s.backup_email_enabled, '1');
  assert.equal(s.backup_frequency, 'weekly', 'switching backups on must give them a schedule that runs');
});
