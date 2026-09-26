// login.kairobookings.com — the front door.
//
// This host belongs to no salon. It serves one page (the sign-in form) and one
// endpoint (checking it), and nothing else: not the owner app, not a booking
// page, not the API of any salon. A request here for anything but those is a
// 404, because the only thing this address is for is getting an owner to the
// address that IS theirs.
//
// The logic that matters — finding the account, checking the password where
// it lives, minting the pass — is in src/central-login.js. This file is the
// HTTP around it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJson, sendJson } from './util.js';
import { hit as rateHit, clientIp } from './ratelimit.js';
import { secureForRequest } from './auth.js';
import { verifyTurnstileWith } from './turnstile.js';
import { VERSION } from './version.js';
import { BASE_DOMAIN } from './tenant.js';
import {
  findAccounts, mintHandoff, salonOrigin, lockedFor, recordFailure, clearFailures,
  loginTurnstile,
} from './central-login.js';
import { requestResetEverywhere, FORGOT_REPLY } from './password-reset.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DIR = path.join(ROOT, 'public');
// The page and its script live OUTSIDE public/, because every salon serves
// public/ as-is: kept there, hairbysha.kairobookings.com/login.html answered
// with this page and its placeholders unfilled.
const FRONTDOOR_DIR = path.join(ROOT, 'frontdoor');

// The few files the sign-in page needs, and nothing else. An allow-list rather
// than "serve public/ minus some things": the owner app lives in the same
// folder, and a front door that could be talked into serving it would render
// a workspace with no salon behind it.
const ASSETS = new Map([
  ['/', { dir: FRONTDOOR_DIR, file: 'index.html', type: 'text/html; charset=utf-8', cache: 'no-cache' }],
  ['/index.html', { dir: FRONTDOOR_DIR, file: 'index.html', type: 'text/html; charset=utf-8', cache: 'no-cache' }],
  ['/js/login.js', { dir: FRONTDOOR_DIR, file: 'login.js', type: 'text/javascript; charset=utf-8', cache: 'no-cache' }],
  ['/icons/kairo-192.png', { dir: PUBLIC_DIR, file: 'icons/kairo-192.png', type: 'image/png', cache: 'public, max-age=86400' }],
  ['/icons/kairo-180.png', { dir: PUBLIC_DIR, file: 'icons/kairo-180.png', type: 'image/png', cache: 'public, max-age=86400' }],
]);

const escAttr = (v) => String(v).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/** Only an https (or, on a developer's machine, http) address is ever linked to. */
const safeUrl = (v, fallback) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(v || '').trim()) ? String(v).trim().replace(/\/+$/, '') : fallback);

/** The marketing site. kairobookings.com, from the same base domain the salons use. */
const siteUrl = () => safeUrl(process.env.KAIRO_SITE_URL, `https://${BASE_DOMAIN}`);

/**
 * Where "Get started" goes. The platform's own signup page today; set
 * KAIRO_SIGNUP_URL when it moves to a branded address and every link follows.
 */
const signupUrl = () => safeUrl(process.env.KAIRO_SIGNUP_URL, 'https://kairo-platform.onrender.com/start');

const supportEmail = () => {
  const v = String(process.env.KAIRO_SUPPORT_EMAIL || '').trim();
  return /^[^@\s"'<>]+@[^@\s"'<>]+\.[^@\s"'<>]+$/.test(v) ? v : `support@${BASE_DOMAIN}`;
};

function csp() {
  const ts = Boolean(loginTurnstile());
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self'${ts ? ' https://challenges.cloudflare.com' : ''}`,
    ...(ts ? ['frame-src https://challenges.cloudflare.com'] : []),
    "connect-src 'self'",
    // The form posts here, and the browser is then sent on to a salon's own
    // address. form-action covers only the post; the onward navigation is a
    // plain location change and is not restricted by it.
    "form-action 'self'",
  ].join('; ');
}

function securityHeaders(res) {
  res.setHeader('Content-Security-Policy', csp());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  // Nothing on this page may ever tell another site where the visitor came
  // from — the next page they land on is their own salon, with a pass in the
  // address bar for a fraction of a second.
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
}

function serveAsset(res, pathname) {
  const a = ASSETS.get(pathname);
  if (!a) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('<!doctype html><meta charset="utf-8"><title>Kairo</title>'
      + '<body style="font:16px system-ui;padding:3rem;color:#333"><h1 style="font-weight:600">Nothing here</h1>'
      + '<p><a href="/">Sign in to Kairo</a></p></body>');
    return;
  }
  fs.readFile(path.join(a.dir, a.file), (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    let body = data;
    // Written into the HTML rather than fetched, so the page works on its
    // first paint with no second round trip. Every value is escaped: they come
    // from the environment, and a stray quote in one must not be able to break
    // out of the attribute it lands in.
    if (a.file === 'index.html') {
      const ts = loginTurnstile();
      const fill = {
        __TURNSTILE_SITE_KEY__: ts ? ts.siteKey : '',
        __SITE_URL__: siteUrl(),
        __SIGNUP_URL__: signupUrl(),
        __SUPPORT_EMAIL__: supportEmail(),
        __BASE_DOMAIN__: BASE_DOMAIN,
      };
      let html = String(data);
      for (const [k, v] of Object.entries(fill)) html = html.replaceAll(k, escAttr(v));
      body = Buffer.from(html);
    }
    res.writeHead(200, { 'Content-Type': a.type, 'Cache-Control': a.cache });
    res.end(body);
  });
}

