// One salon must never be able to take the others down, and a bad update must
// be visible before a customer finds it.
//
// Both properties were missing, and the first one was not theoretical. A tenant
// whose database would not open threw out of `getTenant`, straight through the
// request handler — which nothing wrapped — and Node exited. Every salon on the
// shard went down together, triggered by one stranger loading one booking page.
// After an update that touched migrations, that is the likeliest moment for a
// database to refuse to open.
//
// The second property is what makes an update safe to ship at all. /api/version
// reads a constant and never touches a database, so it answered 200 while a
// salon on the same process was unservable — and Render promotes a deploy on
// the strength of that answer, destroying the instance that was working.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { startKairo } from './helpers/kairo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOMAIN = 'kairobookings.test';

/** A shard with the named salons, each created for real, before it boots. */
async function shardWith(slugs, { corrupt = [] } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-shard-'));
  fs.mkdirSync(path.join(dataDir, 'tenants'), { recursive: true });
  for (const slug of slugs) {
    spawnSync(process.execPath, [path.join(ROOT, 'scripts/tenant.mjs'), 'create', slug,
      '--name', slug, '--email', `owner@${slug}.test`, '--password', 'a-password-here', '--seed', 'none'],
      { env: { ...process.env, KAIRO_DATA_DIR: dataDir }, encoding: 'utf8' });
  }
  // Corrupt AFTER creation, so everything else about the salon is real: the
  // folder, the tenant.json, the address. Only the database is unreadable,
  // which is the shape a failed migration or a half-written file leaves behind.
  for (const slug of corrupt) {
    const db = path.join(dataDir, 'tenants', slug, 'kairo.db');
    for (const f of [db, `${db}-wal`, `${db}-shm`]) { try { fs.unlinkSync(f); } catch { /* may not exist */ } }
    fs.writeFileSync(db, 'this is not a database');
  }
  const k = await startKairo({ dataDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN } });
  return { k, dataDir };
}

const at = (k, slug, p = '/api/public/info') =>
  k.api('GET', p, { host: `${slug}.${DOMAIN}` });

test('one salon that will not open does not take the others with it', async () => {
  const { k } = await shardWith(['alpha', 'beta'], { corrupt: ['beta'] });
  try {
    // Hitting the broken one first is the order that used to end the process.
    const broken = await at(k, 'beta');
    assert.equal(broken.status, 503, 'the broken salon answers for itself');

    const healthy = await at(k, 'alpha');
    assert.equal(healthy.status, 200, 'the salon next door is untouched');

    // And the process is still here to say so. Before the fix this request
    // never got an answer at all, because there was nothing left to answer it.
    const v = await k.api('GET', '/api/version');
    assert.equal(v.status, 200, 'the shard is still running');
  } finally { await k.stop(); }
});

test('a broken salon is not told it does not exist', async () => {
  const { k } = await shardWith(['alpha', 'beta'], { corrupt: ['beta'] });
  try {
    const broken = await at(k, 'beta');
    assert.equal(broken.status, 503);
    assert.match(JSON.stringify(broken.json), /temporarily unavailable/i,
      'its customers must not be sent looking for a mistake they did not make');

    // The distinction has to survive: an address that really names nobody is
    // still a 404, or the two become one answer and neither means anything.
    const nobody = await k.api('GET', '/api/public/info', { host: `nobody.${DOMAIN}` });
    assert.equal(nobody.status, 404);
    assert.match(JSON.stringify(nobody.json), /no salon/i);
  } finally { await k.stop(); }
});

test('/api/ready names the salon that would not open', async () => {
  const { k } = await shardWith(['alpha', 'beta'], { corrupt: ['beta'] });
  try {
    const r = await k.api('GET', '/api/ready');
    assert.equal(r.status, 200, 'one salon broken is not a reason to restart the shard');
    assert.equal(r.json.ok, false, 'but it is not "ok" either, and must not claim to be');
    assert.equal(r.json.salons, 2);
    assert.equal(r.json.serving, 1);
    assert.deepEqual(r.json.degraded.map((d) => d.salon), ['beta']);
    assert.match(r.json.degraded[0].why, /not a database/i, 'and says why, so nobody has to guess');
  } finally { await k.stop(); }
});

test('the fault is found before any customer asks', async () => {
  // Nothing below makes a request to the broken salon first. Asking whether
  // the shard is ready is what tries it, which is the point: a bad update is
  // visible to whoever deploys it, not to whoever books next.
  const { k } = await shardWith(['alpha', 'beta'], { corrupt: ['beta'] });
  try {
    const r = await k.api('GET', '/api/ready');
    assert.deepEqual(r.json.degraded.map((d) => d.salon), ['beta'],
      'a bad update must be visible without waiting for a visitor to find it');
  } finally { await k.stop(); }
});

