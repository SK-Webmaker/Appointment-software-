#!/usr/bin/env node
// Move one salon from its own Kairo onto the shard — and prove the copy.
//
// Phase 5 runs this in a five-minute window with the old service in
// maintenance. Every subcommand is safe to run twice; nothing here ever writes
// to a live salon, only to a tenant folder on the shard, and `import` refuses
// to overwrite a tenant that exists.
//
//   fetch     --url https://hairbysha.kairobookings.com --email o@x --password p --out sha.db.gz
//             download the salon's own backup snapshot (the authenticated endpoint the app uses)
//   import    --slug hairbysha --from sha.db.gz --public-url https://hairbysha.kairobookings.com [--muted] [--apply]
//             dry run by default: prints what would happen. --apply copies the file in and writes tenant.json
//   verify    --slug hairbysha --from sha.db.gz
//             every table's row count, every cent, every setting, the owner's login row, file size — identical or it fails
//   compare   --old https://hairbysha.kairobookings.com --new http://127.0.0.1:10000 [--new-host hairbysha.kairobookings.com]
//             the booking page's data and the next fortnight's availability, side by side
//   since     --slug hairbysha --since "2026-09-08 11:00:00"   (UTC, seconds optional)
//             what was written on the shard after a moment — the rollback reconciliation list
//
// Exit code 0 means every check passed; 1 means at least one did not; 2 means bad usage.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
import https from 'node:https';
import { TENANTS_DIR, SLUG_RE, BASE_DOMAIN } from '../src/tenant.js';

/**
 * HTTP with a Host header of our choosing. fetch() silently drops a custom
 * Host, and the shard decides the salon by Host — so a request to the shard's
 * raw address on behalf of hairbysha.kairobookings.com has to be made by hand.
 */
function request(method, url, { host = '', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const data = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = lib.request({
      method, hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search,
      headers: { ...headers, ...(host ? { host } : {}), ...(data !== undefined ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}) },
      servername: host || u.hostname,
    }, (res) => {
      const chunks = [];
      res.on('data', (ch) => chunks.push(ch));
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (data !== undefined) req.write(data);
    req.end();
  });
}
const asJson = (r) => JSON.parse(r.buffer.toString('utf8'));

const [cmd, ...rest] = process.argv.slice(2);
const opts = new Map();
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) opts.set(rest[i].slice(2), rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true);
}
const str = (k, d = '') => (typeof opts.get(k) === 'string' ? opts.get(k).trim() : d);
const flag = (k) => opts.get(k) === true;

