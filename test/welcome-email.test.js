// The "your Kairo is ready" email says what is true about sending.
//
// It used to tell every new owner to "connect your email" before confirmations
// would send — true once, and false since every salon sends through the
// platform's account from the moment it is built. An owner told to fix
// something that already works either wastes an evening or stops trusting the
// email. Texts are the opposite: always their own ClickSend, so always named.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let server;
const sent = [];

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      sent.push(JSON.parse(raw));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: `em_${sent.length}` }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.RESEND_API_KEY = 're_test';
  process.env.PLATFORM_FROM_EMAIL = 'hello@kairobookings.test';
  process.env.RESEND_API_BASE = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const ready = async (sending, extra = {}) => {
  const { emailReady } = await import('../platform/notify.js');
  const r = await emailReady('owner@salon.example', {
    businessName: 'Luxe <Hair>', url: 'https://luxe.kairobookings.test', appUrl: 'https://apps.apple.com/app/id6740000001', sending, ...extra,
  });
  assert.equal(r.ok, true, r.detail);
  return sent.at(-1);
};

test('a salon that can already send is told so, not sent off to connect email', async () => {
  for (const sending of ['kairo', 'own']) {
    const m = await ready(sending);
    assert.match(m.text, /already go out by email/);
    assert.doesNotMatch(m.text, /once your email is connected/);
    assert.match(m.html, /already go out by email/);
  }
});

test('a salon that cannot send yet is told it will be set up with them', async () => {
  const m = await ready('none');
  assert.match(m.text, /once your email is connected/);
  assert.doesNotMatch(m.text, /already go out by email/);
});

test('texts, the booking link and the iPhone app are always in it, in both versions', async () => {
  const m = await ready('kairo');
  for (const body of [m.text, m.html]) {
    assert.match(body, /Set up text messages/);
    assert.match(body, /luxe\.kairobookings\.test\/book/);
    assert.match(body, /apps\.apple\.com\/app\/id6740000001/);
  }
  assert.match(m.html, /Luxe &lt;Hair&gt; is set up and ready/, 'the business name is escaped in the HTML');
  assert.doesNotMatch(m.html, /Luxe <Hair>/);
  assert.equal(m.subject, 'Welcome to Kairo — Luxe <Hair> is ready');
});

// The welcome is to a person, and says how to reach one.
test('it welcomes the owner by first name and says how to contact Kairo', async () => {
  const m = await ready('kairo', { ownerName: 'Ada Bell' });
  for (const body of [m.text, m.html]) {
    assert.match(body, /Welcome to Kairo, Ada\./);
    assert.match(body, /support@kairobookings\.com/, 'the support address');
    assert.match(body, /Monday to Friday/, 'and when someone answers');
    assert.match(body, /kairobookings\.com\/guide/, 'the guide');
    assert.match(body, /14 days for a full refund/);
    assert.match(body, /owner@salon\.example/, 'the address they sign in with');
  }
  assert.match(m.html, /mailto:support@kairobookings\.com/);
  const anon = await ready('kairo');
  assert.match(anon.text, /^Welcome to Kairo\./, 'no name, no awkward blank');
});
