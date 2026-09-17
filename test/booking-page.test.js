// What a booking page carries besides the form: About, Contact, Location,
// Opening Hours and Reviews, with a bar that follows the customer down it.
//
// The lines it holds:
//
//   1. THE WEEK IS READ FROM THE BUSINESS, not typed twice. The hours on the
//      page are the hours bookings are actually taken in, or the page is
//      telling people to turn up to a locked door.
//   2. A SECTION WITH NOTHING IN IT DOES NOT APPEAR. An empty "Location" tab
//      is worse than no tab: it reads as a page that is broken.
//   3. THE RATING INCLUDES THE BAD ONES. An average computed from the reviews
//      a business liked is not an average.
//   4. THE PUBLIC PAGE LEAKS NOTHING. No client names, no phone numbers, no
//      internal ids beyond what booking needs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startKairo } from './helpers/kairo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let k, cookie;
const api = (m, p, body) => k.api(m, p, { cookie, body });
const info = async () => (await k.api('GET', '/api/public/info')).json;
const set = (body) => api('PUT', '/api/settings', body);

before(async () => {
  k = await startKairo();
  ({ cookie } = await k.login());
  await api('POST', '/api/setup/skip');
  await set({
    business_name: 'Stanmore Cuts', business_tz: 'Australia/Melbourne',
    business_address: 'Budds Lane, Stanmore NSW 2048', business_phone: '(02) 9557 1234',
    booking_enabled: '1',
    open_days: '2,3,4,5,6', open_min: '540', close_min: '1020',
    day_rules: JSON.stringify({
      2: { open_min: 780, close_min: 1140 },
      6: { open_min: 600, close_min: 1080 },
    }),
  });
});
after(async () => { await k.stop(); });

