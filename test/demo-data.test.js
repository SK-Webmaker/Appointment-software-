// The sample salon, and getting rid of it.
//
// Kairo seeds a demo business on a fresh install so the screens are not empty
// while somebody looks around. Useful for an hour, and a liability from then
// on: a real owner cannot tell their first real client from Jeanen Brooks, the
// dashboard reports revenue that never happened, and an automation switched on
// in week one tries to text fourteen people who do not exist.
//
// The lines it holds:
//
//   1. SKIPPING SETUP MEANS STARTING EMPTY. "Skip for now" used to keep the
//      whole demo salon. The word means what it says now.
//   2. EVERY SAMPLE ROW SAYS IT IS ONE, so the screen can label it and the
//      delete can find it. An unflagged seed row is invisible to both.
//   3. REMOVAL IS SCOPED TO THE FLAG. Somebody who added a real client while
//      looking around keeps it — this is the one that would cost an owner
//      their business if it were wrong.
//   4. A SAMPLE IS NEVER MESSAGED, exactly like an opt-out.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo } from './helpers/kairo.js';

let k, cookie;
const api = (m, p, body) => k.api(m, p, { cookie, body });
const clients = async () => (await api('GET', '/api/clients')).json;
const services = async () => (await api('GET', '/api/services')).json;
const staff = async () => (await api('GET', '/api/staff')).json;

/** Count rows, on a connection opened and closed around the question. */
function count(sql) {
  const d = k.db();
  try { return d.prepare(sql).get().n; } finally { d.close(); }
}

/** Put the sample salon back, for a check that needs one to remove. */
async function reseed() {
  await api('POST', '/api/settings/reset-demo');
}

before(async () => {
  k = await startKairo();
  ({ cookie } = await k.login());
});
after(async () => { await k.stop(); });

test('a fresh install seeds samples, and every one of them says so', async () => {
  const list = await clients();
  assert.ok(list.length > 0, 'there are samples to look at');
  assert.ok(list.every((c) => c.is_demo === 1),
    `${list.filter((c) => !c.is_demo).length} sample clients are unflagged`);
  for (const t of ['services', 'staff', 'products', 'appointments']) {
    assert.equal(count(`SELECT COUNT(*) AS n FROM ${t} WHERE is_demo = 0`), 0, `unflagged ${t}`);
  }
  assert.equal((await api('GET', '/api/auth/me')).json.has_demo_data, true,
    'and the session says so, so the page can warn');
});

test('real data added while looking around survives the clean-up', async () => {
  const real = (await api('POST', '/api/clients', {
    first_name: 'Real', last_name: 'Person', phone: '0400999888', email: 'real@example.org',
  })).json;
  const realSvc = (await api('POST', '/api/services', {
    name: 'A real service', duration_min: 30, price: 50, price_type: 'fixed',
  })).json;
  const realStaff = (await api('POST', '/api/staff', { name: 'A real stylist' })).json;

  assert.equal((await api('POST', '/api/demo/clear')).status, 200);

  const after_ = await clients();
  assert.deepEqual(after_.map((c) => c.id), [real.id], 'exactly the one real client is left');
  assert.ok((await services()).some((x) => x.id === realSvc.id), 'the real service survives');
  assert.ok((await staff()).some((x) => x.id === realStaff.id), 'the real team member survives');
  for (const t of ['clients', 'services', 'staff', 'products', 'appointments']) {
    assert.equal(count(`SELECT COUNT(*) AS n FROM ${t} WHERE is_demo = 1`), 0, `${t} left behind`);
  }
  // Nothing may be left pointing at somebody who no longer exists — a stray
  // invoice keeps reporting revenue from a client the owner cannot open.
  assert.equal(count('SELECT COUNT(*) AS n FROM invoices WHERE client_id NOT IN (SELECT id FROM clients)'), 0);
  assert.equal(count('SELECT COUNT(*) AS n FROM reviews WHERE client_id NOT IN (SELECT id FROM clients)'), 0);
  assert.equal((await api('GET', '/api/auth/me')).json.has_demo_data, false, 'and it stops warning');
});

test('"Skip for now" means starting empty, not inheriting a fake salon', async () => {
  await reseed();
  assert.ok((await clients()).length > 0, 'samples are back for this check');
  assert.equal((await api('POST', '/api/setup/skip')).status, 200);
  assert.equal((await clients()).length, 0, 'no clients');
  assert.equal((await services()).length, 0, 'no services');
  assert.equal((await staff()).length, 0, 'no team');
});

test('finishing the wizard clears them too, "start fresh" ticked or not', async () => {
  await reseed();
  const r = await api('POST', '/api/setup/apply', {
    fresh: false, // the owner did NOT ask for a clean slate
    settings: { business_name: 'Real Business' },
    team: [{ name: 'Owner', title: 'Stylist' }],
    services: [{ name: 'Consultation', duration_min: 15, price: 0, price_type: 'free' }],
  });
  assert.equal(r.status, 200);
  assert.equal((await clients()).length, 0, 'the samples still go');
  assert.equal((await services()).length, 1, 'and what the owner typed is what is left');
  assert.equal((await staff()).length, 1);
});

test('a sample client is never messaged', async () => {
  await reseed();
  await api('PUT', '/api/automations/lapsed_winback', { enabled: true });

  // The demo dataset matches no automation on its own — everybody in it has
  // been in recently. So build somebody who WOULD be chased: three visits on a
  // monthly rhythm, then four months of silence. Without this the check passes
  // by finding nothing, which tests the exclusion exactly as well as not
  // running it would.
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };
  const d = k.db();
  const svc = d.prepare('SELECT id FROM services LIMIT 1').get();
  const who = d.prepare('SELECT id FROM staff LIMIT 1').get();
  const lapsed = Number(d.prepare(
    "INSERT INTO clients (first_name, last_name, phone, email) VALUES ('Lapsed','Regular','0400111222','l@example.org')"
  ).run().lastInsertRowid);
  for (const back of [180, 150, 120]) {
    d.prepare(`INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status, is_demo)
               VALUES (?, ?, ?, ?, 600, 660, 'completed', 1)`).run(lapsed, who.id, svc.id, day(back));
  }
  d.close();

  // Asked of the SERVER, not of an in-process import: the suite and the server
  // are separate processes with separate database handles, and a check that
  // reads the wrong one proves nothing about what would actually be sent.
  const reachable = async () => {
    const { eligible } = (await api('GET', '/api/automations/lapsed_winback/preview')).json;
    return (eligible || []).some((e) => (e.clientId ?? e.client_id ?? e.id) === lapsed);
  };

  assert.equal(await reachable(), true, 'a lapsed regular IS chased while they look real');
  const d2 = k.db();
  d2.prepare('UPDATE clients SET is_demo = 1 WHERE id = ?').run(lapsed);
  d2.close();
  assert.equal(await reachable(), false, 'the same person, flagged as a sample, is not');
});

test('removal is idempotent, and a stranger cannot wipe anything', async () => {
  await api('POST', '/api/demo/clear');
  assert.equal((await api('POST', '/api/demo/clear')).status, 200, 'twice is harmless');
  assert.equal((await k.api('POST', '/api/demo/clear')).status, 401, 'and it needs a session');
});
