#!/usr/bin/env node
// Move one salon onto the live shard, and prove the copy — from anywhere.
//
// The rehearsal (rehearse-move.mjs) proves a copy on THIS machine. This is the
// real thing: the snapshot goes up to the shard over the signed control API,
// the shard writes it as a new tenant, and then — because a copy nobody has
// checked is not a move — the shard is asked for it straight back, and every
// row, every cent and every setting is compared against what was sent. Finally
// the booking page and the next fortnight of availability are compared, old
// salon against the new tenant on the shard.
//
//   KAIRO_SHARD_URL=https://kairo-shard-au.onrender.com \
//   KAIRO_PLATFORM_KEY=… \
//   node scripts/move-tenant.mjs --slug horahaircutz \
//     --from hora-final.db.gz \
//     --old https://horahaircutz.kairobookings.com
//
// Nothing here touches the old salon: it is read for the comparison and
// nothing else. The shard import refuses to overwrite a tenant that exists.
//
// Exit 0 means the salon is on the shard and proven identical. Anything else
// means stop: the old salon is still serving, and the shard copy (if one was
// written) can be deleted with the control API before trying again.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as shard from '../platform/shard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d = '') => { const i = argv.indexOf(`--${n}`); return i >= 0 ? String(argv[i + 1] ?? '') : d; };
const has = (n) => argv.includes(`--${n}`);

const slug = arg('slug');
const from = arg('from');
const oldUrl = arg('old').replace(/\/+$/, '');
const base = arg('base-domain', 'kairobookings.com');
const publicUrl = arg('public-url', `https://${slug}.${base}`);

if (!slug || !from || !oldUrl || !process.env.KAIRO_PLATFORM_KEY || !process.env.KAIRO_SHARD_URL) {
  console.error(`
  Move one salon onto the live shard and prove the copy.

    KAIRO_SHARD_URL=… KAIRO_PLATFORM_KEY=… \\
    node scripts/move-tenant.mjs --slug <slug> --from <backup.db.gz> --old <old live url>

    --public-url   the address the tenant will serve at (default https://<slug>.<base-domain>)
    --muted        import muted, so it cannot send until unmuted (rehearsal on the real shard)
    --read-only    import read-only, so nothing can change until the DNS flip
  `);
  process.exit(2);
}

const E = '[';
const step = (n, s) => console.log(`\n${E}1m── ${n}. ${s}${E}0m`);
const ok = (s) => console.log(`   ${E}32m✓${E}0m ${s}`);
const bad = (s) => console.log(`   ${E}31m✗${E}0m ${s}`);
const stop = (why) => { bad(why); console.log(`\n  ${E}31mStopped. The old salon is untouched.${E}0m\n`); process.exit(1); };

const gz = fs.readFileSync(from);
console.log(`\n  Moving ${slug} → ${process.env.KAIRO_SHARD_URL} as ${publicUrl}`);
console.log(`  Snapshot: ${from} (${(gz.length / 1024).toFixed(0)} kB gzipped)\n`);

step(1, 'The shard is alive and multi-tenant');
let health;
try { health = await shard.health(); } catch (e) { stop(`shard did not answer a signed request: ${e.message}`); }
if (!health.multi_tenant) stop('that shard is single-tenant');
ok(`v${health.version}, ${health.tenants} salon(s) already on it`);

step(2, 'Send the snapshot; the shard checks it before writing anything');
let imported;
try {
  imported = await shard.importSnapshot(slug, gz, {
    public_url: publicUrl,
    migrated_from: path.basename(from),
    ...(has('muted') ? { muted: true } : {}),
    ...(has('read-only') ? { read_only: true } : {}),
  });
} catch (e) { stop(`import refused: ${e.message}`); }
ok(`imported: ${imported.counts.clients} clients · ${imported.counts.appointments} appointments · ${imported.counts.invoices} invoices · ${imported.counts.messages} messages`);

step(3, 'Ask for it straight back, and compare every row and every cent');
const work = fs.mkdtempSync(path.join(os.tmpdir(), `kairo-move-${slug}-`));
const dataDir = path.join(work, 'shard');
fs.mkdirSync(path.join(dataDir, 'tenants', slug), { recursive: true });
let back;
try { back = await shard.exportTenant(slug); } catch (e) { stop(`export failed: ${e.message}`); }
const backGz = path.join(work, `${slug}-from-shard.db.gz`);
fs.writeFileSync(backGz, back);
// verify compares a snapshot against TENANTS_DIR/<slug>/kairo.db, so the
// export is unpacked into that shape and the ORIGINAL snapshot is the "from".
const { gunzipSync } = await import('node:zlib');
fs.writeFileSync(path.join(dataDir, 'tenants', slug, 'kairo.db'), gunzipSync(back));
// The strict comparison first, because it is the one that must be read.
const verify = (extra = []) => spawnSync(
  process.execPath,
  ['--disable-warning=ExperimentalWarning', 'scripts/migrate-tenant.mjs', 'verify', '--slug', slug, '--from', from, ...extra],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, KAIRO_DATA_DIR: dataDir } },
);
let v = verify();
if (v.status !== 0) {
  // Almost every real move is cross-version: the salon runs whatever it was
  // last deployed and the shard runs the current code, so opening the database
  // migrates it and the comparison legitimately fails on a handful of rows.
  // On the first move those rows were diffed by hand, on a live salon, at one
  // in the morning — which is exactly how a real difference gets waved through
  // alongside the harmless ones.
  //
  // So they are judged rather than eyeballed. Only provably additive
  // differences are downgraded, each printed with its reason; a removed table,
  // a changed value, a moved row count or a moved cent still stops the move.
  console.log(`\n   ${E}33m↑ the strict comparison found differences. Judging whether a version change explains them…${E}0m`);
  v = verify(['--across-versions']);
  if (v.status !== 0) stop('what came back from the shard is not identical to what was sent');
  ok('every difference is explained by the version change, and nothing else differs');
} else {
  ok('the shard holds exactly what was sent');
}

step(4, 'Compare the booking page and the next fortnight, old salon vs new tenant');
// The salon's own address still points at the OLD service until the DNS flip,
// and the shard sits behind Cloudflare, which refuses a Host header that does
// not match the connection. So the new tenant is given a temporary preview
// address under the wildcard — <slug>-preview.<base> — compared through that,
// and the alias is removed again. It exercises exactly the path customers will
// use after the flip, with nothing pretended.
const preview = `${slug}-preview.${base}`;
try { await shard.patchTenant(slug, { domains: [preview] }); } catch (e) { stop(`could not add the preview address: ${e.message}`); }
// Normally the preview address is reached over the public internet, which is
// the point: it exercises the exact path a customer will use. `--via` reaches
// the same tenant at a given base URL instead, carrying the preview hostname
// as the Host header — how a test drives this against a local shard, and how
// a real move can still be compared if the wildcard is ever not resolving.
const via = arg('via');
const c = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/migrate-tenant.mjs', 'compare',
  '--old', oldUrl, '--new', via || `https://${preview}`, ...(via ? ['--new-host', preview] : [])],
  { cwd: ROOT, stdio: 'inherit', env: process.env });
try { await shard.patchTenant(slug, { domains: [] }); } catch { /* the alias is harmless if it lingers; it serves the same salon */ }
if (c.status !== 0) stop('the new tenant does not answer the same as the old salon');
ok('booking page and availability match, via the wildcard');

fs.rmSync(work, { recursive: true, force: true });
console.log(`\n  ${E}32m${slug} is on the shard and proven identical.${E}0m`);
console.log(`  Next: point the ${new URL(publicUrl).host} DNS record at the shard, then make a real test booking.\n`);