const c = { ok: (s) => `\x1b[32m${s}\x1b[0m`, bad: (s) => `\x1b[31m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m` };
function usage(code = 2) {
  console.error(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(code);
}
function die(msg) { console.error(c.bad(`✗ ${msg}`)); process.exit(1); }

/** Open a snapshot file (.db or .db.gz) read-only via a temp copy if gzipped. */
function openSnapshot(file) {
  if (!fs.existsSync(file)) die(`no such file: ${file}`);
  let dbPath = file;
  if (file.endsWith('.gz')) {
    dbPath = file.replace(/\.gz$/, '');
    if (!fs.existsSync(dbPath) || fs.statSync(dbPath).mtimeMs < fs.statSync(file).mtimeMs) {
      fs.writeFileSync(dbPath, zlib.gunzipSync(fs.readFileSync(file)));
    }
  }
  const head = fs.readFileSync(dbPath).subarray(0, 15).toString();
  if (head !== 'SQLite format 3') die(`${dbPath} is not a SQLite database`);
  const d = new DatabaseSync(dbPath, { readOnly: true });
  return { db: d, path: dbPath };
}

const tenantDbPath = (slug) => path.join(TENANTS_DIR, slug, 'kairo.db');

// ── what "the same" means ──────────────────────────────────────────────────
function profile(d) {
  const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
  const counts = {};
  for (const t of tables) counts[t] = d.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n;
  const q = (sql) => { try { return d.prepare(sql).get(); } catch { return null; } };
  const money = {
    payments_cents: q('SELECT COALESCE(SUM(amount_cents),0) AS v FROM payments')?.v,
    items_cents: q('SELECT COALESCE(CAST(ROUND(SUM(qty*unit_cents)) AS INTEGER),0) AS v FROM invoice_items')?.v,
    deposits_cents: q('SELECT COALESCE(SUM(deposit_cents),0) AS v FROM appointments')?.v,
  };
  const newest = {
    appointment_id: q('SELECT COALESCE(MAX(id),0) AS v FROM appointments')?.v,
    message_id: q('SELECT COALESCE(MAX(id),0) AS v FROM messages')?.v,
    invoice_id: q('SELECT COALESCE(MAX(id),0) AS v FROM invoices')?.v,
    client_id: q('SELECT COALESCE(MAX(id),0) AS v FROM clients')?.v,
    last_invoice_number: q('SELECT number FROM invoices ORDER BY id DESC LIMIT 1')?.number || '',
  };
  const settingsRows = d.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const SECRETS = new Set(['session_secret', 'resend_api_key', 'stripe_secret_key', 'twilio_token', 'clicksend_api_key', 'telnyx_api_key', 'cf_origin_secret', 'turnstile_secret_key']);
  const settings = {};
  for (const r of settingsRows) settings[r.key] = SECRETS.has(r.key) ? (r.value ? `<set:${r.value.length}>` : '<empty>') : r.value;
  const users = d.prepare('SELECT id, email, pass_hash, salt, token_version, email_verified FROM users ORDER BY id').all();
  return { tables, counts, money, newest, settings, users };
}

function diffProfiles(a, b) {
  const rows = [];
  const check = (label, x, y) => rows.push({ label, pass: JSON.stringify(x) === JSON.stringify(y), a: x, b: y });
  check('tables present', a.tables, b.tables);
  for (const t of a.tables) check(`rows: ${t}`, a.counts[t], b.counts[t]);
  for (const k of Object.keys(a.money)) check(`money: ${k}`, a.money[k], b.money[k]);
  for (const k of Object.keys(a.newest)) check(`newest: ${k}`, a.newest[k], b.newest[k]);
  check('settings: count', Object.keys(a.settings).length, Object.keys(b.settings).length);
  for (const k of Object.keys(a.settings)) {
    if (k === 'app_version') continue; // the shard may be newer; migrations are additive and already backed up
    if (a.settings[k] !== b.settings[k]) check(`setting: ${k}`, a.settings[k], b.settings[k]);
  }
  check('owner login rows (email, hash, salt, version)', a.users, b.users);
  return rows;
}

function printRows(rows, { showPass = false } = {}) {
  let fails = 0;
  for (const r of rows) {
    if (!r.pass) fails++;
    if (r.pass && !showPass) continue;
    const mark = r.pass ? c.ok('✓') : c.bad('✗');
    console.log(`  ${mark} ${r.label}${r.pass ? '' : c.dim(`  source=${JSON.stringify(r.a)} tenant=${JSON.stringify(r.b)}`)}`);
  }
  return fails;
}

// ── subcommands ────────────────────────────────────────────────────────────
async function fetchSnapshot() {
  const url = str('url').replace(/\/+$/, ''), email = str('email'), password = str('password'), out = str('out');
  if (!url || !email || !password || !out) usage();
  const login = await request('POST', `${url}/api/auth/login`, { host: str('host'), body: { email, password } });
  if (!login.ok) die(`login failed: ${login.status} ${login.buffer.toString('utf8')}`);
  const m = /kairo_session=([^;]+)/.exec(String(login.headers['set-cookie'] || ''));
  if (!m) die('no session cookie returned');
  const res = await request('GET', `${url}/api/backup/download`, { host: str('host'), headers: { cookie: `kairo_session=${m[1]}` } });
  if (!res.ok) die(`download failed: ${res.status}`);
  const buf = res.buffer;
  fs.writeFileSync(out, buf);
  const raw = zlib.gunzipSync(buf);
  console.log(`${c.ok('✓')} ${out}  ${c.dim(`${buf.length} bytes gzipped, ${raw.length} bytes database`)}`);
}

function importSnapshot() {
  const slug = str('slug'), from = str('from');
  if (!SLUG_RE.test(slug) || !from) usage();
  const publicUrl = str('public-url', `https://${slug}.${BASE_DOMAIN}`);
  const apply = flag('apply');
  const dir = path.join(TENANTS_DIR, slug);
  if (fs.existsSync(dir)) die(`tenant "${slug}" already exists at ${dir} — refusing to overwrite. Delete the folder by hand if you really mean it.`);
  const src = openSnapshot(from);
  const integrity = src.db.prepare('PRAGMA integrity_check').get();
  if (integrity?.integrity_check !== 'ok') die(`source integrity check: ${JSON.stringify(integrity)}`);
  const p = profile(src.db);
  const bytes = fs.statSync(src.path).size;
  console.log('');
  console.log(c.b(`Import ${from} → ${dir}`), apply ? c.bad('— APPLYING') : c.dim('— dry run, nothing will change'));
  console.log(`  source     ${src.path}  ${c.dim(`${bytes} bytes, integrity ok`)}`);
  console.log(`  business   ${p.settings.business_name || '(unnamed)'}  ${c.dim(`tz ${p.settings.business_tz || '(server)'} · from ${p.settings.notif_from_email || '(none)'}`)}`);
  console.log(`  owner      ${p.users.map((u) => u.email).join(', ')}`);
  console.log(`  rows       ${p.counts.clients} clients · ${p.counts.appointments} appointments · ${p.counts.invoices} invoices · ${p.counts.messages} messages`);
  console.log(`  address    ${publicUrl}${flag('muted') ? c.bad('   MUTED — a rehearsal copy that never sends') : ''}`);
  src.db.close();
  if (!apply) { console.log(c.dim('\nDry run. Re-run with --apply.\n')); return; }
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src.path, tenantDbPath(slug));
  const cfg = {
    slug, public_url: publicUrl, plan_status: 'active', plan: 'legacy',
    migrated_from: path.basename(from), migrated_at: new Date().toISOString(),
    ...(flag('muted') ? { muted: true } : {}),
  };
  fs.writeFileSync(path.join(dir, 'tenant.json'), JSON.stringify(cfg, null, 2) + '\n');
  console.log(`\n${c.ok('✓')} copied. Now: verify --slug ${slug} --from ${from}\n`);
}

