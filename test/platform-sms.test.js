// The platform believing ClickSend when ClickSend is wrong.
//
// On 18 September, against the live account with a zero balance, ClickSend
// answered a send with:
//
//   { response_code: "SUCCESS", response_msg: "Messages queued for delivery" }
//
// and sent nothing. The account's own SMS history stayed empty. The platform
// read the envelope, reported ok, and the signup told a customer a code was on
// its way to a handset that would never receive one — the exact dead-end the
// blueprint warns about, arriving through the one door nobody was watching.
//
// src/notify.js (the salon side) already looked at the per-message status. The
// platform's copy did not. These tests exist so the two cannot drift apart
// again, and so the failure has a name the next person can search for.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let server, base, reply, lastSent;

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { lastSent = JSON.parse(body || '{}'); } catch { lastSent = null; }
      res.writeHead(reply.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.CLICKSEND_API_BASE = base;
  process.env.CLICKSEND_USERNAME = 'someone@example.com';
  process.env.CLICKSEND_API_KEY = 'CS-TEST-KEY';
});
after(() => new Promise((r) => server.close(r)));

/** Import fresh each time so the env above is read. */
const sendSms = async (to, body) => (await import('../platform/notify.js')).sendSms(to, body);

test('a message ClickSend actually queued is a success', async () => {
  reply = { status: 200, body: { response_code: 'SUCCESS', data: { total_price: 0.077, messages: [{ status: 'SUCCESS' }] } } };
  const r = await sendSms('0400000000', 'code 123456');
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('"queued for delivery" with NO message queued is a failure, not a success', async () => {
  // The exact shape the live account returned at zero balance: the envelope
  // says SUCCESS and the list is empty. This is the whole reason the file
  // exists, and the assertion that would have caught it.
  reply = { status: 200, body: { response_code: 'SUCCESS', response_msg: 'Messages queued for delivery', data: { messages: [] } } };
  const r = await sendSms('0400000000', 'code 123456');
  assert.equal(r.ok, false, 'an empty queue must never read as sent');
  assert.match(r.detail, /queued no message/i, 'and it should say why, in words an operator can act on');
});

test('a message ClickSend refuses by status is a failure, and the status is reported', async () => {
  reply = { status: 200, body: { response_code: 'SUCCESS', data: { messages: [{ status: 'INSUFFICIENT_CREDIT' }] } } };
  const r = await sendSms('0400000000', 'code 123456');
  assert.equal(r.ok, false);
  assert.match(r.detail, /INSUFFICIENT_CREDIT/);
});

test('one refused message among several fails the send', async () => {
  reply = { status: 200, body: { response_code: 'SUCCESS', data: { messages: [{ status: 'SUCCESS' }, { status: 'BAD_NUMBER' }] } } };
  const r = await sendSms('0400000000', 'code 123456');
  assert.equal(r.ok, false);
});

test('a queued message with no status is allowed, matching the salon side', async () => {
  // src/notify.js treats a missing status as fine. The two must agree, or the
  // platform starts refusing sends the shard is happy with.
  reply = { status: 200, body: { response_code: 'SUCCESS', data: { messages: [{ message_id: 'abc' }] } } };
  const r = await sendSms('0400000000', 'code 123456');
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('an envelope that is not SUCCESS is still a failure', async () => {
  reply = { status: 401, body: { response_code: 'UNAUTHORIZED', response_msg: 'Authorization failed.' } };
  const r = await sendSms('0400000000', 'code 123456');
  assert.equal(r.ok, false);
  assert.match(r.detail, /Authorization failed/);
});

// ── Who the code appears to come from ──────────────────────────────────────
// An alphanumeric sender ID ("Kairo") needs a one-off ACMA registration, and
// that needs an ABN. Until there is one, the honest setting is ClickSend's
// shared number — and that has to be expressible in config rather than
// happening by accident. It did happen by accident: `env || 'Kairo'` treats an
// empty string as unset, so an explicit "use a number" silently sent the tag,
// and ClickSend swapped in a number of its own without being asked.
test('an UNSET sender still defaults to the Kairo alpha tag', async () => {
  delete process.env.CLICKSEND_FROM;
  reply = { status: 200, body: { response_code: 'SUCCESS', data: { messages: [{ status: 'SUCCESS' }] } } };
  await sendSms('0400000000', 'code');
  assert.equal(lastSent.messages[0].from, 'Kairo');
});

test('an EMPTY sender omits the field, so ClickSend picks a shared number', async () => {
  process.env.CLICKSEND_FROM = '';
  reply = { status: 200, body: { response_code: 'SUCCESS', data: { messages: [{ status: 'SUCCESS' }] } } };
  await sendSms('0400000000', 'code');
  assert.ok(!('from' in lastSent.messages[0]),
    `empty must omit "from" entirely, not send it blank — got ${JSON.stringify(lastSent.messages[0])}`);
});

test('a number set explicitly is sent as given', async () => {
  process.env.CLICKSEND_FROM = '+61456674108';
  reply = { status: 200, body: { response_code: 'SUCCESS', data: { messages: [{ status: 'SUCCESS' }] } } };
  await sendSms('0400000000', 'code');
  assert.equal(lastSent.messages[0].from, '+61456674108');
});
