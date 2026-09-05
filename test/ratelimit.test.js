import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead } from './helpers/kairo.js';

// This suite turns the limiter back ON. IPs are simulated with the header
// Cloudflare sets and the limiter trusts by default.
let k;
before(async () => { k = await startKairo({ env: { KAIRO_RATELIMIT: 'on' } }); });
after(async () => { await k.stop(); });

const ip = (v) => ({ 'cf-connecting-ip': v });

test('the 21st login attempt in ten minutes from one address gets a clean 429 with Retry-After; another address is unaffected', async () => {
  let last;
  for (let i = 0; i < 21; i++) {
    last = await k.api('POST', '/api/auth/login', { body: { email: 'x@example.com', password: 'wrong' }, headers: ip('203.0.113.7') });
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
  assert.match(last.json.error, /Too many requests/);
  const other = await k.api('POST', '/api/auth/login', { body: { email: 'x@example.com', password: 'wrong' }, headers: ip('203.0.113.8') });
  assert.equal(other.status, 401, 'a different address still gets a normal answer');
});

test('the 13th booking attempt in five minutes is refused before the handler runs', async () => {
  const date = openDateAhead(3);
  let last;
  for (let i = 0; i < 13; i++) {
    last = await k.api('POST', '/api/public/book', {
      body: { service_ids: [9], staff_id: 1, date, start_min: 480, client: { first_name: 'Spam', email: 'spam@example.com' } },
      headers: ip('198.51.100.5'),
    });
  }
  assert.equal(last.status, 429);
});

test('the leftmost X-Forwarded-For value is never trusted: spoofing it does not reset a limit', async () => {
  for (let i = 0; i < 21; i++) {
    await k.api('POST', '/api/auth/login', {
      body: { email: 'x@example.com', password: 'wrong' },
      headers: { 'x-forwarded-for': `10.0.0.${i}, 192.0.2.44` },  // caller-controlled prefix, real address last
    });
  }
  const r = await k.api('POST', '/api/auth/login', { body: { email: 'x@example.com', password: 'wrong' }, headers: { 'x-forwarded-for': '10.9.9.9, 192.0.2.44' } });
  assert.equal(r.status, 429);
});

test('public reads are generous: a burst of 100 info reads is fine', async () => {
  const rs = await Promise.all(Array.from({ length: 100 }, () => k.api('GET', '/api/public/info', { headers: ip('192.0.2.99') })));
  assert.ok(rs.every((r) => r.status === 200));
});
