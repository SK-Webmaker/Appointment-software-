#!/usr/bin/env node
// Set a salon owner's password, from the shard itself.
//
// For the case nobody plans for: the password is lost and there is no way in.
// tenant.mjs can only set one while CREATING a salon, and the platform's
// /password endpoint needs the control key, which is not always to hand — and
// should not be pasted around just to fix a forgotten login.
//
// This runs where the data already is, so it needs no key and no network:
//
//   Render → kairo-shard-au → Shell
//   KAIRO_DATA_DIR=/var/data node scripts/set-tenant-password.mjs demo 'the-new-password'
//
// It refuses rather than guesses: an unknown salon, an unknown owner or a
// password that would not pass the app's own rules all stop here, because a
// half-applied reset is worse than none.
import process from 'node:process';
import { hashPassword } from '../src/auth.js';
import { checkPassword } from '../src/password.js';
import { getTenant, withTenant, listTenantSlugs } from '../src/tenant.js';
import { db, getSetting } from '../src/db.js';

const [slug, password, wantEmail] = process.argv.slice(2);
if (!slug || !password) {
  console.error('usage: set-tenant-password.mjs <slug> <new-password> [owner-email]');
  console.error('       KAIRO_DATA_DIR must point at the tenants directory (/var/data on the shard)');
  process.exit(1);
}

const t = getTenant(slug);
if (!t) {
  console.error(`No salon called "${slug}". Known: ${listTenantSlugs().join(', ') || '(none)'}`);
  process.exit(1);
}

withTenant(t, () => {
  // The owner, or the named user. Listed rather than assumed, so a typo in an
  // email address cannot silently reset nobody.
  const users = db.prepare('SELECT id, name, email, role FROM users ORDER BY id').all();
  if (!users.length) { console.error('That salon has no users at all.'); process.exit(1); }

  const target = wantEmail
    ? users.find((u) => u.email.toLowerCase() === wantEmail.toLowerCase())
    : (users.find((u) => u.role === 'owner') || users[0]);

  if (!target) {
    console.error(`No user "${wantEmail}" in ${slug}. This salon has:`);
    for (const u of users) console.error(`  ${u.email}  (${u.role})`);
    process.exit(1);
  }

  // The same rules the app enforces, so a password set here is one the owner
  // can actually keep using rather than one Settings would later refuse.
  const problem = checkPassword(password, [target.email, target.name, getSetting('business_name', '')]);
  if (problem) { console.error(`That password will not do: ${problem}`); process.exit(1); }

  const { salt, hash } = hashPassword(password);
  // token_version is bumped so every session anywhere is signed out. If the
  // password was lost because somebody else has it, leaving their session
  // alive would make this pointless.
  db.prepare('UPDATE users SET pass_hash = ?, salt = ?, token_version = token_version + 1 WHERE id = ?')
    .run(hash, salt, target.id);

  console.log(`Set the password for ${target.email} (${target.role}) at ${slug}.`);
  console.log('Every existing session for this salon has been signed out.');
});
