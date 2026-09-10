// "Book Sarah in for a cut on Friday at 2."
//
// The one thing Kai gets asked for most and the one thing it must not do on its
// own. Every other capability writes a setting: reversible, internal, undoable
// by one word. A booking puts a real person in a real chair and sends them a
// confirmation, and there is no undo for a text that has already arrived.
//
// So this suite is mostly about what does NOT happen:
//
//   1. IT NEVER CREATES AN APPOINTMENT. Not one, from any sentence, ever.
//   2. IT NEVER GUESSES A PERSON. Two Sarahs means Kai asks which.
//   3. IT FILLS THE FORM IN — client, service, day, time — and says so.
//   4. IT SAYS WHAT IS WRONG WITH IT before the owner presses Book: closed
//      that day, outside hours, or somebody already in that slot.
//   5. IT DOES NOT EAT THE SETTINGS THAT SHARE ITS VOCABULARY. "Turn off
//      online booking" is a switch; "let people book 60 days ahead" is a
//      number; neither is a booking.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The repo, found from this file rather than hard-coded, so the suite survives
// being run from anywhere — and being run in a container that is not the one it
// was written in.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PORT = 4945;
const B = `http://localhost:${PORT}`;
const DIR = '/tmp/kairo-kai-booking';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { console.log((c ? '✅' : '❌') + ' ' + n + (e ? ' — ' + e : '')); c ? pass++ : fail++; };

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
process.env.KAIRO_DATA_DIR = DIR;

