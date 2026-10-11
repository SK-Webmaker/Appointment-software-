// The how-to videos, the tour, and the look of the thing.
//
// The videos are only any use if an iPhone will play them, and Safari will not
// play a video whose server can't answer a byte range: it asks for "bytes=0-1"
// first and gives up on a plain 200. So the range answers are tested here, not
// just that the file exists.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startKairo, ROOT } from './helpers/kairo.js';

const VIDEO_DIR = path.join(ROOT, 'public', 'videos');
const SMS = 'kairo-sms-setup.mp4';
let k;

before(async () => { k = await startKairo(); });
after(async () => { await k?.stop(); });

const get = (p, headers = {}, method = 'GET') => fetch(k.base + p, { method, headers });

test('both videos and their stills are there, and start playing before they finish downloading', () => {
  for (const name of ['kairo-welcome', 'kairo-sms-setup']) {
    const mp4 = fs.readFileSync(path.join(VIDEO_DIR, `${name}.mp4`));
    assert.ok(fs.statSync(path.join(VIDEO_DIR, `${name}.jpg`)).size > 5000, `${name}.jpg`);
    assert.equal(mp4.subarray(4, 8).toString(), 'ftyp', `${name} is an mp4`);
    // "faststart": the index comes before the picture, so playback begins at once.
    const moov = mp4.indexOf('moov');
    const mdat = mp4.indexOf('mdat');
    assert.ok(moov > 0 && moov < mdat, `${name} has its index first`);
    assert.ok(mp4.length < 10 * 1024 * 1024, `${name} stays small enough for a phone`);
  }
});

test('a video is served in byte ranges, the way Safari asks for it', async () => {
  const size = fs.statSync(path.join(VIDEO_DIR, SMS)).size;
  const probe = await get(`/videos/${SMS}`, { range: 'bytes=0-1' });
  assert.equal(probe.status, 206);
  assert.equal(probe.headers.get('content-type'), 'video/mp4');
  assert.equal(probe.headers.get('content-range'), `bytes 0-1/${size}`);
  assert.equal((await probe.arrayBuffer()).byteLength, 2);

  const tail = await get(`/videos/${SMS}`, { range: 'bytes=-100' });
  assert.equal(tail.status, 206);
  assert.equal(tail.headers.get('content-range'), `bytes ${size - 100}-${size - 1}/${size}`);
  assert.equal((await tail.arrayBuffer()).byteLength, 100);

  const open = await get(`/videos/${SMS}`, { range: `bytes=${size - 10}-` });
  assert.equal(open.status, 206);
  assert.equal((await open.arrayBuffer()).byteLength, 10);

  const past = await get(`/videos/${SMS}`, { range: `bytes=${size + 5}-` });
  assert.equal(past.status, 416);
  assert.equal(past.headers.get('content-range'), `bytes */${size}`);
  await past.arrayBuffer();

  const whole = await get(`/videos/${SMS}`, {}, 'HEAD');
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get('accept-ranges'), 'bytes');
  assert.equal(Number(whole.headers.get('content-length')), size);
});

test('the stills are served as pictures, and a missing video is a 404', async () => {
  const jpg = await get('/videos/kairo-welcome.jpg');
  assert.equal(jpg.status, 200);
  assert.equal(jpg.headers.get('content-type'), 'image/jpeg');
  await jpg.arrayBuffer();
  const none = await get('/videos/nope.mp4', { range: 'bytes=0-1' });
  assert.equal(none.status, 404);
  await none.arrayBuffer();
});

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('the tour visits every page in the menu', () => {
  const app = read('public/js/app.js');
  const keys = [...app.matchAll(/const nav(?:Main|Manage) = \[([^\]]+)\]/g)]
    .flatMap((m) => m[1].match(/'([a-z]+)'/g).map((q) => q.slice(1, -1)));
  assert.ok(keys.length >= 12, 'found the menu');
  const tour = read('public/js/tour.js');
  const visited = new Set([...tour.matchAll(/nav\('([a-z]+)'\)/g)].map((m) => m[1]));
  for (const key of keys) assert.ok(visited.has(key), `the tour skips ${key}`);
  for (const sel of ['a[href="/book"]', '#kai-btn', '#quick-new']) assert.ok(tour.includes(sel), `the tour skips ${sel}`);
});

test('text setup offers the video everywhere an owner meets it', () => {
  assert.match(read('public/js/pages/sms-setup.js'), /videoCard\('sms'/);
  assert.match(read('public/js/pages/settings.js'), /videoCard\('sms'/);
  assert.match(read('public/js/pages/help.js'), /videoCard\('sms'/);
  assert.match(read('public/js/pages/help.js'), /videoCard\('welcome'/);
  assert.match(read('public/js/wizard.js'), /\/videos\/kairo-welcome\.mp4/);
  assert.match(read('src/checklist.js'), /one-minute video/);
  // The old path, from before Settings had sections, is gone everywhere.
  for (const f of ['public/js/pages/sms-setup.js', 'public/js/wizard.js', 'public/js/pages/settings.js', 'public/js/app.js']) {
    assert.doesNotMatch(read(f), /Settings → (SMS|Security)\b/, f);
  }
});

test('no emoji in anything an owner or a client reads', () => {
  // Pictographs read as machine-made in a product people pay for. Icons are
  // drawn; stars and ticks in plain text are typography, and allowed.
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}]/u;
  const ALLOWED = /[★☆✓]/gu;
  const files = [
    ...fs.readdirSync(path.join(ROOT, 'public/js')).filter((f) => f.endsWith('.js')).map((f) => `public/js/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'public/js/pages')).filter((f) => f.endsWith('.js')).map((f) => `public/js/pages/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'public')).filter((f) => f.endsWith('.html')).map((f) => `public/${f}`),
    ...['src/notify.js', 'src/email-html.js', 'src/api.js', 'src/checklist.js', 'platform/notify.js', 'platform/public/app.js'],
  ];
  const hits = [];
  for (const f of files) {
    read(f).split('\n').forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      if (EMOJI.test(line.replace(ALLOWED, ''))) hits.push(`${f}:${i + 1}: ${t.slice(0, 80)}`);
    });
  }
  assert.deepEqual(hits, []);
});
