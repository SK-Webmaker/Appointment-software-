// The real cutover script, driven end to end.
//
// scripts/move-tenant.mjs is what actually runs on a live salon, once, at
// whatever hour the owner picked, with the business's whole history riding on
// it. Until now it had no test at all — the riskiest untested code in the
// repo. rehearse-move.mjs was covered, but the rehearsal verifies the copy
// BEFORE a shard opens it, so it never sees the migration that the real move
// always triggers. That gap is exactly what this file closes.
//
// Nothing is mocked but Stripe's absence: a real single-tenant Kairo with real
// bookings is snapshotted, a real shard imports it over the signed control
// API, and the script's own comparison decides whether the move may proceed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { startKairo, openDateAhead, bookFirstSlot, ROOT, ADMIN } from './helpers/kairo.js';

const KEY = 'platform-key-for-tests-0123456789';
const SECRET = 'front-door-secret-for-tests-0123';
const DOMAIN = 'kairobookings.test';
let old, shard, shardDir, work, snap;

/**
 * The same, without blocking this process.
 *
 * spawnSync deadlocks against anything served FROM this process — the
 * Render-like edge below is, so the script's request could never be answered
 * and the run just timed out. Cost twenty seconds to notice, twice.
 */
function moveAsync(args, { env = {} } = {}) {
  return new Promise((resolve) => {
    const cp = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/move-tenant.mjs', ...args], {
      cwd: ROOT,
      env: { ...process.env, KAIRO_SHARD_URL: shard.base, KAIRO_PLATFORM_KEY: KEY, KAIRO_BASE_DOMAIN: DOMAIN, ...env },
    });
    let out = '';
    cp.stdout.on('data', (c) => { out += c; });
    cp.stderr.on('data', (c) => { out += c; });
    cp.on('close', (status) => resolve({ status, stdout: out, stderr: '' }));
  });
}

/** Run the real cutover script, exactly as a person would. */
function move(args, { env = {} } = {}) {
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/move-tenant.mjs', ...args], {
    cwd: ROOT, encoding: 'utf8',
    env: {
      ...process.env,
      KAIRO_SHARD_URL: shard.base,
      KAIRO_PLATFORM_KEY: KEY,
      KAIRO_BASE_DOMAIN: DOMAIN,
      ...env,
    },
  });
}

before(async () => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-move-'));
  shardDir = path.join(work, 'shard');
  fs.mkdirSync(path.join(shardDir, 'tenants'), { recursive: true });

  // The salon being moved: a real Kairo with a real booking in it.
  old = await startKairo();
  const { cookie } = await old.login();
  await bookFirstSlot(old, {
    date: openDateAhead(3), staffId: 1, serviceIds: [9],
    client: { first_name: 'Moving', email: 'moving@example.com' },
  });
  await old.api('PUT', '/api/settings', { cookie, body: { business_name: 'Movable Salon' } });

  snap = path.join(work, 'snap.db.gz');
  const fetched = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/migrate-tenant.mjs',
    'fetch', '--url', old.base, '--email', ADMIN.email, '--password', ADMIN.password, '--out', snap], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(fetched.status, 0, fetched.stdout + fetched.stderr);

  shard = await startKairo({
    dataDir: shardDir,
    // The forward secret makes the shard believe X-Kairo-Host, which is how
    // the front door reaches a salon and how a real move compares one before
    // its address points at the shard. Without it set here, the only path the
    // tests could take was --via — which is exactly why the real one went
    // unexercised until it 404'd on a live salon.
    env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_PLATFORM_KEY: KEY, KAIRO_FORWARD_SECRET: SECRET },
  });
});
after(async () => {
  await old.stop();
  await shard.stop();
  fs.rmSync(work, { recursive: true, force: true });
});

