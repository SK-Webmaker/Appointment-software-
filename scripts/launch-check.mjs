#!/usr/bin/env node
// What is still in the way of launching — answered by looking, not remembering.
//
// Launch blockers are not bugs. Nothing crashes, no test goes red, and the
// product works perfectly for the two salons already on it. They are things
// like a Terms of Service that still says "[legal name, ABN]", or a Privacy
// Policy URL that 404s — each of which is a rejected App Store submission or a
// document that cannot be relied on, and each of which is invisible until
// somebody goes looking. This goes looking.
//
//   node scripts/launch-check.mjs
//   node scripts/launch-check.mjs --origin https://kairobookings.com
//
// Exit 0 means nothing repo-side is blocking. Exit 1 means something is, and
// it is named. The `--origin` form additionally checks the URLs the App Store
// listing hard-codes, which cannot be changed after submission.
//
// It deliberately does NOT fail on things only a person can do (paying Apple,
// setting a secret in a dashboard). Those are listed at the end as a hand-over,
// because a check that fails on something you cannot fix teaches you to ignore
// it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d = '') => { const i = argv.indexOf(`--${n}`); return i >= 0 ? String(argv[i + 1] ?? '') : d; };
const origin = arg('origin').replace(/\/+$/, '');

const E = '\x1b[';
const c = {
  b: (s) => `${E}1m${s}${E}0m`,
  dim: (s) => `${E}2m${s}${E}0m`,
  ok: (s) => `${E}32m${s}${E}0m`,
  bad: (s) => `${E}31m${s}${E}0m`,
  warn: (s) => `${E}33m${s}${E}0m`,
};

const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } };
const rows = [];
/** blocking: a launch cannot happen with this unresolved. */
const check = (label, pass, detail = '', { blocking = true } = {}) => rows.push({ label, pass, detail, blocking });

// ── 1. Unfilled placeholders in documents that become promises ─────────────
// A policy page is a legal document the moment it is published. Shipping one
// containing "[legal name, ABN]" is worse than shipping none.
const POLICY_FILES = ['platform/public/terms.html', 'platform/public/privacy.html',
  'platform/public/refunds.html', 'platform/public/support.html'];
const PLACEHOLDER = /\[(legal name[^\]]*|support email|ABN|your name)\]/gi;
for (const f of POLICY_FILES) {
  const src = read(f);
  if (src === null) { check(`${f} exists`, false, 'missing'); continue; }
  const found = [...new Set((src.match(PLACEHOLDER) || []))];
  check(`${path.basename(f)} has no unfilled blanks`, found.length === 0, found.join(', '));
}

// ── 2. The identifiers that must agree, or the build will not sign ─────────
const proj = read('ios/project.yml') || '';
const push = read('src/push.js') || '';
const wf = read('.github/workflows/ios.yml') || '';
const BUNDLE = 'com.kairobookings.kairo';
check('iOS project uses the expected bundle id', proj.includes(BUNDLE), BUNDLE);
check('the push sender defaults to the same bundle id', push.includes(BUNDLE), BUNDLE);
for (const secret of ['APPLE_TEAM_ID', 'ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8']) {
  check(`the release workflow reads ${secret}`, wf.includes(secret), '', { blocking: false });
}

// ── 3. The platform can actually be deployed ───────────────────────────────
const bp = read('platform/render.yaml');
check('the platform has a Render blueprint', bp !== null, 'platform/render.yaml');
if (bp) {
  // A disk that is declared but not pointed at is the failure that destroys
  // every signup record on the next deploy, silently.
  check('the blueprint mounts a disk', /disk:/.test(bp) && /mountPath:/.test(bp));
  check('the blueprint points the database at that disk',
    /PLATFORM_DATA_DIR/.test(bp) && /\/var\/data/.test(bp));
  check('the blueprint turns auto-deploy off', /autoDeploy:\s*false/.test(bp));
  // Sending is as load-bearing as the money: without it nobody finishes signing up.
  for (const v of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'KAIRO_PLATFORM_KEY',
    'RESEND_API_KEY', 'PLATFORM_FROM_EMAIL', 'CLICKSEND_USERNAME', 'CLICKSEND_API_KEY']) {
    check(`the blueprint declares ${v}`, bp.includes(v));
  }
}

