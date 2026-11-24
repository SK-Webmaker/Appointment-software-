// Performance (src/stats.js): the figures on a diary small enough to count by
// hand, the emailed report, who may see it, and the operator's "send them their
// numbers", which may only ever reach the salon's own owner.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startKairo } from './helpers/kairo.js';
import { mockResend } from './helpers/mocks.js';
import { sign } from '../src/platform-sign.js';
import { hashPassword } from '../src/auth.js';
import { presetRange, previousRange, monthsOf, resolveRange } from '../src/stats.js';

let k, resend, cookie;

before(async () => {
  resend = await mockResend();
  k = await startKairo({
    env: { KAIRO_SHARED_RESEND_KEY: resend.fullKey, KAIRO_SHARED_FROM: 'bookings@kairobookings.test', RESEND_API_BASE: resend.base },
  });
  ({ cookie } = await k.login());

  // A diary small enough to count by hand. Monday to Friday, 9 to 5 (480
  // minutes), two people, no rosters, in Melbourne.
  const d = k.db();
  try {
    d.exec(`DELETE FROM payments; DELETE FROM invoice_items; DELETE FROM invoices; DELETE FROM messages;
      DELETE FROM appointment_services; DELETE FROM reviews; DELETE FROM appointments; DELETE FROM time_blocks;
      DELETE FROM staff_shifts; DELETE FROM clients; DELETE FROM services; DELETE FROM staff;`);
    const set = d.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [kk, v] of Object.entries({ open_days: '1,2,3,4,5', open_min: '540', close_min: '1020', day_rules: '{}', business_tz: 'Australia/Melbourne', business_name: 'Test Salon', currency: '$' })) set.run(kk, v);
    d.prepare("INSERT INTO staff (id, name, active) VALUES (1, 'Ana', 1), (2, 'Bea', 1)").run();
    d.prepare("INSERT INTO services (id, name, duration_min, price_cents) VALUES (1, 'Cut', 60, 5000), (2, 'Colour', 120, 12000)").run();
    d.prepare("INSERT INTO clients (id, first_name) VALUES (1, 'Cara'), (2, 'Dee'), (3, 'Eve')").run();
    const appt = d.prepare(`INSERT INTO appointments (id, client_id, staff_id, service_id, date, start_min, end_min, status, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    // Cara's cut on Mon 5 Jan; her next one was booked that afternoon (03:00 UTC = 2 pm Melbourne).
    appt.run(1, 1, 1, 1, '2026-01-05', 600, 660, 'completed', 'staff', '2025-12-20 00:00:00');
    appt.run(2, 1, 1, 1, '2026-02-02', 600, 660, 'completed', 'staff', '2026-01-05 03:00:00');
    // Dee's colour, booked online; then a no-show; then a visit in March, booked in February.
    appt.run(3, 2, 2, 2, '2026-01-06', 600, 720, 'completed', 'online', '2026-01-01 00:00:00');
    appt.run(4, 2, 2, 1, '2026-01-20', 600, 660, 'no_show', 'staff', '2026-01-10 00:00:00');
    appt.run(7, 2, 2, 1, '2026-03-03', 600, 660, 'booked', 'staff', '2026-02-20 00:00:00');
    // Eve cancelled once, then came for a cut and colour together.
    appt.run(5, 3, 1, 1, '2026-01-07', 600, 660, 'cancelled', 'staff', '2026-01-02 00:00:00');
    appt.run(6, 3, 1, 1, '2026-01-08', 600, 690, 'completed', 'staff', '2026-01-07 22:00:00');
    d.prepare('INSERT INTO appointment_services (appointment_id, service_id, sort_order) VALUES (6, 1, 0), (6, 2, 1)').run();
    // Blocked: Ana for two hours on Fri 9 Jan, and the whole team all of Mon 12 Jan.
    d.prepare("INSERT INTO time_blocks (staff_id, date, start_min, end_min) VALUES (1, '2026-01-09', 600, 720), (NULL, '2026-01-12', 0, 1440)").run();
    // $50 taken on 5 Jan and $50 on 2 Feb.
    d.prepare("INSERT INTO invoices (id, number, client_id, issue_date, status) VALUES (1, 'T-1', 1, '2026-01-05', 'paid'), (2, 'T-2', 1, '2026-02-02', 'paid')").run();
    d.prepare("INSERT INTO payments (invoice_id, amount_cents, method, paid_at) VALUES (1, 5000, 'card', '2026-01-05 11:00:00'), (2, 5000, 'cash', '2026-02-02 11:00:00')").run();
  } finally { d.close(); }
});
after(async () => { await k?.stop(); await resend?.close(); });

test('presets end today, months are read on their own, and each range is compared like for like', () => {
  const t = '2026-11-24';
  assert.deepEqual(presetRange('last_3_months', t), { from: '2026-09-01', to: '2026-11-24' });
  assert.deepEqual(presetRange('last_month', t), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(presetRange('this_year', t), { from: '2026-01-01', to: '2026-11-24' });
  assert.deepEqual(previousRange('2026-09-01', '2026-11-24'), { from: '2026-06-01', to: '2026-08-24' });
  assert.deepEqual(previousRange('2026-10-01', '2026-10-31'), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(previousRange('2026-03-01', '2026-03-31'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(previousRange('2026-01-01', '2026-11-24', 'this_year'), { from: '2025-01-01', to: '2025-11-24' }, 'the year so far against the same dates last year');
  assert.deepEqual(previousRange('2026-01-01', '2026-02-28'), { from: '2025-11-01', to: '2025-12-31' }, 'January and February against the two months before');
  assert.deepEqual(previousRange('2026-11-10', '2026-11-16'), { from: '2026-11-03', to: '2026-11-09' }, 'other ranges: the same number of days before');
  const ms = monthsOf('2026-09-01', t, t);
  assert.deepEqual(ms.map((m) => [m.key, m.from, m.to, m.to_date]), [
    ['2026-09', '2026-09-01', '2026-09-30', false], ['2026-10', '2026-10-01', '2026-10-31', false], ['2026-11', '2026-11-01', '2026-11-24', true],
  ]);
  assert.equal(resolveRange({ from: '2020-01-01', to: t }, t).from, '2023-11-21', 'never more than 1100 days');
  assert.equal(resolveRange({ from: 'nonsense' }, t).preset, 'last_3_months');
});

test('the figures for a month match the diary, counted by hand', async () => {
  const r = await k.api('GET', '/api/stats?from=2026-01-01&to=2026-01-31', { cookie });
  assert.equal(r.status, 200, r.text);
  const m = r.json.total;
  assert.equal(m.visits, 3, 'the cancellation and the no-show are not visits');
  assert.equal(m.value_cents, 34000, '$50 cut + $120 colour + $170 cut-and-colour');
  assert.equal(m.avg_value_cents, 11333);
  assert.equal(m.takings_cents, 5000);
  assert.equal(m.cancelled, 1);
  assert.equal(m.cancel_rate, 20, 'one of five appointments');
  assert.equal(m.no_shows, 1);
  assert.equal(m.no_show_rate, 25, 'one of the four people expected');
  assert.equal(m.online, 1);
  assert.equal(m.clients_seen, 3);
  assert.equal(m.new_clients, 3);
  assert.equal(m.rebooked, 1, "only Cara's next visit was booked on the day");
  assert.equal(m.rebook_rate, 33.3);
  assert.equal(m.came_back, 2, 'Cara in February, Dee booked for March');
  // Rostered from the first appointment (Mon 5 Jan): 20 weekdays × 480 × 2,
  // less Ana's two hours and the team's whole Monday.
  assert.equal(m.available_min, 20 * 480 * 2 - 120 - 480 * 2);
  assert.equal(m.booked_min, 60 + 120 + 90);
  assert.equal(m.diary_full, 1.5);
});

test('a two-month range has each month, the totals, what sold and who did it', async () => {
  const r = await k.api('GET', '/api/stats?from=2026-01-01&to=2026-02-28', { cookie });
  assert.equal(r.status, 200, r.text);
  const j = r.json;
  assert.deepEqual(j.months.map((m) => [m.key, m.visits, m.value_cents, m.new_clients]), [['2026-01', 3, 34000, 3], ['2026-02', 1, 5000, 0]]);
  assert.equal(j.total.visits, 4);
  assert.equal(j.total.returning_clients, 0, 'everyone seen was new in these dates');
  assert.deepEqual([j.previous.from, j.previous.to, j.previous.visits], ['2025-11-01', '2025-12-31', 0]);
  assert.deepEqual(j.top_services.map((s) => [s.name, s.count, s.value_cents]), [['Colour', 2, 24000], ['Cut', 3, 15000]],
    'the bundled appointment counts each of its services');
  assert.deepEqual(j.team.map((t) => [t.name, t.visits, t.value_cents]), [['Ana', 3, 27000], ['Bea', 1, 12000]]);
  assert.equal(j.weekdays[1].visits, 2, 'two Monday visits');
});

test('the report is emailed to the owner, each month on its own', async () => {
  const before = resend.sent.length;
  const r = await k.api('POST', '/api/stats/email', { cookie, body: { from: '2026-01-01', to: '2026-02-28' } });
  assert.equal(r.status, 200, r.text);
  const mail = resend.sent.slice(before).at(-1);
  assert.ok(mail, 'an email went');
  assert.deepEqual(mail.to, [r.json.to]);
  assert.match(mail.subject, /your numbers, January to February 2026/);
  assert.match(mail.text, /January 2026\n {2}Appointment value: \$340/);
  assert.match(mail.text, /February 2026\n {2}Appointment value: \$50/);
  assert.match(mail.text, /Total\n {2}Appointment value: \$390/);
  assert.match(mail.html, /<td[^>]*>Rebooked before leaving<\/td>/);
  assert.match(mail.html, />January</);
});

test('only the owner can see or send the numbers', async () => {
  const d = k.db();
  try {
    const { salt, hash } = hashPassword('a-good-long-passphrase-26');
    d.prepare("INSERT INTO users (name, email, pass_hash, salt, role) VALUES ('Sam', 'sam@salon.example', ?, ?, 'staff')").run(hash, salt);
  } finally { d.close(); }
  const staff = await k.login('sam@salon.example', 'a-good-long-passphrase-26');
  assert.equal((await k.api('GET', '/api/stats', { cookie: staff.cookie })).status, 403);
  assert.equal((await k.api('POST', '/api/stats/email', { cookie: staff.cookie, body: {} })).status, 403);
  assert.equal((await k.api('GET', '/api/stats')).status, 401, 'and nobody signed out');
});

test("the operator's copy goes only to the salon's own owner", async () => {
  const KEY = 'platform-key-for-tests-0123456789';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-stats-shard-'));
  fs.mkdirSync(path.join(dir, 'tenants'), { recursive: true });
  const shard = await startKairo({
    dataDir: dir,
    env: {
      KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: 'kairobookings.test', KAIRO_PLATFORM_KEY: KEY,
      KAIRO_SHARED_RESEND_KEY: resend.fullKey, KAIRO_SHARED_FROM: 'bookings@kairobookings.test', RESEND_API_BASE: resend.base,
    },
  });
  const signed = (method, p, body) => {
    const raw = body === undefined ? '' : JSON.stringify(body);
    const t = Date.now();
    return shard.api(method, p, { body: raw || undefined, headers: { 'x-kairo-signature': `t=${t},v1=${sign(t, method, p, raw, KEY)}`, ...(raw ? { 'content-type': 'application/json' } : {}) } });
  };
  try {
    const { salt, hash } = hashPassword('a-good-long-passphrase-26');
    const made = await signed('POST', '/api/platform/tenants', {
      slug: 'numbers', name: 'Numbers Salon', owner: { name: 'Nina Owner', email: 'nina@salon.example', pass_hash: hash, salt },
      settings: { business_name: 'Numbers Salon', business_email: 'hello@numbers.example' },
    });
    assert.equal(made.status, 200, made.text);

    const before = resend.sent.length;
    const r = await signed('POST', '/api/platform/tenants/numbers/report', { preset: 'last_3_months' });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.sent_to, 'n•••@salon.example', 'masked, and to the owner');
    const mail = resend.sent.slice(before).at(-1);
    assert.deepEqual(mail.to, ['nina@salon.example']);
    assert.match(mail.text, /^Hi Nina,/);

    const biz = await signed('POST', '/api/platform/tenants/numbers/report', { preset: 'this_month', email: 'hello@numbers.example' });
    assert.equal(biz.status, 200, 'its business email is its own too');

    const stranger = await signed('POST', '/api/platform/tenants/numbers/report', { preset: 'this_month', email: 'someone@else.example' });
    assert.equal(stranger.status, 400, 'never to anybody else');
    assert.ok(!resend.sent.some((m) => m.to.includes('someone@else.example')));

    const unsigned = await shard.api('POST', '/api/platform/tenants/numbers/report', { body: { preset: 'this_month' } });
    assert.equal(unsigned.status, 401);
    assert.equal((await signed('POST', '/api/platform/tenants/nobody/report', {})).status, 404);
  } finally {
    await shard.stop();
  }
});
