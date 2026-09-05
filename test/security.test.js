import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead, bookFirstSlot } from './helpers/kairo.js';

let k, cookie;
before(async () => {
  k = await startKairo();
  ({ cookie } = await k.login());
  await k.api('PUT', '/api/settings', { cookie, body: { resend_api_key: 're_secret_abc', stripe_secret_key: 'sk_live_secret_xyz', clicksend_api_key: 'CS-SECRET' } });
});
after(async () => { await k.stop(); });

test('no secret string ever appears in any public or authenticated response', async () => {
  const pages = ['/api/public/info', '/api/public/availability?date=' + openDateAhead(2) + '&staff_id=1&service_ids=9'];
  for (const p of pages) {
    const r = await k.api('GET', p);
    assert.doesNotMatch(r.text, /re_secret|sk_live|CS-SECRET/, p);
  }
  for (const p of ['/api/settings', '/api/auth/me', '/api/account', '/api/dashboard?date=' + openDateAhead(0)]) {
    const r = await k.api('GET', p, { cookie });
    assert.equal(r.status, 200, p);
    assert.doesNotMatch(r.text, /re_secret|sk_live|CS-SECRET/, p);
  }
});

test('the calendar file is token-scoped: walking the id range with no token yields nothing', async () => {
  const b = await bookFirstSlot(k, { date: openDateAhead(2), staffId: 1, serviceIds: [9], client: { first_name: 'Ics', email: 'ics@example.com' } });
  for (let id = 1; id <= 120; id++) {
    const r = await k.api('GET', `/api/public/ics/${id}`);
    assert.equal(r.status, 404, `id ${id} readable without a token`);
  }
  const wrong = await k.api('GET', `/api/public/ics/${b.json.appointment_id}?t=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
  assert.equal(wrong.status, 404);
  const right = await k.api('GET', b.json.ics_url);
  assert.equal(right.status, 200);
  assert.match(right.text, /BEGIN:VCALENDAR/);
  assert.doesNotMatch(right.text, /ics@example\.com/, 'the file carries no client contact details');
});

test('review links are token-scoped and single-use', async () => {
  const b = await bookFirstSlot(k, { date: openDateAhead(2), staffId: 2, serviceIds: [9], client: { first_name: 'Rev', email: 'rev@example.com' } });
  assert.equal((await k.api('GET', '/api/public/review?token=deadbeef')).status, 404);
  const done = await k.api('PATCH', `/api/appointments/${b.json.appointment_id}/status`, { cookie, body: { status: 'completed' } });
  assert.equal(done.status, 200, done.text);
  const d = k.db();
  const token = d.prepare('SELECT review_token FROM appointments WHERE id = ?').get(b.json.appointment_id).review_token;
  d.close();
  assert.match(token, /^[0-9a-f]{32}$/, 'completing the visit queued a review request with a token');
  const form = await k.api('GET', `/api/public/review?token=${token}`);
  assert.equal(form.status, 200);
  assert.equal(form.json.already_reviewed, false);
  assert.equal(form.json.email, undefined);
  const post = await k.api('POST', '/api/public/review', { body: { token, rating: 5, comment: 'Lovely' } });
  assert.equal(post.status, 200);
  const twice = await k.api('POST', '/api/public/review', { body: { token, rating: 1 } });
  assert.equal(twice.status, 409);
  assert.equal((await k.api('POST', '/api/public/review', { body: { token, rating: 9 } })).status, 400);
});

test('malformed bodies are 400s, never 500s', async () => {
  const nul = await k.api('POST', '/api/auth/login', { body: 'null', headers: { 'content-type': 'application/json' } });
  assert.equal(nul.status, 400);
  const arr = await k.api('POST', '/api/auth/login', { body: '[1,2]', headers: { 'content-type': 'application/json' } });
  assert.equal(arr.status, 400);
  const junk = await k.api('POST', '/api/auth/login', { body: '{not json', headers: { 'content-type': 'application/json' } });
  assert.equal(junk.status, 400);
  const wrongType = await k.api('POST', '/api/clients', { cookie, body: { first_name: { deep: true } } });
  assert.equal(wrongType.status, 400);
  const tooLong = await k.api('POST', '/api/clients', { cookie, body: { first_name: 'x'.repeat(101) } });
  assert.equal(tooLong.status, 400);
});

test('an oversized body is refused with 413 and the server stays up', async () => {
  const big = 'x'.repeat(9 * 1024 * 1024);
  const r = await k.api('PUT', '/api/settings', { cookie, body: JSON.stringify({ brand_tagline: big }), headers: { 'content-type': 'application/json' } });
  assert.equal(r.status, 413);
  assert.equal((await k.api('GET', '/api/version')).status, 200);
});

test('the demo reset is refused once the owner is verified', async () => {
  const d = k.db();
  d.prepare('UPDATE users SET email_verified = 1').run();
  d.close();
  const r = await k.api('POST', '/api/settings/reset-demo', { cookie });
  assert.equal(r.status, 403);
});

test('a client export needs a session and carries the real book', async () => {
  assert.equal((await k.api('GET', '/api/clients/export')).status, 401);
  const r = await k.api('GET', '/api/clients/export', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.match(r.text, /ics@example\.com/);
});
