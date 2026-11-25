// Kai's week (src/marketing.js): the marketing assistant, on a diary small
// enough to check by hand.
//
// What is asserted is what an owner would rely on:
//   1. THE PLAN COMES FROM THE ROWS: the empty time, who is due, who has gone
//      and whose birthday it is, and nobody who opted out or is booked in.
//   2. FREE ADD-ONS BEFORE DISCOUNTS, and money off never above the owner's cap.
//   3. KAI ASKS FIRST: a trial sees the plan but cannot send; only the owner
//      sees it at all.
//   4. A PROMISE IS KEPT: the perk a message offered is on the booking it brings.
//   5. THE AI ONLY REWORDS: placeholders and numbers survive, a reply that
//      invents one is refused, and every use counts against the month.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startKairo } from './helpers/kairo.js';
import { hashPassword } from '../src/auth.js';
import { occasions } from '../src/marketing.js';

let k, cookie, mock, today, gapDay;

/** A stand-in Messages API answering each request with the next scripted text. */
function startMock() {
  const state = { script: [], requests: [] };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      state.requests.push({ headers: req.headers, body });
      const text = state.script.shift() ?? '(script ran out)';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: `msg_${state.requests.length}`, type: 'message', role: 'assistant', model: body.model,
        stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 },
      }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ state, server, port: server.address().port })));
}

const addDays = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const week = async () => (await k.api('GET', '/api/marketing/week', { cookie })).json;
const play = (w, kind) => w.plays.find((p) => p.kind === kind);
const put = (body) => k.api('PUT', '/api/settings', { cookie, body });

before(async () => {
  mock = await startMock();
  k = await startKairo({
    env: {
      KAIRO_ANTHROPIC_API_KEY: 'test-key',
      KAIRO_ANTHROPIC_BASE_URL: `http://127.0.0.1:${mock.port}`,
      KAIRO_KAI_MONTHLY_LIMIT: '2',
      KAIRO_KAI_WEEK: 'all',
    },
  });
  ({ cookie } = await k.login());

  const d = k.db();
  try {
    d.exec(`DELETE FROM payments; DELETE FROM invoice_items; DELETE FROM invoices; DELETE FROM messages;
      DELETE FROM appointment_services; DELETE FROM reviews; DELETE FROM appointments; DELETE FROM time_blocks;
      DELETE FROM staff_shifts; DELETE FROM clients; DELETE FROM services; DELETE FROM staff; DELETE FROM automations;`);
    const set = d.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [kk, v] of Object.entries({
      open_days: '0,1,2,3,4,5,6', open_min: '540', close_min: '1020', day_rules: '{}',
      business_tz: 'Australia/Melbourne', business_name: 'Test Salon', currency: '$', public_url: 'https://salon.example',
      marketing_cooldown_days: '14',
    })) set.run(kk, v);
  } finally { d.close(); }

  today = (await week()).today;
  gapDay = addDays(today, 2);

  const d2 = k.db();
  try {
    d2.prepare("INSERT INTO staff (id, name, active) VALUES (1, 'Ana', 1)").run();
    d2.prepare(`INSERT INTO services (id, name, duration_min, price_cents) VALUES
      (1, 'Cut', 60, 9000), (2, 'Brow tint', 15, 2000), (3, 'Colour', 120, 16000)`).run();
    const c = d2.prepare('INSERT INTO clients (id, first_name, email, birthday, marketing_opt_out) VALUES (?, ?, ?, ?, ?)');
    c.run(1, 'Rita', 'rita@example.com', '', 0);   // a regular, every four weeks, now eight weeks gone
    c.run(2, 'Wade', 'wade@example.com', '', 0);   // twice, months ago: gone
    c.run(3, 'Bea', 'bea@example.com', addDays(today, 2).slice(5), 0);  // birthday this week
    c.run(4, 'Otto', 'otto@example.com', '', 1);   // gone too, but asked not to hear from us
    c.run(5, 'Fay', 'fay@example.com', '', 0);     // gone, but already booked back in
    c.run(6, 'Gus', 'gus@example.com', '', 0);     // the bookings that make the gap day
    const a = d2.prepare(`INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status, source)
      VALUES (?, 1, ?, ?, ?, ?, ?, 'staff')`);
    for (const n of [112, 84, 56]) a.run(1, 1, addDays(today, -n), 600, 660, 'completed');
    for (const n of [200, 120]) a.run(2, 1, addDays(today, -n), 600, 660, 'completed');
    a.run(3, 1, addDays(today, -30), 600, 660, 'completed');
    for (const n of [200, 150]) a.run(4, 1, addDays(today, -n), 700, 760, 'completed');
    for (const n of [200, 150]) a.run(5, 1, addDays(today, -n), 800, 860, 'completed');
    a.run(5, 1, addDays(today, 20), 600, 660, 'booked');
    // Two bookings on the gap day leave 9-10, 11-1 and 2-5 open.
    a.run(6, 3, gapDay, 600, 660, 'booked');
    a.run(6, 1, gapDay, 780, 840, 'booked');
  } finally { d2.close(); }
});
after(async () => { await k?.stop(); mock?.server.close(); });

