#!/usr/bin/env node
// Manage the salons a multi-tenant Kairo serves. Everything is a folder under
// $KAIRO_DATA_DIR/tenants/<slug>/ with a kairo.db and a tenant.json; the
// running server notices a new folder on the next request, and a changed
// tenant.json on the next request after it is saved. No restart needed.
//
//   KAIRO_DATA_DIR=/var/data node scripts/tenant.mjs create abchair \
//       --name "ABC Hair Studio" --email owner@example.com --password 'their-chosen-password' \
//       [--public-url https://abchair.kairobookings.com] [--phone 03...] [--tz Australia/Melbourne] [--seed none|demo]
//   node scripts/tenant.mjs list
//   node scripts/tenant.mjs set abchair read_only=1        # maintenance for one salon
//   node scripts/tenant.mjs set abchair muted=1            # rehearsal copy: nothing is ever sent
//   node scripts/tenant.mjs set abchair deleted=1          # serve nothing at its address (folder kept)
//
// Passwords are hashed here (scrypt) and only the hash is written, so the
// plaintext never sits in a file.
import process from 'node:process';
import path from 'node:path';
import { hashPassword } from '../src/auth.js';
import { createTenant, listTenantSlugs, updateTenantConfig, withTenant, getTenant, TENANTS_DIR, BASE_DOMAIN } from '../src/tenant.js';
import { setSetting, getSetting } from '../src/db.js';

const [cmd, slug, ...rest] = process.argv.slice(2);
const opts = new Map();
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { opts.set(rest[i].slice(2), rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true); }
}
const str = (k, d = '') => (typeof opts.get(k) === 'string' ? opts.get(k).trim() : d);

function usage(code = 1) {
  console.error('usage: tenant.mjs create <slug> --name <n> --email <e> --password <p> [--public-url u] [--phone p] [--tz z] [--seed none|demo]');
  console.error('       tenant.mjs list | set <slug> key=value ...');
  process.exit(code);
}

if (cmd === 'list') {
  const slugs = listTenantSlugs();
  if (!slugs.length) { console.log(`(no tenants under ${TENANTS_DIR})`); process.exit(0); }
  for (const s of slugs) {
    const t = getTenant(s);
    const name = t ? withTenant(t, () => getSetting('business_name', '')) : '';
    const flags = [t?.config.read_only && 'read-only', t?.config.muted && 'muted'].filter(Boolean).join(', ');
    console.log(`  ${s.padEnd(24)} ${name.padEnd(30)} https://${s}.${BASE_DOMAIN}${flags ? `  [${flags}]` : ''}`);
  }
  process.exit(0);
}

if (cmd === 'set') {
  if (!slug || !rest.length) usage();
  const patch = {};
  for (const kv of rest) {
    const [k, v] = kv.split('=');
    if (!k || v === undefined) usage();
    patch[k] = v === '1' || v === 'true' ? true : v === '0' || v === 'false' ? false : v;
  }
  const cfg = updateTenantConfig(slug, patch);
  console.log(JSON.stringify(cfg, null, 2));
  process.exit(0);
}

if (cmd === 'create') {
  if (!slug || !str('name') || !str('email') || !str('password')) usage();
  const { salt, hash } = hashPassword(str('password'));
  const t = createTenant(slug, {
    name: str('name'),
    public_url: str('public-url', `https://${slug}.${BASE_DOMAIN}`),
    seed: str('seed', 'none'),
    owner: { name: str('owner-name', 'Owner'), email: str('email').toLowerCase(), pass_hash: hash, salt },
  });
  withTenant(t, () => {
    setSetting('business_name', str('name'));
    if (str('phone')) setSetting('business_phone', str('phone'));
    if (str('tz')) setSetting('business_tz', str('tz'));
    setSetting('business_email', str('email').toLowerCase());
    setSetting('currency', str('currency', '$'));
    setSetting('currency_code', str('currency-code', 'aud'));
    setSetting('tax_rate', str('tax-rate', '10'));
  });
  console.log(`created ${slug}`);
  console.log(`  folder    ${path.join(TENANTS_DIR, slug)}`);
  console.log(`  address   https://${slug}.${BASE_DOMAIN}`);
  console.log(`  sign in   ${str('email').toLowerCase()}`);
  process.exit(0);
}

usage();
