// "Can you do Tuesday at seven?" when Tuesday at seven is not on the page.
//
// The customer this exists for is the one who finds nothing that suits and
// closes the tab. Today the salon never learns it happened. So the assertions
// that matter are: the request reaches the owner, it reaches them intact, and
// it never quietly becomes something it is not — a client record, a booking,
// or an automated reply.
//
// It is also a public endpoint whose entire purpose is to accept free text
// from strangers, which makes it the softest target on the booking page. The
// second half of this file is about that.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead } from './helpers/kairo.js';

let k, cookie;
before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
after(async () => { await k.stop(); });

const send = (body) => k.api('POST', '/api/public/enquiry', { body });
const listOpen = () => k.api('GET', '/api/enquiries', { cookie });
const listAll = () => k.api('GET', '/api/enquiries?all=1', { cookie });

const REQUEST = {
  name: 'Ruby Vance',
  email: 'ruby.vance@example.net',
  want_date: openDateAhead(9),
  when_text: 'any evening after 6',
  message: "I'd love a balayage but I can only do Sundays — do you ever open?",
};

// ── It reaches the owner, intact ────────────────────────────────────────────

test('the booking page is told the panel is on, and what it should say', async () => {
  const info = await k.api('GET', '/api/public/info');
  assert.equal(info.status, 200);
  assert.equal(info.json.enquiries.enabled, true, 'on by default — an off switch costs a lost customer');
  assert.equal(info.json.enquiries.note, '', 'and uses the built-in wording until the salon writes its own');
});

test('a request arrives whole and sits waiting on the owner', async () => {
  const r = await send(REQUEST);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.ok, true);
  assert.match(r.json.detail, /get back to you/i);

  const list = await listOpen();
  assert.equal(list.status, 200);
  const e = list.json.enquiries.find((x) => x.name === 'Ruby Vance');
  assert.ok(e, 'it reached the owner');
  assert.equal(e.email, 'ruby.vance@example.net');
  assert.equal(e.want_date, REQUEST.want_date);
  assert.equal(e.when_text, 'any evening after 6', 'the half a date picker cannot hold');
  assert.equal(e.message, REQUEST.message, 'word for word — the owner replies to what they said');
  assert.equal(e.status, 'new');
  assert.equal(list.json.open_count, 1);
});

test('a request from somebody the salon already knows says so', async () => {
  const clients = await k.api('GET', '/api/clients', { cookie });
  const known = (clients.json.clients || clients.json).find((c) => c.email);
  const r = await send({ ...REQUEST, name: 'Known Person', email: known.email, message: 'Any chance of a Sunday?' });
  assert.equal(r.status, 200, r.text);
  const e = (await listOpen()).json.enquiries.find((x) => x.name === 'Known Person');
  assert.ok(e.known, '"your Tuesday regular asked" reads differently to "a stranger asked"');
  assert.equal(e.known.id, known.id);
  assert.equal(typeof e.known.visits, 'number');
});

// ── What it must NOT quietly do ─────────────────────────────────────────────

test('a request does not create a client record', async () => {
  // A waitlist entry has to: it is a standing instruction to message that
  // person later. This is one message. Making a client of everybody who ever
  // asked about a Sunday fills the list with people who never came, and opts
  // them into whatever the list is used for.
  const before_ = (await k.api('GET', '/api/clients', { cookie })).json;
  const beforeCount = (before_.clients || before_).length;
  const r = await send({
    name: 'Never A Client', email: 'never.a.client@example.net',
    message: 'Do you do wedding parties?',
  });
  assert.equal(r.status, 200, r.text);
  const after_ = (await k.api('GET', '/api/clients', { cookie })).json;
  assert.equal((after_.clients || after_).length, beforeCount,
    'asking a question is not becoming a customer');
});

test('a request does not create an appointment', async () => {
  const date = REQUEST.want_date;
  const before_ = (await k.api('GET', `/api/appointments?from=${date}&to=${date}`, { cookie })).json.length;
  await send({ ...REQUEST, name: 'Not Booked', message: 'Can you fit me in at 8pm?' });
  const after_ = (await k.api('GET', `/api/appointments?from=${date}&to=${date}`, { cookie })).json.length;
  assert.equal(after_, before_, 'a request is a conversation the salon has not had yet');
});

test('nothing is sent back to the customer automatically', async () => {
  const d = k.db();
  const before_ = d.prepare("SELECT COUNT(*) AS n FROM messages").get().n;
  d.close();
  await send({ ...REQUEST, name: 'No Auto Reply', email: 'no.auto@example.net', message: 'Sundays?' });
  const d2 = k.db();
  const after_ = d2.prepare("SELECT COUNT(*) AS n FROM messages").get().n;
  d2.close();
  assert.equal(after_, before_,
    'the salon knows whether it can do Sunday; a templated "thanks for your enquiry" is worse than nothing');
});

// ── Dealing with one ────────────────────────────────────────────────────────

