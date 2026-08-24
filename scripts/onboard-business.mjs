#!/usr/bin/env node
// Give a new business its own address on the platform domain.
//
// Every business that joins gets `<business>.kairobookings.com`: the booking
// page customers see, and the domain its confirmation emails are sent from.
// That is four DNS records, and three of them are Resend's — the kind of thing
// that is fine to do by hand once and reliably wrong by the fifth time, at 9pm,
// when a truncated DKIM key means every email silently lands in spam.
//
// So it is a script. The fifth business is set up exactly like the first.
//
//   export CLOUDFLARE_API_TOKEN=...
//
//   # Look first — this changes nothing.
//   node scripts/onboard-business.mjs --business glowbar --service glowbar-booking
//
//   # Then, with the three values Resend gives you when you add the domain:
//   node scripts/onboard-business.mjs --business glowbar --service glowbar-booking \
//     --dkim "p=MIGfMA0GCS..." --apply
//
// Options:
//   --business <name>    required — the subdomain, e.g. "glowbar"
//   --service <name>     the Render service, e.g. "glowbar-booking"
//                        (the ".onrender.com" is added for you)
//   --dkim <p=...>       the DKIM value from Resend → Domains → your subdomain
//   --region <code>      Resend's region for the MX host (default ap-northeast-1,
//                        which is the right one for Australia)
//   --zone <domain>      the platform domain (default kairobookings.com)
//   --apply              actually create the records
import process from 'node:process';

const API = 'https://api.cloudflare.com/client/v4';
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
const SERVICE = str('service');
const DKIM = str('dkim');
const REGION = str('region', 'ap-northeast-1');

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
// A subdomain becomes part of the business's public identity and goes into
// every email header. Refuse anything that would need escaping later.
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
const SEND = `send.${BUSINESS}.${ZONE}`;
const DKIM_NAME = `resend._domainkey.${BUSINESS}.${ZONE}`;

// --render prints the blueprint filled in for this business. Render has no
// variables in blueprints and refuses a duplicate service name, so the file in
// the repo is a template and this is what turns it into one business's copy.
if (args.get('render') === true) {
  const svc = SERVICE || `${BUSINESS}-booking`;
  const region = str('render-region', 'singapore');
  const fs = await import('node:fs');
  const url = await import('node:url');
  const path = await import('node:path');
  const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
  const yaml = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8')
    .replace(/^    name: CHANGEME-booking$/m, `    name: ${svc.replace(/\.onrender\.com$/, '')}`)
    .replace(/^    region: singapore$/m, `    region: ${region}`);
  console.log(yaml);
  console.error(`\n# Paste the above as render.yaml, or set these two on the service by hand:`);
  console.error(`#   name:   ${svc.replace(/\.onrender\.com$/, '')}`);
  console.error(`#   region: ${region}`);
  console.error(`# Then add the custom domain ${HOST} on the service's Settings page.\n`);
  process.exit(0);
}

console.log('');
console.log(c.b(`Onboarding ${HOST}`), APPLY ? c.warn('— APPLYING') : c.dim('— dry run, nothing will change'));
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
const find = (type, name, startsWith = '') => existing.find((r) =>
  r.type === type && r.name === name && (!startsWith || String(r.content).startsWith(startsWith)));

const planned = [];
const plan = (label, detail, record) => planned.push({ label, detail, record });

// ── 1. the booking page ─────────────────────────────────────────────────────
console.log('');
console.log(c.b('Booking page'));
const site = existing.find((r) => r.name === HOST && ['A', 'AAAA', 'CNAME'].includes(r.type));
if (site) {
  good(`${site.type} ${HOST} → ${site.content}`, site.proxied ? 'proxied' : 'DNS-only');
  if (!site.proxied) {
    note('Not proxied yet', 'that is correct until Render has issued its certificate — then turn it on');
  }
} else if (!SERVICE) {
  warn(`No record for ${HOST}`, 'pass --service <render-service-name> to create it');
} else {
  const target = SERVICE.includes('.') ? SERVICE : `${SERVICE}.onrender.com`;
  warn(`No record for ${HOST}`, `will add CNAME → ${target}`);
  // DNS-only deliberately: Render verifies the domain and issues its
  // certificate by talking to the origin. Behind Cloudflare's proxy it sees
  // Cloudflare instead and the certificate never issues. Proxy goes on after.
  plan(`Add the booking page record`, `CNAME ${HOST} → ${target} (DNS-only)`, {
    type: 'CNAME', name: HOST, content: target, proxied: false, ttl: 300,
    comment: `Kairo — ${BUSINESS}. DNS-only until Render issues its certificate, then proxy on.`,
  });
}

// ── 2. email, so confirmations come from their own domain ───────────────────
console.log('');
console.log(c.b('Email (Resend)'));
const mxHost = `feedback-smtp.${REGION}.amazonses.com`;
const spf = 'v=spf1 include:amazonses.com ~all';

