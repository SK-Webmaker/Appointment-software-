// Kairo — booking, clients & billing for service businesses.
// Zero-dependency Node.js server: static assets + JSON API + SQLite (node:sqlite).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSetting, storageWarning, publicUrl, publicUrlIsRaw } from './src/db.js';
import { MULTI, current, resolveHost, withTenant, listTenantSlugs, isReadOnly, TENANTS_DIR, BASE_DOMAIN } from './src/tenant.js';
import { sendJson } from './src/util.js';
import { handleApi } from './src/api.js';
import { startScheduler, chaseReviews } from './src/notify.js';
import { runScheduledBackup } from './src/backup.js';
import { runDailyPass } from './src/automations.js';
import { checkOrigin } from './src/origin.js';
import { turnstileEnabled } from './src/turnstile.js';
import { VERSION } from './src/version.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 4820);
const HOST = process.env.HOST || '0.0.0.0';

// Open (and bootstrap: schema, migrations, defaults) the one business of a
// single-tenant install now, so a broken database fails the boot rather than
// the first request. Multi-tenant installs open each salon on first use.
if (!MULTI) current();
// Delivers queued confirmations & reminders every minute, posts a backup off
// the machine when one is due, and makes the marketing automations' daily pass.
// All three ride the same minute tick rather than three timers; each one does
// nothing until it is actually due.
startScheduler({
  tick: async () => {
    await runScheduledBackup();
    // Guarded to once a day inside. That guard is about work, not safety —
    // what actually stops a client being messaged twice is the unique index on
    // automation_sends, which holds even if this ran every minute. Worth being
    // exact about, because someone tidying up later needs to know which of the
    // two is load-bearing.
    try {
      runDailyPass();
    } catch (err) {
      console.error('automations:', err.message);
    }
    // The one review follow-up. Its own guard rather than the daily pass's,
    // because it is keyed on each appointment's own review_chased_at — running
    // it more often than once a day costs a query and sends nobody anything
    // extra, and it should not stop working because the marketing pass errored.
    try {
      chaseReviews();
    } catch (err) {
      console.error('review chase:', err.message);
    }
  },
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
};

function serveStatic(res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  if (rel === '/book') rel = '/book.html';
  if (rel === '/pay-done') rel = '/paydone.html'; // Stripe Checkout return page (POS sales)
  if (rel.startsWith('/review/')) rel = '/review.html'; // client reads the token from the URL itself
  if (rel.startsWith('/cancel/')) rel = '/cancel.html'; // same pattern for the cancel link
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  // Compare against the directory WITH its separator. A bare prefix test lets
  // "/app/public-anything" through, because it starts with "/app/public" —
  // so the guard would stop protecting the day a sibling directory is added
  // whose name happens to share the prefix. The URL parser strips dot segments
  // before this runs, which is what actually blocks traversal today; this is
  // the layer underneath, and it should hold on its own.
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: hash-routed app, so any unknown path renders the shell.
      if (!path.extname(rel)) {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, shell) => {
          if (err2) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(shell);
        });
        return;
      }
      res.writeHead(404); res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    res.end(data);
  });
}

// Content-Security-Policy: scripts and connections are locked to same-origin
// (no CDN, no external calls), which neutralises injected <script> even if some
// XSS slipped past output escaping. Inline styles are allowed because the UI
// uses style attributes throughout; images allow data: URIs for brand logos.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Turnstile is the one thing that needs an outside origin, so it gets the
 * narrowest exception this policy can express: one named host, on the booking
 * document alone, and only while the business has the feature switched on. Turn
 * it off and the header goes back to same-origin-only on the next request.
 */
const TURNSTILE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self'",
  "form-action 'self'",
].join('; ');

const BOOKING_DOCS = new Set(['/book', '/book.html']);
const cspFor = (pathname) =>
  (BOOKING_DOCS.has(pathname) && turnstileEnabled() ? TURNSTILE_CSP : CSP);

/** What a caller sees at an address that names no salon. Deliberately dull. */
function noSuchSalon(res, pathname) {
  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'No salon at this address' });
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end('<!doctype html><meta charset="utf-8"><title>Kairo</title>'
    + '<body style="font:16px system-ui;padding:3rem;color:#333"><h1 style="font-weight:600">No salon at this address</h1>'
    + '<p>Check the link you were given.</p></body>');
}

