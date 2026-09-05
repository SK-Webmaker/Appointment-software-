import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo } from './helpers/kairo.js';

let k;
before(async () => { k = await startKairo(); });
after(async () => { await k.stop(); });

test('/api/version answers without a session and names the package version', async () => {
  const r = await k.api('GET', '/api/version');
  assert.equal(r.status, 200);
  assert.match(r.json.version, /^\d+\.\d+\.\d+$/);
});

test('every response carries the security headers', async () => {
  for (const p of ['/', '/book', '/api/version', '/api/public/info']) {
    const r = await k.api('GET', p);
    const csp = r.headers.get('content-security-policy') || '';
    assert.match(csp, /default-src 'self'/, `${p} CSP`);
    assert.match(csp, /script-src 'self'/, `${p} script-src`);
    assert.match(csp, /frame-ancestors 'none'/, `${p} frame-ancestors`);
    assert.match(r.headers.get('strict-transport-security') || '', /max-age=\d+/, `${p} HSTS`);
    assert.equal(r.headers.get('x-frame-options'), 'DENY', `${p} XFO`);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', `${p} nosniff`);
    assert.match(r.headers.get('permissions-policy') || '', /camera=\(\)/, `${p} permissions`);
  }
});

test('the workspace shell and the booking page are served as HTML', async () => {
  const home = await k.api('GET', '/');
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(home.text, /<div id="app">/);
  const book = await k.api('GET', '/book');
  assert.equal(book.status, 200);
  assert.match(book.text, /book\.js/);
});

test('unknown extensionless paths fall back to the shell; unknown files are 404', async () => {
  const spa = await k.api('GET', '/some/hash/route');
  assert.equal(spa.status, 200);
  assert.match(spa.text, /<div id="app">/);
  const missing = await k.api('GET', '/nope.js');
  assert.equal(missing.status, 404);
});

test('path traversal cannot escape public/', async () => {
  for (const p of ['/..%2f..%2fpackage.json', '/%2e%2e/%2e%2e/server.js', '/css/../../server.js']) {
    const r = await k.api('GET', p);
    assert.notEqual(r.status, 200, p);
    assert.doesNotMatch(r.text, /node:http/, `${p} leaked server.js`);
  }
});

test('static files are served with caching; HTML is not cached', async () => {
  const js = await k.api('GET', '/js/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('cache-control'), /max-age=300/);
  const html = await k.api('GET', '/');
  assert.equal(html.headers.get('cache-control'), 'no-cache');
});

test('non-GET requests to static paths are refused', async () => {
  const r = await k.api('POST', '/', { body: {} });
  assert.equal(r.status, 405);
});

test('the manifest carries the business name so the home-screen icon does', async () => {
  const r = await k.api('GET', '/manifest.webmanifest');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /manifest\+json/);
  assert.equal(r.json.name, 'Luxe Hair Studio');
  assert.equal(r.json.display, 'standalone');
  assert.ok(r.json.icons.length >= 2);
});

test('public info is served no-store so a stale menu can never be cached', async () => {
  const r = await k.api('GET', '/api/public/info');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});