test('the week names the empty time, who is due back, who has gone and whose birthday it is', async () => {
  const w = await week();
  assert.match(w.headline, /empty hours? in the next 7 days/);
  assert.ok(w.empty_minutes >= 360, 'the three gaps on the gap day are counted');

  const gap = w.plays.find((p) => p.kind === 'gap' && p.campaign.offer?.date === gapDay);
  assert.ok(gap, 'the gap day is a play');
  assert.equal(gap.campaign.kind, 'gap_offer');
  assert.equal(gap.perk, null, 'a free slot is the message; no perk on top of it');

  const rebook = play(w, 'rebook');
  assert.equal(rebook.count, 1, 'Rita, eight weeks into a four-week rhythm');
  assert.equal(rebook.perk, null, 'a late regular is nudged, not paid to come back');

  const winback = play(w, 'winback');
  assert.equal(winback.count, 1, 'Wade only: Otto opted out, Fay is booked in, Rita is the nudge\'s');
  assert.equal(winback.campaign.kind, 'winback_offer');

  const birthday = play(w, 'birthday');
  assert.equal(birthday.count, 1);
  assert.match(birthday.why, /Bea/);

  const preview = await k.api('GET', '/api/campaigns/preview?kind=winback_offer&channel=email', { cookie });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.json.recipients.map((r) => r.first_name), ['Wade']);
  assert.equal(w.locked, false);
});

test('a perk is a free add-on first, and money off never more than the owner allows', async () => {
  let w = await week();
  assert.equal(play(w, 'winback').perk.type, 'addon');
  assert.equal(play(w, 'winback').perk.name, 'Brow tint', 'the short, cheap extra on their own menu');

  const d = k.db();
  try { d.prepare('UPDATE services SET active = 0 WHERE id = 2').run(); } finally { d.close(); }
  w = await week();
  assert.deepEqual([play(w, 'winback').perk.type, play(w, 'winback').perk.percent], ['percent', 10], 'no add-on on the menu: 10% off');
  assert.equal((await put({ kai_discount_cap: '5' })).status, 200);
  w = await week();
  assert.equal(play(w, 'winback').perk.percent, 5, 'never above the cap');
  assert.equal(w.discount_cap, 5);
  await put({ kai_discount_cap: '0' });
  w = await week();
  assert.equal(play(w, 'winback').perk, null, 'a cap of 0 means no money off at all');

  await put({ kai_discount_cap: '15' });
  const d2 = k.db();
  try { d2.prepare('UPDATE services SET active = 1 WHERE id = 2').run(); } finally { d2.close(); }
});

test('an automation already doing the job takes its play off the list', async () => {
  assert.equal((await k.api('PUT', '/api/automations/birthday', { cookie, body: { enabled: true } })).status, 200);
  assert.equal(play(await week(), 'birthday'), undefined, 'one birthday message per person is plenty');
  await k.api('PUT', '/api/automations/birthday', { cookie, body: { enabled: false } });
  assert.ok(play(await week(), 'birthday'));
});

