// The sample salon, and getting rid of it.
//
// Kairo seeds a demo business on a fresh install so the screens are not empty
// while somebody looks around. That is useful for an hour and dangerous for
// ever afterwards: a real owner cannot tell their first real client from Jeanen
// Brooks, the dashboard reports revenue that never happened, and an automation
// switched on in week one tries to text fourteen people who do not exist.
//
// What this suite holds to:
//
//   1. SKIPPING SETUP MEANS STARTING EMPTY. "Skip for now" used to keep the
//      demo salon. The word means what it says now.
//   2. EVERY SAMPLE ROW SAYS IT IS ONE. Nothing seeded is unlabelled, so the
//      screen can mark it and the delete can find it.
//   3. REMOVAL IS SCOPED TO THE FLAG. An owner who added a real client while
//      looking around keeps it — every time, no exceptions. This is the one
//      that would cost somebody their business if it were wrong.
//   4. SAMPLES ARE NEVER MESSAGED. They are as un-contactable as an opt-out.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4948;
const B = `http://localhost:${PORT}`;
const DIR = '/tmp/kairo-demo-data-test';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { console.log((c ? '✅' : '❌') + ' ' + n + (e ? ' — ' + e : '')); c ? pass++ : fail++; };

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
process.env.KAIRO_DATA_DIR = DIR;

const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), KAIRO_DATA_DIR: DIR, KAIRO_RATELIMIT: 'off' },
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
const clients = async () => (await json('GET', '/api/clients')).data;
const services = async () => (await json('GET', '/api/services')).data;
const staff = async () => (await json('GET', '/api/staff')).data;

const { db, seedDemo, clearBusinessData } = await import(`${ROOT}/src/db.js`);
const n = (sql) => db.prepare(sql).get().n;
const reseed = () => { clearBusinessData(); seedDemo(); };

