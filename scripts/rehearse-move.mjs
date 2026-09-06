#!/usr/bin/env node
// Rehearse one salon's move, end to end, without touching the salon.
//
// Phase 5 says a rehearsal on a copy must pass before any real cutover. This
// is that rehearsal in one command: it downloads the salon's own backup over
// the authenticated endpoint the app already uses, imports it into a scratch
// shard on this machine, verifies every row and every cent against the
// original, boots the shard, and compares the booking page and the next
// fortnight's availability old-versus-new.
//
// It never writes to the live salon. It only reads, exactly as the owner's own
// "download a backup" button does.
//
// Two ways in. Either it downloads the snapshot itself:
//
//   node scripts/rehearse-move.mjs --url https://hairbysha-booking.onrender.com \
//     --slug hairbysha --email you@example.com --password '…'
//
// or you download the backup yourself from Settings and hand it over, which
// needs no password at all — the comparison afterwards uses only the salon's
// public booking endpoints:
//
//   node scripts/rehearse-move.mjs --url https://hairbysha-booking.onrender.com \
//     --slug hairbysha --from ~/Downloads/kairo-backup.db.gz
//
// Exit 0 means every check passed and the salon is safe to move. Anything else
// means stop and read the output; nothing has been changed either way.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d = '') => { const i = argv.indexOf(`--${n}`); return i >= 0 ? String(argv[i + 1] ?? '') : d; };
const has = (n) => argv.includes(`--${n}`);

const url = arg('url').replace(/\/+$/, '');
const slug = arg('slug');
const email = arg('email');
const password = arg('password') || process.env.KAIRO_PASSWORD || '';
const given = arg('from');
const keep = has('keep');

if (!url || !slug || (!given && (!email || !password))) {
  console.error(`
  Rehearse one salon's move. Reads only; the live salon is never written to.

    node scripts/rehearse-move.mjs --url <live url> --slug <slug> --email <owner> --password <pw>
    node scripts/rehearse-move.mjs --url <live url> --slug <slug> --from <backup.db.gz>

    --from   a backup you already downloaded from Settings. No password
             needed: everything after the download reads only the salon's
             public booking endpoints.
    --keep   leave the scratch shard behind for poking at

  The password can also come from KAIRO_PASSWORD, so it stays out of your
  shell history.
  `);
  process.exit(2);
}

const E = '[';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (n, s) => console.log(`\n${E}1m── ${n}. ${s}${E}0m`);
const ok = (s) => console.log(`   ${E}32m✓${E}0m ${s}`);
const bad = (s) => console.log(`   ${E}31m✗${E}0m ${s}`);

const work = fs.mkdtempSync(path.join(os.tmpdir(), `kairo-rehearsal-${slug}-`));
const snapshot = given ? path.resolve(given) : path.join(work, `${slug}.db.gz`);
const dataDir = path.join(work, 'shard');
fs.mkdirSync(path.join(dataDir, 'tenants'), { recursive: true });

const migrate = (args) => spawnSync(
  process.execPath,
  ['--disable-warning=ExperimentalWarning', 'scripts/migrate-tenant.mjs', ...args],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, KAIRO_DATA_DIR: dataDir } },
);

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
  });
}

let failed = 0;
const check = (r, what) => {
  if (r.status === 0) ok(what);
  else { bad(`${what} — migrate-tenant exited ${r.status}`); failed += 1; }
};

console.log(`\n  Rehearsing ${slug} from ${url}`);
console.log(`  Scratch shard: ${dataDir}`);
console.log('  The live salon is only ever read from.\n');

if (given) {
  step(1, 'Use the backup you already downloaded');
  if (!fs.existsSync(snapshot)) { bad(`no such file: ${snapshot}`); process.exit(1); }
  ok(snapshot);
} else {
  step(1, 'Download the salon’s own backup');
  check(migrate(['fetch', '--url', url, '--email', email, '--password', password, '--out', snapshot]), 'snapshot downloaded');
  if (failed) {
    console.log('\n  Stopped: could not download. Check the URL and the owner login.\n');
    process.exit(1);
  }
}
ok(`${(fs.statSync(snapshot).size / 1024 / 1024).toFixed(2)} MB`);

step(2, 'Import it into a scratch shard (dry run first)');
check(migrate(['import', '--slug', slug, '--from', snapshot, '--public-url', url]), 'dry run');
check(migrate(['import', '--slug', slug, '--from', snapshot, '--public-url', url, '--muted', '--apply']), 'imported, muted so nothing can send');

step(3, 'Verify the copy — every row, every cent, every setting');
check(migrate(['verify', '--slug', slug, '--from', snapshot]), 'copy is identical to the original');

step(4, 'Boot the shard and compare it with the live salon');
const port = await freePort();
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    KAIRO_DATA_DIR: dataDir,
    KAIRO_MULTI_TENANT: '1',
    KAIRO_BASE_DOMAIN: 'kairobookings.com',
    KAIRO_BREACH_CHECK: 'off',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', (d) => { log += d; });
child.stderr.on('data', (d) => { log += d; });

let up = false;
for (let i = 0; i < 100 && !up; i++) {
  try { up = (await fetch(`http://127.0.0.1:${port}/api/version`)).ok; } catch { await sleep(150); }
}
if (!up) {
  bad('the scratch shard did not start');
  console.log(log);
  process.exit(1);
}
ok(`scratch shard up on ${port}`);

check(
  migrate(['compare', '--old', url, '--new', `http://127.0.0.1:${port}`, '--new-host', `${slug}.kairobookings.com`]),
  'booking page and the next fortnight of availability match',
);

child.kill('SIGTERM');
await sleep(400);
child.kill('SIGKILL');

console.log('');
if (failed) {
  console.log(`  ${E}31m${failed} check(s) failed. Do not move ${slug}.${E}0m`);
  console.log(`  The scratch shard is at ${dataDir} for inspection.\n`);
  process.exit(1);
}
console.log(`  ${E}32mEvery check passed. ${slug} is safe to move.${E}0m`);
console.log('  Nothing about the live salon was changed.\n');
if (keep) console.log(`  Scratch shard kept at ${dataDir}\n`);
else fs.rmSync(work, { recursive: true, force: true });