test('the week on the page is the week bookings are taken in', async () => {
  const h = (await info()).hours;
  assert.equal(h.length, 7);
  // Monday first, because that is how an opening-hours sign reads. Sunday is
  // day 0 in every date library, which is not a reason to start a list there.
  assert.deepEqual(h.map((d) => d.label),
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

  const by = Object.fromEntries(h.map((d) => [d.label, d]));
  assert.equal(by.Monday.closed, true, 'a day they do not open is closed, not missing');
  assert.equal(by.Sunday.closed, true);
  assert.equal(by.Tuesday.closed, false);
  // The per-day override, not the salon default.
  assert.equal(by.Tuesday.open_min, 780);
  assert.equal(by.Tuesday.close_min, 1140);
  // A day with no override falls back to the salon's own hours.
  assert.equal(by.Wednesday.open_min, 540);
  assert.equal(by.Saturday.open_min, 600);
  assert.equal(by.Monday.open_min, null, 'a closed day has no times to show');
});

test('closing a day on the page closes it for bookings too', async () => {
  // The two cannot drift: they are the same setting read twice.
  await set({ open_days: '3,4,5' });
  const h = Object.fromEntries((await info()).hours.map((d) => [d.label, d.closed]));
  assert.equal(h.Tuesday, true);
  assert.equal(h.Wednesday, false);
  await set({ open_days: '2,3,4,5,6' });
});

test('a section with nothing to put in it does not turn itself on', async () => {
  const solo = await startKairo();
  // try/finally: a failing assertion here would leave the child server alive
  // and hang the suite to its timeout rather than failing it.
  try {
    const { cookie: c2 } = await solo.login();
    await solo.api('POST', '/api/setup/skip', { cookie: c2 });
    await solo.api('PUT', '/api/settings', {
      cookie: c2, body: { business_name: 'Mobile Barber', business_address: '', brand_tagline: '' },
    });
    const p = (await solo.api('GET', '/api/public/info')).json.page_sections;
    assert.equal(p.location, false, 'no address means no Location');
    assert.equal(p.map, false, 'and nothing to get directions to');
    assert.equal(p.about, false, 'nothing written means no About');
  } finally {
    await solo.stop();
  }
});

test('an owner can turn any of it on and off', async () => {
  await set({
    page_show_about: '1', page_show_contact: '0',
    page_show_location: '1', page_show_map: '0', page_show_hours: '1', page_show_reviews: '0',
    page_about_text: 'A small studio in Stanmore.',
  });
  const p = (await info()).page_sections;
  assert.equal(p.about, true);
  assert.equal(p.contact, false);
  assert.equal(p.location, true);
  assert.equal(p.map, false, 'the address can show without the directions button');
  assert.equal(p.hours, true);
  assert.equal(p.reviews, false);
  assert.equal(p.about_text, 'A small studio in Stanmore.');
  await set({ page_show_contact: '1', page_show_reviews: '1', page_show_map: '1' });
});

test('the rating counts every review, including the ones nobody wants', async () => {
  const d = k.db();
  const staff = Number(d.prepare("INSERT INTO staff (name) VALUES ('Sam')").run().lastInsertRowid);
  const svc = Number(d.prepare("INSERT INTO services (name, duration_min, price_cents) VALUES ('Cut', 30, 4500)").run().lastInsertRowid);
  const client = Number(d.prepare("INSERT INTO clients (first_name, last_name) VALUES ('Reviewer','One')").run().lastInsertRowid);
  // Four fives and a one: 4.2, not 5.
  [5, 5, 5, 5, 1].forEach((rating, i) => {
    const appt = Number(d.prepare(`INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status)
      VALUES (?, ?, ?, ?, 600, 630, 'completed')`).run(client, staff, svc, `2026-01-0${i + 1}`).lastInsertRowid);
    d.prepare('INSERT INTO reviews (appointment_id, client_id, staff_id, rating) VALUES (?, ?, ?, ?)')
      .run(appt, client, staff, rating);
  });
  d.close();

  const r = (await info()).reviews;
  assert.equal(r.count, 5);
  assert.equal(r.average, 4.2, 'the one-star is in the average');
  assert.equal(r.distribution[5], 4);
  assert.equal(r.distribution[1], 1, 'and it is visible in the spread');
});

test('the filled stars keep their own colour', () => {
  // A 4.6 rendered as five identical grey stars, and every assertion above still
  // passed: the number was right, the fill width was right, and the colour that
  // makes the fill visible was being overwritten.
  //
  // The cause was `.bk-rev-score span`, written for the "9 reviews" line. The
  // stars are spans inside that block, so the loose selector matched them too —
  // and at (0,1,1) it out-specifies `.bk-stars-on` at (0,1,0). Nothing in the
  // markup was wrong. The product's claim that it will not round 4.6 up to five
  // was true in the DOM and false on the screen.
  //
  // So this asserts the shape of the rule rather than the rendering: no bare
  // element selector under .bk-rev-score, because any of them silently wins.
  const css = fs.readFileSync(path.join(ROOT, 'public/css/app.css'), 'utf8');
  const loose = [...css.matchAll(/\.bk-rev-score\s*>?\s*([a-z][\w-]*)\s*(?:,|\{)/gi)].map((m) => m[1]);
  assert.deepEqual(loose, [], `.bk-rev-score must not style bare elements (found: ${loose.join(', ')}) — `
    + 'the stars live in there and lose the specificity fight');

  const rule = (sel) => {
    const m = css.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`));
    assert.ok(m, `${sel} has no rule at all`);
    return m[1];
  };
  const on = rule('.bk-stars-on').match(/(?:^|[^-])color:\s*([^;]+);/);
  const off = rule('.bk-stars-off').match(/(?:^|[^-])color:\s*([^;]+);/);
  assert.ok(on && off, 'both halves of the star row must set a colour');
  assert.notEqual(on[1].trim(), off[1].trim(), 'a fill the same colour as the gap is not a fill');
});

test('the public page still says nothing about any client', async () => {
  const raw = JSON.stringify(await info());
  assert.ok(!raw.includes('Reviewer'), 'no reviewer names');
  assert.ok(!raw.includes('review_token') && !raw.includes('cancel_token'));
  // The summary is numbers only — no comments, no ids, nothing to join on.
  const r = (await info()).reviews;
  assert.deepEqual(Object.keys(r).sort(), ['average', 'count', 'distribution']);
});