test('the cutover refuses to start against a shard it cannot prove itself to', () => {
  // --via so this fails on the key rather than on having no way to reach the
  // new tenant; the two refusals are separate and each has its own test.
  const r = move(['--slug', 'movable', '--from', snap, '--old', old.base, '--via', shard.base],
    { env: { KAIRO_PLATFORM_KEY: 'not-the-key' } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /shard did not answer a signed request|Stopped/);
  assert.ok(!fs.existsSync(path.join(shardDir, 'tenants', 'movable')), 'nothing may be written when the key is wrong');
});

test('the whole cutover: snapshot up, asked straight back, compared, and the salon serves', () => {
  const r = move(['--slug', 'movable', '--from', snap, '--old', old.base, '--via', shard.base]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /is on the shard and proven identical/);
  assert.ok(fs.existsSync(path.join(shardDir, 'tenants', 'movable', 'kairo.db')));
});

// The one that matters for a real move. A salon runs whatever it was last
// deployed; the shard runs current code. Opening the database migrates it, so
// what comes back is legitimately not byte-identical to what was sent and the
// strict comparison fails every time. Before this, the script stopped there —
// and a person diffed four rows by hand, on a live salon, in the middle of the
// night, which is how a real difference gets waved through with the harmless
// ones.
//
// To make that real here the snapshot is aged: a table and some settings the
// current schema creates are removed from it, so the shard re-adds them on
// open exactly as a version bump does.
test('a cross-version move is judged rather than abandoned', () => {
  const raw = path.join(work, 'aged.db');
  fs.writeFileSync(raw, zlib.gunzipSync(fs.readFileSync(snap)));
  const d = new DatabaseSync(raw);
  d.exec('PRAGMA journal_mode=DELETE');
  const hadDevices = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='devices'").get();
  if (hadDevices) d.exec('DROP TABLE devices');
  const dropped = d.prepare("SELECT key FROM settings WHERE key IN ('acma_registered','pos_payment_link','checklist_link_shared')").all().map((r) => r.key);
  d.exec("DELETE FROM settings WHERE key IN ('acma_registered','pos_payment_link','checklist_link_shared')");
  d.close();
  assert.ok(hadDevices || dropped.length, 'the fixture must actually remove something the shard will re-add');
  const agedGz = path.join(work, 'aged.db.gz');
  fs.writeFileSync(agedGz, zlib.gzipSync(fs.readFileSync(raw)));

  const r = move(['--slug', 'agedsalon', '--from', agedGz, '--old', old.base, '--via', shard.base]);
  assert.equal(r.status, 0, `a cross-version move must complete, not stop\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /Judging whether a version change explains them/,
    'the strict comparison must run first and be seen to fail');
  assert.match(r.stdout, /explained by the version change/,
    'and the difference must then be explained, with its reason on screen');
  assert.match(r.stdout, /is on the shard and proven identical/);
});

// And the judgement must never explain away something a migration cannot do.
test('a changed value is never explained away as a version difference', () => {
  const dbPath = path.join(shardDir, 'tenants', 'agedsalon', 'kairo.db');
  assert.ok(fs.existsSync(dbPath), 'the cross-version move must have created this tenant');
  const backup = fs.readFileSync(dbPath);
  try {
    const d = new DatabaseSync(dbPath);
    d.exec('PRAGMA busy_timeout=5000');
    d.exec("UPDATE settings SET value = 'Someone Else\u2019s Salon' WHERE key = 'business_name'");
    d.close();
    const bad = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/migrate-tenant.mjs',
      'verify', '--slug', 'agedsalon', '--from', path.join(work, 'aged.db.gz'), '--across-versions'],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, KAIRO_DATA_DIR: shardDir } });
    assert.equal(bad.status, 1, `a changed business name must stop the move\n${bad.stdout}`);
    // The benign rows are still allowed to be explained — that is the point of
    // the flag. What must never happen is the CHANGED VALUE being swept in
    // with them, so assert on that row specifically rather than on the whole
    // output: "all at defaults" legitimately appears for the settings count.
    assert.match(bad.stdout, /setting: business_name/, 'the changed value must be named');
    assert.match(bad.stdout, /1 check FAILED/, 'exactly the one real difference must fail');
    assert.doesNotMatch(bad.stdout, /business_name.*(?:all at defaults|stamp the shard)/,
      'the changed value must not carry a benign explanation');
  } finally {
    fs.writeFileSync(dbPath, backup);
    for (const e of ['-wal', '-shm']) fs.rmSync(dbPath + e, { force: true });
  }
});

/**
 * Stand in for Render's edge, which is what makes this hard.
 *
 * Render routes on the Host header and answers only for hostnames it has been
 * told about. So overriding Host to reach a salon that is not registered there
 * is refused before the shard ever sees the request — and locally, with nothing
 * in front, it works fine. That gap is why the old preview-alias approach
 * passed every test and then 404'd on a live salon.
 *
 * This refuses any Host but its own, exactly as Render does, and passes the
 * forwarding headers through untouched. Reaching a tenant behind it is possible
 * only the way the front door does it.
 */
async function rendersEdge(target) {
  const t = new URL(target);
  const srv = http.createServer((req, res) => {
    const mine = `127.0.0.1:${srv.address().port}`;
    if (req.headers.host !== mine) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'no service at this hostname' }));
      return;
    }
    // Buffered rather than piped: hop-by-hop headers copied straight through
    // (connection, transfer-encoding) hang the response, and nothing here is
    // big enough to be worth streaming.
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const headers = { ...req.headers, host: `${t.hostname}:${t.port}` };
      delete headers.connection; delete headers['transfer-encoding'];
      if (body.length) headers['content-length'] = String(body.length);
      const up = http.request(
        { hostname: t.hostname, port: t.port, path: req.url, method: req.method, headers },
        (r) => {
          const out = [];
          r.on('data', (c) => out.push(c));
          r.on('end', () => {
            const payload = Buffer.concat(out);
            const h = { ...r.headers };
            delete h.connection; delete h['transfer-encoding']; delete h['content-length'];
            res.writeHead(r.statusCode, { ...h, 'content-length': String(payload.length) });
            res.end(payload);
          });
        });
      up.on('error', () => { res.writeHead(502); res.end(); });
      if (body.length) up.write(body);
      up.end();
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

test('the comparison reaches the new tenant the way the front door will', async () => {
  // The path a real move takes, and the one that was broken until Hair By Sha's
  // move hit it. Behind an edge that behaves like Render's, the only way to
  // reach a salon whose address does not point here yet is to forward the real
  // hostname with the secret — the same thing the Worker does.
  const edge = await rendersEdge(shard.base);
  try {
    const r = await moveAsync(['--slug', 'forwarded', '--from', snap, '--old', old.base],
      { env: { KAIRO_FORWARD_SECRET: SECRET, KAIRO_SHARD_URL: edge.url } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /is on the shard and proven identical/);
    assert.ok(fs.existsSync(path.join(shardDir, 'tenants', 'forwarded', 'kairo.db')));
  } finally { await edge.close(); }
});

test('with no way to reach the new tenant, nothing is sent at all', () => {
  // The refusal happens BEFORE the import. Finding out at step 4 would leave
  // the salon written to the shard by a run that then stopped half-done, which
  // is a worse state to be in at 1am than never having started.
  const r = move(['--slug', 'unreachable', '--from', snap, '--old', old.base],
    { env: { KAIRO_FORWARD_SECRET: '' } });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /KAIRO_FORWARD_SECRET/);
  assert.ok(!fs.existsSync(path.join(shardDir, 'tenants', 'unreachable')),
    'nothing may be written when the comparison could never run');
});