try {
  await json('POST', '/api/auth/login', { email: 'admin@kairo.local', password: 'admin123' });

  console.log('\n── 1. a fresh install seeds samples, and says they are samples');
  {
    const list = await clients();
    ok('there are sample clients to look at', list.length > 0, String(list.length));
    ok('and every single one is flagged', list.every((c) => c.is_demo === 1),
      `${list.filter((c) => !c.is_demo).length} unflagged`);
    // Unflagged seed rows are the failure mode that matters: the screen cannot
    // label them and the delete cannot find them.
    ok('so are the sample services', n('SELECT COUNT(*) AS n FROM services WHERE is_demo = 0') === 0);
    ok('so is the sample team', n('SELECT COUNT(*) AS n FROM staff WHERE is_demo = 0') === 0);
    ok('so is the sample stock', n('SELECT COUNT(*) AS n FROM products WHERE is_demo = 0') === 0);
    ok('so is the sample history', n("SELECT COUNT(*) AS n FROM appointments WHERE is_demo = 0") === 0);

    const me = (await json('GET', '/api/auth/me')).data;
    ok('and the session says so, so the page can warn', me.has_demo_data === true, String(me.has_demo_data));
  }

  console.log('\n── 2. real data added while looking around SURVIVES the clean-up');
  {
    // The one that would cost somebody their business if it were wrong.
    const real = (await json('POST', '/api/clients', {
      first_name: 'Real', last_name: 'Person', phone: '0400999888', email: 'real@example.org',
    })).data;
    const realSvc = (await json('POST', '/api/services', {
      name: 'A real service', duration_min: 30, price: 50, price_type: 'fixed',
    })).data;
    const realStaff = (await json('POST', '/api/staff', { name: 'A real stylist' })).data;

    const before = (await clients()).length;
    const cleared = await json('POST', '/api/demo/clear', {});
    ok('removing the samples succeeds', cleared.status === 200, String(cleared.status));

    const after = await clients();
    ok('every sample is gone', after.every((c) => !c.is_demo), JSON.stringify(after.map((c) => c.first_name)));
    ok('the real client is still there', after.some((c) => c.id === real.id),
      `${before} → ${after.length}`);
    ok('and it is exactly the one real client', after.length === 1, String(after.length));
    ok('the real service survives', (await services()).some((x) => x.id === realSvc.id));
    ok('the real team member survives', (await staff()).some((x) => x.id === realStaff.id));
    ok('and nothing of the sample business is left',
      n('SELECT COUNT(*) AS n FROM services WHERE is_demo = 1') === 0
      && n('SELECT COUNT(*) AS n FROM staff WHERE is_demo = 1') === 0
      && n('SELECT COUNT(*) AS n FROM appointments WHERE is_demo = 1') === 0
      && n('SELECT COUNT(*) AS n FROM products WHERE is_demo = 1') === 0);

    // Nothing may be left pointing at a person who no longer exists — a stray
    // invoice keeps reporting revenue from a client the owner cannot open.
    ok('no invoice is left orphaned',
      n('SELECT COUNT(*) AS n FROM invoices WHERE client_id NOT IN (SELECT id FROM clients)') === 0);
    ok('no review is left orphaned',
      n('SELECT COUNT(*) AS n FROM reviews WHERE client_id NOT IN (SELECT id FROM clients)') === 0);
    ok('no message is left orphaned',
      n("SELECT COUNT(*) AS n FROM messages WHERE client_id != '' AND client_id NOT IN (SELECT id FROM clients)") === 0);

    const me = (await json('GET', '/api/auth/me')).data;
    ok('and the session stops warning', me.has_demo_data === false, String(me.has_demo_data));
  }

  console.log('\n── 3. "Skip for now" means starting empty, not inheriting a fake salon');
  {
    reseed();
    ok('samples are back for this check', (await clients()).length > 0);
    const r = await json('POST', '/api/setup/skip', {});
    ok('skip succeeds', r.status === 200, String(r.status));
    ok('and leaves no clients at all', (await clients()).length === 0);
    ok('no services', (await services()).length === 0);
    ok('no team', (await staff()).length === 0);
    ok('and setup is marked done', (await json('GET', '/api/settings')).data.setup_complete === '1');
  }

  console.log('\n── 4. finishing the wizard the recommended way starts clean');
  {
    // The welcome screen asks outright, and "clear it out" is the default and
    // the recommendation. The other answer is honoured too — that is section
    // 5b, and it is the reason this one no longer asserts "whatever they said".
    reseed();
    const r = await json('POST', '/api/setup/apply', {
      fresh: true,
      settings: { business_name: 'Real Business' },
      team: [{ name: 'Owner', title: 'Stylist' }],
      services: [{ name: 'Consultation', duration_min: 15, price: 0, price_type: 'free' }],
    });
    ok('the wizard applies', r.status === 200, String(r.status));
    const after = await clients();
    ok('the samples go', after.length === 0, JSON.stringify(after.map((c) => c.first_name)));
    ok('and what the owner typed is what is left',
      (await services()).length === 1 && (await staff()).length === 1,
      `${(await services()).length} services, ${(await staff()).length} staff`);
  }

  console.log('\n── 5. a sample is never messaged');
  {
    reseed();
    const { candidatesFor, saveAutomation } = await import(`${ROOT}/src/automations.js`);
    saveAutomation('lapsed_winback', { enabled: 1 });

    // The demo dataset matches no automation on its own — everybody in it has
    // been in recently. So build somebody who WOULD be chased: three visits on
    // a monthly rhythm, and then four months of silence.
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return d.toISOString().slice(0, 10);
    };
    const svc = db.prepare('SELECT id, duration_min FROM services LIMIT 1').get();
    const who = db.prepare('SELECT id FROM staff LIMIT 1').get();
    const lapsed = Number(db.prepare(
      "INSERT INTO clients (first_name, last_name, phone, email) VALUES ('Lapsed','Regular','0400111222','lapsed@example.org')"
    ).run().lastInsertRowid);
    for (const back of [180, 150, 120]) {
      db.prepare(`INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status)
                  VALUES (?, ?, ?, ?, 600, 660, 'completed')`).run(lapsed, who.id, svc.id, day(back));
    }

    const reachable = () => candidatesFor('lapsed_winback', { limit: 0 })
      .eligible.some((e) => (e.clientId ?? e.client_id ?? e.id) === lapsed);

    // Prove there is something to exclude, or the next check proves nothing.
    ok('a lapsed regular IS chased while they look real', reachable() === true);

    db.prepare('UPDATE clients SET is_demo = 1 WHERE id = ?').run(lapsed);
    ok('the same person, flagged as a sample, is not', reachable() === false);
  }

  console.log('\n── 5b. the owner is given the choice, and it is honoured');
  {
    // Clearing is the default and the recommendation, but an owner who says
    // "leave them for now" while they look around must be believed.
    reseed();
    const keep = await json('POST', '/api/setup/skip', { keep_samples: true });
    ok('skipping with "keep" succeeds', keep.status === 200, String(keep.status));
    ok('and the samples are still there', (await clients()).length > 0,
      String((await clients()).length));
    ok('the server says it did not clear them', keep.data.demo_cleared === false,
      String(keep.data.demo_cleared));

    reseed();
    const clear = await json('POST', '/api/setup/skip', {});
    ok('skipping with no answer still clears — the safe default',
      (await clients()).length === 0 && clear.data.demo_cleared === true);

    // And the same question through the wizard itself.
    reseed();
    await json('POST', '/api/setup/apply', {
      fresh: false, settings: { business_name: 'Looking Around' },
      team: [], services: [],
    });
    ok('finishing the wizard with "keep" leaves them', (await clients()).length > 0,
      String((await clients()).length));

    reseed();
    await json('POST', '/api/setup/apply', {
      fresh: true, settings: { business_name: 'Real Business' }, team: [], services: [],
    });
    ok('finishing it with "clear" removes them', (await clients()).length === 0);
  }

  console.log('\n── 6. removal is idempotent, and needs a session');
  {
    await json('POST', '/api/demo/clear', {});
    const again = await json('POST', '/api/demo/clear', {});
    ok('running it twice is harmless', again.status === 200, String(again.status));

    const saved = cookie; cookie = '';
    const anon = await json('POST', '/api/demo/clear', {});
    ok('a stranger cannot wipe anything', anon.status === 401, String(anon.status));
    cookie = saved;
  }
} catch (err) {
  ok('the suite ran', false, err.stack || err.message);
} finally {
  srv.kill('SIGKILL');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
