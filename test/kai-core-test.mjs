// The behaviours the booking reader sits in front of. It is read BEFORE the
// change catalogue and BEFORE navigation, so everything downstream of it is
// worth re-checking after touching that order.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The repo, found from this file rather than hard-coded, so the suite survives
// being run from anywhere — and being run in a container that is not the one it
// was written in.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4949, B = `http://localhost:${PORT}`, DIR = '/tmp/kairo-core';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { console.log((c ? '✅' : '❌') + ' ' + n + (e ? ' — ' + e : '')); c ? pass++ : fail++; };
fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'],
  { cwd: ROOT, env: { ...process.env, PORT: String(PORT), KAIRO_DATA_DIR: DIR }, stdio: ['ignore','pipe','pipe'] });
srv.stdout.on('data', () => {}); srv.stderr.on('data', () => {});
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${B}/api/version`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
let cookie = '';
const j = async (m, p, b) => {
  const h = {}; if (cookie) h.cookie = cookie;
  if (b !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(B + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) });
  if (!cookie && r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
};
const say = async (q) => (await j('POST', '/api/ask/do', { q })).data;
const S_ = async () => (await j('GET', '/api/settings')).data;
const BASE = { open_days: '1,2,3,4,5', open_min: '540', close_min: '1020', day_rules: '{}',
  booking_enabled: '1', waitlist_enabled: '0', reminder_hours: '12', chan_reminder: 'email',
  brand_scheme: 'midnight', tax_rate: '0', slot_interval: '15' };
const reset = () => j('PUT', '/api/settings', BASE);
try {
  await j('POST', '/api/auth/login', { email: 'admin@kairo.local', password: 'admin123' });
  await j('POST', '/api/setup/skip', {});
  await j('PUT', '/api/settings', { business_tz: 'Australia/Melbourne' });

  console.log('\n-- changes still happen --');
  for (const [key, q, want] of [
    ['open_days', 'close on Mondays', '2,3,4,5'],
    ['open_days', 'we only open Thursday and Friday', '4,5'],
    ['booking_enabled', 'turn off online booking', '0'],
    ['waitlist_enabled', 'turn the waitlist on', '1'],
    ['reminder_hours', 'send reminders 48 hours before', '48'],
    ['chan_reminder', 'send reminders by text', 'sms'],
    ['brand_scheme', 'make my booking page cream', 'cream'],
    ['tax_rate', 'set GST to 10%', '10'],
    ['slot_interval', 'make my slots 30 minutes', '30'],
  ]) { await reset(); const r = await say(q);
    ok(`"${q}"`, r.kind === 'done' && String((await S_())[key]) === want, `${r.kind}: ${(await S_())[key]}`); }

  await reset();
  const sun = await say('change 11 a.m. to 4 p.m. hours on a Sunday to 2 to 6');
  ok('the sentence this all started with',
    sun.kind === 'done' && JSON.parse((await S_()).day_rules)['0']?.open_min === 840, `${sun.kind}: ${sun.said}`);

  console.log('\n-- compound and undo --');
  await reset();
  const two = await say('close Mondays and open Saturday 10 to 3');
  ok('two in one breath', two.kind === 'done' && (await S_()).open_days === '2,3,4,5,6', (await S_()).open_days);
  await j('POST', '/api/ask/undo', { token: two.undo_token });
  const back = await S_();
  ok('one undo puts both back', back.open_days === '1,2,3,4,5' && back.day_rules === '{}', `${back.open_days} ${back.day_rules}`);
  await reset(); await say('close on Mondays');
  const u = await say('undo that');
  ok('"undo that" works', u.kind === 'undone' && (await S_()).open_days === '1,2,3,4,5', u.kind);

  console.log('\n-- navigation still works --');
  for (const [q, re] of [
    ['show me my calendar in two days', /^#\/calendar\?date=\d{4}-\d{2}-\d{2}$/],
    ["what's on tomorrow", /^#\/calendar\?date=/],
    ['take me to my clients', /^#\/clients$/],
    ['where do I change my logo', /^#\/settings\?open=brand$/],
    ['open my no-show settings', /^#\/settings\?open=noshow$/],
    ['go to billing', /^#\/invoices$/],
  ]) { const r = await say(q); ok(`"${q}"`, r.kind === 'went' && re.test(r.href || ''), `${r.kind}: ${r.href}`); }

  console.log('\n-- refusals hold --');
  for (const q of ['what time do we close on Friday', 'what did we take last week', 'who owes me',
    'send everyone a text about the sale', 'delete all my clients', 'qwertyuiop asdf']) {
    await reset(); const before = JSON.stringify(await S_()); const r = await say(q);
    ok(`"${q}" changes nothing`, r.kind === 'unknown' && JSON.stringify(await S_()) === before, `${r.kind}: ${r.said}`);
  }
  await reset();
  const look = await say('open my calendar on Saturday');
  ok('looking at a day is not trading on it',
    look.kind === 'went' && (await S_()).open_days === '1,2,3,4,5', `${look.kind} ${(await S_()).open_days}`);
  const already = await say('close on Sunday');
  ok('already-true is said, not misread', already.kind === 'already', `${already.kind}: ${already.said}`);

  console.log('\n-- the voice --');
  for (const [q, turn] of [['close on Mondays', 0], ['open Saturday 10 to 3', 1], ['qwertyuiop', 5]]) {
    const r = (await j('POST', '/api/ask/do', { q, turn })).data;
    ok(`"${q}" — warm ends with said`, String(r.warm || '').endsWith(String(r.said || '')), `${r.warm}`);
  }
} catch (e) { console.error('\n💥 ' + (e?.stack || e)); fail++; }
srv.kill('SIGKILL');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
