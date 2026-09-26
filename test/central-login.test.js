// login.kairobookings.com — signing in without knowing your own address.
//
// This is the most valuable form Kairo has ever put on the internet: every
// salon's accounts sit behind it. So most of what follows is about refusals —
// what it must never reveal, never accept, and never let happen twice. The
// happy path is the short part.
//
// Runs a real multi-salon shard with three salons, including one person who
// has access to two of them, which is the case that exercises the picker.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { startKairo, tenantCli } from './helpers/kairo.js';

const DOMAIN = 'kairobookings.test';
const LOGIN = `login.${DOMAIN}`;
const ALPHA = { email: 'owner@alpha.test', password: 'alpha-pass-2026!!' };
const BETA = { email: 'owner@beta.test', password: 'beta-pass-2026!!' };
// One person, one password, two businesses.
const BOTH = { email: 'both@shared.test', password: 'shared-pass-2026!!' };
let k, dataDir;

const tenantDb = (slug) => {
  const d = new DatabaseSync(path.join(dataDir, 'tenants', slug, 'kairo.db'));
  d.exec('PRAGMA busy_timeout = 5000');
  return d;
};

/** Add a second user with the same email + password to a salon, directly. */
function addUser(slug, email, password) {
  // Hash exactly as Kairo does, so this is a real account and not a fixture
  // that only this test understands.
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const d = tenantDb(slug);
  d.prepare("INSERT INTO users (name, email, salt, pass_hash, role) VALUES (?, ?, ?, ?, 'owner')")
    .run('Shared Person', email, salt, hash);
  d.close();
}

const signIn = (body) => k.api('POST', '/api/login', { host: LOGIN, body });

/** Follow a redirect URL on the right salon host; returns the raw response. */
async function redeem(redirect) {
  const u = new URL(redirect);
  return k.api('GET', `${u.pathname}${u.search}`, { host: u.host });
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-central-'));
  tenantCli(dataDir, ['create', 'alpha', '--name', 'Alpha Salon', '--email', ALPHA.email, '--password', ALPHA.password, '--seed', 'demo']);
  tenantCli(dataDir, ['create', 'beta', '--name', 'Beta Salon', '--email', BETA.email, '--password', BETA.password]);
  k = await startKairo({ dataDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN } });
  // Open both once so their schemas exist, then add the shared person to each.
  await k.api('GET', '/api/public/info', { host: `alpha.${DOMAIN}` });
  await k.api('GET', '/api/public/info', { host: `beta.${DOMAIN}` });
  addUser('alpha', BOTH.email, BOTH.password);
  addUser('beta', BOTH.email, BOTH.password);
});
after(async () => { await k?.stop(); });

// ── The page ────────────────────────────────────────────────────────────────

test('the front door serves the sign-in page and nothing else', async () => {
  const page = await k.api('GET', '/', { host: LOGIN });
  assert.equal(page.status, 200);
  assert.match(page.text, /<title>Sign in · Kairo<\/title>/);
  assert.match(page.text, /\/js\/login\.js/, 'it loads the script that drives it');
  assert.doesNotMatch(page.text, /__[A-Z_]+__/, 'every placeholder was filled in');
  assert.match(page.text, new RegExp(`data-base="${DOMAIN}"`), 'the page is told which domain is safe to follow');

  const js = await k.api('GET', '/js/login.js', { host: LOGIN });
  assert.equal(js.status, 200);

  // Not the owner app, not a booking page, not any salon's API: this address
  // belongs to no salon, and anything that rendered one here would be
  // rendering a workspace with no salon behind it.
  for (const p of ['/book', '/js/app.js', '/js/pages/calendar.js', '/api/public/info', '/api/auth/me', '/api/settings']) {
    const r = await k.api('GET', p, { host: LOGIN });
    assert.notEqual(r.status, 200, `${p} must not be served at the front door`);
  }
});

test('the page sends the security headers a sign-in form needs', async () => {
  const page = await k.api('GET', '/', { host: LOGIN });
  assert.equal(page.headers.get('x-frame-options'), 'DENY', 'no clickjacking the password box');
  assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  assert.match(page.headers.get('content-security-policy') || '', /script-src 'self'/);
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
});

// ── Signing in ──────────────────────────────────────────────────────────────

test('the right email and password lead to that salon, and only that salon', async () => {
  const r = await signIn(ALPHA);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.business, 'Alpha Salon');
  const u = new URL(r.json.redirect);
  assert.equal(u.host, `alpha.${DOMAIN}`, 'handed to the salon the account belongs to');
  assert.equal(u.pathname, '/api/auth/handoff');
  assert.match(u.searchParams.get('t'), /^[A-Za-z0-9_-]{43}$/, 'a 256-bit single-use pass');
});

