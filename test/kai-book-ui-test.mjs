// The last step, in a real browser: say it, and the booking form is in front of
// you with everything already chosen.
//
// The server suite proves Kai builds the right URL. This proves the URL lands —
// that the form opens, that the fields really are filled in, and above all that
// NOTHING IS BOOKED until somebody presses the button. That last one is the
// whole reason this feature stops where it does.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The repo, found from this file rather than hard-coded, so the suite survives
// being run from anywhere — and being run in a container that is not the one it
// was written in.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Playwright is a DEV dependency and deliberately not one of Kairo's — the
// product ships with none at all. Install it where you like and point
// KAIRO_PW at it, or drop it in test/node_modules; without it this suite says
// so and stands down rather than failing in a way that looks like a bug.
// npm walks up to the nearest package.json, so an install run from test/ lands
// in the repo's own node_modules. Both are checked rather than insisting on one.
const PW_PATH = [
  process.env.KAIRO_PW,
  path.join(ROOT, 'test', 'node_modules', 'playwright-core', 'index.js'),
  path.join(ROOT, 'node_modules', 'playwright-core', 'index.js'),
].find((f) => f && fs.existsSync(f));
if (!PW_PATH) {
  console.log('\n⚠️  SKIPPED — no playwright-core. Install it with'
    + ' "npm i --no-save playwright-core", or point KAIRO_PW at one.');
  console.log('\n0 passed, 0 failed');
  process.exit(0);
}
const pkg = await import(PW_PATH);
const { chromium } = pkg.default || pkg;

const PORT = 4947;
const B = `http://localhost:${PORT}`;
const DIR = '/tmp/kairo-book-ui';
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
const countAppts = async () =>
  (await json('GET', '/api/appointments?from=2000-01-01&to=2099-01-01')).data.length;

const { db } = await import(`${ROOT}/src/db.js`);

