// The one new risk of serving many salons from one process is the line that
// turns a hostname into a file. Everything here exists to falsify it.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startKairo, openDateAhead, tenantCli } from './helpers/kairo.js';

const DOMAIN = 'kairobookings.test';
const A = `alpha.${DOMAIN}`, B = `beta.${DOMAIN}`;
const ALPHA = { email: 'alpha@example.com', password: 'alpha-pass-2026!!' };
const BETA = { email: 'beta@example.com', password: 'beta-pass-2026!!' };
let k, dataDir, alphaCookie, betaCookie;

const tenantDb = (slug) => {
  const d = new DatabaseSync(path.join(dataDir, 'tenants', slug, 'kairo.db'));
  d.exec('PRAGMA busy_timeout = 5000');
  return d;
};
const count = (slug, table) => { const d = tenantDb(slug); const n = d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n; d.close(); return n; };

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-tenants-'));
  tenantCli(dataDir, ['create', 'alpha', '--name', 'Alpha Salon', '--email', ALPHA.email, '--password', ALPHA.password, '--seed', 'demo']);
  tenantCli(dataDir, ['create', 'beta', '--name', 'Beta Salon', '--email', BETA.email, '--password', BETA.password]);
  k = await startKairo({ dataDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN } });
  ({ cookie: alphaCookie } = await k.login(ALPHA.email, ALPHA.password, { host: A }));
  ({ cookie: betaCookie } = await k.login(BETA.email, BETA.password, { host: B }));
  // Beta starts empty (seed none) and is set up through the wizard, like a real signup.
  const w = await k.api('POST', '/api/setup/apply', {
    host: B, cookie: betaCookie,
    body: { settings: { business_name: 'Beta Salon' }, team: [{ name: 'Bea', title: 'Owner' }], services: [{ name: 'Beta Colour', category: 'Colour', duration_min: 60, price: 120, price_type: 'fixed' }] },
  });
  assert.equal(w.status, 200, w.text);
});
after(async () => { await k.stop(); });

test('the CLI created two folders, each with its own database and tenant.json', () => {
  for (const s of ['alpha', 'beta']) {
    assert.ok(fs.existsSync(path.join(dataDir, 'tenants', s, 'kairo.db')), s);
    const cfg = JSON.parse(fs.readFileSync(path.join(dataDir, 'tenants', s, 'tenant.json'), 'utf8'));
    assert.equal(cfg.slug, s);
    assert.ok(cfg.owner.pass_hash && cfg.owner.salt);
    assert.equal(cfg.owner.password, undefined, 'no plaintext password anywhere');
  }
  assert.match(tenantCli(dataDir, ['list']), /alpha.*Alpha Salon[\s\S]*beta.*Beta Salon/);
});

test('an address that names no salon gets nobody — not the first salon, not the last', async () => {
  for (const host of [`nobody.${DOMAIN}`, 'kairobookings.test', `a.b.${DOMAIN}`, 'example.com', '127.0.0.1']) {
    const info = await k.api('GET', '/api/public/info', { host });
    assert.equal(info.status, 404, host);
    assert.equal(info.json.error, 'No salon at this address');
    const page = await k.api('GET', '/book', { host });
    assert.equal(page.status, 404, host);
    assert.doesNotMatch(page.text, /Alpha|Beta/, `${host} leaked a salon`);
  }
  assert.equal((await k.api('GET', '/api/version', { host: 'anything.example' })).status, 200, 'the health check answers for any host');
  assert.equal((await k.api('GET', '/api/version')).status, 200);
});

test('each address serves only its own salon, and says which one it served', async () => {
  const a = await k.api('GET', '/api/public/info', { host: A });
  assert.equal(a.status, 200);
  assert.equal(a.headers.get('x-kairo-tenant'), 'alpha');
  assert.equal(a.json.business_name, 'Alpha Salon');
  assert.ok(a.json.staff.some((s) => s.name === 'Sha'), 'alpha has the demo team');
  assert.doesNotMatch(a.text, /Beta|Bea\b/);

  const b = await k.api('GET', '/api/public/info', { host: B });
  assert.equal(b.headers.get('x-kairo-tenant'), 'beta');
  assert.equal(b.json.business_name, 'Beta Salon');
  assert.deepEqual(b.json.staff.map((s) => s.name), ['Bea']);
  assert.deepEqual(b.json.services.map((s) => s.name), ['Beta Colour']);
  assert.doesNotMatch(b.text, /Alpha|Sha\b|Luxe/);

  const ma = await k.api('GET', '/manifest.webmanifest', { host: A });
  const mb = await k.api('GET', '/manifest.webmanifest', { host: B });
  assert.equal(ma.json.name, 'Alpha Salon');
  assert.equal(mb.json.name, 'Beta Salon');
});

