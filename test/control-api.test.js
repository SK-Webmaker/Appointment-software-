// The shard's control API: the six things the platform may do to a salon.
// Everything here is about the gate — a wrong signature, a stale one, a
// replayed one, and a shard that was never given a key at all.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { startKairo } from './helpers/kairo.js';
import { sign } from '../src/platform-sign.js';

const KEY = 'platform-key-for-tests-0123456789';
const DOMAIN = 'kairobookings.test';
let k, dataDir;

const hash = (p) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, pass_hash: crypto.scryptSync(p, salt, 64).toString('hex') };
};

/** A signed call, exactly as platform/shard.js makes one. */
async function signed(method, p, body, { at = Date.now(), key = KEY } = {}) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  return k.api(method, p, {
    body: body === undefined ? undefined : raw,
    headers: { 'x-kairo-signature': `t=${at},v1=${sign(at, method, p, raw, key)}`, ...(raw ? { 'content-type': 'application/json' } : {}) },
  });
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-control-'));
  fs.mkdirSync(path.join(dataDir, 'tenants'), { recursive: true });
  k = await startKairo({ dataDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_PLATFORM_KEY: KEY } });
});
after(async () => { await k.stop(); });

test('a shard with no platform key answers 404 — the API does not exist for it', async () => {
  const plain = await startKairo();
  try {
    const r = await plain.api('GET', '/api/platform/health');
    assert.equal(r.status, 404);
    assert.equal(r.json.error, 'Not found');
  } finally { await plain.stop(); }
});

test('an unsigned, wrongly signed, stale or tampered request is refused', async () => {
  assert.equal((await k.api('GET', '/api/platform/health')).status, 401);
  assert.equal((await k.api('GET', '/api/platform/health', { headers: { 'x-kairo-signature': 'garbage' } })).status, 401);
  assert.equal((await signed('GET', '/api/platform/health', undefined, { key: 'a-different-key-entirely-000000' })).status, 401);
  assert.equal((await signed('GET', '/api/platform/health', undefined, { at: Date.now() - 10 * 60 * 1000 })).status, 401, 'a ten-minute-old signature');
  assert.equal((await signed('GET', '/api/platform/health', undefined, { at: Date.now() + 10 * 60 * 1000 })).status, 401, 'one from the future');
  // A signature valid for one path must not work on another.
  const at = Date.now();
  const forPath = await k.api('GET', '/api/platform/tenants', {
    headers: { 'x-kairo-signature': `t=${at},v1=${sign(at, 'GET', '/api/platform/health', '', KEY)}` },
  });
  assert.equal(forPath.status, 401, 'a signature is bound to its path');
  const ok = await signed('GET', '/api/platform/health');
  assert.equal(ok.status, 200);
  assert.equal(ok.json.multi_tenant, true);
  assert.equal(ok.json.base_domain, DOMAIN);
});

test('a signature over different bytes than the body is refused', async () => {
  const at = Date.now();
  const honest = JSON.stringify({ slug: 'honest', name: 'Honest', owner: { email: 'a@b.co', ...hash('x') } });
  const swapped = JSON.stringify({ slug: 'swapped', name: 'Swapped', owner: { email: 'a@b.co', ...hash('x') } });
  const r = await k.api('POST', '/api/platform/tenants', {
    body: swapped,
    headers: { 'content-type': 'application/json', 'x-kairo-signature': `t=${at},v1=${sign(at, 'POST', '/api/platform/tenants', honest, KEY)}` },
  });
  assert.equal(r.status, 401);
  assert.equal((await signed('GET', '/api/platform/tenants')).json.tenants.length, 0, 'nothing was created');
});

