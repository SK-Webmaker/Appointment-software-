// The Phase 5 move, rehearsed: a real single-tenant Kairo with real activity is
// snapshotted, imported onto a multi-tenant data directory, verified, served,
// and compared with the original — and the verifier is shown to fail when the
// copy is wrong.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { startKairo, openDateAhead, bookFirstSlot, ROOT, ADMIN } from './helpers/kairo.js';

const DOMAIN = 'kairobookings.test';
let old, shardDir, work, snap;

function migrate(args, { env = {} } = {}) {
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/migrate-tenant.mjs', ...args], {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, KAIRO_DATA_DIR: shardDir, KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, ...env },
  });
}

before(async () => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-migrate-'));
  shardDir = path.join(work, 'shard');
  fs.mkdirSync(path.join(shardDir, 'tenants'), { recursive: true });
  old = await startKairo();
  const { cookie } = await old.login();
  // Real activity: a booking, an invoice, a payment, a settings change, a secret.
  const b = await bookFirstSlot(old, { date: openDateAhead(3), staffId: 1, serviceIds: [9], client: { first_name: 'Moved', email: 'moved@example.com' } });
  const inv = (await old.api('POST', '/api/invoices/from-appointment', { cookie, body: { appointment_id: b.json.appointment_id } })).json;
  await old.api('POST', `/api/invoices/${inv.id}/payments`, { cookie, body: { amount_cents: inv.total_cents, method: 'cash' } });
  await old.api('PUT', '/api/settings', { cookie, body: { business_name: 'Hair By Test', business_tz: 'Australia/Melbourne', resend_api_key: 're_moving_house', notif_from_email: 'hello@mail.hairbytest.example' } });
  snap = path.join(work, 'snap.db.gz');
});
after(async () => { await old.stop(); fs.rmSync(work, { recursive: true, force: true }); });

test('fetch downloads the salon’s own backup snapshot with the owner’s credentials', () => {
  const r = migrate(['fetch', '--url', old.base, '--email', ADMIN.email, '--password', ADMIN.password, '--out', snap]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(snap));
  const bad = migrate(['fetch', '--url', old.base, '--email', ADMIN.email, '--password', 'wrong', '--out', snap + '.x']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /login failed/);
});

test('import is a dry run by default and refuses to overwrite', () => {
  const dry = migrate(['import', '--slug', 'hairbytest', '--from', snap]);
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /dry run/);
  assert.match(dry.stdout, /Hair By Test/);
  assert.match(dry.stdout, /Australia\/Melbourne/);
  assert.ok(!fs.existsSync(path.join(shardDir, 'tenants', 'hairbytest')), 'dry run created nothing');
  const apply = migrate(['import', '--slug', 'hairbytest', '--from', snap, '--apply']);
  assert.equal(apply.status, 0, apply.stdout + apply.stderr);
  assert.ok(fs.existsSync(path.join(shardDir, 'tenants', 'hairbytest', 'kairo.db')));
  const cfg = JSON.parse(fs.readFileSync(path.join(shardDir, 'tenants', 'hairbytest', 'tenant.json'), 'utf8'));
  assert.equal(cfg.public_url, `https://hairbytest.${DOMAIN}`);
  assert.equal(cfg.plan, 'legacy');
  const again = migrate(['import', '--slug', 'hairbytest', '--from', snap, '--apply']);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
});

test('verify passes on a faithful copy and lists every check when asked', () => {
  const r = migrate(['verify', '--slug', 'hairbytest', '--from', snap, '--verbose']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /All \d+ checks passed/);
  assert.match(r.stdout, /rows: appointments/);
  assert.match(r.stdout, /money: payments_cents/);
  assert.match(r.stdout, /owner login rows/);
  assert.doesNotMatch(r.stdout, /setting: /, 'settings are listed only when they differ — none should');
});

