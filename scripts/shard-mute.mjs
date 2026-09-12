#!/usr/bin/env node
// Mute or unmute one salon on a remote shard — and prove it took.
//
// A muted tenant runs normally and sends nothing: src/notify.js marks every
// message "skipped" instead of delivering it. That is what makes it safe to
// copy a live salon onto the shard while the original is still the one serving
// customers. Two copies of one salon both sending is two reminders on a
// client's phone, and the guard against that — the unique index on
// automation_sends — lives INSIDE one database, so it cannot see the other.
//
// The whole point of this file is the read-back. Unmuting is one PATCH, and a
// PATCH that silently did nothing looks exactly like one that worked. A salon
// left muted after its cutover sends no confirmations at all and says nothing
// about it; the owner finds out when a client asks why they never got one. So
// this asks the shard what the tenant looks like afterwards, and fails loudly
// unless the answer is what was asked for.
//
//   KAIRO_SHARD_URL=https://kairo-shard-au.onrender.com \
//   KAIRO_PLATFORM_KEY=… \
//   node scripts/shard-mute.mjs --slug hairbysha --off
//
//   --off   unmute: sending resumes. This is the cutover step.
//   --on    mute: nothing is sent. This is how a rehearsal copy is imported.
//   neither: report the current state and change nothing.
import * as shard from '../platform/shard.js';

const argv = process.argv.slice(2);
const arg = (n, d = '') => { const i = argv.indexOf(`--${n}`); return i >= 0 ? String(argv[i + 1] ?? '') : d; };
const has = (n) => argv.includes(`--${n}`);

const slug = arg('slug');
const on = has('on');
const off = has('off');

if (!slug || (on && off) || !process.env.KAIRO_PLATFORM_KEY || !process.env.KAIRO_SHARD_URL) {
  console.error(`
  Mute or unmute one salon on a shard, and prove it took.

    KAIRO_SHARD_URL=… KAIRO_PLATFORM_KEY=… \\
    node scripts/shard-mute.mjs --slug <slug> [--on|--off]

    --off   unmute: sending resumes (the cutover step)
    --on    mute: nothing is sent (importing a rehearsal copy)
    neither report the current state, change nothing
`);
  process.exit(2);
}

const E = '[';
const ok = (s) => console.log(`  ${E}32m✓${E}0m ${s}`);
const bad = (s) => console.log(`  ${E}31m✗${E}0m ${s}`);

/** What the shard says about this salon right now. */
async function state() {
  const t = await shard.getTenant(slug);
  if (!t) { bad(`no salon called "${slug}" on ${shard.SHARD_URL()}`); process.exit(1); }
  return t;
}

console.log('');
let t = await state();
const was = t.muted === true;
console.log(`  ${slug} on ${shard.SHARD_URL()}`);
console.log(`  currently: ${was ? 'MUTED — nothing is sent' : 'sending'}${t.email_sending ? `, email via ${t.email_sending}` : ''}`);

if (!on && !off) { console.log(''); process.exit(0); }

const want = on;
if (was === want) {
  ok(`already ${want ? 'muted' : 'unmuted'} — nothing to do`);
  console.log('');
  process.exit(0);
}

await shard.patchTenant(slug, { muted: want });

// The read-back. Asking the shard again rather than trusting the PATCH's own
// answer, because the question is what the shard will DO on the next message,
// and only a fresh read answers that.
t = await state();
if (t.muted !== want) {
  bad(`the shard still reports muted=${t.muted} after asking for ${want}. Nothing here can be assumed; stop.`);
  console.log('');
  process.exit(1);
}

ok(`now ${want ? 'MUTED — nothing will be sent' : 'unmuted — sending has resumed'}`);

// Unmuting a salon that cannot send is not a success. It is the same outcome
// as staying muted, arrived at differently, and it is worth saying out loud at
// the moment somebody is watching rather than the next morning.
if (!want) {
  if (t.email_sending === 'none') {
    bad('but this salon has no way to send email at all — check its Resend settings before anyone books');
    console.log('');
    process.exit(1);
  }
  // A shard older than the shared-sending change does not report this field at
  // all, and `undefined` printed as a reassurance is worse than no reassurance.
  // Say which of the two situations this is, rather than dressing one as the
  // other: the salon is unmuted either way, but only one of them has been
  // checked.
  if (!t.email_sending) {
    console.log('  · this shard does not report how the salon sends, so that part is unverified');
    console.log('    — prove it with the test booking’s confirmation email instead');
  } else {
    ok(`email will go out via: ${t.email_sending}`);
  }
}
console.log('');
process.exit(0);