test('the pass signs them in, exactly as the salon\'s own login would', async () => {
  const r = await signIn(ALPHA);
  const res = await redeem(r.json.redirect);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/', 'straight on, so the pass leaves the address bar');
  const cookie = /kairo_session=([^;]+)/.exec(res.headers.get('set-cookie') || '')?.[1];
  assert.ok(cookie, 'a normal session cookie');
  assert.match(res.headers.get('set-cookie'), /HttpOnly/);

  const me = await k.api('GET', '/api/auth/me', { host: `alpha.${DOMAIN}`, cookie: `kairo_session=${cookie}` });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.email, ALPHA.email);
});

test('a session from one salon opens nothing at another', async () => {
  const r = await signIn(ALPHA);
  const res = await redeem(r.json.redirect);
  const cookie = /kairo_session=([^;]+)/.exec(res.headers.get('set-cookie') || '')[1];
  const beta = await k.api('GET', '/api/auth/me', { host: `beta.${DOMAIN}`, cookie: `kairo_session=${cookie}` });
  assert.equal(beta.status, 401, "signing in to Alpha must never open Beta's book");
});

// ── The pass ────────────────────────────────────────────────────────────────

test('a pass works exactly once', async () => {
  const r = await signIn(ALPHA);
  const first = await redeem(r.json.redirect);
  assert.equal(first.status, 302);
  assert.equal(first.headers.get('location'), '/');

  const again = await redeem(r.json.redirect);
  assert.equal(again.status, 302);
  assert.match(again.headers.get('location'), new RegExp(`^http://${LOGIN}/\\?expired=1$`),
    'a used pass goes back to the front door, never into the workspace');
  assert.doesNotMatch(again.headers.get('set-cookie') || '', /kairo_session=[^;]/,
    'and sets no session');
});

test('a pass is dead after sixty seconds even if nobody used it', async () => {
  const r = await signIn(ALPHA);
  const token = new URL(r.json.redirect).searchParams.get('t');
  // Age it in the database rather than wait a minute: this exercises the real
  // expiry check, not a test-only shortcut.
  const d = tenantDb('alpha');
  d.prepare("UPDATE login_handoffs SET expires_at = '2020-01-01 00:00:00'").run();
  d.close();
  const res = await k.api('GET', `/api/auth/handoff?t=${token}`, { host: `alpha.${DOMAIN}` });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /expired=1/);
});

test('a pass for one salon cannot be spent at another', async () => {
  const r = await signIn(ALPHA);
  const token = new URL(r.json.redirect).searchParams.get('t');
  const res = await k.api('GET', `/api/auth/handoff?t=${token}`, { host: `beta.${DOMAIN}` });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /expired=1/, "Alpha's pass means nothing at Beta");
  assert.doesNotMatch(res.headers.get('set-cookie') || '', /kairo_session=[^;]/);
});

test('only a hash of the pass is ever stored', async () => {
  const r = await signIn(ALPHA);
  const token = new URL(r.json.redirect).searchParams.get('t');
  const d = tenantDb('alpha');
  const rows = d.prepare('SELECT token_hash FROM login_handoffs').all();
  d.close();
  assert.ok(rows.length >= 1);
  for (const row of rows) {
    assert.notEqual(row.token_hash, token, 'a copy of the database must not be a copy of a live pass');
    assert.match(row.token_hash, /^[0-9a-f]{64}$/);
  }
});

test('nonsense passes are refused without a crash', async () => {
  for (const t of ['', 'short', 'x'.repeat(43), '../../etc/passwd', 'a'.repeat(500)]) {
    const res = await k.api('GET', `/api/auth/handoff?t=${encodeURIComponent(t)}`, { host: `alpha.${DOMAIN}` });
    assert.equal(res.status, 302, `"${t.slice(0, 20)}"`);
    assert.match(res.headers.get('location'), /expired=1/);
  }
});

// ── What it must never give away ────────────────────────────────────────────

test('a wrong password and an unknown email look identical', async () => {
  const wrongPass = await signIn({ email: ALPHA.email, password: 'not-the-password' });
  const noSuchEmail = await signIn({ email: 'nobody-here@nowhere.test', password: 'whatever-2026' });
  assert.equal(wrongPass.status, 401);
  assert.equal(noSuchEmail.status, 401);
  assert.deepEqual(wrongPass.json, noSuchEmail.json,
    'whether somebody has a Kairo account is not this page\'s to give away');
});

test('a correct password for the wrong person opens nothing', async () => {
  // Alpha's password, typed with Beta's email.
  const r = await signIn({ email: BETA.email, password: ALPHA.password });
  assert.equal(r.status, 401);
});

