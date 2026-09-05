#!/usr/bin/env node
// A test that cannot fail is not a test.
//
// This deliberately breaks Kairo — one defect at a time, in a throwaway copy
// of the repo — and requires the suite that guards that behaviour to FAIL.
// A mutation that survives means the suite is not actually checking what it
// claims to, and this script exits non-zero so CI goes red.
//
//   npm run test:falsify            # every mutation
//   node test/falsify.mjs auth-gate # one, by name
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// name → { file, find, replace, suites }. `find` must occur exactly once.
const MUTATIONS = {
  'auth-gate': {
    file: 'src/api.js', suites: ['auth'],
    find: "if (!user) return sendJson(res, 401, { error: 'Not signed in' });",
    replace: "if (false) return sendJson(res, 401, { error: 'Not signed in' });",
  },
  'session-version-ignored': {
    file: 'src/api.js', suites: ['auth'],
    find: 'if (row && row.token_version === sess.version) user = row;',
    replace: 'if (row) user = row;',
  },
  'cookie-not-httponly': {
    file: 'src/auth.js', suites: ['auth'],
    find: 'return `Path=/; HttpOnly; SameSite=Lax${secure ? \'; Secure\' : \'\'}`;',
    replace: 'return `Path=/; SameSite=Lax${secure ? \'; Secure\' : \'\'}`;',
  },
  'double-booking-allowed': {
    file: 'src/api.js', suites: ['public-booking'],
    find: 'if (!freeSlotsFor(staffId, b.date, duration).includes(start)) {',
    replace: 'if (false) {',
  },
  'unknown-fields-accepted': {
    file: 'src/validate.js', suites: ['public-booking', 'settings'],
    find: 'if (!(key in schema)) throw httpError(400, `Unexpected field: ${path}${key}`);',
    replace: '',
  },
  'rate-limit-never-fires': {
    file: 'src/ratelimit.js', suites: ['ratelimit'],
    find: 'if (w.count > policy.limit) {',
    replace: 'if (false) {',
  },
  'secrets-unmasked': {
    file: 'src/db.js', suites: ['settings', 'security'],
    find: 'if (SECRET_SETTINGS.has(r.key)) {',
    replace: 'if (false) {',
  },
  'csp-missing': {
    file: 'server.js', suites: ['boot'],
    find: "res.setHeader('Content-Security-Policy', cspFor(url.pathname));",
    replace: '',
  },
  'ics-without-token': {
    file: 'src/api.js', suites: ['security'],
    find: "if (!recordTokenValid('ics', params.id, query.get('t'), getSetting('session_secret'))) {",
    replace: 'if (false) {',
  },
  'cancel-window-ignored': {
    file: 'src/api.js', suites: ['cancel'],
    find: 'if (ctx.tooLate) {',
    replace: 'if (false) {',
  },
  'origin-lock-never-blocks': {
    file: 'src/origin.js', suites: ['origin-lock'],
    find: "block: m === 'enforce',",
    replace: 'block: false,',
  },
  'admin-email-case-kept': {
    file: 'src/db.js', suites: ['backup-and-boot'],
    find: "String(process.env.KAIRO_ADMIN_EMAIL || 'admin@kairo.local').trim().toLowerCase(),",
    replace: "String(process.env.KAIRO_ADMIN_EMAIL || 'admin@kairo.local'),",
  },
  'move-drops-client': {
    file: 'src/api.js', suites: ['messages'],
    find: "const clientId = ('client_id' in a.b || a.b.new_client) ? a.clientId : before.client_id;",
    replace: 'const clientId = a.clientId;',
  },
  'host-routing-picks-first-tenant': {
    file: 'src/tenant.js', suites: ['tenants'],
    find: "    if (slug.includes('.')) return null;   // one label only: a.b.<domain> is nobody\n    return getTenant(slug);",
    replace: "    if (slug.includes('.')) return null;\n    return getTenant(listTenantSlugs()[0]);",
  },
  'read-only-not-enforced': {
    file: 'server.js', suites: ['tenants'],
    find: "if (isReadOnly() && req.method !== 'GET' && req.method !== 'HEAD'",
    replace: "if (false && req.method !== 'GET' && req.method !== 'HEAD'",
  },
  'muted-still-sends': {
    file: 'src/notify.js', suites: ['tenants'],
    find: 'if (isMuted()) {',
    replace: 'if (false) {',
  },
  'rate-limit-shared-across-salons': {
    file: 'src/api.js', suites: ['tenants'],
    find: 'const over = rateHit(bucket, slug ? `${slug}:${ip}` : ip);',
    replace: 'const over = rateHit(bucket, ip);',
  },
  'pre-update-backup-skipped': {
    file: 'src/db.js', suites: ['backup-and-boot'],
    find: 'if (priorVersion && priorVersion !== VERSION) backupBeforeUpdate(priorVersion);',
    replace: '',
  },
};

const only = process.argv.slice(2);
const names = only.length ? only : Object.keys(MUTATIONS);
for (const n of names) if (!MUTATIONS[n]) { console.error(`unknown mutation: ${n}`); process.exit(2); }

const SKIP = new Set(['.git', 'data', 'node_modules', 'docs', 'scratchpad', 'audit']);
function copyRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-falsify-'));
  fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) || src === ROOT });
  return dir;
}

let survived = 0;
const rows = [];
for (const name of names) {
  const m = MUTATIONS[name];
  const dir = copyRepo();
  try {
    const file = path.join(dir, m.file);
    const src = fs.readFileSync(file, 'utf8');
    const count = src.split(m.find).length - 1;
    if (count !== 1) throw new Error(`"${name}": expected exactly one occurrence in ${m.file}, found ${count} — the code moved; update the mutation`);
    fs.writeFileSync(file, src.replace(m.find, m.replace));
    const suites = m.suites.map((s) => path.join('test', `${s}.test.js`));
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', ...suites], {
      cwd: dir, encoding: 'utf8', timeout: 180_000, env: { ...process.env },
    });
    const failed = r.status !== 0;
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    rows.push([name, failed ? 'caught' : 'SURVIVED', `${secs}s`, m.suites.join(', ')]);
    if (!failed) {
      survived++;
      console.error(`\n--- mutation "${name}" survived: ${m.suites.join(', ')} still pass. Output:\n${r.stdout.slice(-2000)}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const w = Math.max(...rows.map((r) => r[0].length));
console.log('');
for (const [n, verdict, secs, suites] of rows) console.log(`  ${n.padEnd(w)}  ${verdict.padEnd(8)}  ${secs.padStart(6)}  ${suites}`);
console.log(`\n${rows.length - survived}/${rows.length} mutations caught.${survived ? ` ${survived} SURVIVED — a test that cannot fail is not a test.` : ''}\n`);
process.exit(survived ? 1 : 0);
