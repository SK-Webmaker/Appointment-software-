// Is every salon's off-site copy still being made?
//
// The copies Kairo keeps beside each database are for a bad upgrade; they are
// on the same disk as the thing they protect, so losing the disk loses both.
// What survives that is the backup emailed to each owner — which runs on a
// schedule, can fail quietly, and is nobody's job to look at.
//
// Written after finding that Horahaircutz's last successful backup still
// predated his move onto the shard, seven days later. Nothing reported it, and
// finding out meant exporting his entire database to read four settings.
//
// The distinction that matters below: a backup that is DUE is not a fault — the
// scheduler reaches it within the minute. A fault is one that cannot happen,
// one that tried and failed, or one whose last success is old enough to prove
// the schedule has stopped.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { startKairo } from './helpers/kairo.js';
import { sign } from '../src/platform-sign.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'platform-key-for-tests-0123456789';
const DOMAIN = 'kairobookings.test';
let k, dataDir;

const run = (args = []) => new Promise((resolve) => {
  const cp = spawn(process.execPath, [path.join(ROOT, 'scripts/backup-check.mjs'), ...args], {
    env: { ...process.env, KAIRO_SHARD_URL: k.base, KAIRO_PLATFORM_KEY: KEY },
  });
  let out = '';
  cp.stdout.on('data', (c) => { out += c; });
  cp.stderr.on('data', (c) => { out += c; });
  // ANSI codes sit between the tick and the words; every assertion reads the
  // stripped text, or it silently matches nothing.
  cp.on('close', (code) => resolve({ code, out: out.replace(/\[[0-9;]*m/g, '') }));
});

/** Set this salon's backup settings to whatever state is being tested. */
function backupState(slug, settings) {
  const d = new DatabaseSync(path.join(dataDir, 'tenants', slug, 'kairo.db'));
  d.exec('PRAGMA busy_timeout = 5000');
  const put = d.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [key, value] of Object.entries(settings)) put.run(key, String(value));
  d.close();
}

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

/** A salon whose backups are entirely healthy. */
const healthy = (whenDays = 1) => ({
  backup_email_enabled: '1',
  backup_frequency: 'weekly',
  backup_email_to: 'owner@example.test',
  backup_last_at: daysAgo(whenDays),
  backup_last_ok: '1',
  backup_last_detail: 'Emailed to owner@example.test (500 KB)',
  backup_last_bytes: '512000',
});

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-bkchk-'));
  fs.mkdirSync(path.join(dataDir, 'tenants'), { recursive: true });
  for (const slug of ['alpha', 'beta']) {
    spawnSync(process.execPath, [path.join(ROOT, 'scripts/tenant.mjs'), 'create', slug,
      '--name', slug, '--email', `owner@${slug}.test`, '--password', 'a-password-here', '--seed', 'none'],
      { env: { ...process.env, KAIRO_DATA_DIR: dataDir }, encoding: 'utf8' });
  }
  k = await startKairo({ dataDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_PLATFORM_KEY: KEY } });
});
after(async () => { await k.stop(); });

test('every salon backed up recently passes', async () => {
  backupState('alpha', healthy(1));
  backupState('beta', healthy(2));

  const r = await run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Every salon has a current off-site copy/i);
});

test('a backup that failed is a fault, and says why', async () => {
  backupState('alpha', healthy(1));
  backupState('beta', { ...healthy(1), backup_last_ok: '0', backup_last_detail: 'Email not configured' });

  const r = await run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /beta: last attempt FAILED/i);
  assert.match(r.out, /Email not configured/i, 'the reason must be carried through, not swallowed');
});

test('a schedule that has stopped is caught even though nothing failed', async () => {
  // The Horahaircutz case exactly: the last attempt SUCCEEDED, so nothing is
  // marked failed anywhere — it simply has not happened since. Only the age
  // gives it away.
  backupState('alpha', healthy(1));
  backupState('beta', healthy(30));   // weekly schedule, 30 days since the last one

  const r = await run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /beta: last good backup was 30 days ago/i);
  assert.match(r.out, /schedule is not running/i);
});

test('a salon merely due for one is not a fault', async () => {
  // 8 days on a weekly schedule: due, and the scheduler will reach it within
  // the minute. Calling that a fault would make the check cry wolf every week
  // and it would stop being read.
  backupState('alpha', healthy(1));
  backupState('beta', healthy(8));

  const r = await run();
  assert.equal(r.code, 0, r.out);
});

test('a backup with nowhere to send it is a fault', async () => {
  backupState('alpha', healthy(1));
  backupState('beta', { ...healthy(1), backup_email_to: '', business_email: '' });

  const r = await run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /beta: no recipient/i);
});

test('backups switched off are reported rather than counted as fine', async () => {
  backupState('alpha', healthy(1));
  backupState('beta', { ...healthy(1), backup_email_enabled: '0' });

  const r = await run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /beta: backups are switched OFF/i);
});

test('a salon that has never been backed up is a fault', async () => {
  backupState('alpha', healthy(1));
  backupState('beta', { ...healthy(1), backup_last_at: '' });

  const r = await run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /beta: never run/i);
});

test('--quiet prints the faults and not the healthy ones', async () => {
  backupState('alpha', healthy(1));
  backupState('beta', { ...healthy(1), backup_last_ok: '0', backup_last_detail: 'nope' });

  const r = await run(['--quiet']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /beta: last attempt FAILED/i);
  assert.doesNotMatch(r.out, /✓ alpha/, 'a quiet run is for the ones that need a person');
});

test('the control API reports whether a backup has a recipient, not who it is', async () => {
  // The owner's address is theirs. The operational question is only whether the
  // backup has somewhere to go, and answering it with the address itself
  // republishes a personal detail through a channel that had no need of it.
  // Without this, dropping the reduction is caught only by accident — by
  // to_set going undefined — which says nothing about the address.
  backupState('alpha', healthy(1));

  const p = '/api/platform/tenants/alpha';
  const t = Date.now();
  const r = await k.api('GET', p, {
    headers: { 'x-kairo-signature': `t=${t},v1=${sign(t, 'GET', p, '', KEY)}` },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.backup.to_set, true, 'it must say a recipient exists');
  assert.equal(r.json.backup.to, undefined, 'and must not say who it is');
  assert.doesNotMatch(r.text, /owner@example\.test/,
    'the address must not appear anywhere in the response');
});
