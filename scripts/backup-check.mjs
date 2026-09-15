#!/usr/bin/env node
// Is every salon's off-site copy still being made?
//
// Every salon on a shard shares one disk. The copies Kairo keeps beside each
// database are for a bad upgrade and are worthless if that disk is lost, so the
// backup Kairo emails to each owner is the only thing between a dead disk and a
// dead business. It runs on a schedule, it can fail quietly, and nobody finds
// out until the day it matters.
//
// That is not hypothetical. Seven days after Horahaircutz moved onto the shard,
// his last successful backup still predated the move — and discovering it meant
// exporting his whole database to read four settings. This asks instead.
//
//   KAIRO_SHARD_URL=https://kairo-shard-au.onrender.com \
//   KAIRO_PLATFORM_KEY=… \
//   node scripts/backup-check.mjs
//
//   --quiet   print only the salons with a problem
//
// Exit 0 means every salon has a current off-site copy. Exit 1 means at least
// one does not, and the reason is on the line.
import * as shard from '../platform/shard.js';

const argv = process.argv.slice(2);
const quiet = argv.includes('--quiet');

if (!process.env.KAIRO_PLATFORM_KEY || !process.env.KAIRO_SHARD_URL) {
  console.error(`
  Check that every salon's off-site backup is current.

    KAIRO_SHARD_URL=… KAIRO_PLATFORM_KEY=… node scripts/backup-check.mjs [--quiet]
`);
  process.exit(2);
}

const E = '[';
const ok = (s) => console.log(`  ${E}32m✓${E}0m ${s}`);
const bad = (s) => console.log(`  ${E}31m✗${E}0m ${s}`);
const dim = (s) => `${E}2m${s}${E}0m`;

/** How many days each frequency means. Mirrors FREQUENCIES in src/backup.js. */
const DAYS = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, off: 0 };

/**
 * Judge one salon's backup.
 *
 * "Due" is not a fault — it means the scheduler will get to it within the
 * minute. A fault is a backup that cannot happen (switched off, nowhere to
 * send it), one that tried and failed, or one whose last success is so old
 * that the schedule is plainly not running: twice its own period, which is
 * late enough to be a real answer rather than a clock skew.
 */
function judge(b) {
  if (!b) return { fault: true, why: 'this shard is too old to report backup state — deploy it first' };
  if (b.enabled === false) return { fault: true, why: 'backups are switched OFF for this salon' };
  if (!b.to_set) return { fault: true, why: 'no recipient — the backup has nowhere to go' };
  const every = DAYS[b.frequency] ?? 7;
  if (!every) return { fault: true, why: `frequency is "${b.frequency}" — nothing is scheduled` };
  if (!b.last_at) return { fault: true, why: 'never run' };
  if (b.last_ok === false) return { fault: true, why: `last attempt FAILED — ${b.last_detail || 'no reason recorded'}` };
  const ageDays = (Date.now() - Date.parse(b.last_at)) / 86_400_000;
  if (!Number.isFinite(ageDays)) return { fault: true, why: `last run time is unreadable: ${b.last_at}` };
  if (ageDays > every * 2) {
    return { fault: true, why: `last good backup was ${ageDays.toFixed(0)} days ago, on a ${b.frequency} schedule — the schedule is not running` };
  }
  return { fault: false, ageDays, every };
}

console.log('');
let list;
try { list = await shard.listTenants(); } catch (e) { bad(`shard did not answer: ${e.message}`); process.exit(1); }
const slugs = list.tenants || [];
console.log(`  ${slugs.length} salon(s) on ${shard.SHARD_URL()}\n`);

let faults = 0;
for (const slug of slugs) {
  let t;
  try { t = await shard.getTenant(slug); } catch (e) { bad(`${slug}: could not be read — ${e.message}`); faults++; continue; }
  const v = judge(t?.backup);
  if (v.fault) {
    faults++;
    bad(`${slug}: ${v.why}`);
  } else if (!quiet) {
    const size = t.backup.last_bytes ? `${Math.round(t.backup.last_bytes / 1024)} KB` : 'size unrecorded';
    ok(`${slug}: ${v.ageDays < 1 ? 'today' : `${v.ageDays.toFixed(0)} days ago`} ${dim(`(${t.backup.frequency}, ${size})`)}`);
  }
}

console.log('');
if (faults) {
  console.log(`  ${E}31m${faults} salon(s) without a current off-site copy.${E}0m`);
  console.log(`  ${dim('The disk holds all of them. A copy per owner is what survives losing it.')}\n`);
  process.exit(1);
}
console.log(`  ${E}32mEvery salon has a current off-site copy.${E}0m\n`);
process.exit(0);
