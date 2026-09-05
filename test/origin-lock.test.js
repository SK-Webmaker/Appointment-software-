import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo } from './helpers/kairo.js';

let k, cookie;
before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
after(async () => { await k.stop(); });

test('a fresh install has the lock off and refuses to move it without a secret', async () => {
  const st = await k.api('GET', '/api/edge/status', { cookie });
  assert.equal(st.json.origin.mode, 'off');
  assert.equal(st.json.origin.secret_set, false);
  const r = await k.api('POST', '/api/edge/lock-mode', { cookie, body: { mode: 'monitor' } });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /Generate the Cloudflare secret first/);
});

test('minting a secret returns it exactly once; monitor counts direct hits and never blocks', async () => {
  const mint = await k.api('POST', '/api/edge/origin-secret', { cookie });
  assert.equal(mint.status, 200);
  const secret = mint.json.secret;
  assert.match(secret, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(mint.json.header, 'x-kairo-origin');
  const st = await k.api('GET', '/api/edge/status', { cookie });
  assert.equal(st.json.origin.secret_set, true);
  assert.doesNotMatch(JSON.stringify(st.json), new RegExp(secret), 'write-only from then on');

  const mon = await k.api('POST', '/api/edge/lock-mode', { cookie, body: { mode: 'monitor' } });
  assert.equal(mon.status, 200);
  const direct = await k.api('GET', '/api/public/info');
  assert.equal(direct.status, 200, 'monitor never blocks');
  const viaEdge = await k.api('GET', '/api/public/info', { headers: { 'x-kairo-origin': secret } });
  assert.equal(viaEdge.status, 200);
  const st2 = await k.api('GET', '/api/edge/status', { cookie, headers: { 'x-kairo-origin': secret } });
  assert.ok(st2.json.origin.direct_count >= 1);
  assert.match(st2.json.origin.direct_last_path, /^\/(api|book)/, 'the last direct path is remembered');
  assert.equal(st2.json.origin.via_edge, true);
  k._secret = secret;
});

test('enforce is refused from a request that did not come through the edge', async () => {
  const r = await k.api('POST', '/api/edge/lock-mode', { cookie, body: { mode: 'enforce' } });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /did not come through Cloudflare/);
  const st = await k.api('GET', '/api/edge/status', { cookie });
  assert.equal(st.json.origin.mode, 'monitor', 'mode unchanged after refusal');
});

test('in enforce, header-less requests get a bare 403 while /api/version still answers', async () => {
  const secret = k._secret;
  const r = await k.api('POST', '/api/edge/lock-mode', { cookie, body: { mode: 'enforce' }, headers: { 'x-kairo-origin': secret } });
  assert.equal(r.status, 200, r.text);
  assert.equal((await k.api('GET', '/api/public/info')).status, 403);
  assert.equal((await k.api('GET', '/book')).status, 403);
  assert.equal((await k.api('GET', '/api/version')).status, 200, 'health check never blocked');
  assert.equal((await k.api('GET', '/api/public/info', { headers: { 'x-kairo-origin': secret } })).status, 200);
  assert.equal((await k.api('GET', '/api/public/info', { headers: { 'x-kairo-origin': secret + 'x' } })).status, 403);
});

test('minting a new secret steps enforce back to monitor so nobody is shut out', async () => {
  const mint = await k.api('POST', '/api/edge/origin-secret', { cookie, headers: { 'x-kairo-origin': k._secret } });
  assert.equal(mint.status, 200);
  assert.equal(mint.json.stepped_down, true);
  assert.equal((await k.api('GET', '/api/public/info')).status, 200);
  assert.equal((await k.api('GET', '/api/public/info', { headers: { 'x-kairo-origin': k._secret } })).status, 200, 'old secret: allowed in monitor, but counted');
});

test('KAIRO_ORIGIN_LOCK=off in the environment overrides the database on restart', async () => {
  await k.api('POST', '/api/edge/lock-mode', { cookie, body: { mode: 'enforce' }, headers: { 'x-kairo-origin': (await k.api('POST', '/api/edge/origin-secret', { cookie })).json.secret } }).catch(() => {});
  const dir = k.dataDir;
  await k.stop({ keepData: true });
  k = await startKairo({ dataDir: dir, env: { KAIRO_ORIGIN_LOCK: 'off' } });
  assert.equal((await k.api('GET', '/api/public/info')).status, 200);
  const { cookie: c2 } = await k.login();
  const st = await k.api('GET', '/api/edge/status', { cookie: c2 });
  assert.equal(st.json.origin.forced_by_env, true);
  assert.equal(st.json.origin.mode, 'off');
});