/**
 * Check an email and password against every salon, and send the browser on.
 *
 * Every refusal for a wrong email or a wrong password says the same thing in
 * the same time: whether somebody has a Kairo account is not this page's to
 * give away.
 */
async function signIn(req, res) {
  const ip = clientIp(req);
  const over = rateHit('central_login', ip);
  if (over) {
    res.setHeader('Retry-After', String(over.retryAfterSec));
    sendJson(res, 429, { error: 'Too many attempts from here. Please wait a few minutes and try again.' });
    return;
  }

  let b;
  try { b = await readJson(req); } catch { sendJson(res, 400, { error: 'That request could not be read.' }); return; }
  const email = String(b?.email ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(b?.password ?? '').slice(0, 200);
  const slug = String(b?.slug ?? '').trim().toLowerCase().slice(0, 40);
  if (!email || !password) {
    sendJson(res, 400, { error: 'Please enter your email and password.' });
    return;
  }

  const wait = lockedFor(email);
  if (wait) {
    res.setHeader('Retry-After', String(wait));
    sendJson(res, 429, {
      error: `Too many wrong passwords for this email. Please try again in ${Math.max(1, Math.ceil(wait / 60))} minutes.`,
    });
    return;
  }

  const ts = loginTurnstile();
  if (ts) {
    const human = await verifyTurnstileWith(ts.secret, String(b?.turnstile_token ?? ''), ip);
    if (!human.ok) { sendJson(res, 400, { error: human.detail }); return; }
  }

  const matches = findAccounts(email, password, { onlySlug: slug });
  if (!matches.length) {
    recordFailure(email);
    sendJson(res, 401, { error: "That email and password don't match a Kairo account." });
    return;
  }
  clearFailures(email);

  // One person with access to more than one business — an owner with two
  // salons, or the same email used on a demo and a real one. They pick. The
  // list is only ever shown after the password has been proved, so it tells
  // nobody anything they could not already open.
  if (matches.length > 1 && !slug) {
    sendJson(res, 200, {
      choose: matches.map((m) => ({ slug: m.slug, business: m.business, name: m.userName })),
    });
    return;
  }

  const m = matches[0];
  const token = mintHandoff(m, { ip, userAgent: String(req.headers['user-agent'] || '') });
  const origin = salonOrigin(m.slug, { secure: secureForRequest(req) });
  sendJson(res, 200, {
    business: m.business,
    redirect: `${origin}/api/auth/handoff?t=${encodeURIComponent(token)}`,
  });
}

/**
 * "Forgot password?" at the front door. Every salon with a CONFIRMED account
 * under this email sends its own link; everybody else — no account, an
 * unconfirmed address, asked too often — gets the same answer, at the same
 * speed, because the sending happens after the reply.
 */
async function forgot(req, res) {
  const ip = clientIp(req);
  const over = rateHit('central_forgot', ip);
  if (over) {
    res.setHeader('Retry-After', String(over.retryAfterSec));
    sendJson(res, 429, { error: 'Too many requests from here. Please wait a few minutes and try again.' });
    return;
  }
  let b;
  try { b = await readJson(req); } catch { sendJson(res, 400, { error: 'That request could not be read.' }); return; }
  const email = String(b?.email ?? '').trim().toLowerCase().slice(0, 200);
  if (!email) { sendJson(res, 400, { error: 'Enter the email you sign in with.' }); return; }
  const ts = loginTurnstile();
  if (ts) {
    const human = await verifyTurnstileWith(ts.secret, String(b?.turnstile_token ?? ''), ip);
    if (!human.ok) { sendJson(res, 400, { error: human.detail }); return; }
  }
  requestResetEverywhere(email, { ip, secure: secureForRequest(req) })
    .catch((err) => console.error('password reset (front door) failed —', String(err?.message || err).slice(0, 160)));
  sendJson(res, 200, { ok: true, message: FORGOT_REPLY });
}

/** Everything that arrives at the front door comes through here. */
export async function handleLoginHost(req, res, url) {
  securityHeaders(res);
  const p = url.pathname;
  if (p === '/api/version') { sendJson(res, 200, { version: VERSION }); return; }
  if (p === '/api/login') {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed' }); return; }
    await signIn(req, res);
    return;
  }
  if (p === '/api/forgot') {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed' }); return; }
    await forgot(req, res);
    return;
  }
  if (p.startsWith('/api/')) { sendJson(res, 404, { error: 'Not found' }); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('Method not allowed'); return; }
  serveAsset(res, p);
}
