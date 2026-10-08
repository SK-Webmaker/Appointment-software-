// Kai, the agent — the loop around Claude, tested against a stand-in for the
// Messages API so every path runs offline and on every commit.
//
// The stand-in answers with scripted turns: "call this action", then "say
// this". What is asserted is what the app did with them — the DATABASE after
// the action, what went back to the model, what the owner was shown — never
// what the script said would happen. The model's judgement is tested live,
// separately, by scripts/kai-backtest.mjs; this file tests that whatever the
// model decides, the app around it is safe and correct:
//
//   1. IT DOES THE SAME THING THE SCREENS DO, through the same routes.
//   2. NOTHING THAT DELETES, REACHES A CLIENT OR MOVES MONEY RUNS WITHOUT THE
//      OWNER PRESSING CONFIRM — and typing something else counts as no.
//   3. ACCOUNT, SECURITY AND KEY ROUTES ARE UNREACHABLE, even by path.
//   4. SECRETS NEVER REACH THE MODEL.
//   5. A BROKEN OR REFUSING MODEL LEAVES A CONVERSATION THAT CAN CARRY ON.
//   6. ONE OWNER'S CONVERSATIONS ARE THEIRS ALONE.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { startKairo, ROOT } from './helpers/kairo.js';

let k, cookie, mock;

/** A stand-in Messages API. `script` is a list of turns, each a function of the request. */
function startMock() {
  const state = { script: [], requests: [], status: 200 };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      state.requests.push({ headers: req.headers, body });
      if (state.status !== 200) {
        res.writeHead(state.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'mock failure' } }));
        return;
      }
      const next = state.script.shift();
      const turn = typeof next === 'function' ? next(body) : next;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: `msg_${state.requests.length}`, type: 'message', role: 'assistant', model: body.model,
        stop_reason: turn?.stop_reason || (turn?.content?.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn'),
        content: turn?.content || [{ type: 'text', text: '(script ran out)' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ ...state, server, state, port: server.address().port })));
}

let n = 0;
const use = (input, name = 'kairo') => ({ type: 'tool_use', id: `toolu_${++n}`, name, input });
const say = (text) => ({ content: [{ type: 'text', text }] });
const calls = (...inputs) => ({ content: inputs.map((i) => (i.name ? use(i.input, i.name) : use(i))) });
/** The tool_result blocks in the last request's final user message. */
const lastResults = () => {
  const msgs = mock.state.requests.at(-1).body.messages;
  return msgs.at(-1).content.filter((b) => b.type === 'tool_result');
};
const chat = (message, chatId) => k.api('POST', '/api/kai/chats', { cookie, body: { message, ...(chatId ? { chat_id: chatId } : {}) } });

before(async () => {
  mock = await startMock();
  k = await startKairo({ env: { KAIRO_ANTHROPIC_API_KEY: 'test-key', KAIRO_ANTHROPIC_BASE_URL: `http://127.0.0.1:${mock.port}` } });
  ({ cookie } = await k.login());
  // This owner has turned Kai on (the consent itself is tested below).
  await k.api('POST', '/api/kai/consent', { cookie, body: {} });
  // A finished setup, so the owner app is the workspace rather than the wizard.
  await k.api('POST', '/api/setup/skip', { cookie, body: { keep_samples: true } });
});
after(async () => { await k?.stop(); mock?.server.close(); });

test('Kai says it is on when the server has a key', async () => {
  const r = await k.api('GET', '/api/kai/status', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.agent, true);
});

test('a note on a client: it looks the client up, writes the note, and the database has it', async () => {
  const before = (await k.api('GET', '/api/clients', { cookie })).json;
  const jane = before[0];
  mock.state.script = [
    calls({ method: 'GET', path: '/api/clients', query: { q: jane.first_name }, summary: `Look up ${jane.first_name}` }),
    (body) => {
      // The client list went back to the model as data it can act on.
      const res = body.messages.at(-1).content.find((b) => b.type === 'tool_result');
      const found = JSON.parse(res.content);
      assert.ok(found.some((c) => c.id === jane.id), 'the search result reached the model');
      return calls({ method: 'PUT', path: `/api/clients/${jane.id}`, summary: `Add a note to ${jane.first_name}`,
        body: { first_name: jane.first_name, last_name: jane.last_name, email: jane.email, phone: jane.phone, birthday: jane.birthday || '', notes: 'Prefers a quieter chair by the window.' } });
    },
    say(`Done — noted on ${jane.first_name}'s record.`),
  ];
  const r = await chat(`Add a note to ${jane.first_name}: prefers a quieter chair by the window`);
  assert.equal(r.status, 200, r.text);
  const after = (await k.api('GET', `/api/clients/${jane.id}`, { cookie })).json;
  assert.equal((after.client || after).notes, 'Prefers a quieter chair by the window.');
  const kinds = r.json.events.map((e) => e.t);
  assert.deepEqual(kinds, ['user', 'act', 'kai']);
  assert.equal(r.json.events[1].ok, true);
  assert.match(r.json.events[1].summary, /note/i);
  assert.equal(r.json.pending, false);
});