test("one salon's session is worthless on another, and so are its owner's credentials", async () => {
  assert.equal((await k.api('GET', '/api/auth/me', { host: A, cookie: alphaCookie })).status, 200);
  assert.equal((await k.api('GET', '/api/auth/me', { host: B, cookie: alphaCookie })).status, 401, 'alpha cookie on beta');
  assert.equal((await k.api('GET', '/api/auth/me', { host: A, cookie: betaCookie })).status, 401, 'beta cookie on alpha');
  const cross = await k.api('POST', '/api/auth/login', { host: B, body: ALPHA });
  assert.equal(cross.status, 401, "alpha's owner cannot sign in to beta");
  const clients = await k.api('GET', '/api/clients', { host: B, cookie: betaCookie });
  assert.equal(clients.status, 200);
  assert.equal(clients.json.length, 0, 'beta has no clients; alpha has fourteen');
});

test('a booking on one salon writes only to that salon’s file', async () => {
  const date = openDateAhead(3);
  const before = { a: count('alpha', 'appointments'), b: count('beta', 'appointments'), bm: count('beta', 'messages'), bc: count('beta', 'clients') };
  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`, { host: A });
  const r = await k.api('POST', '/api/public/book', {
    host: A, body: { service_ids: [9], staff_id: 1, date, start_min: av.json.slots[0].start_min, client: { first_name: 'Only', email: 'only@alpha.example' } },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(count('alpha', 'appointments'), before.a + 1);
  assert.equal(count('beta', 'appointments'), before.b, 'beta untouched');
  assert.equal(count('beta', 'messages'), before.bm, 'no message queued in beta');
  assert.equal(count('beta', 'clients'), before.bc, 'no client created in beta');
  const d = tenantDb('alpha');
  const token = d.prepare('SELECT cancel_token FROM appointments WHERE id = ?').get(r.json.appointment_id).cancel_token;
  d.close();
  assert.equal((await k.api('GET', `/api/public/cancel?token=${token}`, { host: A })).status, 200);
  assert.equal((await k.api('GET', `/api/public/cancel?token=${token}`, { host: B })).status, 404, "alpha's cancel token means nothing on beta");
  assert.equal((await k.api('GET', r.json.ics_url, { host: B })).status, 404, "alpha's calendar token means nothing on beta");
});

test('two hundred interleaved requests never cross: every answer names the salon that was asked', async () => {
  const hosts = Array.from({ length: 200 }, (_, i) => (i % 2 ? B : A));
  const results = await Promise.all(hosts.map((h) => k.api('GET', '/api/public/info', { host: h })));
  results.forEach((r, i) => {
    assert.equal(r.status, 200);
    assert.equal(r.json.business_name, hosts[i] === A ? 'Alpha Salon' : 'Beta Salon', `request ${i}`);
    assert.equal(r.headers.get('x-kairo-tenant'), hosts[i] === A ? 'alpha' : 'beta');
  });
});

test('a salon created while the server runs is served on its next request, no restart', async () => {
  const G = `gamma.${DOMAIN}`;
  assert.equal((await k.api('GET', '/api/public/info', { host: G })).status, 404);
  tenantCli(dataDir, ['create', 'gamma', '--name', 'Gamma Salon', '--email', 'gamma@example.com', '--password', 'gamma-pass-2026!!']);
  const r = await k.api('GET', '/api/public/info', { host: G });
  assert.equal(r.status, 200);
  assert.equal(r.json.business_name, 'Gamma Salon');
  assert.equal(r.json.staff.length, 0, 'a provisioned salon starts empty');
  const { cookie } = await k.login('gamma@example.com', 'gamma-pass-2026!!', { host: G });
  const me = await k.api('GET', '/api/auth/me', { host: G, cookie });
  assert.equal(me.json.settings.setup_complete, '', 'and meets the wizard');
  assert.equal(me.json.settings.default_password_active, '0');
  assert.equal(me.json.settings.public_url_effective, `https://gamma.${DOMAIN}`);
  assert.equal(me.json.settings.public_url_from_env, '1', 'pinned by tenant.json');
});