test('empty fields are refused before anything is checked', async () => {
  assert.equal((await signIn({ email: '', password: 'x' })).status, 400);
  assert.equal((await signIn({ email: ALPHA.email, password: '' })).status, 400);
  assert.equal((await signIn({})).status, 400);
});

test('the front door only takes a POST to sign in', async () => {
  const r = await k.api('GET', '/api/login', { host: LOGIN });
  assert.equal(r.status, 405);
});

// ── One person, two businesses ──────────────────────────────────────────────

test('somebody with access to two businesses is asked which', async () => {
  const r = await signIn(BOTH);
  assert.equal(r.status, 200, r.text);
  assert.ok(Array.isArray(r.json.choose), 'a choice, not a guess');
  assert.equal(r.json.redirect, undefined, 'and no pass minted for a business they did not pick');
  const names = r.json.choose.map((c) => c.business).sort();
  assert.deepEqual(names, ['Alpha Salon', 'Beta Salon']);

  const pickBeta = await signIn({ ...BOTH, slug: 'beta' });
  assert.equal(pickBeta.status, 200);
  assert.equal(new URL(pickBeta.json.redirect).host, `beta.${DOMAIN}`);
});

test('picking a business you have no account at is refused', async () => {
  // Alpha's owner has no account at Beta.
  const r = await signIn({ ...ALPHA, slug: 'beta' });
  assert.equal(r.status, 401, 'naming a salon is not a way in');
});

test('the list of businesses is only shown after the password is proved', async () => {
  const r = await signIn({ email: BOTH.email, password: 'wrong-password' });
  assert.equal(r.status, 401);
  assert.equal(r.json.choose, undefined, 'no business names for a wrong password');
});

// ── Repeated failures ───────────────────────────────────────────────────────

test('an email that keeps failing is locked, whoever is trying', async () => {
  const target = { email: 'locked@alpha.test', password: 'wrong' };
  // Give the target a real account so a successful unlock can be shown.
  addUser('alpha', target.email, 'the-real-pass-2026!!');
  let last;
  for (let i = 0; i < 8; i += 1) last = await signIn(target);
  assert.equal(last.status, 401, 'the eighth failure is still just a failure');
  const ninth = await signIn(target);
  assert.equal(ninth.status, 429, 'then the account is shut for a while');
  assert.match(ninth.json.error, /too many wrong passwords/i);

  // Even the RIGHT password is refused while locked — otherwise the lock only
  // stops people who were never going to guess it.
  const right = await signIn({ email: target.email, password: 'the-real-pass-2026!!' });
  assert.equal(right.status, 429, 'a lock that the right guess walks through is not a lock');
});

test('the lock on one email does not touch anybody else', async () => {
  const r = await signIn(BETA);
  assert.equal(r.status, 200, 'Beta signs in while somebody else is locked out');
});

// ── The address itself ──────────────────────────────────────────────────────

test('no salon can be served at the front door, even one named "login"', async () => {
  // Create a salon literally called "login". The signup page refuses the
  // name, but the shard is the last line and must hold on its own.
  tenantCli(dataDir, ['create', 'login', '--name', 'Impostor Salon', '--email', 'evil@impostor.test', '--password', 'impostor-2026!!']);
  const page = await k.api('GET', '/', { host: LOGIN });
  assert.match(page.text, /Sign in · Kairo/, 'the front door, not the impostor');
  assert.doesNotMatch(page.text, /Impostor/);
  const info = await k.api('GET', '/api/public/info', { host: LOGIN });
  assert.notEqual(info.status, 200, "and not the impostor's API either");
  // Nor is it offered as somewhere to sign in: its owner's correct password
  // gets the same refusal as a wrong one.
  const r = await signIn({ email: 'evil@impostor.test', password: 'impostor-2026!!' });
  assert.equal(r.status, 401, 'a salon at the front door\'s own address is never a sign-in target');
});

test('the reserved list names every address the front door could live at', () => {
  const src = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'platform', 'signup.js'), 'utf8');
  for (const s of ['login', 'signin', 'sign-in', 'auth', 'sso']) {
    assert.match(src, new RegExp(`'${s}'`), `"${s}" must be reserved`);
  }
});

test('"hidden" means hidden on the sign-in page', async () => {
  // Found in a real browser, not by a test: the page's own `form {display:flex}`
  // beat the browser's built-in [hidden] rule, so the email, password and Sign
  // in button stayed on screen behind the "Which business?" picker. The flow
  // still worked, which is exactly why nothing else caught it.
  const page = await k.api('GET', '/', { host: LOGIN });
  assert.match(page.text, /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/,
    'the page must make [hidden] win over its own display rules');
});
