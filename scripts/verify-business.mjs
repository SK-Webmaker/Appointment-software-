#!/usr/bin/env node
// Is this business actually set up correctly? One command, every check.
//
// Written after an onboarding that took a morning instead of an hour. Every
// failure that day was silent in a different way:
//
//   - the booking-page CNAME was never created, so the custom domain sat
//     "pending" in Render with nothing saying why;
//   - the From address was on the send. subdomain, which holds the bounce
//     records and is not a sending identity, so Resend refused it — and the
//     error named no setting;
//   - a service was built by hand with a build command that does nothing and
//     could only fail;
//   - and none of it was visible until a real customer would have been the one
//     to notice.
//
// Every check below exists because something in that list was true and nothing
// said so. It reads; it changes nothing.
//
//   node scripts/verify-business.mjs --business horahaircutz
//
// Options:
//   --business <name>  required — the subdomain, e.g. "horahaircutz"
//   --zone <domain>    the platform domain (default kairobookings.com)
//   --mail-domain <d>  the sending domain, when the app cannot be reached to ask
//   --json             machine-readable output, for wiring into something else
import process from 'node:process';
import dns from 'node:dns/promises';

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const [k, v] = a.includes('=') ? [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a.slice(2), null];
  args.set(k, v ?? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true));
}
const str = (k, d = '') => (typeof args.get(k) === 'string' ? args.get(k).trim() : d);

const ZONE = str('zone', 'kairobookings.com');
const BUSINESS = str('business').toLowerCase();
const JSON_OUT = args.get('json') === true;

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
};

if (!/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/.test(BUSINESS)) {
  console.error(c.bad('--business must be a plain subdomain:'), 'lowercase letters, numbers and hyphens, e.g. "horahaircutz"');
  process.exit(1);
}

const HOST = `${BUSINESS}.${ZONE}`;
const SERVICE = `${BUSINESS}-booking`;
const ORIGIN = `https://${HOST}`;

// Filled in from the app's own public info, so the email checks look at the
// domain this business really sends from rather than the one it was born on.
let MAIL_DOMAIN_FROM_APP = '';

// Each result: { level, label, detail, fix }
const results = [];
const pass = (label, detail = '') => results.push({ level: 'pass', label, detail });
const warn = (label, detail = '', fix = '') => results.push({ level: 'warn', label, detail, fix });
const fail = (label, detail = '', fix = '') => results.push({ level: 'fail', label, detail, fix });

const get = async (url, opts = {}) => {
  const ctl = AbortSignal.timeout(15000);
  try {
    const res = await fetch(url, { signal: ctl, redirect: 'manual', ...opts });
    const body = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, headers: res.headers, body };
  } catch (err) {
    return { ok: false, status: 0, headers: new Headers(), body: '', error: err.message };
  }
};

// ── DNS ─────────────────────────────────────────────────────────────────────
// The booking page's own record is the one that was missing, and the symptom
// was a Render custom domain that never verified rather than anything saying
// "there is no DNS record".
{
  let addrs = [];
  try { addrs = await dns.resolve4(HOST).catch(() => dns.resolve6(HOST)); } catch { addrs = []; }
  if (!addrs.length) {
    fail('The booking address does not resolve', HOST,
      `Cloudflare → DNS → Add record → CNAME  ${BUSINESS}  →  ${SERVICE}.onrender.com  (DNS only, grey cloud)`);
  } else {
    // Cloudflare's anycast ranges vs Render's own. Which one answers tells you
    // whether the proxy is on, which is the difference between the WAF applying
    // and not.
    const proxied = addrs.some((a) => /^(104\.|172\.6[4-9]\.|172\.7[0-1]\.|2606:4700)/.test(a));
    pass('Booking address resolves', `${HOST} → ${addrs[0]}`);
    if (proxied) pass('Cloudflare proxy is on', 'the WAF and bot filtering apply to this business');
    else {
      warn('Cloudflare proxy is OFF', `${HOST} answers straight from Render`,
        'Correct while Render is issuing the certificate. Once it has a green tick, set the CNAME to orange cloud.');
    }
  }

}

// ── The app itself ──────────────────────────────────────────────────────────
{
  const v = await get(`${ORIGIN}/api/version`);
  if (!v.ok) {
    fail('The app is not answering', `${ORIGIN}/api/version → ${v.status || v.error}`,
      'Render → the service → Logs. Look for "Kairo cannot start" or "DATA WILL BE LOST".');
  } else {
    let version = '';
    try { version = JSON.parse(v.body).version || ''; } catch { /* not json */ }
    pass('The app is running', `v${version || '?'}`);
  }

  const book = await get(`${ORIGIN}/book`);
  if (book.ok) pass('The booking page loads', `${ORIGIN}/book`);
  else fail('The booking page does not load', `${book.status || book.error}`, 'Check the service is live in Render.');

  // TLS: fetch() rejects an invalid chain outright, so reaching here at all
  // means the certificate verified.
  if (v.status || book.status) pass('HTTPS certificate is valid', 'verified by the request succeeding');
}