test('what goes to Claude: the key, the model, effort, fallback, caching, the tools and the action reference', async () => {
  const req = mock.state.requests.at(-1);
  assert.equal(req.headers['x-api-key'], 'test-key');
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.match(req.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(req.body.model, 'claude-sonnet-5-5');
  assert.equal(req.body.fallbacks, 'default');
  assert.equal(req.body.output_config.effort, 'medium');
  assert.equal(req.body.thinking, undefined, 'adaptive thinking is the default on this model');
  assert.deepEqual(req.body.cache_control, { type: 'ephemeral' });
  assert.deepEqual(req.body.tools.map((t) => t.name), ['kairo', 'open_page']);
  const sys = req.body.system.map((b) => b.text).join('\n');
  assert.match(sys, /POST \/api\/appointments \{staff_id\*/, 'the booking action is in the reference');
  assert.match(sys, /PUT \/api\/clients\/:id \{first_name\*/, 'the client edit action is in the reference');
  assert.doesNotMatch(sys, /\/api\/auth\/|\/api\/account\/delete|\/api\/public\//, 'account and public routes are not offered');
  assert.doesNotMatch(sys, /resend_api_key|stripe_secret_key|clicksend_api_key/, 'secret settings are not offered');
  // The time of day rides on the owner's turn, not the cached system prompt.
  const first = req.body.messages[0].content.map((b) => b.text || '').join(' ');
  assert.match(first, /<context>Business: .+Today is .+it is .+<\/context>/);
  assert.doesNotMatch(sys, /<context>/);
});

test('the history is append-only: each request starts with exactly the previous one', async () => {
  const reqs = mock.state.requests.slice(-3);
  for (let i = 1; i < reqs.length; i++) {
    const prev = reqs[i - 1].body.messages;
    const cur = reqs[i].body.messages;
    assert.deepEqual(cur.slice(0, prev.length), prev, `request ${i} rewrote earlier turns`);
  }
});

test('a booking is made through the same route as the calendar, and a clash comes back as an error Kai can read', async () => {
  const staff = (await k.api('GET', '/api/staff', { cookie })).json[0];
  const svc = (await k.api('GET', '/api/services', { cookie })).json[0];
  const client = (await k.api('GET', '/api/clients', { cookie })).json[1];
  const date = new Date(Date.now() + 86400000 * 90).toISOString().slice(0, 10);
  const book = { method: 'POST', path: '/api/appointments', summary: 'Book it', body: { client_id: client.id, staff_id: staff.id, service_id: svc.id, date, start_min: 600, notify_client: false } };
  mock.state.script = [calls(book), calls(book), say('Booked the first; the second clashes.')];
  const r = await chat('book it twice');
  assert.equal(r.status, 200, r.text);
  const acts = r.json.events.filter((e) => e.t === 'act');
  assert.equal(acts[0].ok, true);
  assert.equal(acts[1].ok, false);
  assert.match(acts[1].error, /overlaps/i);
  const res = lastResults();
  assert.equal(res[0].is_error, true, 'the clash is marked as an error for the model');
  assert.match(res[0].content, /overlaps/);
  const appts = (await k.api('GET', `/api/appointments?from=${date}&to=${date}`, { cookie })).json
    .filter((a) => a.client_id === client.id && a.start_min === 600);
  assert.equal(appts.length, 1, 'exactly one booking exists');
});

test('deleting waits for Confirm; Confirm runs it', async () => {
  const c = (await k.api('POST', '/api/clients', { cookie, body: { first_name: 'Delete', last_name: 'Me' } })).json;
  mock.state.script = [
    calls({ method: 'DELETE', path: `/api/clients/${c.id}`, summary: 'Delete client Delete Me' }),
    say('Deleted.'),
  ];
  const r = await chat('delete Delete Me');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.pending, true);
  const card = r.json.events.find((e) => e.t === 'confirm');
  assert.equal(card.state, 'waiting');
  assert.equal(card.items[0].summary, 'Delete client Delete Me');
  assert.equal((await k.api('GET', `/api/clients/${c.id}`, { cookie })).status, 200, 'still there before Confirm');

  const ok = await k.api('POST', `/api/kai/chats/${r.json.chat_id}/confirm`, { cookie, body: { approve: true } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.confirm.state, 'done');
  assert.equal((await k.api('GET', `/api/clients/${c.id}`, { cookie })).status, 404, 'gone after Confirm');
  assert.equal(lastResults()[0].is_error, undefined);
  const stored = (await k.api('GET', `/api/kai/chats/${r.json.chat_id}`, { cookie })).json;
  assert.equal(stored.events.find((e) => e.t === 'confirm').state, 'done');
  assert.equal(stored.pending, false);
});

test("Don't means nothing happens, and the model is told so", async () => {
  const c = (await k.api('POST', '/api/clients', { cookie, body: { first_name: 'Keep', last_name: 'Me' } })).json;
  mock.state.script = [calls({ method: 'DELETE', path: `/api/clients/${c.id}`, summary: 'Delete Keep Me' }), say('Left it.')];
  const r = await chat('delete Keep Me');
  const no = await k.api('POST', `/api/kai/chats/${r.json.chat_id}/confirm`, { cookie, body: { approve: false } });
  assert.equal(no.status, 200, no.text);
  assert.equal(no.json.confirm.state, 'declined');
  assert.equal((await k.api('GET', `/api/clients/${c.id}`, { cookie })).status, 200, 'still there');
  assert.match(lastResults()[0].content, /did not confirm/);
});

test('typing something else while a Confirm is waiting counts as no, in the same turn as the new message', async () => {
  const c = (await k.api('POST', '/api/clients', { cookie, body: { first_name: 'Ignore', last_name: 'Me' } })).json;
  mock.state.script = [
    calls({ method: 'GET', path: '/api/staff', summary: 'Look up the team' }, { method: 'DELETE', path: `/api/clients/${c.id}`, summary: 'Delete Ignore Me' }),
    say('Sure, what next?'),
  ];
  const r = await chat('look at staff and delete Ignore Me');
  assert.equal(r.json.pending, true);
  const r2 = await chat('actually never mind, how was today?', r.json.chat_id);
  assert.equal(r2.status, 200, r2.text);
  const last = mock.state.requests.at(-1).body.messages.at(-1);
  const results = last.content.filter((b) => b.type === 'tool_result');
  assert.equal(results.length, 2, 'both calls from that turn are answered together');
  assert.ok(results.some((b) => /did not confirm/.test(b.content)));
  assert.ok(last.content.some((b) => b.type === 'text' && /never mind/.test(b.text)), 'with the new message');
  assert.equal((await k.api('GET', `/api/clients/${c.id}`, { cookie })).status, 200, 'not deleted');
});

test('sending to clients, refunds, card sales and cancelling all wait for Confirm', async () => {
  const gated = [
    { method: 'POST', path: '/api/campaigns/send', body: { kind: 'offer', channel: 'email', body: 'Hi', client_ids: [1] } },
    { method: 'POST', path: '/api/invoices/1/refund', body: {} },
    { method: 'POST', path: '/api/pos/sale', body: { items: [], method: 'cash' } },
    { method: 'POST', path: '/api/appointments/1/cancel', body: {} },
    { method: 'PATCH', path: '/api/appointments/1/status', body: { status: 'cancelled' } },
    { method: 'POST', path: '/api/automations/winback/run' },
  ];
  for (const g of gated) {
    mock.state.script = [calls({ ...g, summary: 'x' }), say('ok')];
    const r = await chat(`do ${g.path}`);
    assert.equal(r.json.pending, true, `${g.method} ${g.path} should wait`);
    await k.api('POST', `/api/kai/chats/${r.json.chat_id}/confirm`, { cookie, body: { approve: false } });
  }
  // A status change that is not a cancellation just happens.
  mock.state.script = [calls({ method: 'PATCH', path: '/api/appointments/1/status', body: { status: 'confirmed' }, summary: 'Confirm it' }), say('ok')];
  const r = await chat('mark it confirmed');
  assert.equal(r.json.pending, false);
});

test('account, security, key and public routes cannot be reached, even by path', async () => {
  const blocked = [
    { method: 'POST', path: '/api/account/delete', body: { password: 'admin123', confirm: 'x' } },
    { method: 'PUT', path: '/api/auth/password', body: { current: 'admin123', next: 'hacked-pass-123' } },
    { method: 'POST', path: '/api/auth/logout-everywhere' },
    { method: 'POST', path: '/api/settings/reset-demo' },
    { method: 'POST', path: '/api/public/book', body: {} },
    { method: 'POST', path: '/api/sms/connect', body: {} },
    { method: 'POST', path: '/api/kai/chats', body: { message: 'loop' } },
    { method: 'GET', path: '/api/clients/export' },
    { method: 'GET', path: '/api/../api/auth/me' },
  ];
  mock.state.script = [calls(...blocked.map((b) => ({ ...b, summary: 'try' }))), say('No.')];
  const r = await chat('try the forbidden things');
  assert.equal(r.status, 200, r.text);
  const res = lastResults();
  assert.equal(res.length, blocked.length);
  for (const x of res) {
    assert.equal(x.is_error, true);
    assert.match(x.content, /not an action Kai can take|not a Kairo action/);
  }
  // Still signed in, password unchanged.
  assert.equal((await k.api('GET', '/api/auth/me', { cookie })).status, 200);
  assert.equal((await k.login()).user.email, 'admin@kairo.local');
});

test('secrets never reach the model, and Kai cannot set them', async () => {
  await k.api('PUT', '/api/settings', { cookie, body: { resend_api_key: 're_live_SECRET123', clicksend_api_key: 'CS-SECRET-456' } });
  mock.state.script = [
    calls({ method: 'GET', path: '/api/settings', summary: 'Read settings' }),
    calls({ method: 'PUT', path: '/api/settings', body: { resend_api_key: 'attacker' }, summary: 'Set key' }),
    say('ok'),
  ];
  const r = await chat('show me my settings');
  assert.equal(r.status, 200, r.text);
  const all = JSON.stringify(mock.state.requests.slice(-3).map((q) => q.body.messages));
  assert.doesNotMatch(all, /re_live_SECRET123|CS-SECRET-456/);
  assert.match(lastResults()[0].content, /can't set resend_api_key/);
  const s = (await k.api('GET', '/api/settings', { cookie })).json;
  assert.notEqual(s.resend_api_key, 'attacker');
});

test('open_page tells the screen where to go', async () => {
  mock.state.script = [calls({ name: 'open_page', input: { page: 'calendar', params: { date: '2026-10-03' }, label: 'Friday' } }), say('Here it is.')];
  const r = await chat('show me friday');
  const nav = r.json.events.find((e) => e.t === 'nav');
  assert.deepEqual(nav, { t: 'nav', page: 'calendar', params: { date: '2026-10-03' }, label: 'Friday' });
});

test('a failing API leaves a conversation that carries on', async () => {
  mock.state.status = 500;
  const r = await chat('hello?');
  mock.state.status = 200;
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.events.at(-1).t, 'error');
  mock.state.script = [say('Back again.')];
  const r2 = await chat('are you there?', r.json.chat_id);
  assert.equal(r2.status, 200, r2.text);
  assert.equal(r2.json.events.at(-1).text, 'Back again.');
  const msgs = mock.state.requests.at(-1).body.messages;
  assert.equal(msgs[0].role, 'user');
});

test('a refusal is said plainly and the conversation carries on', async () => {
  mock.state.script = [{ stop_reason: 'refusal', content: [] }, say('Happy to help with that.')];
  const r = await chat('something declined');
  assert.match(r.json.events.at(-1).text, /not something I can help with/);
  const r2 = await chat('book a cut', r.json.chat_id);
  assert.equal(r2.status, 200, r2.text);
});

test('the transcript is kept and listed, and only for its owner', async () => {
  mock.state.script = [say('Hi there.')];
  const r = await chat('first message of a chat');
  const list = (await k.api('GET', '/api/kai/chats', { cookie })).json.chats;
  assert.ok(list.some((c) => c.id === r.json.chat_id && c.title === 'first message of a chat'));
  const got = (await k.api('GET', `/api/kai/chats/${r.json.chat_id}`, { cookie })).json;
  assert.deepEqual(got.events.map((e) => e.t), ['user', 'kai']);
  assert.equal((await k.api('GET', `/api/kai/chats/${r.json.chat_id}`)).status, 401, 'signed out: nothing');
  assert.equal((await k.api('DELETE', `/api/kai/chats/${r.json.chat_id}`, { cookie })).status, 200);
  assert.equal((await k.api('GET', `/api/kai/chats/${r.json.chat_id}`, { cookie })).status, 404);
});

test('the action reference covers every owner route that is not deliberately kept from Kai', async () => {
  const { catalogue } = await import('../src/kai-catalogue.js');
  const offered = new Set(catalogue().map((a) => `${a.method} ${a.path}`));
  const src = fs.readFileSync(path.join(ROOT, 'src', 'api.js'), 'utf8');
  const kept = /^\/api\/(auth|public|ask|kai|app|setup|demo|edge|platform)\b|^\/api\/account\/(delete|refund|profile)|^\/api\/settings\/reset-demo|\/export$|^\/api\/clients\/(import|parse-sheet)|^\/api\/services\/import|^\/api\/photos\/:id$|\/photos$|^\/api\/sms\/(connect|own-number|login)|^\/api\/version|^\/api\/backup\/download/;
  const missing = [];
  for (const m of src.matchAll(/^route\('([A-Z]+)', '([^']+)'/gm)) {
    if (kept.test(m[2])) continue;
    if (!offered.has(`${m[1]} ${m[2]}`)) missing.push(`${m[1]} ${m[2]}`);
  }
  assert.deepEqual(missing, [], 'every owner action is either in Kai\'s reference or deliberately kept out');
  assert.ok(offered.size > 90, `only ${offered.size} actions offered`);
});

test('the ClickSend login: saved, read back only by asking, never in settings, never reachable by Kai', async () => {
  let r = await k.api('PUT', '/api/sms/login', { cookie, body: { username: 'owner@salon.test', password: 'Top-Up-Pass-77' } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json, { username: 'owner@salon.test', password_set: true });
  r = await k.api('GET', '/api/sms/login', { cookie });
  assert.deepEqual(r.json, { username: 'owner@salon.test', password_set: true }, 'the password is not in the plain read');
  const settings = await k.api('GET', '/api/settings', { cookie });
  assert.doesNotMatch(settings.text, /Top-Up-Pass-77/, 'never in the settings list');
  r = await k.api('POST', '/api/sms/login/reveal', { cookie, body: {} });
  assert.equal(r.json.password, 'Top-Up-Pass-77');
  // A blank password keeps it; the sentinel clears it.
  await k.api('PUT', '/api/sms/login', { cookie, body: { username: 'owner@salon.test', password: '' } });
  assert.equal((await k.api('POST', '/api/sms/login/reveal', { cookie, body: {} })).json.password, 'Top-Up-Pass-77');
  // Kai: not in its reference, refused by path, and redacted if it ever surfaced.
  mock.state.script = [calls({ method: 'POST', path: '/api/sms/login/reveal', summary: 'peek' }, { method: 'GET', path: '/api/settings', summary: 'settings' }), say('no')];
  await chat('what is my clicksend password');
  const res = lastResults();
  assert.equal(res[0].is_error, true);
  assert.doesNotMatch(JSON.stringify(mock.state.requests.at(-1).body), /Top-Up-Pass-77|owner@salon\.test/);
  assert.equal((await k.api('POST', '/api/sms/login/reveal')).status, 401, 'signed out: nothing');
  await k.api('PUT', '/api/sms/login', { cookie, body: { password: '__clear__' } });
  assert.equal((await k.api('GET', '/api/sms/login', { cookie })).json.password_set, false);
});

test('every read in the reference runs through Kai without a server error', async () => {
  const { catalogue } = await import('../src/kai-catalogue.js');
  const ids = {
    clients: (await k.api('GET', '/api/clients', { cookie })).json[0].id,
    staff: (await k.api('GET', '/api/staff', { cookie })).json[0].id,
    services: (await k.api('GET', '/api/services', { cookie })).json[0].id,
    invoices: (await k.api('GET', '/api/invoices', { cookie })).json[0]?.id || 1,
    appointments: (await k.api('GET', '/api/appointments', { cookie })).json[0]?.id || 1,
  };
  const today = new Date().toISOString().slice(0, 10);
  const fill = (p) => p
    .replace(/\/api\/(clients|staff|services|invoices|appointments)\/:id/, (_, r) => `/api/${r}/${ids[r]}`)
    .replace(':kind', 'winback').replace(':step', 'google-listing').replace(':date', today).replace(/:[a-z]+/g, '1');
  const reads = catalogue().filter((a) => a.method === 'GET');
  mock.state.script = [calls(...reads.map((a) => ({ method: 'GET', path: fill(a.path), summary: a.path }))), say('read them all')];
  const r = await chat('read everything');
  assert.equal(r.status, 200, r.text);
  const res = lastResults();
  assert.equal(res.length, reads.length);
  const broken = res.map((x, i) => [reads[i].path, x]).filter(([, x]) => x.is_error && /"status":5\d\d/.test(x.content));
  assert.deepEqual(broken.map(([p, x]) => `${p}: ${x.content.slice(0, 120)}`), [], 'no read fails with a server error');
});

test('a write in every area of the business runs through Kai and lands in the database', async () => {
  const staff = (await k.api('GET', '/api/staff', { cookie })).json[0];
  const svc = (await k.api('GET', '/api/services', { cookie })).json[0];
  const client = (await k.api('GET', '/api/clients', { cookie })).json[2];
  const day = new Date(Date.now() + 86400000 * 120); while (day.getDay() === 0) day.setDate(day.getDate() + 1);
  const date = day.toISOString().slice(0, 10);
  const writes = [
    { method: 'POST', path: '/api/clients', body: { first_name: 'Kai', last_name: 'Created', phone: '0400 000 111' } },
    { method: 'POST', path: '/api/services', body: { name: 'Kai Gloss', duration_min: 30, price_cents: 4500, price_type: 'fixed', category: 'Colour' } },
    { method: 'POST', path: '/api/products', body: { name: 'Kai Serum', retail_cents: 3200, stock_qty: 5 } },
    { method: 'POST', path: '/api/staff', body: { name: 'Kai Stylist', title: 'Junior' } },
    { method: 'POST', path: '/api/time-blocks', body: { staff_id: staff.id, date, start_min: 780, end_min: 840, reason: 'Kai lunch' } },
    { method: 'POST', path: '/api/appointments', body: { client_id: client.id, staff_id: staff.id, service_id: svc.id, date, start_min: 600, notify_client: false } },
    { method: 'PUT', path: '/api/settings', body: { invoice_footer: 'Thanks from Kai' } },
    { method: 'PUT', path: `/api/clients/${client.id}/safety`, body: { allergies: 'Kai-noted latex' } },
    { method: 'PUT', path: `/api/clients/${client.id}/marketing`, body: { opt_out: true } },
    { method: 'POST', path: '/api/waitlist', body: { client_id: client.id, service_id: svc.id, note: 'Kai waitlist' } },
    { method: 'POST', path: '/api/invoices', body: { client_id: client.id, items: [{ description: 'Kai item', qty: 1, unit_cents: 2500 }] } },
    { method: 'PUT', path: `/api/staff/${staff.id}/shifts/${date}`, body: { working: false, note: 'Kai day off' } },
  ];
  mock.state.script = [calls(...writes.map((w) => ({ ...w, summary: `${w.method} ${w.path}` }))), say('all done')];
  const r = await chat('do a bit of everything');
  assert.equal(r.status, 200, r.text);
  const acts = r.json.events.filter((e) => e.t === 'act');
  assert.deepEqual(acts.filter((a) => !a.ok).map((a) => `${a.summary}: ${a.error}`), [], 'every write succeeded');

  const has = async (p, pred) => pred((await k.api('GET', p, { cookie })).json);
  assert.ok(await has('/api/clients?q=Created', (j) => j.some((c) => c.first_name === 'Kai')));
  assert.ok(await has('/api/services?all=1', (j) => j.some((s) => s.name === 'Kai Gloss' && s.price_cents === 4500)));
  assert.ok(await has('/api/products?all=1', (j) => j.some((p) => p.name === 'Kai Serum')));
  assert.ok(await has('/api/staff?all=1', (j) => j.some((s) => s.name === 'Kai Stylist')));
  assert.ok(await has(`/api/time-blocks?from=${date}&to=${date}`, (j) => j.some((b) => b.reason === 'Kai lunch')));
  assert.ok(await has(`/api/appointments?from=${date}&to=${date}`, (j) => j.some((a) => a.client_id === client.id && a.start_min === 600)));
  assert.ok(await has('/api/settings', (j) => j.invoice_footer === 'Thanks from Kai'));
  assert.ok(await has(`/api/clients/${client.id}/safety`, (j) => JSON.stringify(j).includes('Kai-noted latex')));
  assert.ok(await has('/api/waitlist', (j) => JSON.stringify(j).includes('Kai waitlist')));
  assert.ok(await has('/api/invoices', (j) => j.some((i) => i.client_id === client.id)));
  assert.ok(await has(`/api/staff/${staff.id}/shifts`, (j) => JSON.stringify(j).includes('Kai day off')));
});

test("a salon's daily Kai allowance stops at the limit, and a Confirm answer doesn't use one", async () => {
  const k2 = await startKairo({ env: { KAIRO_ANTHROPIC_API_KEY: 'test-key', KAIRO_ANTHROPIC_BASE_URL: `http://127.0.0.1:${mock.port}`, KAIRO_KAI_DAILY_LIMIT: '2' } });
  try {
    const { cookie: c2 } = await k2.login();
    await k2.api('POST', '/api/kai/consent', { cookie: c2, body: {} });
    const send = (message) => k2.api('POST', '/api/kai/chats', { cookie: c2, body: { message } });
    const victim = (await k2.api('POST', '/api/clients', { cookie: c2, body: { first_name: 'Cap', last_name: 'Test' } })).json;
    mock.state.script = [calls({ method: 'DELETE', path: `/api/clients/${victim.id}`, summary: 'Delete Cap Test' }), say('Deleted.')];
    const first = await send('delete Cap Test');
    assert.equal(first.status, 200, first.text);
    const conf = await k2.api('POST', `/api/kai/chats/${first.json.chat_id}/confirm`, { cookie: c2, body: { approve: true } });
    assert.equal(conf.status, 200, 'answering Confirm is not a new message');
    mock.state.script = [say('Second.')];
    assert.equal((await send('second')).status, 200);
    const third = await send('third');
    assert.equal(third.status, 429);
    assert.match(third.json.error, /limit for today \(2 messages\)/);
    const st = (await k2.api('GET', '/api/kai/status', { cookie: c2 })).json;
    assert.deepEqual([st.used_today, st.daily_limit], [2, 2]);
    // The rest of Kairo is untouched.
    assert.equal((await k2.api('GET', '/api/clients', { cookie: c2 })).status, 200);
  } finally {
    await k2.stop();
  }
});

test('nothing reaches Anthropic until the owner turns Kai on, and turning it off stops it again', async () => {
  const k3 = await startKairo({ env: { KAIRO_ANTHROPIC_API_KEY: 'test-key', KAIRO_ANTHROPIC_BASE_URL: `http://127.0.0.1:${mock.port}` } });
  try {
    const { cookie: c3 } = await k3.login();
    const before = mock.state.requests.length;
    assert.equal((await k3.api('GET', '/api/kai/status', { cookie: c3 })).json.consented, false);
    const refused = await k3.api('POST', '/api/kai/chats', { cookie: c3, body: { message: 'hello' } });
    assert.equal(refused.status, 428);
    assert.equal(refused.json.consent_required, true);
    assert.equal(mock.state.requests.length, before, 'nothing was sent to the model');

    assert.equal((await k3.api('POST', '/api/kai/consent', { cookie: c3, body: {} })).json.consented, true);
    mock.state.script = [say('Hello!')];
    assert.equal((await k3.api('POST', '/api/kai/chats', { cookie: c3, body: { message: 'hello' } })).status, 200);
    assert.equal(mock.state.requests.length, before + 1);

    assert.equal((await k3.api('DELETE', '/api/kai/consent', { cookie: c3 })).json.consented, false);
    assert.equal((await k3.api('POST', '/api/kai/chats', { cookie: c3, body: { message: 'again' } })).status, 428);
    assert.equal(mock.state.requests.length, before + 1, 'off means off');
    // Consent cannot be given or taken by Kai itself.
    const { catalogue } = await import('../src/kai-catalogue.js');
    assert.ok(!catalogue().some((a) => a.path.startsWith('/api/kai')));
  } finally {
    await k3.stop();
  }
});
