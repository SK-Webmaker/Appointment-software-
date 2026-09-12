// Kai: say it, and it happens — or, for a booking, it is filled in and waits.
//
// Kai is the only place in Kairo that changes a setting from a sentence, so
// most of what follows is about what it REFUSES to do. The lines it holds:
//
//   1. IT ACTUALLY DOES THEM, and the assertion is on the DATABASE. Kai saying
//      it changed something is not the same as it having changed.
//   2. A QUESTION IS NEVER A COMMAND. "What time do we close on Friday" changes
//      nothing; "what did we take last week" is answered, not navigated away
//      from.
//   3. LOOKING AT A DAY IS NOT TRADING ON IT. "Open my calendar on Saturday"
//      shows Saturday; "open on Saturday" opens the salon. One word apart, and
//      getting it backwards is the worse of the two by a wide margin.
//   4. IT NEVER GUESSES between two close readings — it asks.
//   5. UNDO IS EXACT: only the keys the change wrote go back, and a change made
//      in another tab in between survives.
//   6. NOTHING THAT REACHES A CLIENT HAPPENS ON ITS OWN. A booking is prepared
//      and handed over with a button; it is never made.
//   7. THE PERSONALITY NEVER EDITS THE RECEIPT. `warm` always ends with `said`,
//      character for character.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo } from './helpers/kairo.js';

let k, cookie;

const BASE = {
  open_days: '1,2,3,4,5', open_min: '540', close_min: '1020', day_rules: '{}',
  booking_enabled: '1', waitlist_enabled: '0', reminders_enabled: '1',
  reminder_hours: '12', booking_horizon_days: '30', booking_lead_min: '60',
  cancel_window_hours: '24', slot_interval: '15',
  noshow_deposit_after: '0', noshow_block_after: '0', deposit_over_cents: '0',
  confirm_enabled: '1', receipts_enabled: '1', review_requests_enabled: '0',
  chan_confirmation: 'email', chan_reminder: 'email', chan_receipt: 'email',
  review_delay_hours: '24', sms_notifications_enabled: '0',
  client_cancel_enabled: '1', waitlist_autofill: '0', ask_heard_from: '0',
  deposit_type: 'none', deposit_value: '20', tax_rate: '0',
  invoice_due_days: '7', rebook_weeks_default: '6', brand_scheme: 'midnight',
  patch_valid_months: '6', patch_lead_hours: '48',
  backup_email_enabled: '0', backup_frequency: 'weekly',
  cal_start_min: '420', cal_end_min: '1260',
};

const reset = () => k.api('PUT', '/api/settings', { cookie, body: BASE });
const settings = async () => (await k.api('GET', '/api/settings', { cookie })).json;
const say = async (q, turn) =>
  (await k.api('POST', '/api/ask/do', { cookie, body: turn === undefined ? { q } : { q, turn } })).json;
const param = (href, key) =>
  new URLSearchParams(String(href || '').split('?')[1] || '').get(key);

before(async () => {
  k = await startKairo();
  ({ cookie } = await k.login());
  await k.api('PUT', '/api/settings', {
    cookie, body: { business_name: 'Glow Bar', business_tz: 'Australia/Melbourne' },
  });
  // Two Sarahs, because a salon with two Sarahs is not an edge case, it is
  // Tuesday — and one person nobody shares a name with, for the simple path.
  const d = k.db();
  d.exec(`INSERT INTO clients (first_name, last_name, phone) VALUES
    ('Sarah','Wilson','0400010001'), ('Sarah','Jones','0400010002'),
    ('Wilhelmina','Baptiste','0400010003')`);
  d.close();
});
after(async () => { await k.stop(); });

// ---------------------------------------------------------------------------
// Changing things
// ---------------------------------------------------------------------------