test('a salon created after boot is still reported on', async () => {
  // The test that tells the readiness check apart from a lucky one. Boot has
  // been and gone, and the scheduler's tick only comes round within the minute
  // — so a salon provisioned just now has been opened by nothing at all. If
  // readiness only reported on salons something had already touched, this one
  // would be counted as fine because nobody had looked, and a deploy gate that
  // depends on who got there first is not a gate.
  const { k, dataDir } = await shardWith(['alpha']);
  try {
    assert.equal((await k.api('GET', '/api/ready')).json.salons, 1);

    // Provision a second salon into the running shard, exactly as the control
    // API does, and break it the way a failed migration would.
    spawnSync(process.execPath, [path.join(ROOT, 'scripts/tenant.mjs'), 'create', 'gamma',
      '--name', 'gamma', '--email', 'owner@gamma.test', '--password', 'a-password-here', '--seed', 'none'],
      { env: { ...process.env, KAIRO_DATA_DIR: dataDir }, encoding: 'utf8' });
    const db = path.join(dataDir, 'tenants', 'gamma', 'kairo.db');
    for (const f of [db, `${db}-wal`, `${db}-shm`]) { try { fs.unlinkSync(f); } catch { /* may not exist */ } }
    fs.writeFileSync(db, 'this is not a database');

    const r = await k.api('GET', '/api/ready');
    assert.equal(r.json.salons, 2, 'the new salon counts immediately');
    assert.deepEqual(r.json.degraded.map((d) => d.salon), ['gamma'],
      'and readiness must have tried it rather than assumed it was fine');
  } finally { await k.stop(); }
});

test('asking whether the shard is ready leaves every salon migrated', async () => {
  // Why verify-deploy calls /api/ready before it says a deploy is finished:
  // by the time it does, every salon's schema is already built, so the first
  // real customer of the day is not the one who pays for it.
  const { k, dataDir } = await shardWith(['alpha', 'beta']);
  try {
    const r = await k.api('GET', '/api/ready');
    assert.equal(r.json.ok, true);
    assert.equal(r.json.serving, 2);

    for (const slug of ['alpha', 'beta']) {
      const d = new DatabaseSync(path.join(dataDir, 'tenants', slug, 'kairo.db'), { readOnly: true });
      const n = d.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'appointments'").get().n;
      d.close();
      assert.equal(n, 1, `${slug} should be migrated once the shard reports ready`);
    }
  } finally { await k.stop(); }
});

test('a salon that is repaired comes back without a restart', async () => {
  const { k, dataDir } = await shardWith(['alpha', 'beta'], { corrupt: ['beta'] });
  try {
    assert.equal((await at(k, 'beta')).status, 503);

    // Repair it the way a person would, with the shard still running.
    fs.unlinkSync(path.join(dataDir, 'tenants', 'beta', 'kairo.db'));

    assert.equal((await at(k, 'beta')).status, 200, 'the next request must try again, not stay broken');
    const r = await k.api('GET', '/api/ready');
    assert.equal(r.json.ok, true, 'and the shard stops reporting it as degraded');
    assert.equal(r.json.degraded.length, 0);
  } finally { await k.stop(); }
});

test('a shard that can serve nobody says so with a 503', async () => {
  const { k } = await shardWith(['alpha'], { corrupt: ['alpha'] });
  try {
    const r = await k.api('GET', '/api/ready');
    assert.equal(r.status, 503, 'nothing left to serve is the one case worth restarting for');
    assert.equal(r.json.ok, false);
    assert.equal(r.json.serving, 0);
  } finally { await k.stop(); }
});

test('a request that throws ruins only itself', async () => {
  // The guard underneath everything: whatever goes wrong in one request, the
  // process must still be here for the next one. Proven with the failure that
  // actually happened rather than a contrived throw.
  const { k } = await shardWith(['alpha', 'beta'], { corrupt: ['beta'] });
  try {
    for (let i = 0; i < 5; i++) await at(k, 'beta');
    const after = await at(k, 'alpha');
    assert.equal(after.status, 200, 'five failures in a row change nothing for anyone else');
  } finally { await k.stop(); }
});

test('a malformed Host header cannot bring the shard down', async () => {
  // Not a contrived throw: `new URL(req.url, `http://${host}`)` is the first
  // line of the handler, it runs before any tenant logic, and a Host of "["
  // makes it throw. Uncaught, that ended the process — so anyone who could
  // reach the shard could stop every salon on it with one request.
  const { k } = await shardWith(['alpha']);
  try {
    const bad = await k.api('GET', '/api/public/info', { host: '[' });
    assert.equal(bad.status, 500, 'the request fails, and says so');

    const after = await at(k, 'alpha');
    assert.equal(after.status, 200, 'and the salon next door never noticed');
  } finally { await k.stop(); }
});
