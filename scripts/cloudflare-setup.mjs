#!/usr/bin/env node
// Point a business's Cloudflare zone at its Kairo instance, correctly.
//
// Cloudflare is only worth anything here if three things are true, and all
// three are easy to get wrong by hand:
//
//   1. the DNS record is actually proxied (orange cloud) — otherwise
//      Cloudflare never sees the traffic and none of its filtering applies;
//   2. TLS to the origin is verified, not "Flexible" (which quietly serves
//      customers over plain HTTP behind the scenes);
//   3. a Transform Rule stamps the shared secret on every forwarded request,
//      so Kairo can refuse anything that skipped Cloudflare entirely.
//
// It reports before it touches anything. Without --apply it changes nothing at
// all, which is the mode to run first.
//
//   export CLOUDFLARE_API_TOKEN=...        # never passed on the command line
//   node scripts/cloudflare-setup.mjs --domain example.com
//   node scripts/cloudflare-setup.mjs --domain example.com --origin-secret XXX --apply
//
// Options:
//   --domain <zone>          required — the domain as it appears in Cloudflare
//   --host <hostname>        limit the header rule to one hostname
//                            (default: every request in the zone)
//   --origin-secret <value>  the secret from Kairo's Settings -> Cloudflare
//                            protection -> Generate the secret
//   --turnstile              also create a Turnstile widget and print its keys
//   --rate-limit             also add the one free rate-limiting rule
//   --apply                  actually make the changes
import process from 'node:process';

const API = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

// The header Kairo looks for. Kept in step with src/origin.js.
const ORIGIN_HEADER = 'x-kairo-origin';
// Named so a human scanning the Cloudflare dashboard knows what it is for and
// that deleting it will break something.
const RULE_REF = 'kairo_origin_header';
const RULE_DESC = 'Kairo: prove this request came through Cloudflare';
const RATE_REF = 'kairo_api_ceiling';

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const [k, v] = a.includes('=') ? [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a.slice(2), null];
  args.set(k, v ?? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true));
}
const APPLY = args.get('apply') === true;
const DOMAIN = typeof args.get('domain') === 'string' ? args.get('domain') : '';
const HOST = typeof args.get('host') === 'string' ? args.get('host') : '';
const SECRET = typeof args.get('origin-secret') === 'string' ? args.get('origin-secret') : '';

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
};

if (!TOKEN) {
  console.error(c.bad('No CLOUDFLARE_API_TOKEN in the environment.'));
  console.error('  export CLOUDFLARE_API_TOKEN=...   (keep it out of your shell history and off the command line)');
  process.exit(1);
}
if (!DOMAIN) {
  console.error(c.bad('--domain is required.'), 'e.g. --domain example.com');
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
    const why = (data.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
    const err = new Error(why);
    err.codes = (data.errors || []).map((e) => e.code);
    throw err;
  }
  return data.result;
}

/** Actions are collected first and run second, so nothing changes mid-report. */
const planned = [];
const plan = (label, detail, run) => { planned.push({ label, detail, run }); };
const note = (label, detail) => console.log(`  ${c.dim('·')} ${label} ${c.dim(detail)}`);
const good = (label, detail = '') => console.log(`  ${c.ok('✓')} ${label} ${c.dim(detail)}`);
const warn = (label, detail = '') => console.log(`  ${c.warn('!')} ${label} ${c.dim(detail)}`);

console.log('');
console.log(c.b(`Cloudflare setup for ${DOMAIN}`), APPLY ? c.warn('— APPLYING CHANGES') : c.dim('— dry run, nothing will change'));
console.log('');

// ── the token ───────────────────────────────────────────────────────────────
try {
  const v = await cf('GET', '/user/tokens/verify');
  good('Token is valid', `status: ${v.status}`);
} catch (err) {
  console.error(c.bad('  ✗ The token was rejected:'), err.message);
  process.exit(1);
}