/** Writes an owner or a customer would make, refused while a salon is in maintenance. */
function refuseReadOnly(res) {
  res.setHeader('Retry-After', '120');
  sendJson(res, 503, {
    error: 'Kairo is being updated — back in a few minutes. Nothing has been lost; please try again shortly.',
    read_only: true,
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  // Which salon? The Host header decides, and nothing else. The health check
  // answers for any host because Render pings the raw hostname, and a shard
  // that looks down because its health check named no salon restarts forever.
  const tenant = resolveHost(req.headers.host);
  if (!tenant) {
    if (url.pathname === '/api/version') { sendJson(res, 200, { version: VERSION }); return; }
    noSuchSalon(res, url.pathname);
    return;
  }
  await withTenant(tenant, () => handle(req, res, url, tenant));
});

async function handle(req, res, url, tenant) {
  if (MULTI) res.setHeader('X-Kairo-Tenant', tenant.slug);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', cspFor(url.pathname));
  // Tell browsers to stick to HTTPS for two years (ignored on plain HTTP).
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  // The app needs none of these device features — deny them outright.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Did this come through Cloudflare? In enforce mode, anything that reached
  // the origin directly is refused here — before routing, before the session is
  // read, before a single query runs.
  const origin = checkOrigin(req, url.pathname);
  if (origin.block) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    // Maintenance: reads keep working, writes wait. Signing in and out is
    // allowed so the owner can still see their diary and is told why.
    if (isReadOnly() && req.method !== 'GET' && req.method !== 'HEAD'
        && !/^\/api\/auth\/(login|logout)$/.test(url.pathname)) {
      refuseReadOnly(res);
      return;
    }
    await handleApi(req, res, url.pathname, url.searchParams);
    return;
  }
  if (url.pathname === '/manifest.webmanifest') {
    serveManifest(res);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end('Method not allowed'); return;
  }
  serveStatic(res, url.pathname);
}

// Web-app manifest so "Add to Home Screen" installs with the business's own
// name and brand colour (a static file couldn't know either). Served for the
// admin workspace; the icon and dark chrome match the app itself.
function serveManifest(res) {
  const name = getSetting('business_name', 'Kairo');
  const manifest = {
    name,
    short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
    description: `${name} — booking, clients & payments`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#070a10',
    theme_color: '#070a10',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/kairo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/kairo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/kairo-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  res.writeHead(200, {
    'Content-Type': 'application/manifest+json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(manifest));
}

server.listen(PORT, HOST, () => {
  if (MULTI) {
    const slugs = listTenantSlugs();
    console.log('');
    console.log(`  ◆ Kairo v${VERSION} is running — multi-tenant`);
    console.log(`    ${slugs.length} salon${slugs.length === 1 ? '' : 's'} under ${TENANTS_DIR}`);
    console.log(`    Addresses: https://<slug>.${BASE_DOMAIN}   (Host header decides the salon)`);
    if (String(process.env.KAIRO_READ_ONLY || '') === '1') console.log('    !  KAIRO_READ_ONLY=1 — every salon is refusing writes');
    console.log('');
    return;
  }
  const name = getSetting('business_name', 'your business');
  const risk = storageWarning();
  if (risk) {
    // Loud, and first. This is the one misconfiguration that loses a business
    // its whole history, and it stays silent until the day it isn't.
    console.log('');
    console.log('  ##################################################################');
    console.log('  #  DATA WILL BE LOST — this instance has no persistent disk      #');
    console.log('  ##################################################################');
    console.log(`    ${risk.message}`);
    console.log(`    Writing to: ${risk.dir}`);
  }
  // Second-loudest, and for the same reason: it stays silent until it isn't.
  // A booking link on the free hosting hostname works perfectly, so nobody
  // ever reports it — the business just quietly hands out the wrong address
  // for months, and by then it is printed on things.
  //
  // Two cases worth saying out loud, and one worth staying quiet about. An
  // address that has been *chosen* and is still the hosting one is always
  // wrong, wherever it runs. Nothing set at all is only alarming on a real
  // deployment — on somebody's laptop that is just how you start it — so that
  // half is gated on the marker variables the hosts set for us.
  const looksHosted = ['RENDER', 'RAILWAY_ENVIRONMENT', 'FLY_APP_NAME', 'DYNO', 'VERCEL', 'K_SERVICE']
    .some((k) => String(process.env[k] || '').trim() !== '');
  if (publicUrlIsRaw() && (publicUrl() || looksHosted)) {
    console.log('');
    console.log('  ------------------------------------------------------------------');
    console.log('  !  The booking link is not this business\'s own web address');
    console.log('  ------------------------------------------------------------------');
    console.log(`    Customers are being given: ${publicUrl() || '(nothing set — falls back to whatever host they arrive on)'}`);
    console.log('    Set KAIRO_PUBLIC_URL on the service to https://<business>.kairobookings.com');
    console.log('    and add the matching custom domain. See ONBOARDING.md.');
  }
  if (String(process.env.KAIRO_READ_ONLY || '') === '1') {
    console.log('');
    console.log('  !  KAIRO_READ_ONLY=1 — writes are refused (maintenance). Remove it to take bookings again.');
  }
  console.log('');
  console.log(`  ◆ Kairo v${VERSION} is running`);
  console.log(`    Workspace (${name}):  http://localhost:${PORT}`);
  console.log(`    Public booking page:  http://localhost:${PORT}/book`);
  console.log('');
  console.log('    Sign in: admin@kairo.local / admin123  (change in Settings)');
  console.log('');
});
