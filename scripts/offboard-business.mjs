#!/usr/bin/env node
// Take a business off the platform domain, safely.
//
// The mirror of onboard-business.mjs, and the more dangerous half. Onboarding
// wrong costs you ten minutes; offboarding wrong deletes a DNS record belonging
// to a salon that is still trading, and their booking page stops resolving
// while they are cutting hair.
//
// So this refuses far more than it does:
//
//   - it will only ever touch records whose name IS the business's own
//     subdomain, or ends with "." + that subdomain. Never the apex, never
//     another business, never a record it cannot account for;
//   - it will not touch _dmarc, which belongs to the whole domain — deleting it
//     while offboarding one salon would void DMARC for every other one;
//   - it lists everything first and changes nothing without --apply;
//   - and it tells you, every time, what it is NOT doing: the Render service,
//     the disk, and their Resend and ClickSend accounts are not ours to delete
//     from here, and the data must be handed over before any of this runs.
//
//   export CLOUDFLARE_API_TOKEN=...
//
//   # Look first. This changes nothing.
//   node scripts/offboard-business.mjs --business glowbar
//
//   # Then, once they have their data:
//   node scripts/offboard-business.mjs --business glowbar --apply
//
// Options:
//   --business <name>   required — the subdomain, e.g. "glowbar"
//   --zone <domain>     the platform domain (default kairobookings.com)
//   --apply             actually delete the records
import process from 'node:process';

// Overridable so the deletion logic can be tested against a mock rather than
// against the live zone. There is no safe way to test a delete by running it.
const API = process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const [k, v] = a.includes('=') ? [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a.slice(2), null];
  args.set(k, v ?? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true));
}
const str = (k, d = '') => (typeof args.get(k) === 'string' ? args.get(k).trim() : d);

const APPLY = args.get('apply') === true;
const ZONE = str('zone', 'kairobookings.com');
const BUSINESS = str('business').toLowerCase();

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
};
const good = (l, d = '') => console.log(`  ${c.ok('✓')} ${l} ${c.dim(d)}`);
const warn = (l, d = '') => console.log(`  ${c.warn('!')} ${l} ${c.dim(d)}`);
const note = (l, d = '') => console.log(`  ${c.dim('·')} ${l} ${c.dim(d)}`);

if (!TOKEN) {
  console.error(c.bad('No CLOUDFLARE_API_TOKEN in the environment.'));
  console.error('  export CLOUDFLARE_API_TOKEN=...   (keep it off the command line — that ends up in history and in ps)');
  process.exit(1);
}
// The same rule onboarding used to create it. A name that would not have been
// accepted then cannot identify anything now, and a loose one here is how you
// end up matching more than you meant to.
if (!/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/.test(BUSINESS)) {
  console.error(c.bad('--business must be a plain subdomain:'), 'lowercase letters, numbers and hyphens, e.g. "glowbar"');
  process.exit(1);
}