test('marking done clears it from the waiting list, and can be undone', async () => {
  const e = (await listOpen()).json.enquiries[0];
  assert.ok(e, 'something to work with');
  const done = await k.api('POST', `/api/enquiries/${e.id}/done`, { cookie, body: {} });
  assert.equal(done.status, 200);
  assert.equal(done.json.status, 'done');
  assert.ok(!(await listOpen()).json.enquiries.some((x) => x.id === e.id), 'off the waiting list');
  assert.ok((await listAll()).json.enquiries.some((x) => x.id === e.id), 'still readable');

  const back = await k.api('POST', `/api/enquiries/${e.id}/done`, { cookie, body: { reopen: true } });
  assert.equal(back.json.status, 'new', '"done" is a judgement, and judgements slip');
  assert.ok((await listOpen()).json.enquiries.some((x) => x.id === e.id));
});

test('deleting one removes it for good', async () => {
  const e = (await listOpen()).json.enquiries[0];
  assert.equal((await k.api('DELETE', `/api/enquiries/${e.id}`, { cookie })).status, 200);
  assert.ok(!(await listAll()).json.enquiries.some((x) => x.id === e.id));
});

// ── Refusals ────────────────────────────────────────────────────────────────

test('a request with no way to reply is refused', async () => {
  const r = await send({ name: 'Anonymous', message: 'Do you do Sundays?' });
  assert.equal(r.status, 400,
    'an unanswerable request is worse than none — the owner knows somebody wanted something and cannot find out who');
  assert.match(r.json.error, /email or a phone/i);
});

test('an empty name or message is refused, and a mistyped email too', async () => {
  assert.equal((await send({ name: '', email: 'a@b.co', message: 'hi' })).status, 400);
  assert.equal((await send({ name: 'No Message', email: 'a@b.co', message: '' })).status, 400);
  const typo = await send({ name: 'Typo', email: 'ruby at example dot net', message: 'Sundays?' });
  assert.equal(typo.status, 400, 'a mistyped address is a reply that never arrives');
});

test('a date typed in words is kept as words, not thrown away', async () => {
  // The field is <input type="date">, but a browser without support for it
  // shows a plain text box. Refusing the whole request over "next Tuesday"
  // would turn away the exact customer this exists to keep.
  const r = await send({ ...REQUEST, name: 'Bad Date', want_date: 'next Tuesday-ish', when_text: 'after work' });
  assert.equal(r.status, 200, 'the request still gets through — the date is the optional half');
  const e = (await listOpen()).json.enquiries.find((x) => x.name === 'Bad Date');
  assert.equal(e.want_date, '', 'the date column only ever holds a real date');
  assert.match(e.when_text, /next Tuesday-ish/, 'but what they typed still reaches the owner');
  assert.match(e.when_text, /after work/, 'alongside anything else they said');
});

test('the message is capped rather than swallowing the database', async () => {
  const r = await send({ ...REQUEST, name: 'Very Long', message: 'x'.repeat(9000) });
  // Either refused or truncated — never stored whole.
  if (r.status === 200) {
    const e = (await listOpen()).json.enquiries.find((x) => x.name === 'Very Long');
    assert.ok(e.message.length <= 1500, `stored ${e.message.length} characters`);
  } else {
    assert.equal(r.status, 400);
  }
});

// ── The switch ──────────────────────────────────────────────────────────────

test('turning it off closes the endpoint, not just the panel', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { enquiries_enabled: '0' } });
  const info = await k.api('GET', '/api/public/info');
  assert.equal(info.json.enquiries.enabled, false, 'the page knows not to draw it');
  const r = await send({ ...REQUEST, name: 'Too Late' });
  assert.equal(r.status, 404,
    'hiding the panel is not enough — a cached page or a replayed request must be refused too');
  await k.api('PUT', '/api/settings', { cookie, body: { enquiries_enabled: '1' } });
});

test('requests stop when online booking itself is off', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { booking_enabled: '0' } });
  assert.equal((await send({ ...REQUEST, name: 'Closed Shop' })).status, 404,
    'a salon that took its booking page down has not left a form open on it');
  await k.api('PUT', '/api/settings', { cookie, body: { booking_enabled: '1' } });
});

test('the owner routes need a login', async () => {
  assert.equal((await k.api('GET', '/api/enquiries')).status, 401,
    'a stranger must not be able to read what other people asked the salon');
  assert.equal((await k.api('DELETE', '/api/enquiries/1')).status, 401);
});

// ── The owner's own switch for being interrupted ────────────────────────────

test('the phone alert for requests is on by default and can be turned off', async () => {
  const s = (await k.api('GET', '/api/settings', { cookie })).json;
  assert.equal(s.push_enquiry, '1');
  const cfg = await k.api('GET', '/api/app/config', { cookie });
  assert.equal(cfg.json.push.kinds.enquiry, true);

  await k.api('PUT', '/api/settings', { cookie, body: { push_enquiry: '0' } });
  const off = await k.api('GET', '/api/app/config', { cookie });
  assert.equal(off.json.push.kinds.enquiry, false, 'the app must be told, not left guessing');

  // The request itself still arrives — the alert is a preference, never a
  // precondition for the salon hearing about a customer.
  const r = await send({ ...REQUEST, name: 'Quiet Request', message: 'Any chance of a Sunday?' });
  assert.equal(r.status, 200, r.text);
  assert.ok((await listOpen()).json.enquiries.some((x) => x.name === 'Quiet Request'));
  await k.api('PUT', '/api/settings', { cookie, body: { push_enquiry: '1' } });
});