test('every capability, from a sentence somebody would say, checked in the database', async () => {
  const cases = [
    ['booking_enabled', 'turn off online booking', '0'],
    ['waitlist_enabled', 'turn the waitlist on', '1'],
    ['reminders_enabled', 'stop sending reminders', '0'],
    ['reminder_hours', 'send reminders 48 hours before', '48'],
    ['reminder_hours', 'remind them the day before', '24'],
    ['booking_horizon_days', 'let people book up to 60 days ahead', '60'],
    ['booking_lead_min', 'I need at least 2 hours notice', '120'],
    ['cancel_window_hours', 'clients can cancel up to 12 hours before', '12'],
    ['slot_interval', 'make my slots 30 minutes', '30'],
    ['noshow_deposit_after', 'ask for a deposit after 2 no shows', '2'],
    ['noshow_block_after', 'stop online booking after 3 no shows', '3'],
    ['deposit_over_cents', 'always take a deposit on bookings over $200', '20000'],
    ['open_days', 'close on Mondays', '2,3,4,5'],
    ['open_days', 'open on Saturday', '1,2,3,4,5,6'],
    ['open_days', 'we only open Thursday and Friday', '4,5'],
    ['confirm_enabled', 'stop sending confirmations', '0'],
    ['receipts_enabled', 'turn receipts off', '0'],
    ['review_requests_enabled', 'start asking for reviews', '1'],
    ['review_delay_hours', 'ask for reviews 2 days after', '48'],
    ['chan_reminder', 'send reminders by text', 'sms'],
    ['chan_confirmation', 'send confirmations by email and text', 'both'],
    ['sms_notifications_enabled', 'turn texting on', '1'],
    ['client_cancel_enabled', "don't let clients cancel online", '0'],
    ['waitlist_autofill', 'fill cancellations automatically', '1'],
    ['ask_heard_from', 'ask clients how they heard about us', '1'],
    ['deposit_type', 'take a 20% deposit', 'percent'],
    ['deposit_value', 'take a $50 deposit', '50'],
    ['tax_rate', 'set GST to 10%', '10'],
    ['invoice_due_days', 'invoices are due in 14 days', '14'],
    ['rebook_weeks_default', 'suggest rebooking in 8 weeks', '8'],
    ['brand_scheme', 'make my booking page cream', 'cream'],
    ['brand_scheme', 'change my booking page colour to green', 'sage'],
    ['patch_valid_months', 'patch tests last 12 months', '12'],
    ['backup_frequency', 'back up daily', 'daily'],
    ['cal_start_min', 'make the calendar start at 8am', '480'],
  ];
  for (const [key, q, want] of cases) {
    await reset();
    const r = await say(q);
    assert.equal(r.kind, 'done', `"${q}" → ${r.kind}: ${r.said}`);
    assert.equal(String((await settings())[key]), want, `"${q}" → ${key}`);
  }
});

test('the sentence this was all built for', async () => {
  await reset();
  const r = await say('change 11 a.m. to 4 p.m. hours on a Sunday to 2 to 6');
  assert.equal(r.kind, 'done');
  assert.match(r.said, /Sunday is 2pm–6pm now/);
  const s = await settings();
  assert.equal(s.open_days, '0,1,2,3,4,5', 'Sunday is open');
  // Two in the AFTERNOON. Reading the first of the two ranges opened at 2am.
  assert.equal(JSON.parse(s.day_rules)['0'].open_min, 840);
  assert.equal(JSON.parse(s.day_rules)['0'].close_min, 1080);
  assert.equal(s.open_min, '540', 'the rest of the week kept its hours');
});

test('a polite request is still a request, and a real question is still a question', async () => {
  await reset();
  const r = await say('can you please close on Mondays');
  assert.equal((await settings()).open_days, '2,3,4,5');
  assert.match(r.said, /Closed on Monday/);

  await reset();
  const q = await say('can people book on a Sunday');
  assert.notEqual(q.kind, 'done', `${q.kind}: ${q.said}`);
  assert.equal((await settings()).open_days, '1,2,3,4,5');
});