async function cf(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    throw new Error((data.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`);
  }
  return data.result;
}

const HOST = `${BUSINESS}.${ZONE}`;

/**
 * Does this record belong to THIS business, beyond any doubt?
 *
 * Exact match on their host, or a label under it. Deliberately not a substring
 * test: "glow" must never match "glowbar", and nothing may match the apex or a
 * record sitting directly on the zone.
 */
function belongsToBusiness(name) {
  const n = String(name || '').toLowerCase();
  return n === HOST || n.endsWith(`.${HOST}`);
}

console.log('');
console.log(c.b(`Removing ${HOST}`), APPLY ? c.bad('— APPLYING, THIS DELETES RECORDS') : c.dim('— dry run, nothing will change'));
console.log('');

let zone;
try {
  zone = (await cf('GET', `/zones?name=${encodeURIComponent(ZONE)}`))[0];
} catch (err) {
  console.error(c.bad('  ✗ Could not list zones:'), err.message);
  process.exit(1);
}
if (!zone) {
  console.error(c.bad(`  ✗ No zone called "${ZONE}" is visible to this token.`));
  process.exit(1);
}
const ZID = zone.id;
good('Zone', `${zone.name} · ${zone.plan?.name}`);

const existing = await cf('GET', `/zones/${ZID}/dns_records?per_page=500`);

// Everything that is theirs, and nothing else.
const mine = existing.filter((r) => belongsToBusiness(r.name));

// Belt and braces: prove the filter never caught the domain-wide records, and
// say so out loud rather than trusting the reader to know it didn't.
const dmarcName = `_dmarc.${ZONE}`;
const caughtDmarc = mine.some((r) => r.name === dmarcName);
const caughtApex = mine.some((r) => r.name === ZONE);
if (caughtDmarc || caughtApex) {
  console.error('');
  console.error(c.bad('  ✗ Refusing to continue: the match caught a domain-wide record.'));
  console.error(c.bad('    This is a bug in this script, not something to work around.'));
  process.exit(1);
}

console.log('');
console.log(c.b('DNS records for this business'));
if (!mine.length) {
  good('Nothing found', `no records under ${HOST} — already removed, or never created`);
} else {
  for (const r of mine) {
    const val = r.type === 'TXT' ? `${String(r.content).slice(0, 40)}…` : r.content;
    warn(`${r.type} ${r.name}`, `→ ${val}${r.proxied ? ' · proxied' : ''}`);
  }
}

console.log('');
console.log(c.b('Left alone, deliberately'));
good(dmarcName, 'domain-wide — deleting it would void DMARC for every other business');
note(`${ZONE} and every other business's records`, `${existing.length - mine.length} records untouched`);

// ── the part this script cannot do ──────────────────────────────────────────
console.log('');
console.log(c.b('Not this script\'s job — do these yourself, in this order'));
note('1. Give them their data FIRST', 'Settings → Backups → Download a copy, and Clients → Export. Before anything below.');
note('2. Render', `delete the service "${BUSINESS}-booking" — that deletes the disk and the database with it`);
note('3. Render', `remove the custom domain ${HOST} from the service first if you are keeping the service`);
note('4. Resend', 'the account is theirs — hand it over or close it. Remove the sending domain either way.');
note('5. ClickSend', 'same. Any remaining credit is theirs.');

console.log('');
if (!mine.length) {
  console.log(c.dim('  Nothing to delete.'));
  console.log('');
  process.exit(0);
}

if (!APPLY) {
  console.log(c.b(`  ${mine.length} record${mine.length === 1 ? '' : 's'} would be deleted.`));
  console.log(c.dim('  Re-run with --apply once the business has their data.'));
  console.log('');
  process.exit(0);
}

console.log(c.bad(`  Deleting ${mine.length} record${mine.length === 1 ? '' : 's'}…`));
let removed = 0;
for (const r of mine) {
  // Re-check immediately before deleting. The list was fetched a moment ago and
  // this is the last point at which a mistake is still preventable.
  if (!belongsToBusiness(r.name)) {
    console.error(c.bad(`  ✗ Refusing to delete ${r.name} — it is not under ${HOST}`));
    continue;
  }
  try {
    await cf('DELETE', `/zones/${ZID}/dns_records/${r.id}`);
    good(`Deleted ${r.type} ${r.name}`);
    removed++;
  } catch (err) {
    console.error(c.bad(`  ✗ Could not delete ${r.type} ${r.name}:`), err.message);
  }
}

console.log('');
console.log(c.b(`  ${removed} of ${mine.length} removed.`));
if (removed < mine.length) {
  console.log(c.warn('  Some records are still there — re-run to try again.'));
}
console.log('');
console.log(c.dim(`  ${HOST} will stop resolving within a few minutes.`));
console.log(c.dim('  Keep the final backup somewhere safe for a few months in case they come back.'));
console.log('');