test('a promo is built from the goal, with the perk, the days and the words', async () => {
  const quiet = (await k.api('GET', '/api/marketing/promo?goal=quiet&weekdays=5,2', { cookie })).json;
  assert.deepEqual(quiet.weekdays, [2, 5], 'in week order');
  assert.equal(quiet.title, 'Fill your Tuesdays and Fridays');
  assert.match(quiet.body, /a free Brow tint/);
  assert.match(quiet.body, /\{booking_link\}/);
  assert.equal(quiet.campaign.kind, 'promo');

  const occ = (await k.api('GET', '/api/marketing/promo?goal=occasion', { cookie })).json;
  const next = occasions(today)[0];
  assert.ok(occ.title.startsWith(next.label));
  assert.equal(occ.until, next.date);

  const svc = (await k.api('GET', '/api/marketing/promo?goal=service&service_id=3', { cookie })).json;
  assert.equal(svc.campaign.service_id, 3);
  assert.match(svc.body, /Colour/);
  // Who a cut promo reaches: the people who have had one, best customers
  // first. Not Otto (opted out), not Fay or Gus (booked in already).
  const who = (await k.api('GET', '/api/campaigns/preview?kind=promo&service_id=1&channel=email', { cookie })).json;
  assert.deepEqual(who.recipients.map((r) => r.first_name), ['Rita', 'Wade', 'Bea']);

  const wb = await k.api('GET', '/api/marketing/promo?goal=winback', { cookie });
  assert.equal(wb.status, 200);
  assert.equal(wb.json.campaign.kind, 'winback_offer');
});

test('the occasions come round in date order, on the Australian dates', () => {
  assert.equal(occasions('2026-11-25')[0].key, 'christmas');
  const spring = occasions('2027-03-01');
  assert.equal(spring.find((o) => o.key === 'mothers_day').date, '2027-05-09', 'second Sunday in May');
  assert.equal(occasions('2027-07-01').find((o) => o.key === 'fathers_day').date, '2027-09-05', 'first Sunday in September');
});