const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), KAIRO_DATA_DIR: DIR },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stdout.on('data', () => {}); srv.stderr.on('data', () => {});
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${B}/api/version`)).ok) break; } catch { /* not up */ }
  await new Promise((r) => setTimeout(r, 250));
}

let cookie = '';
const json = async (m, p, b) => {
  const h = {};
  if (cookie) h.cookie = cookie;
  if (b !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(B + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) });
  if (!cookie && r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
};
const say = async (q) => (await json('POST', '/api/ask/do', { q })).data;
const settings = async () => (await json('GET', '/api/settings')).data;
const countAppts = async () =>
  (await json('GET', '/api/appointments?from=2000-01-01&to=2099-01-01')).data.length;
const param = (href, k) => new URLSearchParams(String(href || '').split('?')[1] || '').get(k);

const { db } = await import(`${ROOT}/src/db.js`);

try {
  await json('POST', '/api/auth/login', { email: 'admin@kairo.local', password: 'admin123' });
  await json('POST', '/api/setup/skip', {});
  await json('PUT', '/api/settings', {
    business_name: 'Glow Bar', business_tz: 'Australia/Melbourne',
    open_days: '1,2,3,4,5', open_min: '540', close_min: '1020', day_rules: '{}',
  });

  // Two Sarahs, because a salon with two Sarahs is not an edge case, it is
  // Tuesday. And one person nobody shares a name with, for the simple path.
  db.prepare("INSERT INTO clients (first_name, last_name, phone) VALUES ('Sarah','Wilson','0400010001')").run();
  db.prepare("INSERT INTO clients (first_name, last_name, phone) VALUES ('Sarah','Jones','0400010002')").run();
  db.prepare("INSERT INTO clients (first_name, last_name, phone) VALUES ('Wilhelmina','Baptiste','0400010003')").run();
  const wilhelmina = db.prepare("SELECT id FROM clients WHERE first_name = 'Wilhelmina'").get().id;
  const sarahW = db.prepare("SELECT id FROM clients WHERE last_name = 'Wilson'").get().id;
  const svc = db.prepare('SELECT id, name, duration_min FROM services WHERE active = 1 LIMIT 1').get();

  console.log('\n── 1. it fills the form in');
  {
    const r = await say(`book Wilhelmina in for a ${svc.name} on Friday at 2`);
    ok('it prepares rather than books', r.kind === 'prepare', `${r.kind}: ${r.said}`);
    ok('on the calendar', String(r.href).startsWith('#/calendar?'), r.href);
    ok('with the form asked to open', param(r.href, 'new') === '1', r.href);
    ok('the right client', param(r.href, 'client') === String(wilhelmina), r.href);
    ok('the right service', param(r.href, 'service') === String(svc.id), r.href);
    ok('two in the afternoon, not two in the morning', param(r.href, 'start') === '840', r.href);
    ok('on a Friday', new Date(`${param(r.href, 'date')}T12:00:00`).getDay() === 5, param(r.href, 'date'));
    ok('and it says what it filled in', /Wilhelmina Baptiste/.test(r.said) && /2pm/.test(r.said), r.said);
    // The owner is one press from texting somebody. That has to be on screen.
    ok('and that nothing has happened yet',
      /press Book/i.test(r.said), r.said);
  }

  console.log('\n── 2. the ways people say it');
  {
    const cases = [
      `book Wilhelmina in for a ${svc.name} tomorrow at 10`,
      `put Wilhelmina down for a ${svc.name} next Tuesday at 2:30`,
      `book Wilhelmina Baptiste in for a ${svc.name} on the 15th at 11`,
      `pencil Wilhelmina in for a ${svc.name} on Friday at 3`,
    ];
    for (const q of cases) {
      const r = await say(q);
      ok(`"${q}"`, r.kind === 'prepare' && param(r.href, 'client') === String(wilhelmina),
        `${r.kind}: ${r.href || r.said}`);
    }
  }

  console.log('\n── 3. it never guesses which Sarah');
  {
    const r = await say(`book Sarah in for a ${svc.name} on Friday at 2`);
    ok('it asks instead of picking', r.kind === 'ambiguous', `${r.kind}: ${r.said}`);
    ok('offering both of them', (r.options || []).length === 2,
      JSON.stringify((r.options || []).map((o) => o.title)));
    ok('each with its own form to open',
      (r.options || []).every((o) => String(o.href).includes('new=1')),
      JSON.stringify((r.options || []).map((o) => o.href)));
    ok('for different people',
      new Set((r.options || []).map((o) => param(o.href, 'client'))).size === 2,
      JSON.stringify((r.options || []).map((o) => param(o.href, 'client'))));

    // A full name settles it. Nobody should have to answer a question they
    // already answered in the sentence.
    const w = await say(`book Sarah Wilson in for a ${svc.name} on Friday at 2`);
    ok('but a full name is not ambiguous',
      w.kind === 'prepare' && param(w.href, 'client') === String(sarahW), `${w.kind}: ${w.href}`);
  }

  console.log('\n── 4. a name it does not know is handed over, not swallowed');
  {
    const r = await say(`book Jodie in for a ${svc.name} tomorrow at 3`);
    ok('it still prepares', r.kind === 'prepare', `${r.kind}: ${r.said}`);
    ok('with the name typed in for them', param(r.href, 'name') === 'Jodie', r.href);
    ok('and no client id invented', param(r.href, 'client') === null, r.href);
    ok('saying which name it could not place',
      (r.warnings || []).some((w) => /Jodie/.test(w)), JSON.stringify(r.warnings));
  }

  console.log('\n── 5. it says what is wrong with it before you press Book');
  {
    // Sunday is closed in this week.
    const shut = await say(`book Wilhelmina in for a ${svc.name} on Sunday at 11`);
    ok('a closed day is flagged',
      (shut.warnings || []).some((w) => /closed on Sundays/i.test(w)), JSON.stringify(shut.warnings));

    const early = await say(`book Wilhelmina in for a ${svc.name} on Friday at 7am`);
    ok('so are hours outside the trading day',
      (early.warnings || []).some((w) => /outside/i.test(w)), JSON.stringify(early.warnings));

    // Put somebody in the slot, then ask for the same one.
    const staff = (await json('GET', '/api/staff')).data[0];
    const friday = param((await say(`book Wilhelmina in for a ${svc.name} on Friday at 2`)).href, 'date');
    db.prepare(`INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status)
                VALUES (?, ?, ?, ?, 840, 900, 'booked')`).run(sarahW, staff.id, svc.id, friday);
    const clash = await say(`book Wilhelmina in for a ${svc.name} on Friday at 2`);
    ok('and somebody already in that slot',
      (clash.warnings || []).some((w) => /already has/i.test(w)), JSON.stringify(clash.warnings));
    ok('naming who', (clash.warnings || []).some((w) => /Sarah Wilson/.test(w)), JSON.stringify(clash.warnings));
    // Whose diary it is, by name. "Sarah Wilson is already booked at that time"
    // does not say whether Sarah is the person being booked or the person in
    // the way, and those are opposite problems.
    ok('and whose diary it is',
      (clash.warnings || []).some((w) => w.includes(staff.name)), JSON.stringify(clash.warnings));
    ok('while still preparing it, because the owner may mean to double-book',
      clash.kind === 'prepare', clash.kind);
  }

  console.log('\n── 5b. a clash is about one diary, not the whole shop');
  {
    // A salon with three chairs nearly always has somebody in a chair. A check
    // across the whole shop fires on almost every booking, and the client it
    // names belongs to a stylist the owner is not booking into.
    const first = (await json('GET', '/api/staff')).data[0];
    const rowan = (await json('POST', '/api/staff', { name: 'Rowan', title: 'Colour' })).data;
    const monday = param((await say(`book Wilhelmina in for a ${svc.name} on Monday at 2`)).href, 'date');
    db.prepare(`INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status)
                VALUES (?, ?, ?, ?, 840, 900, 'booked')`).run(sarahW, rowan.id, svc.id, monday);

    const other = await say(`book Wilhelmina in for a ${svc.name} on Monday at 2`);
    ok('somebody in another stylist’s column is not a clash',
      !(other.warnings || []).some((w) => /already has/i.test(w)), JSON.stringify(other.warnings));
    // Which is only true because Kai and the form agree on who the booking is
    // against. The form picks the first of the team when nobody is named, so
    // Kai names that same person in the link rather than leaving it to chance.
    ok('and the link says whose diary it is',
      param(other.href, 'staff') === String(first.id), other.href);

    const named = await say(`book Wilhelmina in with Rowan for a ${svc.name} on Monday at 2`);
    ok('naming her makes it one',
      (named.warnings || []).some((w) => /Rowan already has Sarah Wilson/.test(w)),
      JSON.stringify(named.warnings));
    // A clash is only half an answer. The other half is who could take them.
    ok('and it says who is free instead',
      (named.warnings || []).some((w) => w.includes(first.name) && /free\.$/.test(w)),
      JSON.stringify(named.warnings));
  }

  console.log('\n── 6. it never creates an appointment');
  {
    const before = await countAppts();
    for (const q of [
      `book Wilhelmina in for a ${svc.name} on Friday at 2`,
      `book Sarah in for a ${svc.name} tomorrow at 10`,
      `put Wilhelmina down for a ${svc.name} next Tuesday at 2:30`,
      `book Jodie in for a ${svc.name} on Friday at 11`,
      `book Wilhelmina in for a ${svc.name} on Sunday at 9`,
    ]) await say(q);
    ok('five prepared bookings later, the diary is untouched',
      (await countAppts()) === before, `${before} → ${await countAppts()}`);
  }

  console.log('\n── 7. it does not eat the settings that share its vocabulary');
  {
    const cases = [
      ['turn off online booking', 'booking_enabled', '0'],
      ['turn online booking back on', 'booking_enabled', '1'],
      ['stop online booking after 3 no shows', 'noshow_block_after', '3'],
      ['let people book up to 60 days ahead', 'booking_horizon_days', '60'],
      ['change my booking page colour to green', 'brand_scheme', 'sage'],
    ];
    for (const [q, key, want] of cases) {
      const r = await say(q);
      ok(`"${q}" is still a setting`,
        r.kind === 'done' && String((await settings())[key]) === want,
        `${r.kind}: ${(await settings())[key]}`);
    }
    for (const q of ['can people book on a Sunday', 'copy my booking link', 'how far ahead can people book']) {
      const r = await say(q);
      ok(`"${q}" is not a booking`, r.kind !== 'prepare', `${r.kind}: ${r.said}`);
    }
    // The ones that need the exclusion list by name. Each is a settings change
    // that also happens to contain a booking verb AND a service the salon
    // really offers, which is enough shape to look like a booking to anything
    // less specific than "these words are never a booking".
    for (const [q, key, want] of [
      [`turn off online booking for a ${svc.name}`, 'booking_enabled', '0'],
      [`let people book up to 90 days ahead for a ${svc.name}`, 'booking_horizon_days', '90'],
    ]) {
      const r = await say(q);
      ok(`"${q}" is a setting, not a booking`,
        r.kind !== 'prepare' && String((await settings())[key]) === want,
        `${r.kind}: ${(await settings())[key]}`);
    }

    // Navigation still wins where no person is named.
    const nav = await say('show me my calendar in two days');
    ok('and "show me my calendar in two days" still just goes there',
      nav.kind === 'went', `${nav.kind}: ${nav.href}`);
  }

  console.log('\n── 8. a stranger cannot use it');
  {
    const anon = await fetch(`${B}/api/ask/do`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: `book Sarah in for a ${svc.name} on Friday at 2` }),
    });
    ok('it refuses without a session', anon.status === 401, String(anon.status));
  }
} catch (err) {
  console.error('\n💥 ' + (err?.stack || err));
  fail++;
}

srv.kill('SIGKILL');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
