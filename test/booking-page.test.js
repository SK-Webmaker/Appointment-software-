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
      cookie: c2,
      // A mobile barber with nothing on file: no shopfront, no landline, no
      // address for a map, nothing written about themselves.
      body: {
        business_name: 'Mobile Barber', business_address: '', brand_tagline: '',
        business_phone: '', business_email: '',
        // On the shared sender, which is what every salon Kairo sells is on.
        // This is the setting that made mail_domain look like a contact.
        notif_from_email: 'bookings@kairobookings.com',
      },
    });
    const p = (await solo.api('GET', '/api/public/info')).json.page_sections;
    assert.equal(p.location, false, 'no address means no Location');
    assert.equal(p.map, false, 'and nothing to get directions to');
    assert.equal(p.about, false, 'nothing written means no About');
    // Not "nothing to show" — this one is off even with a wall of five-stars,
    // because publishing a rating is the owner's decision to make.
    assert.equal(p.reviews, false, 'reviews wait to be switched on');

    // A salon with no phone and no email must get no Contact section — and
    // every salon on the shared sender HAS a mail_domain, so counting that as a
    // way to be contacted gave all of them an empty box. Caught on a real
    // barber who has neither on file, four minutes after it went live.
    const pub = (await solo.api('GET', '/api/public/info')).json;
    assert.ok(!pub.business_phone, 'this salon has no phone');
    assert.ok(pub.mail_domain, 'but it does have a sending domain, like every salon does');
    assert.ok(!p.live.includes('contact'), 'and a sending domain is not a way to reach anybody');

    // Nor is the business email. It is where invoices go, it is often personal,
    // and /api/public/info has never sent it — so a salon whose only contact is
    // an email got a Contact section the page could not fill. Twice.
    await solo.api('PUT', '/api/settings', { cookie: c2, body: { business_email: 'sam@example.test' } });
    const p2 = (await solo.api('GET', '/api/public/info')).json;
    assert.equal(p2.business_email, undefined, 'the owner\'s email is not published');
    assert.ok(!p2.page_sections.live.includes('contact'),
      'and it must not make Contact live, because the page cannot draw it');
    await solo.api('PUT', '/api/settings', { cookie: c2, body: { business_email: '' } });

    // Contact is still what the owner wants — the tick stays on. It is listed
    // as empty, so Settings says why rather than quietly unticking itself.
    assert.equal(p.contact, true, 'the preference is untouched');
    assert.ok(p.empty.includes('contact'), 'and the reason is named');

    // The page draws exactly `live`, so the three opinions cannot diverge again.
    const book = fs.readFileSync(path.join(ROOT, 'public/js/book.js'), 'utf8');
    assert.match(book, /new Set\(p\.live \|\| \[\]\)/,
      'the booking page must draw the server\'s list, not recompute it');
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

  // Reviews are off until asked for, so ask.
  await set({ page_show_reviews: '1' });
  const r = (await info()).reviews;
  assert.equal(r.count, 5);
  assert.equal(r.average, 4.2, 'the one-star is in the average');
  assert.equal(r.distribution[5], 4);
  assert.equal(r.distribution[1], 1, 'and it is visible in the spread');

  // Switched off, the rating is not sent at all — not sent and hidden.
  await set({ page_show_reviews: '0' });
  const off = await info();
  assert.equal(off.reviews.count, 0, 'a rating the owner did not publish is not in the JSON');
  assert.equal(off.reviews.average, 0);
  await set({ page_show_reviews: '1' });
});

test('the owner is shown what the page is doing, not what was saved', async () => {
  // A business that has never opened this card has no page_show_* rows at all,
  // and several sections default to ON. The Settings card drew every box
  // unticked over a page that was showing five sections — and the save writes
  // every box explicitly, so an owner changing one thing switched off four they
  // had never touched.
  //
  // The tick is read from /api/public/info, the booking page's own answer, so
  // it cannot disagree with what a customer sees. This asserts the two sources
  // are the same one.
  const solo = await startKairo();
  try {
    const { cookie: c2 } = await solo.login();
    await solo.api('POST', '/api/setup/skip', { cookie: c2 });
    await solo.api('PUT', '/api/settings', {
      cookie: c2, body: { business_address: '1 Smith Street, Fitzroy VIC 3065', business_phone: '0400000000' },
    });

    const raw = (await solo.api('GET', '/api/settings', { cookie: c2 })).json;
    for (const k of ['page_show_contact', 'page_show_hours', 'page_show_reviews', 'page_show_location']) {
      assert.ok(raw[k] === undefined || raw[k] === '', `${k} is unset until the card is saved — that is the whole trap`);
    }

    const live = (await solo.api('GET', '/api/public/info')).json.page_sections;
    assert.equal(live.contact, true, 'and yet the page is showing Contact');
    assert.equal(live.hours, true);
    assert.equal(live.location, true, 'it has an address, so Location is on');
    assert.equal(live.map, true);
    assert.equal(live.reviews, false, 'the rating is the one that waits to be asked');

    // The settings page must render from `live`. If it ever reads the raw keys
    // again, it will draw these as off.
    const src = fs.readFileSync(path.join(ROOT, 'public/js/pages/settings.js'), 'utf8');
    assert.match(src, /const live = await livePageSections\(/,
      'the boxes must be ticked from what the booking page reports, not from the stored keys');
    assert.ok(!/const live = \{[^}]*page_show_/.test(src),
      'and must not fall back to reading those keys inline');
  } finally {
    await solo.stop();
  }
});

test('the booking page never reads a field the server does not send', async () => {
  // `b.business_email` was read in the Contact section for weeks. It is not a
  // key of /api/public/info and never has been, so the branch could not fire —
  // and because the section still had the phone, nothing looked broken until a
  // salon turned up with an email and no phone. Then it drew an empty box.
  //
  // A missing key is not an error in JavaScript; it is `undefined`, quietly.
  // So the check has to be made deliberately, here, against the real payload.
  const src = fs.readFileSync(path.join(ROOT, 'public/js/book.js'), 'utf8');
  const start = src.indexOf('function liveSections');
  const end = src.indexOf('function wirePageTabs');
  assert.ok(start > 0 && end > start, 'the section code must still be findable');
  // Comments stripped first: this file explains the bug it is guarding against
  // by name, and a scanner that reads its own prose finds a fault in the story
  // rather than in the code.
  const code = src.slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const read = new Set([...code.matchAll(/\bb\.([a-zA-Z_][\w]*)/g)].map((m) => m[1]));
  assert.ok(read.size > 0, 'if this finds nothing the test is not testing anything');

  const sent = new Set(Object.keys(await info()));
  const missing = [...read].filter((k) => !sent.has(k));
  assert.deepEqual(missing, [],
    `the booking page reads ${missing.join(', ')}, which /api/public/info does not send`);
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