test('maintenance for one salon: its writes wait, its reads and sign-in work, the salon next door is unaffected', async () => {
  tenantCli(dataDir, ['set', 'beta', 'read_only=1']);
  const date = openDateAhead(3);
  const info = await k.api('GET', '/api/public/info', { host: B });
  assert.equal(info.status, 200);
  assert.equal(info.json.read_only, true);
  const post = await k.api('POST', '/api/clients', { host: B, cookie: betaCookie, body: { first_name: 'Blocked' } });
  assert.equal(post.status, 503);
  assert.equal(post.json.read_only, true);
  assert.equal(post.headers.get('retry-after'), '120');
  assert.match(post.json.error, /back in a few minutes/);
  assert.equal((await k.api('GET', '/api/clients', { host: B, cookie: betaCookie })).status, 200, 'reads still work');
  assert.equal((await k.api('POST', '/api/auth/login', { host: B, body: BETA })).status, 200, 'signing in still works');
  assert.equal(count('beta', 'clients'), 0, 'nothing was written');
  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=2&service_ids=9`, { host: A });
  const ok = await k.api('POST', '/api/public/book', {
    host: A, body: { service_ids: [9], staff_id: 2, date, start_min: av.json.slots[0].start_min, client: { first_name: 'Next', email: 'next@alpha.example' } },
  });
  assert.equal(ok.status, 200, 'alpha keeps taking bookings');
  tenantCli(dataDir, ['set', 'beta', 'read_only=0']);
  const again = await k.api('POST', '/api/clients', { host: B, cookie: betaCookie, body: { first_name: 'Allowed' } });
  assert.equal(again.status, 200, again.text);
});

test('a muted salon works completely and sends nothing', async () => {
  tenantCli(dataDir, ['set', 'alpha', 'muted=1']);
  await k.api('PUT', '/api/settings', { host: A, cookie: alphaCookie, body: { resend_api_key: 're_would_be_real', notif_from_email: 'hello@alpha.kairobookings.test' } });
  const r = await k.api('POST', '/api/messages/test', { host: A, cookie: alphaCookie, body: { channel: 'email', to: 'someone@example.com' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'skipped');
  assert.match(r.json.detail, /Muted/);
  tenantCli(dataDir, ['set', 'alpha', 'muted=0']);
  await k.api('PUT', '/api/settings', { host: A, cookie: alphaCookie, body: { resend_api_key: '__clear__' } });
});

test('a deleted salon serves nothing at its address and is gone from the list', async () => {
  tenantCli(dataDir, ['set', 'gamma', 'deleted=1']);
  assert.equal((await k.api('GET', '/api/public/info', { host: `gamma.${DOMAIN}` })).status, 404);
  assert.doesNotMatch(tenantCli(dataDir, ['list']), /gamma/);
  assert.ok(fs.existsSync(path.join(dataDir, 'tenants', 'gamma', 'kairo.db')), 'the file is kept');
});

test('rate limits are per salon: exhausting one booking allowance does not spend another’s', async () => {
  const k2 = await startKairo({ dataDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_RATELIMIT: 'on' } });
  try {
    const date = openDateAhead(6);
    const ip = { 'cf-connecting-ip': '203.0.113.99' };
    let last;
    for (let i = 0; i < 13; i++) {
      last = await k2.api('POST', '/api/public/book', { host: A, headers: ip, body: { service_ids: [9], staff_id: 3, date, start_min: 480, client: { first_name: 'Spam', email: 'spam@example.com' } } });
    }
    assert.equal(last.status, 429);
    const other = await k2.api('POST', '/api/public/book', { host: B, headers: ip, body: { service_ids: [1], staff_id: 1, date, start_min: 480, client: { first_name: 'Fine', email: 'fine@example.com' } } });
    assert.notEqual(other.status, 429, 'beta is not limited by alpha’s spam');
  } finally { await k2.stop({ keepData: true }); }
});

test('single-tenant maintenance via the environment behaves the same way', async () => {
  const k3 = await startKairo({ env: { KAIRO_READ_ONLY: '1' } });
  try {
    const { cookie } = await k3.login();
    assert.equal((await k3.api('GET', '/api/public/info')).json.read_only, true);
    assert.equal((await k3.api('GET', '/api/clients', { cookie })).status, 200);
    assert.equal((await k3.api('POST', '/api/clients', { cookie, body: { first_name: 'No' } })).status, 503);
    assert.equal((await k3.api('GET', '/api/version')).status, 200);
  } finally { await k3.stop(); }
});

// ---------------------------------------------------------------------------
// The front door: a forwarded host, and why it must not be believed
// ---------------------------------------------------------------------------

describe('a shard behind a front door', () => {
  const SECRET = 'front-door-secret-0123456789';
  let f, dir;

  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-front-'));
    fs.mkdirSync(path.join(dir, 'tenants'), { recursive: true });
    f = await startKairo({ dataDir: dir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_FORWARD_SECRET: SECRET } });
    // two salons, so "reached the wrong one" is a thing that can be detected
    tenantCli(dir, ['create', 'alpha', '--name', 'Alpha Salon', '--email', 'a@alpha.test', '--password', 'alpha-pw-123']);
    tenantCli(dir, ['create', 'beta', '--name', 'Beta Salon', '--email', 'b@beta.test', '--password', 'beta-pw-1234']);
  });
  after(async () => { await f?.stop(); fs.rmSync(dir, { recursive: true, force: true }); });

  const name = (r) => r.json?.business_name;

  test('with the secret, the forwarded host decides which salon answers', async () => {
    const r = await f.api('GET', '/api/public/info', {
      host: 'kairo-shard.onrender.test',
      headers: { 'x-kairo-host': `alpha.${DOMAIN}`, 'x-kairo-forward-secret': SECRET },
    });
    assert.equal(r.status, 200);
    assert.equal(name(r), 'Alpha Salon');

    const r2 = await f.api('GET', '/api/public/info', {
      host: 'kairo-shard.onrender.test',
      headers: { 'x-kairo-host': `beta.${DOMAIN}`, 'x-kairo-forward-secret': SECRET },
    });
    assert.equal(name(r2), 'Beta Salon', 'the same front door reaches a different salon');
  });

  test('WITHOUT the secret the header is ignored, so nobody can walk into another salon', async () => {
    // The whole danger of this mechanism in one test: an attacker who found the
    // shard's own address and guessed a salon's name must get nothing.
    for (const headers of [
      { 'x-kairo-host': `alpha.${DOMAIN}` },
      { 'x-kairo-host': `alpha.${DOMAIN}`, 'x-kairo-forward-secret': 'wrong' },
      { 'x-kairo-host': `alpha.${DOMAIN}`, 'x-kairo-forward-secret': SECRET.slice(0, -1) },
      { 'x-kairo-host': `alpha.${DOMAIN}`, 'x-kairo-forward-secret': `${SECRET}x` },
      { 'x-kairo-host': `alpha.${DOMAIN}`, 'x-kairo-forward-secret': '' },
    ]) {
      const r = await f.api('GET', '/api/public/info', { host: 'kairo-shard.onrender.test', headers });
      assert.equal(r.status, 404, `must not resolve a salon: ${JSON.stringify(headers)}`);
    }
  });

  test('a forwarded host cannot cross from one salon to another', async () => {
    // Arriving legitimately AT beta, but claiming to be alpha, without the
    // secret: beta must answer, never alpha.
    const r = await f.api('GET', '/api/public/info', {
      host: `beta.${DOMAIN}`,
      headers: { 'x-kairo-host': `alpha.${DOMAIN}` },
    });
    assert.equal(r.status, 200);
    assert.equal(name(r), 'Beta Salon', 'an unsigned forwarded host must never redirect a real request');
  });

  test('a shard with no front-door secret ignores the header entirely', async () => {
    // Every shard is in this state until someone deliberately configures one,
    // so the header must be inert here — and the dangerous case is the header
    // arriving with NO secret alongside it, because "no secret configured" and
    // "no secret sent" are both empty and an empty string equals an empty
    // string. That comparison must never be reached.
    // It must have a salon of its own to reach, or this passes for the wrong
    // reason — a shard with no salons answers 404 however it routes.
    const pdir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-nosecret-'));
    fs.mkdirSync(path.join(pdir, 'tenants'), { recursive: true });
    const plain = await startKairo({ dataDir: pdir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN } });
    tenantCli(pdir, ['create', 'alpha', '--name', 'Alpha Salon', '--email', 'a@alpha.test', '--password', 'alpha-pw-123']);
    assert.equal((await plain.api('GET', '/api/public/info', { host: `alpha.${DOMAIN}` })).status, 200, 'alpha really is there to be reached');
    try {
      for (const headers of [
        { 'x-kairo-host': `alpha.${DOMAIN}` },
        { 'x-kairo-host': `alpha.${DOMAIN}`, 'x-kairo-forward-secret': '' },
        { 'x-kairo-host': `alpha.${DOMAIN}`, 'x-kairo-forward-secret': SECRET },
      ]) {
        const r = await plain.api('GET', '/api/public/info', { host: 'kairo-shard.onrender.test', headers });
        assert.equal(r.status, 404, `the mechanism is off until a secret is configured: ${JSON.stringify(headers)}`);
      }
    } finally { await plain.stop(); fs.rmSync(pdir, { recursive: true, force: true }); }
  });
});
