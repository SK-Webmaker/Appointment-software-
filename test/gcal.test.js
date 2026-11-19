// Google Calendar, both ways (src/gcal.js): the iCal reader on its own, then
// the whole thing against a real Kairo and a stand-in calendar server.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startKairo, openDateAhead } from './helpers/kairo.js';
import { busyTimes, toBlocks, checkCalendarUrl, parseEvents } from '../src/gcal.js';

const DAY = 86400000;
const day = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;
const TZ = 'Australia/Melbourne';

/** Busy blocks for an iCal body, in Melbourne, over a date range. */
function blocksOf(body, from, to) {
  const text = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;
  return toBlocks(busyTimes(text, { tz: TZ, fromDay: day(from), toDay: day(to) }), { tz: TZ, fromDate: from, toDate: to });
}
const ev = (lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
const slim = (bs) => bs.map((b) => `${b.date} ${b.start}-${b.end}`);

// ---------------------------------------------------------------------------
// Reading iCal
// ---------------------------------------------------------------------------

test('a timed event lands at the right local time, in its own zone or in UTC', () => {
  assert.deepEqual(slim(blocksOf(ev(['UID:a', 'DTSTART;TZID=Australia/Melbourne:20261125T093000', 'DTEND;TZID=Australia/Melbourne:20261125T110000']), '2026-11-20', '2026-11-30')),
    ['2026-11-25 570-660']);
  // 22:00 UTC on the 24th is 9 am on the 25th in Melbourne (summer time, +11).
  assert.deepEqual(slim(blocksOf(ev(['UID:b', 'DTSTART:20261124T220000Z', 'DTEND:20261124T230000Z']), '2026-11-20', '2026-11-30')),
    ['2026-11-25 540-600']);
  // A Sydney event is the same clock time as Melbourne; a Perth one is three hours later here.
  assert.deepEqual(slim(blocksOf(ev(['UID:c', 'DTSTART;TZID=Australia/Perth:20261125T090000', 'DTEND;TZID=Australia/Perth:20261125T100000']), '2026-11-20', '2026-11-30')),
    ['2026-11-25 720-780']);
});

test('events marked Free, cancelled ones and zero-length ones block nothing', () => {
  const body = [
    ev(['UID:free', 'DTSTART:20261125T000000Z', 'DTEND:20261125T010000Z', 'TRANSP:TRANSPARENT']),
    ev(['UID:gone', 'DTSTART:20261125T000000Z', 'DTEND:20261125T010000Z', 'STATUS:CANCELLED']),
    ev(['UID:zero', 'DTSTART:20261125T000000Z', 'DTEND:20261125T000000Z']),
  ].join('\r\n');
  assert.deepEqual(blocksOf(body, '2026-11-20', '2026-11-30'), []);
});

test('all-day and overnight events become whole days and split at midnight', () => {
  assert.deepEqual(slim(blocksOf(ev(['UID:hol', 'DTSTART;VALUE=DATE:20261224', 'DTEND;VALUE=DATE:20261227']), '2026-12-20', '2026-12-31')),
    ['2026-12-24 0-1440', '2026-12-25 0-1440', '2026-12-26 0-1440']);
  assert.deepEqual(slim(blocksOf(ev(['UID:late', 'DTSTART;TZID=Australia/Melbourne:20261125T220000', 'DURATION:PT4H']), '2026-11-20', '2026-11-30')),
    ['2026-11-25 1320-1440', '2026-11-26 0-120']);
});

test('a weekly repeat keeps its clock time across daylight saving and honours skipped and moved days', () => {
  // Every Monday 9–10 am Melbourne from 30 Mar 2026 (DST ends 5 Apr), four times;
  // 13 Apr skipped, 20 Apr moved to 2 pm.
  const body = [
    ev(['UID:wk', 'DTSTART;TZID=Australia/Melbourne:20260330T090000', 'DTEND;TZID=Australia/Melbourne:20260330T100000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4', 'EXDATE;TZID=Australia/Melbourne:20260413T090000']),
    ev(['UID:wk', 'RECURRENCE-ID;TZID=Australia/Melbourne:20260420T090000',
      'DTSTART;TZID=Australia/Melbourne:20260420T140000', 'DTEND;TZID=Australia/Melbourne:20260420T150000']),
  ].join('\r\n');
  assert.deepEqual(slim(blocksOf(body, '2026-03-28', '2026-05-10')),
    ['2026-03-30 540-600', '2026-04-06 540-600', '2026-04-20 840-900']);
});

test('UNTIL, INTERVAL, monthly "last Friday" and a series started long ago all expand', () => {
  const fortnightly = ev(['UID:f', 'DTSTART:20261102T000000Z', 'DTEND:20261102T010000Z', 'RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261201T000000Z']);
  assert.deepEqual(slim(blocksOf(fortnightly, '2026-11-01', '2026-12-31')), ['2026-11-02 660-720', '2026-11-16 660-720', '2026-11-30 660-720']);

  const lastFri = ev(['UID:m', 'DTSTART;TZID=Australia/Melbourne:20260130T170000', 'DTEND;TZID=Australia/Melbourne:20260130T180000', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR']);
  assert.deepEqual(slim(blocksOf(lastFri, '2026-11-01', '2027-01-31')), ['2026-11-27 1020-1080', '2026-12-25 1020-1080', '2027-01-29 1020-1080']);

  const daily = ev(['UID:d', 'DTSTART;TZID=Australia/Melbourne:20150101T070000', 'DTEND;TZID=Australia/Melbourne:20150101T073000', 'RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR']);
  const got = blocksOf(daily, '2026-11-23', '2026-11-29');
  assert.deepEqual(slim(got), ['2026-11-23 420-450', '2026-11-24 420-450', '2026-11-25 420-450', '2026-11-26 420-450', '2026-11-27 420-450']);
});

test('alarms inside an event, folded lines and overlapping events are handled', () => {
  const body = [
    ['BEGIN:VEVENT', 'UID:x', 'DTSTART:20261125T000000Z', 'DTEND:20261125T020000Z', 'SUMMARY:Dentist with a very long title that Google folds onto a second line be',
      ' cause it is long', 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'DTSTART:20990101T000000Z', 'END:VALARM', 'END:VEVENT'].join('\r\n'),
    ev(['UID:y', 'DTSTART:20261125T010000Z', 'DTEND:20261125T030000Z']),
  ].join('\r\n');
  const evs = parseEvents(`BEGIN:VCALENDAR\r\n${body}\r\nEND:VCALENDAR`);
  assert.match(evs[0].props.SUMMARY.value, /because it is long$/);
  assert.equal(evs[0].props.DTSTART.value, '20261125T000000Z', 'the alarm\'s fields stay out of the event');
  assert.deepEqual(slim(blocksOf(body, '2026-11-20', '2026-11-30')), ['2026-11-25 660-840'], 'merged into one block');
});

test('only calendar services\' iCal addresses are accepted', () => {
  assert.ok(checkCalendarUrl('https://calendar.google.com/calendar/ical/me%40gmail.com/private-abc123/basic.ics').url);
  assert.ok(checkCalendarUrl('webcal://p52-caldav.icloud.com/published/2/abc').url, 'iCloud\'s webcal link');
  assert.equal(checkCalendarUrl('https://calendar.google.com/calendar/u/0/r').url, null, 'the web page, not the iCal address');
  assert.match(checkCalendarUrl('https://calendar.google.com/calendar/embed?src=me').error, /Secret address in iCal format/);
  for (const bad of ['http://calendar.google.com/calendar/ical/a/b.ics', 'https://169.254.169.254/latest/meta-data', 'https://localhost/x.ics',
    'https://calendar.google.com.evil.example/calendar/ical/a/b.ics', 'https://user:pw@calendar.google.com/calendar/ical/a/b.ics', 'file:///etc/passwd', 'not a url']) {
    assert.equal(checkCalendarUrl(bad).url, null, bad);
  }
});

// ---------------------------------------------------------------------------
// End to end
// ---------------------------------------------------------------------------

let k, cookie, cal, calOrigin;
const date = openDateAhead(4);
const calendar = { status: 200, body: '' };

before(async () => {
  cal = http.createServer((req, res) => {
    res.writeHead(calendar.status, { 'content-type': 'text/calendar' });
    res.end(calendar.body);
  });
  await new Promise((r) => cal.listen(0, '127.0.0.1', r));
  calOrigin = `http://127.0.0.1:${cal.address().port}`;
  k = await startKairo({ env: { KAIRO_GCAL_TEST_ORIGIN: calOrigin } });
  ({ cookie } = await k.login());
  await k.api('PUT', '/api/settings', { cookie, body: { business_tz: TZ } });
});
after(async () => { await k.stop(); cal.close(); });

const compact = date.replace(/-/g, '');
const dentist = ev(['UID:dentist@google.com', `DTSTART;TZID=${TZ}:${compact}T100000`, `DTEND;TZID=${TZ}:${compact}T120000`, 'SUMMARY:Dentist (private)']);
const icsOf = (...events) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
const slotsAt = async (staffId) => {
  const r = await k.api('GET', `/api/public/availability?date=${date}&staff_id=${staffId}&service_ids=9`);
  assert.equal(r.status, 200);
  return r.json.slots.map((s) => s.start_min);
};
const gcalBlocks = async () => (await k.api('GET', `/api/time-blocks?from=${date}&to=${date}`, { cookie })).json.filter((b) => b.source === 'gcal');

let original; // staff 1's slots that day before any calendar is linked
const overlaps = (start, from, to) => start < to && start + 60 > from; // service 9 is an hour

test('busy time from Google hides those slots from the booking page, and only the time is kept', async () => {
  original = await slotsAt(1);
  assert.ok(original.some((m) => overlaps(m, 600, 720)), 'something between 10 and 12 is offered to begin with');

  const bad = await k.api('PUT', '/api/staff/1/calendar', { cookie, body: { import_url: 'https://example.com/cal.ics', import_on: true } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /Secret address in iCal format/);

  calendar.body = icsOf(dentist);
  const on = await k.api('PUT', '/api/staff/1/calendar', { cookie, body: { import_url: `${calOrigin}/basic.ics`, import_on: true } });
  assert.equal(on.status, 200, JSON.stringify(on.json));
  assert.equal(on.json.error, '');
  assert.equal(on.json.busy_count, 1);
  assert.ok(on.json.checked_at);
  assert.ok(!JSON.stringify(on.json).includes('/basic.ics'), 'the secret address never comes back');
  assert.equal(on.json.import_hint, `127.0.0.1:${cal.address().port}`);

  assert.deepEqual(await slotsAt(1), original.filter((m) => !overlaps(m, 600, 720)), 'exactly the slots that overlap the dentist are gone');
  const others = (await k.api('GET', `/api/public/availability?date=${date}&staff_id=2&service_ids=9`)).json.slots;
  assert.ok(others.length > 0, 'other team members are untouched');

  const blocks = await gcalBlocks();
  assert.equal(blocks.length, 1);
  assert.deepEqual([blocks[0].staff_id, blocks[0].start_min, blocks[0].end_min, blocks[0].reason], [1, 600, 720, 'Busy (Google Calendar)']);
  assert.doesNotMatch(JSON.stringify(blocks), /Dentist/, 'personal titles are never stored');

  // Not editable here: it would only come back on the next read.
  assert.equal((await k.api('PUT', `/api/time-blocks/${blocks[0].id}`, { cookie, body: { staff_id: 1, date, start_min: 600, end_min: 630 } })).status, 409);
  assert.equal((await k.api('DELETE', `/api/time-blocks/${blocks[0].id}`, { cookie })).status, 409);
});

test('each read replaces the busy time; a failed read keeps the last good one and says why', async () => {
  calendar.body = icsOf(ev(['UID:gym', `DTSTART;TZID=${TZ}:${compact}T140000`, `DTEND;TZID=${TZ}:${compact}T150000`]));
  let r = await k.api('POST', '/api/staff/1/calendar/sync', { cookie });
  assert.equal(r.json.busy_count, 1);
  assert.deepEqual((await gcalBlocks()).map((b) => b.start_min), [840], 'the dentist is gone, the gym is in');

  calendar.status = 404;
  r = await k.api('POST', '/api/staff/1/calendar/sync', { cookie });
  assert.match(r.json.error, /no longer recognises that address/);
  assert.equal((await gcalBlocks()).length, 1, 'still blocked while Google is unreachable');
  calendar.status = 200;
  r = await k.api('POST', '/api/staff/1/calendar/sync', { cookie });
  assert.equal(r.json.error, '');

  r = await k.api('PUT', '/api/staff/1/calendar', { cookie, body: { import_on: false } });
  assert.equal(r.json.import_on, 0);
  assert.equal(r.json.import_set, 1, 'the address is remembered for switching back on');
  assert.equal((await gcalBlocks()).length, 0, 'switching it off frees the time at once');
  assert.deepEqual(await slotsAt(1), original, 'back to exactly what was offered before');
  r = await k.api('PUT', '/api/staff/1/calendar', { cookie, body: { import_on: true } });
  assert.equal(r.json.busy_count, 1, 'switching back on reads the calendar again straight away');
  await k.api('PUT', '/api/staff/1/calendar', { cookie, body: { import_on: false } });
});

test('the bookings feed is off until switched on, carries the bookings in UTC, and a new link kills the old one', async () => {
  const start = (await slotsAt(1))[0];
  const appt = await k.api('POST', '/api/appointments', { cookie, body: { staff_id: 1, client_id: 1, service_ids: [9], date, start_min: start } });
  assert.equal(appt.status, 200, JSON.stringify(appt.json));

  let st = (await k.api('GET', '/api/staff/1/calendar', { cookie })).json;
  assert.equal(st.feed_on, 0);
  assert.equal(st.feed_url, '');

  st = (await k.api('PUT', '/api/staff/1/calendar', { cookie, body: { feed_on: true } })).json;
  const path = new URL(st.feed_url).pathname;
  assert.match(path, /^\/api\/public\/calendar\/[a-f0-9]{32}\.ics$/);

  const feed = await k.api('GET', path);
  assert.equal(feed.status, 200);
  assert.match(feed.headers.get('content-type'), /text\/calendar/);
  assert.match(feed.text, /^BEGIN:VCALENDAR\r\n/);
  const block = feed.text.split('BEGIN:VEVENT').find((v) => v.includes(`kairo-appt-${appt.json.id}@`));
  assert.ok(block, 'the new booking is in the feed');
  // Melbourne is UTC+11 in summer and +10 in winter.
  const [y, mo, d] = date.split('-').map(Number);
  const want = [11, 10].map((off) => new Date(Date.UTC(y, mo - 1, d, 0, start - off * 60)).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z');
  assert.ok(want.some((w) => block.includes(`DTSTART:${w}`)), `${block} starts at ${want.join(' or ')}`);
  assert.doesNotMatch(feed.text, /Busy \(Google Calendar\)/, 'imported busy time is never sent back to Google');

  const old = path;
  st = (await k.api('PUT', '/api/staff/1/calendar', { cookie, body: { new_link: true } })).json;
  assert.notEqual(new URL(st.feed_url).pathname, old);
  assert.equal((await k.api('GET', old)).status, 404, 'the old link stops working');
  assert.equal((await k.api('GET', new URL(st.feed_url).pathname)).status, 200);

  await k.api('PUT', '/api/staff/1/calendar', { cookie, body: { feed_on: false } });
  assert.equal((await k.api('GET', new URL(st.feed_url).pathname)).status, 404, 'switched off means gone');
  assert.equal((await k.api('GET', '/api/public/calendar/not-a-token.ics')).status, 404);
});

test('team lists never carry the calendar secrets', async () => {
  await k.api('PUT', '/api/staff/1/calendar', { cookie, body: { feed_on: true, import_url: `${calOrigin}/basic.ics`, import_on: true } });
  const list = await k.api('GET', '/api/staff?all=1', { cookie });
  assert.doesNotMatch(JSON.stringify(list.json), /feed_token|import_url|127\.0\.0\.1/);
  assert.equal((await k.api('GET', '/api/staff/999/calendar', { cookie })).status, 404);
});