// ── the zone ────────────────────────────────────────────────────────────────
let zone;
try {
  const zones = await cf('GET', `/zones?name=${encodeURIComponent(DOMAIN)}`);
  zone = zones[0];
} catch (err) {
  console.error(c.bad('  ✗ Could not list zones:'), err.message);
  console.error(c.dim('    The token needs Zone → Zone → Read for this domain.'));
  process.exit(1);
}
if (!zone) {
  console.error(c.bad(`  ✗ No zone called "${DOMAIN}" is visible to this token.`));
  console.error(c.dim('    Check the spelling, and that the token includes this zone under Zone Resources.'));
  process.exit(1);
}
good(`Zone found`, `${zone.name} · ${zone.plan?.name || 'unknown plan'} · status ${zone.status}`);
const ZID = zone.id;
if (zone.status !== 'active') {
  warn('This zone is not active yet', `status "${zone.status}" — nothing below takes effect until it is`);
}

// ── DNS: is anything actually going through Cloudflare? ─────────────────────
console.log('');
console.log(c.b('DNS'));
let dnsReadable = true;
try {
  const records = (await cf('GET', `/zones/${ZID}/dns_records?per_page=200`))
    .filter((r) => ['A', 'AAAA', 'CNAME'].includes(r.type));
  const origins = records.filter((r) => /onrender\.com|render\.com/i.test(r.content || ''));
  const shown = origins.length ? origins : records;

  if (!shown.length) {
    warn('No A/AAAA/CNAME records in this zone', 'nothing is pointed anywhere yet');
  }
  for (const r of shown) {
    const label = `${r.type} ${r.name} → ${r.content}`;
    if (r.proxied) good(label, 'proxied');
    else {
      warn(label, 'NOT proxied — traffic to this name skips Cloudflare entirely');
      plan(`Turn on proxying for ${r.name}`, `${r.type} → ${r.content}`,
        () => cf('PATCH', `/zones/${ZID}/dns_records/${r.id}`, { proxied: true }));
    }
  }
  if (origins.length && origins.length < records.length) {
    note(`${records.length - origins.length} other record(s) not pointing at Render`, 'left alone');
  }
} catch (err) {
  dnsReadable = false;
  warn('Could not read DNS', err.message);
  note('', 'add Zone → DNS → Edit to the token to check and fix proxying');
}

// ── TLS and the basics ──────────────────────────────────────────────────────
console.log('');
console.log(c.b('TLS'));
const SETTINGS = [
  // Flexible is the dangerous default some zones land on: the customer sees a
  // padlock while Cloudflare talks to the origin over plain HTTP. Render
  // serves a valid certificate, so Full (strict) is both correct and safe.
  { key: 'ssl', want: 'strict', label: 'Encryption mode', pretty: { off: 'Off', flexible: 'Flexible', full: 'Full', strict: 'Full (strict)' } },
  { key: 'always_use_https', want: 'on', label: 'Always use HTTPS' },
  { key: 'min_tls_version', want: '1.2', label: 'Minimum TLS version' },
  { key: 'automatic_https_rewrites', want: 'on', label: 'Automatic HTTPS rewrites' },
];
for (const s of SETTINGS) {
  try {
    const cur = await cf('GET', `/zones/${ZID}/settings/${s.key}`);
    const now = String(cur.value);
    const pretty = (v) => s.pretty?.[v] || v;
    if (now === s.want) { good(s.label, pretty(now)); continue; }
    if (cur.editable === false) { warn(s.label, `${pretty(now)} — not editable on this plan`); continue; }
    warn(s.label, `${pretty(now)} → ${pretty(s.want)}`);
    plan(`Set ${s.label}`, `${pretty(now)} → ${pretty(s.want)}`,
      () => cf('PATCH', `/zones/${ZID}/settings/${s.key}`, { value: s.want }));
  } catch (err) {
    warn(s.label, `could not read (${err.message})`);
  }
}

// ── the origin header ───────────────────────────────────────────────────────
console.log('');
console.log(c.b('Origin header'));
// Scoped to one hostname if asked, otherwise every request in the zone. A
// hostname that isn't Kairo would simply receive a header it ignores.
const EXPRESSION = HOST ? `(http.host eq "${HOST}")` : 'true';