// ── 4. Every environment variable the code reads is accounted for ──────────
// Dead config is harmless; missing config is a silent dead end in the funnel.
const platformSrc = fs.readdirSync(path.join(ROOT, 'platform'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => read(`platform/${f}`) || '').join('\n');
const readVars = new Set([...platformSrc.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]));
// Knobs with safe defaults, deliberately not required in production.
const OPTIONAL = new Set(['ABR_API_BASE', 'ABR_GUID', 'CLOUDFLARE_API_BASE', 'RESEND_API_BASE',
  'RESEND_REGION', 'RESEND_VERIFY_TRIES', 'RESEND_VERIFY_WAIT_MS', 'STRIPE_API_BASE',
  'CLICKSEND_API_BASE', 'PLATFORM_RATELIMIT', 'KAIRO_REFUND_DAYS', 'KAIRO_DELETE_GRACE_DAYS',
  'CLICKSEND_FROM', 'KAIRO_PRICE_CENTS', 'PLATFORM_PORT', 'PLATFORM_HOST', 'NODE_VERSION']);
if (bp) {
  const missing = [...readVars].filter((v) => !OPTIONAL.has(v) && !bp.includes(v)).sort();
  check('every required variable the platform reads is in the blueprint',
    missing.length === 0, missing.join(', '));
}

// ── 4b. The support address can actually receive mail ──────────────────────
// A support address is published in the App Store listing and in the policies,
// where it cannot be quietly changed later. "It is typed in the HTML" is not
// the same as "mail sent to it arrives" — a domain with no MX records accepts
// nothing, silently, and the sender gets a bounce nobody sees.
const supportSrc = read('platform/public/support.html') || '';
const addr = (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.exec(supportSrc) || [])[0] || '';
check('a support address is published', Boolean(addr), addr);

// ── 5. The App Store listing's own URLs ────────────────────────────────────
const listing = read('docs/app-store/07-phase-7-launch.md') || '';
const listed = [...new Set([...listing.matchAll(/https:\/\/kairobookings\.com(\/[a-z-]*)/g)].map((m) => m[1]))]
  .filter((p) => p && p !== '/');

async function main() {
  // Mail exchangers for the support domain. Cloudflare Email Routing publishes
  // route*.mx.cloudflare.net; a Workspace mailbox publishes Google's. Either is
  // fine — none at all means mail to that address goes nowhere.
  if (addr) {
    const domain = addr.split('@')[1];
    let mx = [];
    try {
      const dns = await import('node:dns/promises');
      mx = await dns.resolveMx(domain);
    } catch { mx = []; }
    check(`${domain} can receive mail`, mx.length > 0,
      mx.length ? mx.map((m) => m.exchange).join(', ') : 'no MX records — mail to this address will bounce');
  }

  if (origin) {
    for (const p of [...new Set([...listed, '/privacy', '/support', '/terms', '/refunds', '/start'])]) {
      let status = 0;
      try {
        const res = await fetch(origin + p, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
        status = res.status;
      } catch { status = 0; }
      check(`${origin}${p} answers`, status === 200, status ? `http ${status}` : 'unreachable');
    }
  }

  console.log(`\n${c.b('  Kairo — what is still in the way of launching')}`);
  if (!origin) console.log(c.dim('  (repo only. Add --origin https://… to also check the live URLs.)'));
  console.log('');

  let blocking = 0;
  let advisory = 0;
  for (const r of rows) {
    if (r.pass) { console.log(`  ${c.ok('✓')} ${r.label}${r.detail ? c.dim(`  ${r.detail}`) : ''}`); continue; }
    if (r.blocking) { blocking += 1; console.log(`  ${c.bad('✗')} ${r.label}${r.detail ? c.dim(`  — ${r.detail}`) : ''}`); }
    else { advisory += 1; console.log(`  ${c.warn('!')} ${r.label}${r.detail ? c.dim(`  — ${r.detail}`) : ''}`); }
  }

  console.log(`\n${c.b('  Needs a person, not this script')}`);
  for (const line of [
    'Apple Developer Program enrolment (A$149, 1–2 days) — everything iOS waits on it',
    'The four GitHub secrets, once Apple approves: APPLE_TEAM_ID, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8',
    'The APNs key on the shard: KAIRO_APNS_KEY, KAIRO_APNS_KEY_ID, KAIRO_APNS_TEAM_ID, KAIRO_APPLE_APP_ID',
    'Stripe live keys and the webhook secret on the platform service',
    'Decide what serves the apex — the marketing site or the platform (see platform/render.yaml)',
    'Cloudflare → Email Routing → add the support@ rule (MX is already live; the address just needs a destination)',
    'The seller name in the Terms — the one remaining blocker. See docs/app-store/LEGAL-TODO.md',
  ]) console.log(`  ${c.dim('·')} ${line}`);

  console.log('');
  if (blocking) {
    console.log(c.bad(`  ${blocking} thing${blocking === 1 ? '' : 's'} blocking launch.`) + (advisory ? c.dim(`  (${advisory} advisory)`) : ''));
    console.log('');
    process.exit(1);
  }
  console.log(c.ok('  Nothing in the repo is blocking launch.') + (advisory ? c.dim(`  ${advisory} advisory.`) : ''));
  console.log('');
}

await main();