function verify() {
  const slug = str('slug'), from = str('from');
  if (!SLUG_RE.test(slug) || !from) usage();
  const target = tenantDbPath(slug);
  if (!fs.existsSync(target)) die(`no tenant database at ${target}`);
  const src = openSnapshot(from);
  const dst = new DatabaseSync(target, { readOnly: true });
  console.log('');
  console.log(c.b(`Verify ${slug}`), c.dim(`${src.path} vs ${target}`));
  const rows = diffProfiles(profile(src.db), profile(dst));
  const sb = fs.statSync(src.path).size, tb = fs.statSync(target).size;
  rows.push({ label: `file size within 1% (${sb} vs ${tb})`, pass: Math.abs(sb - tb) <= Math.max(4096, sb * 0.01), a: sb, b: tb });
  const ic = dst.prepare('PRAGMA integrity_check').get();
  rows.push({ label: 'tenant integrity check', pass: ic?.integrity_check === 'ok', a: 'ok', b: ic?.integrity_check });
  const fails = printRows(rows, { showPass: flag('verbose') });
  console.log(fails ? c.bad(`\n  ${fails} check${fails === 1 ? '' : 's'} FAILED — do not switch.\n`) : c.ok(`\n  All ${rows.length} checks passed.\n`));
  src.db.close(); dst.close();
  process.exit(fails ? 1 : 0);
}

