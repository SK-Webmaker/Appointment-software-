// Unmuting a salon at its cutover, and proving it took.
//
// This exists because of a specific failure shape rather than a general wish
// for coverage. On the night a salon moves, it is imported MUTED so that two
// copies of one business cannot both text the same client, and then unmuted at
// the moment the front door switches over. If that unmute silently fails, the
// salon serves perfectly and sends nothing — no confirmations, no reminders —
// and nothing on any screen says so. The owner learns about it from a client.
//
// So the property under test is not "the PATCH was sent". It is "the shard,
// asked afresh, agrees". A script that reports success without re-reading is
// the bug this file is here to catch.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { startKairo } from './helpers/kairo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'platform-key-for-tests-0123456789';
const DOMAIN = 'kairobookings.test';
let k, dataDir;

/** Run the script exactly as a person would at the cutover. */
const run = (args) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/shard-mute.mjs'), ...args], {
    env: { ...process.env, KAIRO_SHARD_URL: k.base, KAIRO_PLATFORM_KEY: KEY },
    encoding: 'utf8',
  });
  // ANSI codes sit between the tick and the words, so every assertion below
  // reads the stripped text. Grepping the raw output silently matches nothing.
  const clean = `${r.stdout}${r.stderr}`.replace(/\[[0-9;]*m/g, '');
  return { code: r.status, out: clean };
};

const tenantJson = (slug) => path.join(dataDir, 'tenants', slug, 'tenant.json');
const readConfig = (slug) => JSON.parse(fs.readFileSync(tenantJson(slug), 'utf8'));

/**
 * Give the salon its own Resend account, or take it away.
 *
 * Whether a salon can send at all is a separate question from whether it is
 * muted, and the script is expected to answer both. Every test below says
 * which of the two states it is in rather than inheriting it from the test
 * before — the first draft of this file did inherit it, and read as the script
 * being broken when it was reporting a real problem correctly.
 */
function canSendEmail(slug, yes) {
  const d = new DatabaseSync(path.join(dataDir, 'tenants', slug, 'kairo.db'));
  d.exec('PRAGMA busy_timeout = 5000');
  const put = d.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  put.run('resend_api_key', yes ? 're_test_key_for_this_suite' : '');
  put.run('notif_from_email', yes ? 'hello@movable.test' : '');
  d.close();
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-mute-'));
  fs.mkdirSync(path.join(dataDir, 'tenants'), { recursive: true });
  k = await startKairo({ dataDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_PLATFORM_KEY: KEY } });
  spawnSync(process.execPath, [path.join(ROOT, 'scripts/tenant.mjs'), 'create', 'movable',
    '--name', 'Movable Salon', '--email', 'owner@movable.test', '--password', 'a-password-here', '--seed', 'none'],
    { env: { ...process.env, KAIRO_DATA_DIR: dataDir }, encoding: 'utf8' });
});
after(async () => { await k.stop(); });

test('a muted salon is unmuted, and the shard is asked again to confirm', async () => {
  canSendEmail('movable', true);
  fs.writeFileSync(tenantJson('movable'), JSON.stringify({ ...readConfig('movable'), muted: true }, null, 2));

  const r = run(['--slug', 'movable', '--off']);
  assert.equal(r.code, 0, `unmute should succeed:\n${r.out}`);
  assert.match(r.out, /unmuted/i, 'it must say the salon is unmuted');
  assert.equal(readConfig('movable').muted, false, 'and the shard must actually be unmuted');
});

test('muting is the same story in reverse, so a rehearsal copy cannot send', async () => {
  canSendEmail('movable', true);
  fs.writeFileSync(tenantJson('movable'), JSON.stringify({ ...readConfig('movable'), muted: false }, null, 2));

  const r = run(['--slug', 'movable', '--on']);
  assert.equal(r.code, 0, `mute should succeed:\n${r.out}`);
  assert.match(r.out, /MUTED/, 'it must say so in words that cannot be misread at 1am');
  assert.equal(readConfig('movable').muted, true);
});

test('with no flag it reports and changes nothing', async () => {
  canSendEmail('movable', true);
  fs.writeFileSync(tenantJson('movable'), JSON.stringify({ ...readConfig('movable'), muted: true }, null, 2));

  const r = run(['--slug', 'movable']);
  assert.equal(r.code, 0);
  assert.match(r.out, /MUTED/, 'it must report the state it found');
  assert.equal(readConfig('movable').muted, true, 'a report must never change anything');
});

test('a salon that cannot send email is a failure, not a success', async () => {
  // The trap this catches: unmuting a salon with no Resend account at all
  // leaves it exactly as silent as it was muted, but reported as fixed. A
  // salon in that state needs a person, so the exit code has to say so.
  canSendEmail('movable', false);
  fs.writeFileSync(tenantJson('movable'), JSON.stringify({ ...readConfig('movable'), muted: true }, null, 2));

  const r = run(['--slug', 'movable', '--off']);
  assert.equal(readConfig('movable').muted, false, 'the unmute itself still happens');
  assert.equal(r.code, 1, `a salon that cannot send must exit non-zero:\n${r.out}`);
  assert.match(r.out, /no way to send email/i, 'and must say what is wrong in plain words');
});

test('a slug that is not on the shard stops rather than inventing one', async () => {
  const r = run(['--slug', 'nosuchsalon', '--off']);
  assert.equal(r.code, 1);
  assert.match(r.out, /no salon called/i);
});

test('an older shard, which cannot say how a salon sends, is told apart from one that says "none"', async () => {
  // The shard Sha moves onto is older than the shared-sending change and does
  // not return email_sending at all. Printing "via: undefined" beside a green
  // tick would read as a check that passed — the one thing it must not do. So
  // this stands up a shard that answers the way that one does, rather than
  // adding a pretend-old flag to the script itself.
  let muted = true;
  const stub = http.createServer((req, res) => {
    if (req.method === 'PATCH') { muted = false; req.resume(); }
    res.writeHead(200, { 'content-type': 'application/json' });
    // Note what is absent: no email_sending key, exactly like kairo-shard-au.
    res.end(JSON.stringify({ slug: 'movable', muted, read_only: false }));
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${stub.address().port}`;
  try {
    // spawnSync would deadlock: it blocks this process's event loop, and the
    // stub above is served BY this process, so the script's request could
    // never be answered. It cost twenty seconds of timeout to notice.
    const { code, out } = await new Promise((resolve) => {
      const cp = spawn(process.execPath, [path.join(ROOT, 'scripts/shard-mute.mjs'), '--slug', 'movable', '--off'], {
        env: { ...process.env, KAIRO_SHARD_URL: base, KAIRO_PLATFORM_KEY: KEY },
      });
      let buf = '';
      cp.stdout.on('data', (c) => { buf += c; });
      cp.stderr.on('data', (c) => { buf += c; });
      cp.on('close', (code) => resolve({ code, out: buf.replace(/\u001b\[[0-9;]*m/g, '') }));
    });
    assert.equal(code, 0, `an old shard is not a failure:\n${out}`);
    assert.doesNotMatch(out, /undefined/, 'it must never print undefined as a reassurance');
    assert.match(out, /unverified/i, 'and must say plainly that the sending side was not checked');
  } finally {
    await new Promise((r) => stub.close(r));
  }
});