test('create makes a salon that serves at its own address, empty, with the owner able to sign in', async () => {
  const creds = hash('a-real-owner-password-2026');
  const r = await signed('POST', '/api/platform/tenants', {
    slug: 'abchair', name: 'ABC Hair Studio', price_cents: 41000,
    owner: { name: 'Ada', email: 'Ada@ABC.example', ...creds },
    settings: { business_name: 'ABC Hair Studio', business_phone: '0400111222', business_tz: 'Australia/Melbourne', tax_rate: '10', currency_code: 'aud' },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.created, true);
  assert.equal(r.json.business_name, 'ABC Hair Studio');
  assert.equal(r.json.counts.clients, 0, 'a real salon starts empty — no demo data');
  assert.equal(r.json.counts.appointments, 0);

  const host = `abchair.${DOMAIN}`;
  const info = await k.api('GET', '/api/public/info', { host });
  assert.equal(info.status, 200);
  assert.equal(info.json.business_name, 'ABC Hair Studio');
  const { cookie } = await k.login('ada@abc.example', 'a-real-owner-password-2026', { host });
  const me = await k.api('GET', '/api/auth/me', { host, cookie });
  assert.equal(me.json.settings.plan_status, 'active');
  assert.equal(me.json.settings.plan_interval, 'once');
  assert.equal(me.json.settings.plan_price_cents, '41000');
  assert.equal(me.json.settings.setup_complete, '', 'and meets the wizard');
  assert.equal(me.json.settings.business_tz, 'Australia/Melbourne');
  assert.equal(me.json.settings.tax_rate, '10');
});

test('create refuses a duplicate slug, a bad slug, an owner without a hash and an unknown setting', async () => {
  const creds = hash('another-password-2026-ok');
  assert.equal((await signed('POST', '/api/platform/tenants', { slug: 'abchair', name: 'Copycat', owner: { email: 'x@y.co', ...creds } })).status, 409);
  assert.equal((await signed('POST', '/api/platform/tenants', { slug: 'Not A Slug', name: 'x', owner: { email: 'x@y.co', ...creds } })).status, 400);
  assert.equal((await signed('POST', '/api/platform/tenants', { slug: 'nohash', name: 'x', owner: { email: 'x@y.co' } })).status, 400);
  const bad = await signed('POST', '/api/platform/tenants', { slug: 'badsetting', name: 'x', owner: { email: 'x@y.co', ...creds }, settings: { session_secret: 'nope' } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /Unexpected setting/);
  assert.equal((await signed('GET', '/api/platform/tenants')).json.tenants.length, 1, 'only the one real salon exists');
});

test('status reports counts and never a row of anybody’s data', async () => {
  const r = await signed('GET', '/api/platform/tenants/abchair');
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.json.counts).sort(), ['appointments', 'clients', 'invoices', 'messages']);
  assert.doesNotMatch(r.text, /ada@abc/i, 'the owner’s email is not handed back through status');
  assert.equal((await signed('GET', '/api/platform/tenants/nobody')).status, 404);
});

test('settings go through the same allow-list as the owner’s own screen', async () => {
  const ok = await signed('PUT', '/api/platform/tenants/abchair/settings', { business_phone: '0400999888' });
  assert.equal(ok.status, 200);
  const bad = await signed('PUT', '/api/platform/tenants/abchair/settings', { origin_lock_mode: 'enforce' });
  assert.equal(bad.status, 400, 'the settings the owner cannot write, the platform cannot write either');
});

test('maintenance and mute can be flipped from the platform', async () => {
  const host = `abchair.${DOMAIN}`;
  assert.equal((await signed('PATCH', '/api/platform/tenants/abchair', { read_only: true })).json.read_only, true);
  const { cookie } = await k.login('ada@abc.example', 'a-real-owner-password-2026', { host });
  assert.equal((await k.api('POST', '/api/clients', { host, cookie, body: { first_name: 'Nope' } })).status, 503);
  assert.equal((await signed('PATCH', '/api/platform/tenants/abchair', { read_only: false })).json.read_only, false);
  assert.equal((await k.api('POST', '/api/clients', { host, cookie, body: { first_name: 'Fine' } })).status, 200);
  const bad = await signed('PATCH', '/api/platform/tenants/abchair', { pass_hash: 'sneaky' });
  assert.equal(bad.status, 400, 'only the known config keys may be patched');
});

test('a password reset takes a hash, never a password, and retires every session', async () => {
  const host = `abchair.${DOMAIN}`;
  const before = await k.login('ada@abc.example', 'a-real-owner-password-2026', { host });
  assert.equal((await k.api('GET', '/api/auth/me', { host, cookie: before.cookie })).status, 200);
  const next = hash('the-owner-forgot-and-reset-99');
  const r = await signed('POST', '/api/platform/tenants/abchair/password', { email: 'ada@abc.example', ...next });
  assert.equal(r.status, 200, r.text);
  assert.equal((await k.api('GET', '/api/auth/me', { host, cookie: before.cookie })).status, 401, 'the old session is gone');
  assert.equal((await k.api('POST', '/api/auth/login', { host, body: { email: 'ada@abc.example', password: 'a-real-owner-password-2026' } })).status, 401);
  assert.equal((await k.api('POST', '/api/auth/login', { host, body: { email: 'ada@abc.example', password: 'the-owner-forgot-and-reset-99' } })).status, 200);
});

test('export returns the whole salon as a gzipped database', async () => {
  const r = await signed('GET', '/api/platform/tenants/abchair/export');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/gzip');
  const { gunzip } = await import('./helpers/kairo.js');
  assert.equal(gunzip(r.buffer).subarray(0, 15).toString(), 'SQLite format 3');
});

test('delete stops the address serving and keeps the file', async () => {
  const host = `abchair.${DOMAIN}`;
  assert.equal((await signed('DELETE', '/api/platform/tenants/abchair')).json.deleted, true);
  assert.equal((await k.api('GET', '/api/public/info', { host })).status, 404);
  assert.ok(fs.existsSync(path.join(dataDir, 'tenants', 'abchair', 'kairo.db')), 'the data is kept');
  assert.equal((await signed('GET', '/api/platform/tenants/abchair')).status, 404);
});
