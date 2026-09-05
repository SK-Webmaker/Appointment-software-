import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, ADMIN } from './helpers/kairo.js';

let k;
before(async () => { k = await startKairo(); });
after(async () => { await k.stop(); });

test('every authenticated route refuses a request with no session', async () => {
  for (const p of ['/api/clients', '/api/settings', '/api/appointments', '/api/messages', '/api/dashboard', '/api/account', '/api/edge/status']) {
    const r = await k.api('GET', p);
    assert.equal(r.status, 401, p);
    assert.equal(r.json.error, 'Not signed in');
  }
});

test('a wrong password is refused with the same message as an unknown email', async () => {
  const bad = await k.api('POST', '/api/auth/login', { body: { email: ADMIN.email, password: 'nope-nope-nope' } });
  const unknown = await k.api('POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: 'nope-nope-nope' } });
  assert.equal(bad.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(bad.json.error, unknown.json.error);
});

test('login sets an HttpOnly, SameSite cookie and returns the user without secrets', async () => {
  const { setCookie, user } = await k.login();
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.doesNotMatch(setCookie, /Secure/, 'plain-HTTP dev must stay usable');
  assert.equal(user.email, ADMIN.email);
  assert.equal(user.pass_hash, undefined);
  assert.equal(user.salt, undefined);
  assert.equal(user.token_version, undefined);
});

test('the cookie is marked Secure behind an HTTPS proxy', async () => {
  const r = await k.api('POST', '/api/auth/login', {
    body: { email: ADMIN.email, password: ADMIN.password },
    headers: { 'x-forwarded-proto': 'https' },
  });
  assert.match(r.headers.get('set-cookie'), /; Secure/);
});

test('/api/auth/me works with the cookie and never exposes the session epoch', async () => {
  const { cookie } = await k.login();
  const r = await k.api('GET', '/api/auth/me', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.user.email, ADMIN.email);
  assert.equal(r.json.user.token_version, undefined);
  assert.equal(r.json.settings.default_password_active, '1', 'fresh install is on the default password');
});

test('a forged or tampered cookie is rejected', async () => {
  const { cookie } = await k.login();
  const tampered = cookie.slice(0, -2) + (cookie.endsWith('a') ? 'bb' : 'aa');
  const r1 = await k.api('GET', '/api/auth/me', { cookie: tampered });
  assert.equal(r1.status, 401);
  const r2 = await k.api('GET', '/api/auth/me', { cookie: 'kairo_session=1.0.9999999999999.forged' });
  assert.equal(r2.status, 401);
  const r3 = await k.api('GET', '/api/auth/me', { cookie: 'kairo_session=%ZZ%' });
  assert.equal(r3.status, 401, 'a malformed cookie must not crash the server');
});

test('logout clears the cookie', async () => {
  const r = await k.api('POST', '/api/auth/logout');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /kairo_session=;.*Max-Age=0/);
});

test('password rules are enforced on the server', async () => {
  const { cookie } = await k.login();
  const short = await k.api('PUT', '/api/auth/password', { cookie, body: { current: ADMIN.password, next: 'short' } });
  assert.equal(short.status, 400);
  const common = await k.api('PUT', '/api/auth/password', { cookie, body: { current: ADMIN.password, next: 'password1234' } });
  assert.equal(common.status, 400);
  const wrongCurrent = await k.api('PUT', '/api/auth/password', { cookie, body: { current: 'not-it', next: 'a-perfectly-good-passphrase-91' } });
  assert.equal(wrongCurrent.status, 400);
  assert.match(wrongCurrent.json.error, /Current password/);
});

test('changing the password retires every old cookie, hands this browser a new one, and clears the default-password flag', async () => {
  const old = await k.login();
  const other = await k.login();
  const r = await k.api('PUT', '/api/auth/password', {
    cookie: old.cookie, body: { current: ADMIN.password, next: 'a-perfectly-good-passphrase-91' },
  });
  assert.equal(r.status, 200);
  const fresh = /kairo_session=([^;]+)/.exec(r.headers.get('set-cookie'))[1];
  assert.equal((await k.api('GET', '/api/auth/me', { cookie: old.cookie })).status, 401, 'old cookie retired');
  assert.equal((await k.api('GET', '/api/auth/me', { cookie: other.cookie })).status, 401, 'other device retired');
  const me = await k.api('GET', '/api/auth/me', { cookie: `kairo_session=${fresh}` });
  assert.equal(me.status, 200, 'this browser keeps working');
  assert.equal(me.json.settings.default_password_active, '0');
  assert.equal((await k.api('POST', '/api/auth/login', { body: { email: ADMIN.email, password: ADMIN.password } })).status, 401);
  const again = await k.login(ADMIN.email, 'a-perfectly-good-passphrase-91');
  assert.equal(again.user.email, ADMIN.email);
});