let browser;
try {
  await json('POST', '/api/auth/login', { email: 'admin@kairo.local', password: 'admin123' });
  await json('POST', '/api/setup/skip', {});
  await json('PUT', '/api/settings', {
    business_name: 'Glow Bar', open_days: '1,2,3,4,5',
    open_min: '540', close_min: '1020', day_rules: '{}',
  });
  db.prepare("INSERT INTO clients (first_name, last_name, phone) VALUES ('Wilhelmina','Baptiste','0400010003')").run();
  db.prepare("INSERT INTO clients (first_name, last_name, phone) VALUES ('Sarah','Wilson','0400010001')").run();
  db.prepare("INSERT INTO clients (first_name, last_name, phone) VALUES ('Sarah','Jones','0400010002')").run();
  const svc = db.prepare('SELECT id, name, duration_min FROM services WHERE active = 1 LIMIT 1').get();

  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await p.goto(`${B}/`, { waitUntil: 'networkidle' });
  await p.fill('#login-form input[name=email]', 'admin@kairo.local');
  await p.fill('#login-form input[name=password]', 'admin123');
  await p.click('#login-form button[type=submit]');
  await p.waitForTimeout(2400);

  console.log('\n── 1. say it, and the form is in front of you');
  {
    const before = await countAppts();
    await p.keyboard.press('Control+k');
    await p.waitForTimeout(600);
    await p.fill('#kai-q', `book Wilhelmina in for a ${svc.name} on Friday at 2`);
    await p.waitForTimeout(1000);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(2600);

    ok('the booking form opened', Boolean(await p.$('#appt-form')), '');
    ok('titled as a new appointment',
      /New appointment/i.test(await p.textContent('.modal-head, .modal h3, .modal-title').catch(() => '')),
      await p.textContent('.modal-head, .modal h3, .modal-title').catch(() => '(no title)'));
    ok('with the client already picked',
      (await p.inputValue('#client-search')) === 'Wilhelmina Baptiste',
      await p.inputValue('#client-search'));
    ok('and really selected, not just typed',
      (await p.inputValue('#appt-form [name=client_id]')) !== '',
      await p.inputValue('#appt-form [name=client_id]'));
    ok('the service already chosen',
      (await p.inputValue('#svc-list .svc-sel')) === String(svc.id),
      await p.inputValue('#svc-list .svc-sel'));
    ok('two in the afternoon',
      (await p.inputValue('#appt-form [name=start_min]')) === '840',
      await p.inputValue('#appt-form [name=start_min]'));
    ok('on a Friday',
      new Date(`${await p.inputValue('#appt-form [name=date]')}T12:00:00`).getDay() === 5,
      await p.inputValue('#appt-form [name=date]'));
    ok('the duration came from the service',
      (await p.inputValue('#appt-form [name=duration]')) === String(svc.duration_min),
      await p.inputValue('#appt-form [name=duration]'));

    // The one that matters.
    ok('and NOTHING has been booked', (await countAppts()) === before, `${before} → ${await countAppts()}`);
    ok('there is a Book button to press', Boolean(await p.$('#appt-save')), '');
    ok('which says Book, not Save',
      /Book appointment/i.test(await p.textContent('#appt-save')), await p.textContent('#appt-save'));
  }

  console.log('\n── 2. and pressing it books exactly that');
  {
    const before = await countAppts();
    await p.click('#appt-save');
    await p.waitForTimeout(2600);
    // A booking asks who to tell before it saves. Answer it the quiet way.
    const quiet = await p.$('button:has-text("Don\'t send")');
    if (quiet) { await quiet.click(); await p.waitForTimeout(2000); }
    ok('one appointment, made deliberately', (await countAppts()) === before + 1,
      `${before} → ${await countAppts()}`);
    const made = (await json('GET', '/api/appointments?from=2000-01-01&to=2099-01-01')).data
      .find((a) => a.start_min === 840);
    ok('for the person Kai filled in', Boolean(made), JSON.stringify(made || null).slice(0, 120));
  }

  console.log('\n── 3. the instruction does not survive a refresh');
  {
    // Left in the address bar, a refresh — or the back button — re-opens a form
    // the owner has already dealt with, which is how somebody books the same
    // person twice.
    const hash = await p.evaluate(() => location.hash);
    ok('the address bar is back to a plain calendar day',
      /^#\/calendar\?date=\d{4}-\d{2}-\d{2}$/.test(hash), hash);
    const before = await countAppts();
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    ok('and a refresh opens no form', (await p.$('#appt-form')) === null, '');
    ok('and books nothing', (await countAppts()) === before, `${before} → ${await countAppts()}`);
  }

  console.log('\n── 4. a name Kai could not place is typed in, not invented');
  {
    await p.keyboard.press('Control+k');
    await p.waitForTimeout(600);
    await p.fill('#kai-q', `book Jodie in for a ${svc.name} tomorrow at 3`);
    await p.waitForTimeout(1000);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(2600);
    ok('the form opened', Boolean(await p.$('#appt-form')), '');
    ok('with the name Kai heard', (await p.inputValue('#client-search')) === 'Jodie',
      await p.inputValue('#client-search'));
    ok('but no client chosen for them',
      (await p.inputValue('#appt-form [name=client_id]')) === '',
      await p.inputValue('#appt-form [name=client_id]'));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
  }

  console.log('\n── 5. two Sarahs: it asks, and the answer opens that one');
  {
    await p.keyboard.press('Control+k');
    await p.waitForTimeout(600);
    await p.fill('#kai-q', `book Sarah in for a ${svc.name} on Friday at 11`);
    await p.waitForTimeout(1000);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(2600);

    const opts = await p.$$('[data-pick]');
    ok('it asked which Sarah', opts.length === 2, String(opts.length));
    ok('naming both', /Sarah Wilson/.test(await p.textContent('#kai-list'))
      && /Sarah Jones/.test(await p.textContent('#kai-list')), '');
    ok('and nothing was booked while it asked',
      (await p.$('#appt-form')) === null, '');

    const before = await countAppts();
    await p.$$eval('[data-pick]', (els) => els[0].click());
    await p.waitForTimeout(2600);
    ok('picking one opens that one\'s form', Boolean(await p.$('#appt-form')), '');
    ok('for a Sarah', /^Sarah /.test(await p.inputValue('#client-search')),
      await p.inputValue('#client-search'));
    ok('and still books nothing on its own', (await countAppts()) === before,
      `${before} → ${await countAppts()}`);
    await p.keyboard.press('Escape');
  }

  console.log('\n── 6. nothing broken');
  {
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const real = errs.filter((e) => !/401|Failed to fetch/.test(e));
    ok('no page errors', real.length === 0, real.join(' | ').slice(0, 200));
    ok('the page never scrolls sideways',
      (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0, '');
  }
} catch (err) {
  console.error('\n💥 ' + (err?.stack || err));
  fail++;
}

await browser?.close().catch(() => {});
srv.kill('SIGKILL');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