test('a trial sees what Kai would do, and cannot send it', async () => {
  const d = k.db();
  try {
    d.prepare("INSERT INTO settings (key, value) VALUES ('plan_status', 'trial'), ('trial_ends_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(new Date(Date.now() + 7 * 86400000).toISOString());
  } finally { d.close(); }
  const w = await week();
  assert.equal(w.locked, true);
  assert.ok(play(w, 'winback'), 'the plan is still there');
  const r = await k.api('POST', '/api/campaigns/send', {
    cookie, body: { kind: 'winback_offer', channel: 'email', subject: 'Hi', body: 'Hi {first_name}', client_ids: [2] },
  });
  assert.equal(r.status, 402);
  assert.equal(r.json.locked, 'marketing');
  const d2 = k.db();
  try { d2.prepare("DELETE FROM settings WHERE key IN ('plan_status', 'trial_ends_at')").run(); } finally { d2.close(); }
});

test('the perk a message promised is written on the booking it brings, and counted in the results', async () => {
  const sent = await k.api('POST', '/api/campaigns/send', {
    cookie,
    body: {
      kind: 'winback_offer', channel: 'email', subject: 'We miss you',
      body: 'Hi {first_name}, a free Brow tint is on us.\n\nBook here: {booking_link}', client_ids: [2], perk: 'free Brow tint',
    },
  });
  assert.equal(sent.status, 200);
  assert.equal(sent.json.queued, 1);
  const d = k.db();
  let msg;
  try { msg = d.prepare("SELECT token, perk, body FROM messages WHERE kind = 'winback_offer' AND client_id = 2").get(); } finally { d.close(); }
  assert.equal(msg.perk, 'free Brow tint');
  assert.match(msg.body, new RegExp(`/book\\?m=${msg.token}`), 'a link of their own, so the booking can be traced');

  const booked = await k.api('POST', '/api/public/book', {
    body: { service_id: 1, staff_id: 1, date: gapDay, start_min: 540, from_message: msg.token, client: { first_name: 'Wade', email: 'wade@example.com' } },
  });
  assert.equal(booked.status, 200, booked.text);
  const d2 = k.db();
  let appt;
  try { appt = d2.prepare("SELECT notes, source_message_id FROM appointments WHERE client_id = 2 AND date = ?").get(gapDay); } finally { d2.close(); }
  assert.ok(appt.source_message_id, 'credited to the message');
  assert.match(appt.notes, /^Kai offer: free Brow tint/);

  const w = await week();
  assert.equal(w.results.bookings, 1);
  assert.equal(w.results.revenue_cents, 9000);
  assert.equal(play(w, 'winback'), undefined, 'Wade is booked in now, so nobody is left to win back');
});

test('only the owner sees Kai\'s week', async () => {
  const d = k.db();
  try {
    const { salt, hash } = hashPassword('a-good-long-passphrase-26');
    d.prepare("INSERT INTO users (name, email, pass_hash, salt, role) VALUES ('Sam', 'sam@salon.example', ?, ?, 'staff')").run(hash, salt);
  } finally { d.close(); }
  const staff = await k.login('sam@salon.example', 'a-good-long-passphrase-26');
  assert.equal((await k.api('GET', '/api/marketing/week', { cookie: staff.cookie })).status, 403);
  assert.equal((await k.api('GET', '/api/marketing/promo', { cookie: staff.cookie })).status, 403);
  assert.equal((await k.api('POST', '/api/marketing/rewrite', { cookie: staff.cookie, body: { text: 'x' } })).status, 403);
  assert.equal((await k.api('GET', '/api/marketing/week')).status, 401);
});

test('rewording keeps the facts, counts against the month, and refuses a reply that changes a number', async () => {
  const draft = 'Hi {first_name}, book before 24 Dec and a free Brow tint is on us.\n\nBook here: {booking_link}\n\nTest Salon';
  mock.state.script.push('Hi {first_name}, get in before 24 Dec and your Brow tint is on the house.\n\nBook here: {booking_link}\n\nTest Salon');
  const ok = await k.api('POST', '/api/marketing/rewrite', { cookie, body: { text: draft, channel: 'email' } });
  assert.equal(ok.status, 200, ok.text);
  assert.match(ok.json.text, /on the house/);
  assert.equal(ok.json.allowance.used, 1);
  const req = mock.state.requests.at(-1);
  assert.equal(req.body.model, 'claude-haiku-5-5');
  assert.equal(req.body.fallbacks, undefined, 'Haiku has no server-side fallback');
  assert.equal(req.body.tools, undefined, 'a rewrite needs no tools');
  assert.equal(req.body.output_config.effort, 'low');
  assert.ok(req.body.messages[0].content.includes('{first_name}'), 'the placeholder, never a client\'s name');

  mock.state.script.push('Hi {first_name}, 20% off before 24 Dec.\n\nBook here: {booking_link}');
  const bad = await k.api('POST', '/api/marketing/rewrite', { cookie, body: { text: draft, channel: 'email' } });
  assert.equal(bad.status, 422);
  assert.match(bad.json.error, /changed a number/);

  const over = await k.api('POST', '/api/marketing/rewrite', { cookie, body: { text: draft, channel: 'email' } });
  assert.equal(over.status, 429, 'two a month in this test, and both are spent');
  assert.match(over.json.error, /starts again on the 1st/);

  const w = await week();
  assert.deepEqual([w.ai.used, w.ai.allowance, w.ai.left], [2, 2, 0]);
});

test('a salon not yet in the rollout has no Your week at all', async () => {
  const k2 = await startKairo();   // the default rollout: the demo salon only
  try {
    const { cookie: c2 } = await k2.login();
    assert.equal((await k2.api('GET', '/api/marketing/week', { cookie: c2 })).status, 404);
    assert.equal((await k2.api('GET', '/api/marketing/promo', { cookie: c2 })).status, 404);
    assert.equal((await k2.api('GET', '/api/settings', { cookie: c2 })).json.kai_week_on, '0', 'so the menu leaves it out');
    assert.equal((await k.api('GET', '/api/settings', { cookie })).json.kai_week_on, '1');
  } finally { await k2.stop(); }
});