test('the shard serves the moved salon: same owner login, same name, same secrets present, same diary', async () => {
  const k = await startKairo({ dataDir: shardDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN } });
  try {
    const host = `hairbytest.${DOMAIN}`;
    const { cookie } = await k.login(ADMIN.email, ADMIN.password, { host });
    const s = await k.api('GET', '/api/settings', { host, cookie });
    assert.equal(s.json.business_name, 'Hair By Test');
    assert.equal(s.json.resend_api_key_set, '1', 'the Resend key moved with the file');
    assert.equal(s.json.notif_from_email, 'hello@mail.hairbytest.example');
    assert.equal(s.json.public_url_effective, `https://hairbytest.${DOMAIN}`);
    const oldInfo = await old.api('GET', '/api/public/info');
    const newInfo = await k.api('GET', '/api/public/info', { host });
    const strip = (j) => { const { read_only, ...rest } = j; return rest; };
    assert.deepEqual(strip(newInfo.json), strip(oldInfo.json), 'the booking page data is identical');
    const cmp = migrate(['compare', '--old', old.base, '--new', k.base, '--new-host', host]);
    assert.equal(cmp.status, 0, cmp.stdout + cmp.stderr);
    assert.match(cmp.stdout, /Identical: \d+ checks/);
    // Bookings made after the move are what a rollback would have to carry back.
    await new Promise((r) => setTimeout(r, 1100)); // clear of the second the copy was seeded in
    const stamp = new Date().toISOString().slice(0, 19).replace('T', ' '); // UTC, like created_at
    const none = migrate(['since', '--slug', 'hairbytest', '--since', stamp]);
    assert.match(none.stdout, /Nothing written since then/);
    const b = await bookFirstSlot({ ...k, api: (m, pth, o = {}) => k.api(m, pth, { ...o, host }) }, { date: openDateAhead(4), staffId: 2, serviceIds: [10], client: { first_name: 'After', email: 'after@example.com' } });
    assert.equal(b.status, 200, b.text);
    const some = migrate(['since', '--slug', 'hairbytest', '--since', stamp]);
    assert.match(some.stdout, /appointments \(1\)/);
    assert.match(some.stdout, /After/);
    assert.match(some.stdout, /to carry back/);
  } finally { await k.stop({ keepData: true }); }
});

test('verify FAILS when the copy is not faithful — a lost client, a changed payment, a different owner', () => {
  const dbPath = path.join(shardDir, 'tenants', 'hairbytest', 'kairo.db');
  // The tenant has moved on since the original snapshot (the test above booked
  // on it), so the reference for THIS test is a fresh consistent copy of the
  // tenant itself; the WAL is folded in first so the byte backup is complete.
  const snap2 = path.join(work, 'snap2.db');
  const d0 = new DatabaseSync(dbPath); d0.exec('PRAGMA wal_checkpoint(TRUNCATE)'); d0.exec(`VACUUM INTO '${snap2}'`); d0.close();
  const backup = fs.readFileSync(dbPath);
  const mutate = (sql) => { const d = new DatabaseSync(dbPath); d.exec('PRAGMA busy_timeout=5000'); d.exec(sql); d.close(); };
  try {
    mutate("DELETE FROM clients WHERE email = 'moved@example.com'");
    let r = migrate(['verify', '--slug', 'hairbytest', '--from', snap2]);
    assert.equal(r.status, 1, 'a missing client must fail verification');
    assert.match(r.stdout, /rows: clients/);
    fs.writeFileSync(dbPath, backup); for (const ext of ['-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
    mutate('UPDATE payments SET amount_cents = amount_cents - 1');
    r = migrate(['verify', '--slug', 'hairbytest', '--from', snap2]);
    assert.equal(r.status, 1, 'one cent must fail verification');
    assert.match(r.stdout, /money: payments_cents/);
    fs.writeFileSync(dbPath, backup); for (const ext of ['-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
    mutate("UPDATE users SET salt = 'ff'");
    r = migrate(['verify', '--slug', 'hairbytest', '--from', snap2]);
    assert.equal(r.status, 1, 'a changed owner row must fail verification');
    assert.match(r.stdout, /owner login rows/);
  } finally {
    fs.writeFileSync(dbPath, backup); for (const ext of ['-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
  }
  const ok = migrate(['verify', '--slug', 'hairbytest', '--from', snap2]);
  assert.equal(ok.status, 0, 'restored copy passes again');
});