// ── Is it telling customers the right address? ──────────────────────────────
// A booking link on the onrender.com hostname works perfectly, which is exactly
// why nobody reports it — the salon just quietly hands out the wrong address
// until it is printed on something.
{
  const info = await get(`${ORIGIN}/api/public/info`);
  if (!info.ok) {
    warn('Could not read the public business info', String(info.status || info.error));
  } else {
    let data = {};
    try { data = JSON.parse(info.body); } catch { /* not json */ }
    MAIL_DOMAIN_FROM_APP = String(data.mail_domain || '').trim();
    if (data.business_name) {
      if (/^luxe hair studio$/i.test(String(data.business_name))) {
        warn('Still showing the demo business', 'Luxe Hair Studio',
          'Correct before handover — the owner\'s setup wizard clears it on first sign-in.');
      } else {
        pass('Business name is set', data.business_name);
      }
    }
    for (const [label, key, fix] of [
      ['Business phone', 'business_phone', 'Settings → Business profile. Without it the cancel email cannot tell clients who to ring.'],
      ['Business address', 'business_address', 'Settings → Business profile.'],
    ]) {
      if (String(data[key] || '').trim()) pass(`${label} is set`, data[key]);
      else warn(`${label} is empty`, '', fix);
    }
  }
}

// ── Email, on whatever domain this business actually sends from ─────────────
// Asking the app rather than assuming the platform domain: a business moved to
// its own domain has its DKIM and SPF over there, and checking the wrong place
// produces a confident "records missing" against email that works. That false
// alarm is worse than no check — it sends you editing live DNS for nothing.
{
  const mailDomain = str('mail-domain') || MAIL_DOMAIN_FROM_APP;
  if (!mailDomain) {
    warn('Email is not configured yet', 'no From address set',
      'Settings → Notifications → Resend API key and From email. Expected here: hello@' + HOST);
  } else {
    const onPlatform = mailDomain === HOST;
    if (!onPlatform) {
      pass('Sends from its own domain', mailDomain);
    }
    // The trap that cost a morning: send.<domain> carries the bounce records
    // and is not a sending identity, so a From address there is refused.
    if (/^send\./i.test(mailDomain)) {
      fail('The From address is on the send. subdomain', mailDomain,
        `That subdomain only carries MX and SPF. Settings → Notifications → From email → hello@${mailDomain.replace(/^send\./i, '')}`);
    }
    for (const [label, name, type] of [
      ['DKIM', `resend._domainkey.${mailDomain}`, 'TXT'],
      ['SPF', `send.${mailDomain}`, 'TXT'],
      ['bounce MX', `send.${mailDomain}`, 'MX'],
    ]) {
      try {
        const recs = type === 'MX' ? await dns.resolveMx(name) : await dns.resolveTxt(name);
        if (recs.length) pass(`${label} record present`, name);
        else throw new Error('empty');
      } catch {
        fail(`${label} record missing`, name,
          label === 'DKIM'
            ? 'Resend → Domains → this domain → copy the DKIM, then add it in Cloudflare as a TXT record'
            : `Re-run scripts/onboard-business.mjs --business ${BUSINESS} --apply`);
      }
    }
  }
}

// ── Security posture ────────────────────────────────────────────────────────
{
  const root = await get(`${ORIGIN}/`);
  const h = root.headers;
  const need = [
    ['Content-Security-Policy', 'content-security-policy'],
    ['HSTS', 'strict-transport-security'],
    ['X-Frame-Options', 'x-frame-options'],
    ['X-Content-Type-Options', 'x-content-type-options'],
  ];
  const missing = need.filter(([, k]) => !h.get(k));
  if (!missing.length) pass('Security headers present', need.map(([n]) => n).join(', '));
  else fail('Security headers missing', missing.map(([n]) => n).join(', '), 'This should never happen — tell me.');

  // The raw hosting address walks past Cloudflare entirely: no WAF, no bot
  // filtering, no rate limiting by real IP. It cannot be turned off on Render,
  // so the origin lock is the only thing that closes it.
  const raw = await get(`https://${SERVICE}.onrender.com/api/version`);
  if (raw.ok) {
    warn('Reachable directly, bypassing Cloudflare', `${SERVICE}.onrender.com answers`,
      'Settings → Security → origin lock: run it in monitor mode first, then enforce. Until then Cloudflare is optional for anyone who finds this address.');
  } else {
    pass('The raw hosting address is closed', `${SERVICE}.onrender.com → ${raw.status || 'unreachable'}`);
  }
}

// ── Output ──────────────────────────────────────────────────────────────────
const fails = results.filter((r) => r.level === 'fail');
const warns = results.filter((r) => r.level === 'warn');

if (JSON_OUT) {
  console.log(JSON.stringify({ business: BUSINESS, host: HOST, service: SERVICE, results }, null, 2));
  process.exit(fails.length ? 1 : 0);
}

console.log('');
console.log(c.b(`Checking ${HOST}`));
console.log('');
for (const r of results) {
  const mark = r.level === 'pass' ? c.ok('✓') : r.level === 'warn' ? c.warn('!') : c.bad('✗');
  console.log(`  ${mark} ${r.label} ${c.dim(r.detail)}`);
  if (r.fix) console.log(`      ${c.dim('→ ' + r.fix)}`);
}

console.log('');
if (fails.length) {
  console.log(c.bad(`  ${fails.length} thing${fails.length === 1 ? '' : 's'} to fix before this business is usable.`));
} else if (warns.length) {
  console.log(c.warn(`  Nothing broken. ${warns.length} thing${warns.length === 1 ? '' : 's'} worth a look.`));
} else {
  console.log(c.ok('  Everything checks out.'));
}
console.log('');
process.exit(fails.length ? 1 : 0);