async function transformRuleset() {
  try {
    return await cf('GET', `/zones/${ZID}/rulesets/phases/http_request_late_transform/entrypoint`);
  } catch (err) {
    // 10007 = no ruleset in this phase yet, which is the normal starting state.
    if (err.codes?.includes(10007) || /could not find|not found/i.test(err.message)) return null;
    throw err;
  }
}

let headerRuleState = 'unknown';
try {
  const rs = await transformRuleset();
  const existing = rs?.rules?.find((r) => r.ref === RULE_REF || r.description === RULE_DESC);
  if (existing) {
    headerRuleState = 'present';
    good('A Kairo header rule already exists', `on ${existing.expression}`);
    if (SECRET) {
      note('Its value is not readable back', 'apply again to overwrite it with the secret you passed');
      plan('Replace the origin header rule', `${ORIGIN_HEADER} on ${EXPRESSION}`,
        () => cf('PATCH', `/zones/${ZID}/rulesets/${rs.id}/rules/${existing.id}`, headerRule()));
    }
  } else if (!SECRET) {
    headerRuleState = 'missing';
    warn('No rule yet, and no --origin-secret given',
      'generate one in Kairo → Settings → Cloudflare protection, then re-run with --origin-secret');
  } else {
    headerRuleState = 'missing';
    warn('No rule yet', `will add ${ORIGIN_HEADER} on ${EXPRESSION}`);
    plan('Add the origin header rule', `${ORIGIN_HEADER} on ${EXPRESSION}`, async () => {
      const cur = await transformRuleset();
      if (cur) return cf('POST', `/zones/${ZID}/rulesets/${cur.id}/rules`, headerRule());
      return cf('PUT', `/zones/${ZID}/rulesets/phases/http_request_late_transform/entrypoint`, {
        rules: [headerRule()],
      });
    });
  }
} catch (err) {
  warn('Could not read Transform Rules', err.message);
  note('', 'the token needs Zone → Transform Rules → Edit and Account → Rulesets → Read');
}

function headerRule() {
  return {
    ref: RULE_REF,
    description: RULE_DESC,
    expression: EXPRESSION,
    action: 'rewrite',
    action_parameters: { headers: { [ORIGIN_HEADER]: { operation: 'set', value: SECRET } } },
    enabled: true,
  };
}

// ── rate limiting (one rule on Free) ────────────────────────────────────────
if (args.get('rate-limit')) {
  console.log('');
  console.log(c.b('Rate limiting'));
  // Free plans get exactly one rule, a 10-second window and IP-only counting.
  // So this is a volumetric ceiling, not a policy: set well above anything a
  // real person does (Kairo's own limiter is 600/min for a signed-in owner),
  // its job is only to absorb a flood before it reaches the origin at all.
  const rateRule = {
    ref: RATE_REF,
    description: 'Kairo: absorb API floods before they reach the origin',
    expression: '(starts_with(http.request.uri.path, "/api/"))',
    action: 'block',
    ratelimit: {
      characteristics: ['ip.src', 'cf.colo.id'],
      period: 10,
      requests_per_period: 100,
      mitigation_timeout: 10,
    },
    enabled: true,
  };
  try {
    const rs = await cf('GET', `/zones/${ZID}/rulesets/phases/http_ratelimit/entrypoint`).catch(() => null);
    const existing = rs?.rules?.find((r) => r.ref === RATE_REF);
    if (existing) {
      good('The Kairo ceiling is already in place', `${existing.ratelimit?.requests_per_period}/${existing.ratelimit?.period}s`);
    } else if (rs?.rules?.length) {
      warn(`This zone already has ${rs.rules.length} rate-limiting rule(s)`,
        'Free plans allow one — leaving them alone rather than replacing what you built');
    } else {
      warn('No rate-limiting rule yet', '100 requests / 10s per IP to /api/ → block');
      plan('Add the API ceiling', '100 per 10s per IP', async () => {
        const cur = await cf('GET', `/zones/${ZID}/rulesets/phases/http_ratelimit/entrypoint`).catch(() => null);
        if (cur) return cf('POST', `/zones/${ZID}/rulesets/${cur.id}/rules`, rateRule);
        return cf('PUT', `/zones/${ZID}/rulesets/phases/http_ratelimit/entrypoint`, { rules: [rateRule] });
      });
    }
  } catch (err) {
    warn('Could not read rate-limiting rules', err.message);
    note('', 'the token needs Zone → Firewall Services → Edit');
  }
}

