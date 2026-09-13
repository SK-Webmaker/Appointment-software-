#!/usr/bin/env node
// Did that deploy actually land, and is every salon still serving?
//
// Two mistakes this exists to stop making.
//
// THE FIRST IS CHECKING TOO EARLY. Render keeps the old instance serving until
// the new one passes its health check, so a check that runs the moment a deploy
// is triggered describes the instance being replaced. That has already happened
// once here: a post-deploy check came back green, and it was green about the
// old code. So this waits for the process to have RESTARTED — /api/ready
// reports `started_at`, and nothing is judged until that moves.
//
// THE SECOND IS ASKING A QUESTION THAT CANNOT FAIL. /api/version reads a
// constant; it answers 200 from a shard on which no salon can be opened. The
// question worth asking is whether every salon opened and migrated, which is
// what /api/ready answers.
//
//   node scripts/verify-deploy.mjs --url https://kairo-shard-au.onrender.com
//   node scripts/verify-deploy.mjs --url … --after 2026-09-13T21:00:00Z
//   node scripts/verify-deploy.mjs --url … --salon hairbysha --salon horahaircutz
//
//   --after <ISO>    wait for a process that started after this moment. Take it
//                    immediately BEFORE triggering the deploy.
//   --salon <slug>   also fetch this salon's public booking data and require it
//                    to answer. Repeatable. Proves the salon serves, not just
//                    that it opened.
//   --timeout <s>    how long to wait for the restart (default 300)
//
// Exit 0 means the new code is live and every salon is serving. Anything else
// means the deploy is not finished, and Render's "Rollback" is one click.
import process from 'node:process';

const argv = process.argv.slice(2);
const arg = (n, d = '') => { const i = argv.indexOf(`--${n}`); return i >= 0 ? String(argv[i + 1] ?? '') : d; };
const all = (n) => argv.reduce((acc, v, i) => (v === `--${n}` && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);

const url = arg('url').replace(/\/+$/, '');
const after = arg('after');
const salons = all('salon');
const timeoutMs = (Number(arg('timeout', '300')) || 300) * 1000;

if (!url) {
  console.error(`
  Check that a deploy landed and every salon is still serving.

    node scripts/verify-deploy.mjs --url https://kairo-shard-au.onrender.com \\
      [--after <ISO taken before the deploy>] [--salon <slug>]... [--timeout 300]
`);
  process.exit(2);
}

const E = '[';
const ok = (s) => console.log(`  ${E}32m✓${E}0m ${s}`);
const bad = (s) => console.log(`  ${E}31m✗${E}0m ${s}`);
const stop = (why) => { bad(why); console.log(`\n  ${E}31mThe deploy is not finished. Render's Rollback is one click.${E}0m\n`); process.exit(1); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ready() {
  const res = await fetch(`${url}/api/ready`, { signal: AbortSignal.timeout(15000) });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`/api/ready did not answer JSON (HTTP ${res.status})`);
  return { status: res.status, ...json };
}

console.log(`\n  Verifying ${url}`);

// ── 1. Wait for the new process ──────────────────────────────────────────────
let r;
const deadline = Date.now() + timeoutMs;
for (;;) {
  try {
    r = await ready();
    // No --after means "whatever is running now": one look, no waiting.
    if (!after) break;
    if (r.started_at && Date.parse(r.started_at) > Date.parse(after)) break;
    if (Date.now() > deadline) {
      stop(`still the process that started at ${r.started_at} after ${Math.round(timeoutMs / 1000)}s — the deploy has not swapped in`);
    }
  } catch (err) {
    // A restarting shard refuses connections for a few seconds. That is the
    // deploy working, not failing, so it is only fatal once time runs out.
    if (Date.now() > deadline) stop(`never answered: ${err.message}`);
  }
  await sleep(3000);
}

if (after) ok(`new process is live — started ${r.started_at}`);
else ok(`running since ${r.started_at}`);
ok(`version ${r.version}${r.multi_tenant ? ', multi-tenant' : ''}`);

// ── 2. Every salon opened and migrated ───────────────────────────────────────
if (r.degraded?.length) {
  for (const d of r.degraded) bad(`${d.salon}: ${d.why}`);
  stop(`${r.degraded.length} of ${r.salons} salon(s) will not open`);
}
if (r.ok !== true) stop(`the shard does not report itself ok: ${JSON.stringify(r)}`);
ok(`all ${r.salons} salon(s) opened and migrated`);

// ── 3. The salons named actually serve ───────────────────────────────────────
//
// Opening is not serving. A salon whose database migrated cleanly can still
// fail to answer, and the people who would find that out are its customers.
for (const slug of salons) {
  const host = `${slug}.${process.env.KAIRO_BASE_DOMAIN || 'kairobookings.com'}`;
  let res;
  try {
    res = await fetch(`https://${host}/api/public/info`, { signal: AbortSignal.timeout(20000) });
  } catch (err) {
    stop(`${slug}: its booking page could not be reached (${err.message})`);
  }
  if (!res.ok) stop(`${slug}: its booking page answered HTTP ${res.status}`);
  const info = await res.json().catch(() => ({}));
  // "Online booking is disabled" is a 200 with an error body — a salon that is
  // up and deliberately closed. Worth telling apart from one that is broken,
  // and worth saying out loud rather than counting as a clean pass.
  if (info.error) ok(`${slug}: serving, booking currently off (${info.error})`);
  else ok(`${slug}: serving as "${info.business_name || slug}"`);
}

console.log(`\n  ${E}32mDeploy verified.${E}0m\n`);
process.exit(0);