if (find('MX', SEND)) good(`MX ${SEND}`, 'already set');
else {
  warn(`MX ${SEND}`, `will add → ${mxHost}`);
  plan('Add the bounce-handling MX', `${SEND} → ${mxHost}`,
    { type: 'MX', name: SEND, content: mxHost, priority: 10, ttl: 300, comment: `Resend — ${BUSINESS}` });
}

if (find('TXT', SEND, '"v=spf1') || find('TXT', SEND, 'v=spf1')) good(`TXT ${SEND}`, 'SPF already set');
else {
  warn(`TXT ${SEND}`, 'will add SPF');
  plan('Add SPF', spf, { type: 'TXT', name: SEND, content: spf, ttl: 300, comment: `Resend SPF — ${BUSINESS}` });
}

const dkimExisting = existing.find((r) => r.type === 'TXT' && r.name === DKIM_NAME);
if (dkimExisting) {
  good(`TXT ${DKIM_NAME}`, 'DKIM already set');
} else if (!DKIM) {
  warn(`TXT ${DKIM_NAME}`, 'missing, and no --dkim given');
  note('', 'Resend → Domains → add the subdomain → copy the DKIM value, then re-run with --dkim "p=..."');
} else {
  // A DKIM key truncated on the way through a dashboard produces mail that
  // sends fine and fails authentication everywhere — the worst failure mode
  // there is, because nothing reports it. Check the length before trusting it.
  const clean = DKIM.replace(/^"|"$/g, '').trim();
  if (!/^p=/.test(clean)) {
    warn('The DKIM value does not start with "p="', 'paste the whole record value, not just part of it');
  } else if (clean.length < 200) {
    warn(`The DKIM value looks truncated`, `${clean.length} characters — a real one is 250+. Copy it again.`);
  } else {
    warn(`TXT ${DKIM_NAME}`, `will add DKIM (${clean.length} chars)`);
    plan('Add DKIM', `${clean.slice(0, 28)}…`,
      { type: 'TXT', name: DKIM_NAME, content: clean, ttl: 300, comment: `Resend DKIM — ${BUSINESS}` });
  }
}

// ── 3. DMARC — once for the whole domain, ever ──────────────────────────────
console.log('');
console.log(c.b('DMARC'));
const dmarc = existing.find((r) => r.type === 'TXT' && r.name === `_dmarc.${ZONE}`);
if (dmarc) {
  // Two DMARC records on one domain is not "more protection" — receivers see an
  // ambiguous policy and treat the domain as having none at all, for every
  // business on it. This is why it is checked rather than assumed.
  good(`_dmarc.${ZONE}`, `already set — leaving it alone (a second record would void DMARC for every business)`);
} else {
  warn(`_dmarc.${ZONE}`, 'missing — will add the one policy record for the whole domain');
  plan('Add DMARC (once for the domain)', 'v=DMARC1; p=none;',
    { type: 'TXT', name: `_dmarc.${ZONE}`, content: 'v=DMARC1; p=none;', ttl: 300, comment: 'Domain-wide. One record only.' });
}

// ── do it ───────────────────────────────────────────────────────────────────
console.log('');
if (!planned.length) {
  console.log(c.ok(`${HOST} is already set up.`));
  console.log('');
  process.exit(0);
}
console.log(c.b(`${planned.length} record${planned.length === 1 ? '' : 's'} to create:`));
planned.forEach((p, i) => console.log(`  ${i + 1}. ${p.label} ${c.dim(p.detail)}`));
console.log('');

if (!APPLY) {
  console.log(c.dim('Dry run — nothing was changed. Re-run with --apply.'));
  console.log('');
  process.exit(0);
}

let failed = 0;
for (const p of planned) {
  try {
    await cf('POST', `/zones/${ZID}/dns_records`, p.record);
    console.log(`  ${c.ok('✓')} ${p.label}`);
  } catch (err) {
    failed++;
    console.log(`  ${c.bad('✗')} ${p.label} — ${err.message}`);
  }
}

console.log('');
if (failed) {
  console.log(c.bad(`${failed} record${failed === 1 ? '' : 's'} failed.`));
  process.exit(1);
}
console.log(c.ok('Done.'), c.dim('What happens next:'));
console.log(c.dim(`  1. In Render, add the custom domain ${HOST} to the service.`));
console.log(c.dim('  2. Wait for its green tick (the certificate).'));
console.log(c.dim(`  3. Turn the Cloudflare proxy on for ${HOST}.`));
console.log(c.dim('  4. In Resend, hit Verify on the domain.'));
console.log(c.dim(`  5. In Kairo → Settings: set the website address to https://${HOST},`));
console.log(c.dim(`     the from address to hello@${SEND}, and who replies go to.`));
console.log('');