// ── Turnstile ───────────────────────────────────────────────────────────────
if (args.get('turnstile')) {
  console.log('');
  console.log(c.b('Turnstile'));
  const accountId = zone.account?.id;
  if (!accountId) {
    warn('Could not tell which account this zone belongs to', 'skipping');
  } else {
    try {
      const widgets = await cf('GET', `/accounts/${accountId}/challenges/widgets`);
      const mine = widgets.find((w) => (w.domains || []).includes(DOMAIN) || (w.domains || []).includes(HOST));
      if (mine) {
        good('A widget already covers this domain', `${mine.name} · sitekey ${mine.sitekey}`);
        note('The secret is only shown when a widget is created', 'rotate it in the dashboard if you no longer have it');
      } else {
        warn('No widget for this domain yet', 'will create a managed one');
        plan('Create a Turnstile widget', `${HOST || DOMAIN}`, async () => {
          const w = await cf('POST', `/accounts/${accountId}/challenges/widgets`, {
            name: `Kairo booking — ${DOMAIN}`,
            domains: [HOST || DOMAIN],
            mode: 'managed',
          });
          return { keys: { sitekey: w.sitekey, secret: w.secret } };
        });
      }
    } catch (err) {
      warn('Could not read Turnstile widgets', err.message);
      note('', 'the token needs Account → Turnstile → Edit');
    }
  }
}

// ── do it ───────────────────────────────────────────────────────────────────
console.log('');
if (!planned.length) {
  console.log(c.ok('Nothing to change — this zone is already set up.'));
  if (headerRuleState === 'missing') {
    console.log(c.dim('  (except the origin header rule, which needs --origin-secret)'));
  }
  console.log('');
  process.exit(0);
}

console.log(c.b(`${planned.length} change${planned.length === 1 ? '' : 's'} to make:`));
planned.forEach((p, i) => console.log(`  ${i + 1}. ${p.label} ${c.dim(p.detail)}`));
console.log('');

if (!APPLY) {
  console.log(c.dim('Dry run — nothing was changed. Re-run with --apply to make these changes.'));
  console.log('');
  process.exit(0);
}

let failed = 0;
const keys = [];
for (const p of planned) {
  try {
    const out = await p.run();
    if (out?.keys) keys.push(out.keys);
    console.log(`  ${c.ok('✓')} ${p.label}`);
  } catch (err) {
    failed++;
    console.log(`  ${c.bad('✗')} ${p.label} — ${err.message}`);
  }
}

if (keys.length) {
  console.log('');
  console.log(c.b('Turnstile keys — paste these into Kairo → Settings → Cloudflare protection:'));
  for (const k of keys) {
    console.log(`  Site key:   ${k.sitekey}`);
    console.log(`  Secret key: ${k.secret}`);
  }
  console.log(c.dim('  The secret is shown once. It is not readable again.'));
}

console.log('');
if (failed) {
  console.log(c.bad(`${failed} change${failed === 1 ? '' : 's'} failed.`), c.dim('Usually a missing token permission — the message above says which.'));
  process.exit(1);
}
console.log(c.ok('Done.'));
console.log(c.dim('Next: in Kairo → Settings → Cloudflare protection, switch the lock to "Watch only",'));
console.log(c.dim('leave it a day, and only turn it on once nothing is arriving directly.'));
console.log('');