async function compareLive() {
  const oldUrl = str('old').replace(/\/+$/, ''), newUrl = str('new').replace(/\/+$/, '');
  if (!oldUrl || !newUrl) usage();
  const newHost = str('new-host');
  const get = async (base, p, host) => {
    const r = await request('GET', base + p, { host });
    if (!r.ok) throw new Error(`${base}${p}${host ? ` (Host: ${host})` : ''} → ${r.status}`);
    return asJson(r);
  };
  const strip = (info) => { const { read_only, ...rest } = info; return rest; };
  const a = strip(await get(oldUrl, '/api/public/info', str('old-host')));
  const b = strip(await get(newUrl, '/api/public/info', newHost));
  const rows = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    rows.push({ label: `public info: ${k}`, pass: JSON.stringify(a[k]) === JSON.stringify(b[k]), a: a[k], b: b[k] });
  }
  // The next fortnight's availability, per staff member: the diary itself.
  const staff = a.staff || [];
  const svc = (a.services || [])[0];
  if (svc) {
    for (const d of (a.open_dates || []).slice(0, 14)) {
      for (const s of staff) {
        const p = `/api/public/availability?date=${d.date}&staff_id=${s.id}&service_ids=${svc.id}`;
        const [x, y] = await Promise.all([get(oldUrl, p, str('old-host')), get(newUrl, p, newHost)]);
        rows.push({ label: `availability ${d.date} ${s.name}`, pass: JSON.stringify(x) === JSON.stringify(y), a: x.slots?.length, b: y.slots?.length });
      }
    }
  }
  console.log('');
  console.log(c.b(`Compare ${oldUrl} vs ${newUrl}${newHost ? ` (Host: ${newHost})` : ''}`));
  const fails = printRows(rows, { showPass: flag('verbose') });
  console.log(fails ? c.bad(`\n  ${fails} difference${fails === 1 ? '' : 's'}.\n`) : c.ok(`\n  Identical: ${rows.length} checks.\n`));
  process.exit(fails ? 1 : 0);
}

function since() {
  const slug = str('slug'), t = str('since');
  if (!SLUG_RE.test(slug) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(t)) usage();
  const d = new DatabaseSync(tenantDbPath(slug), { readOnly: true });
  console.log('');
  console.log(c.b(`Written on the shard for ${slug} since ${t}`));
  // created_at columns are SQLite's datetime('now') — UTC. paid_at is stamped in
  // the business's zone. --since is compared as given, so pass a UTC time and,
  // when in doubt, an earlier one: this list is meant to over-include.
  const sections = [
    ['appointments', 'SELECT a.id, a.date, a.start_min, a.status, a.source, a.created_at, c.first_name, c.last_name FROM appointments a LEFT JOIN clients c ON c.id = a.client_id WHERE a.created_at >= $t OR a.cancelled_at >= $t ORDER BY a.id'],
    ['clients', 'SELECT id, first_name, last_name, email, phone, created_at FROM clients WHERE created_at >= $t ORDER BY id'],
    ['payments', 'SELECT id, invoice_id, amount_cents, method, paid_at FROM payments WHERE paid_at >= $t ORDER BY id'],
    ['messages', 'SELECT id, kind, channel, status, to_addr, created_at FROM messages WHERE created_at >= $t ORDER BY id'],
  ];
  let total = 0;
  for (const [name, sql] of sections) {
    const rows = d.prepare(sql).all({ t });
    total += rows.length;
    console.log(`\n  ${name} (${rows.length})`);
    for (const r of rows) console.log(`    ${JSON.stringify(r)}`);
  }
  console.log(total ? c.bad(`\n  ${total} row${total === 1 ? '' : 's'} to carry back if you roll back.\n`) : c.ok('\n  Nothing written since then — a rollback loses nothing.\n'));
  d.close();
}

const run = { fetch: fetchSnapshot, import: importSnapshot, verify, compare: compareLive, since }[cmd];
if (!run) usage();
await run();