test('two things in one breath both happen, and one undo puts both back', async () => {
  await reset();
  const r = await say('close Mondays and open Saturday 10 to 3');
  const s = await settings();
  assert.equal(s.open_days, '2,3,4,5,6');
  assert.equal(JSON.parse(s.day_rules)['6'].open_min, 600);
  // Said on its own the close plan recaps the whole week, which is out of date
  // by the time the opening half has run.
  assert.doesNotMatch(r.said, /You're open Tuesday, Wednesday, Thursday and Friday now/);

  await k.api('POST', '/api/ask/undo', { cookie, body: { token: r.undo_token } });
  const back = await settings();
  assert.equal(back.open_days, '1,2,3,4,5');
  assert.equal(back.day_rules, '{}');
});

test('sentences that merely contain the word "and" are still read whole', async () => {
  await reset();
  await say('close on Monday and Tuesday');
  assert.equal((await settings()).open_days, '3,4,5');
  await reset();
  await say('open Thursday and Friday only');
  assert.equal((await settings()).open_days, '4,5');
  await reset();
  await say('change my opening days to Tuesday and Thursday');
  assert.equal((await settings()).open_days, '2,4');
});

test('undo is exact: a change somebody else made meanwhile survives it', async () => {
  await reset();
  const r = await say('close on Mondays');
  await k.api('PUT', '/api/settings', {
    cookie, body: { business_name: 'Glow Bar Camberwell', slot_interval: '20' },
  });
  await k.api('POST', '/api/ask/undo', { cookie, body: { token: r.undo_token } });
  const s = await settings();
  assert.equal(s.open_days, '1,2,3,4,5', 'the hours went back');
  assert.equal(s.business_name, 'Glow Bar Camberwell', 'and the rest was left alone');
  assert.equal(s.slot_interval, '20');

  const again = await k.api('POST', '/api/ask/undo', { cookie, body: { token: r.undo_token } });
  assert.equal(again.status, 409, 'the same undo cannot run twice');
});

test('"undo" is a word, and running out of them says so', async () => {
  await reset();
  await say('close on Mondays');
  const u = await say('undo that');
  assert.equal(u.kind, 'undone');
  assert.equal((await settings()).open_days, '1,2,3,4,5');
  assert.equal(typeof u.undone_token, 'string');

  let none = null;
  for (let i = 0; i < 12; i++) {
    none = await say('undo that');
    if (none.kind !== 'undone') break;
  }
  assert.equal(none.kind, 'nothing', `${none.kind}: ${none.said}`);
});

test('already-true is said, not mistaken for not-understood', async () => {
  await reset();
  const r = await say('close on Sunday');
  assert.equal(r.kind, 'already', `${r.kind}: ${r.said}`);
  assert.match(r.said, /already closed on Sunday/i);
  assert.equal((await settings()).open_days, '1,2,3,4,5');
});

test('a switch and the pipe it goes down are different things', async () => {
  // "Send reminders by text" said to the switch turns on something already on
  // and changes nothing anybody asked for.
  await reset();
  const r = await say('send reminders by text');
  const s = await settings();
  assert.equal(s.chan_reminder, 'sms');
  assert.equal(s.reminders_enabled, '1', 'the switch did not move');
  assert.ok((r.warnings || []).some((w) => /Texting is switched off/i.test(w)));
});

test('what it must refuse', async () => {
  for (const q of [
    'what time do we close on Friday',
    'how many days ahead can people book',
    'what did we take last week',
    'who owes me',
    'send everyone a text about the sale',
    'delete all my clients',
    "cancel tomorrow's appointments",
    'refund Sarah',
    'qwertyuiop asdf',
  ]) {
    await reset();
    const before = JSON.stringify(await settings());
    const r = await say(q);
    assert.equal(r.kind, 'unknown', `"${q}" → ${r.kind}: ${r.said}`);
    assert.equal(JSON.stringify(await settings()), before, `"${q}" changed something`);
  }
});

// ---------------------------------------------------------------------------
// Going places
// ---------------------------------------------------------------------------

test('it takes you anywhere, on the day you named', async () => {
  await reset();
  const two = await say('show me my calendar in two days');
  assert.equal(two.kind, 'went');
  assert.match(two.href, /^#\/calendar\?date=\d{4}-\d{2}-\d{2}$/);
  assert.match(two.said, /Here's \w+ \d+ \w+/, 'it names the day it landed on');

  const today = param((await say('show me today')).href, 'date');
  const addDays = (n) => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  assert.equal(param(two.href, 'date'), addDays(2));
  assert.equal(param((await say('my booking schedule in three days')).href, 'date'), addDays(3),
    'no pointing word needed when a day is named');
  assert.equal(param((await say("what's on tomorrow")).href, 'date'), addDays(1));

  // A bare weekday looks forward: nobody asks to be shown a diary they worked.
  const fri = param((await say('show me Friday')).href, 'date');
  assert.ok(fri >= today && new Date(`${fri}T12:00:00`).getDay() === 5);
  const last = param((await say('show me last Friday')).href, 'date');
  assert.ok(last < today && new Date(`${last}T12:00:00`).getDay() === 5);
});

test('every screen and every settings card, by the words an owner would use', async () => {
  for (const [q, want] of [
    ['take me to my clients', '#/clients'],
    ['go to billing', '#/invoices'],
    ['show me the team', '#/staff'],
    ['open the till', '#/pos'],
    ['where do I change my logo', '#/settings?open=brand'],
    ['take me to sms settings', '#/settings?open=sms'],
    ['open my no-show settings', '#/settings?open=noshow'],
    ['where are the patch test settings', '#/settings?open=safety'],
    ['show me backups', '#/settings?open=backup'],
    ['where do I change my tax rate', '#/settings?open=billing'],
  ]) {
    const r = await say(q);
    assert.equal(r.kind, 'went', `"${q}" → ${r.kind}`);
    assert.equal(r.href, want, `"${q}"`);
  }
  // Cloudflare is deliberately absent: a security layer the owner did not ask
  // for and cannot act on, which only raises a question with no useful answer.
  const cf = await say('take me to cloudflare settings');
  assert.ok(cf.kind !== 'went' || !/edge/.test(cf.href || ''));
});

test('looking at a day is not trading on it', async () => {
  await reset();
  const look = await say('open my calendar on Saturday');
  assert.equal(look.kind, 'went');
  assert.equal((await settings()).open_days, '1,2,3,4,5', 'the salon did not start opening Saturdays');

  await reset();
  const trade = await say('open on Saturday');
  assert.equal(trade.kind, 'done');
  assert.equal((await settings()).open_days, '1,2,3,4,5,6');
});

test('navigation changes nothing at all', async () => {
  await reset();
  const before = JSON.stringify(await settings());
  for (const q of ['show me my calendar in two days', 'where do I change my logo',
    'take me to my clients', 'show me Friday', 'open the till']) await say(q);
  assert.equal(JSON.stringify(await settings()), before);
});

// ---------------------------------------------------------------------------
// A booking, filled in but never made
// ---------------------------------------------------------------------------

test('it fills a booking in, and says what it filled in', async () => {
  await reset();
  const d = k.db();
  const svc = d.prepare('SELECT id, name FROM services WHERE active = 1 LIMIT 1').get();
  const who = d.prepare("SELECT id FROM clients WHERE first_name = 'Wilhelmina'").get().id;
  d.close();

  const r = await say(`book Wilhelmina in for a ${svc.name} on Friday at 2`);
  assert.equal(r.kind, 'prepare', `${r.kind}: ${r.said}`);
  assert.equal(param(r.href, 'new'), '1', 'the form is asked to open');
  assert.equal(param(r.href, 'client'), String(who));
  assert.equal(param(r.href, 'service'), String(svc.id));
  assert.equal(param(r.href, 'start'), '840', 'two in the afternoon, not two in the morning');
  assert.equal(new Date(`${param(r.href, 'date')}T12:00:00`).getDay(), 5);
  assert.match(r.said, /Wilhelmina Baptiste/);
  // The owner is one press from texting somebody. That has to be on screen.
  assert.match(r.said, /press Book/i);
});

test('it never guesses which Sarah', async () => {
  await reset();
  const d = k.db();
  const svc = d.prepare('SELECT name FROM services WHERE active = 1 LIMIT 1').get().name;
  const sarahW = d.prepare("SELECT id FROM clients WHERE last_name = 'Wilson'").get().id;
  d.close();

  const r = await say(`book Sarah in for a ${svc} on Friday at 2`);
  assert.equal(r.kind, 'ambiguous', `${r.kind}: ${r.said}`);
  assert.equal(r.options.length, 2);
  assert.ok(r.options.every((o) => String(o.href).includes('new=1')));
  assert.equal(new Set(r.options.map((o) => param(o.href, 'client'))).size, 2);

  // A full name settles it: nobody should answer a question they already
  // answered in the sentence.
  const w = await say(`book Sarah Wilson in for a ${svc} on Friday at 2`);
  assert.equal(w.kind, 'prepare');
  assert.equal(param(w.href, 'client'), String(sarahW));
});

test('a name it cannot place is handed over as typed, not invented', async () => {
  await reset();
  const d = k.db();
  const svc = d.prepare('SELECT name FROM services WHERE active = 1 LIMIT 1').get().name;
  d.close();
  const r = await say(`book Jodie in for a ${svc} tomorrow at 3`);
  assert.equal(r.kind, 'prepare');
  assert.equal(param(r.href, 'name'), 'Jodie');
  assert.equal(param(r.href, 'client'), null, 'no client id invented');
  assert.ok((r.warnings || []).some((w) => /Jodie/.test(w)), 'it says which name it could not place');
});

test('it says what is wrong with a booking before you press Book', async () => {
  await reset();
  const d = k.db();
  const svc = d.prepare('SELECT id, name FROM services WHERE active = 1 LIMIT 1').get();
  // The one the form itself will select when nobody is named — /api/staff
  // orders by id, and the form takes the first.
  const staff = d.prepare('SELECT id, name FROM staff WHERE active = 1 ORDER BY id').get();
  const sarahW = d.prepare("SELECT id FROM clients WHERE last_name = 'Wilson'").get().id;
  d.close();

  const shut = await say(`book Wilhelmina in for a ${svc.name} on Sunday at 11`);
  assert.ok((shut.warnings || []).some((w) => /closed on Sundays/i.test(w)));

  const early = await say(`book Wilhelmina in for a ${svc.name} on Friday at 7am`);
  assert.ok((early.warnings || []).some((w) => /outside/i.test(w)));

  const friday = param((await say(`book Wilhelmina in for a ${svc.name} on Friday at 2`)).href, 'date');
  const d2 = k.db();
  d2.prepare(`INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status)
              VALUES (?, ?, ?, ?, 840, 900, 'booked')`).run(sarahW, staff.id, svc.id, friday);
  d2.close();
  const clash = await say(`book Wilhelmina in for a ${svc.name} on Friday at 2`);
  assert.ok((clash.warnings || []).some((w) => /already has/i.test(w)));
  assert.ok((clash.warnings || []).some((w) => /Sarah Wilson/.test(w)), 'naming who');
  // Whose diary, by name. "Sarah Wilson is already booked at that time" does
  // not say whether Sarah is the person being booked or the person in the way,
  // and those are opposite problems.
  assert.ok((clash.warnings || []).some((w) => w.includes(staff.name)), 'naming whose diary');
  assert.equal(clash.kind, 'prepare', 'still prepared — the owner may mean to double-book');
});

test('a clash is one stylist’s diary, not the whole shop', async () => {
  await reset();
  const d = k.db();
  const svc = d.prepare('SELECT id, name FROM services WHERE active = 1 LIMIT 1').get();
  const first = d.prepare('SELECT id, name FROM staff WHERE active = 1 ORDER BY id').get();
  const sarahW = d.prepare("SELECT id FROM clients WHERE last_name = 'Wilson'").get().id;
  // A second chair, with a name nobody else on the team shares.
  const rowan = Number(d.prepare("INSERT INTO staff (name, title, color) VALUES ('Rowan', 'Colour', '#199e70')")
    .run().lastInsertRowid);
  d.close();

  const monday = param((await say(`book Wilhelmina in for a ${svc.name} on Monday at 2`)).href, 'date');
  const d2 = k.db();
  // The demo seed fills today-30 to today+13 with appointments at random times
  // from a list that includes 2pm, spread across whoever is on the team. So on
  // roughly one calendar date in three, the first stylist already has somebody
  // at 2pm next Monday and this test failed on a real clash it had created
  // itself — a red suite that says nothing about the code. The default
  // stylist's 2pm is cleared so the only clash in play is the one below.
  d2.prepare('DELETE FROM appointments WHERE staff_id = ? AND date = ? AND start_min < 900 AND end_min > 840')
    .run(first.id, monday);
  d2.prepare(`INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status)
              VALUES (?, ?, ?, ?, 840, 900, 'booked')`).run(sarahW, rowan, svc.id, monday);
  d2.close();

  // A salon with three chairs nearly always has somebody in a chair. Checking
  // the whole shop fires on almost every booking, and names a client who
  // belongs to a stylist the owner is not booking into.
  const other = await say(`book Wilhelmina in for a ${svc.name} on Monday at 2`);
  assert.ok(!(other.warnings || []).some((w) => /already has/i.test(w)),
    `another stylist's client is not a clash: ${JSON.stringify(other.warnings)}`);
  // Which is only true because Kai and the form agree on who the booking is
  // against, and they only agree because Kai writes its choice into the link.
  assert.equal(param(other.href, 'staff'), String(first.id), 'the link says whose diary');

  const named = await say(`book Wilhelmina in with Rowan for a ${svc.name} on Monday at 2`);
  assert.ok((named.warnings || []).some((w) => /Rowan already has Sarah Wilson/.test(w)),
    `naming her makes it one: ${JSON.stringify(named.warnings)}`);
  // A clash is only half an answer. The other half is who could take them.
  assert.ok((named.warnings || []).some((w) => w.includes(first.name) && /free\.$/.test(w)),
    `and who is free instead: ${JSON.stringify(named.warnings)}`);
});

test('it never creates an appointment', async () => {
  await reset();
  const d = k.db();
  const svc = d.prepare('SELECT name FROM services WHERE active = 1 LIMIT 1').get().name;
  const before = d.prepare('SELECT COUNT(*) AS n FROM appointments').get().n;
  d.close();

  for (const q of [
    `book Wilhelmina in for a ${svc} on Friday at 2`,
    `book Sarah in for a ${svc} tomorrow at 10`,
    `put Wilhelmina down for a ${svc} next Tuesday at 2:30`,
    `book Jodie in for a ${svc} on Friday at 11`,
    `pencil Wilhelmina in for a ${svc} on Sunday at 9`,
  ]) await say(q);

  const d2 = k.db();
  const after = d2.prepare('SELECT COUNT(*) AS n FROM appointments').get().n;
  d2.close();
  assert.equal(after, before, 'five prepared bookings later, the diary is untouched');
});

test('a booking does not eat the settings that share its vocabulary', async () => {
  const d = k.db();
  const svc = d.prepare('SELECT name FROM services WHERE active = 1 LIMIT 1').get().name;
  d.close();
  // Each of these is a settings change that also contains a booking verb AND a
  // service the salon really offers — enough shape to look like a booking to
  // anything less specific than "these words are never a booking".
  for (const [q, key, want] of [
    ['turn off online booking', 'booking_enabled', '0'],
    ['stop online booking after 3 no shows', 'noshow_block_after', '3'],
    ['let people book up to 60 days ahead', 'booking_horizon_days', '60'],
    [`turn off online booking for a ${svc}`, 'booking_enabled', '0'],
    [`let people book up to 90 days ahead for a ${svc}`, 'booking_horizon_days', '90'],
  ]) {
    await reset();
    const r = await say(q);
    assert.notEqual(r.kind, 'prepare', `"${q}" was read as a booking`);
    assert.equal(String((await settings())[key]), want, `"${q}" → ${key}`);
  }
  const nav = await say('show me my calendar in two days');
  assert.equal(nav.kind, 'went', 'and navigation still wins where no person is named');
});

// ---------------------------------------------------------------------------
// The voice
// ---------------------------------------------------------------------------

test('the personality never gets between the owner and the receipt', async () => {
  await reset();
  const openers = new Set();
  for (const [q, turn] of [
    ['close on Mondays', 0], ['open Saturday 10 to 3', 1], ['undo that', 2],
    ['show me tomorrow', 3], ['close on Mondays', 4], ['turn off online booking', 5],
    ['qwertyuiop', 6], ['turn the waitlist on', 7],
  ]) {
    const r = await say(q, turn);
    // The invariant: whatever charm is added, the fact underneath is untouched
    // and can be checked word for word.
    assert.ok(String(r.warm || '').endsWith(String(r.said || '')),
      `"${q}": ${r.warm} / ${r.said}`);
    if (r.kind === 'done') openers.add(String(r.warm).split('—')[0].trim());
  }
  assert.ok(openers.size > 1, 'and it does not say the same thing every time');

  // Never chirpy about a failure.
  const no = await say('qwertyuiop asdf', 0);
  assert.equal(no.warm, no.said);
});

test('nobody who is not signed in can do any of it', async () => {
  // Compared against what the salon looked like a moment ago rather than a
  // fixed value: the point is that the stranger changed nothing, not what the
  // tests before this one happened to leave behind.
  const before = JSON.stringify(await settings());
  for (const path of ['/api/ask/do', '/api/ask/undo', '/api/ask/apply']) {
    const anon = await k.api('POST', path, {
      body: { q: 'close on Mondays', token: '', fingerprint: 'x' },
    });
    assert.equal(anon.status, 401, path);
  }
  assert.equal(JSON.stringify(await settings()), before);
});
