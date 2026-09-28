// "Forgot password?" — a reset link by email, only ever to a confirmed address.
//
// The feature is small; what it must refuse is not. Most of what follows is
// about the email that must NOT be sent (an unconfirmed address, a stranger's
// address, the hundredth press of the button), the link that must NOT work
// (twice, late, at another salon), and the answer that must NOT differ
// (whether or not the account exists).
//
// A real shard with three salons and a fake email provider that records every
// message, so each assertion is about what an inbox would actually receive.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { startKairo, tenantCli, ROOT } from './helpers/kairo.js';
import { mockResend } from './helpers/mocks.js';

const DOMAIN = 'kairobookings.test';
const LOGIN = `login.${DOMAIN}`;
const ALPHA = `alpha.${DOMAIN}`;
const BETA = `beta.${DOMAIN}`;
const GAMMA = `gamma.${DOMAIN}`;
const OWNER_A = { email: 'owner@alpha.test', password: 'alpha-pass-2026!!' };
const OWNER_B = { email: 'owner@beta.test', password: 'beta-pass-2026!!' };
const FORGOT_SAYS = /If that email belongs to a Kairo account with a confirmed email address/;
let k, dataDir, resend;

const tenantDb = (slug) => {
  const d = new DatabaseSync(path.join(dataDir, 'tenants', slug, 'kairo.db'));
  d.exec('PRAGMA busy_timeout = 5000');
  return d;
};

/** A real account, hashed exactly as Kairo hashes one. */
function addUser(slug, email, password, { verified = true } = {}) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const d = tenantDb(slug);
  d.prepare("INSERT INTO users (name, email, salt, pass_hash, role, email_verified) VALUES (?, ?, ?, ?, 'owner', ?)")
    .run('Test Person', email, salt, hash, verified ? 1 : 0);
  d.close();
}

function setVerified(slug, email, v) {
  const d = tenantDb(slug);
  d.prepare('UPDATE users SET email_verified = ? WHERE email = ?').run(v ? 1 : 0, email);
  d.close();
}

const sessionFrom = (res) => /kairo_session=([^;]+)/.exec(res.headers.get('set-cookie') || '')?.[1];
const login = async (host, email, password) => {
  const r = await k.api('POST', '/api/auth/login', { host, body: { email, password } });
  return { status: r.status, cookie: r.status === 200 ? `kairo_session=${sessionFrom(r)}` : null };
};

/** Every email sent to `to` since `from`, waiting a moment for the ones sent after the reply. */
async function inbox(to, { from = 0, expect = 1, waitMs = 3000 } = {}) {
  const deadline = Date.now() + waitMs;
  let got = [];
  for (;;) {
    got = resend.sent.slice(from).filter((m) => [].concat(m.to).includes(to));
    if (got.length >= expect || Date.now() > deadline) return got;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** The link out of a reset email: host, and the token after '#t='. */
function linkIn(mail) {
  const m = /(https?:\/\/[^\s"'<>]+\/reset#t=([A-Za-z0-9_-]{43}))/.exec(mail.text || '');
  assert.ok(m, `a reset link in the email: ${mail.text}`);
  const u = new URL(m[1]);
  return { host: u.host, token: m[2], url: m[1] };
}

const forgot = (host, email) => k.api('POST', '/api/auth/forgot', { host, body: { email } });

before(async () => {
  resend = await mockResend();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-reset-'));
  tenantCli(dataDir, ['create', 'alpha', '--name', 'Alpha Salon', '--email', OWNER_A.email, '--password', OWNER_A.password]);
  tenantCli(dataDir, ['create', 'beta', '--name', 'Beta Salon', '--email', OWNER_B.email, '--password', OWNER_B.password]);
  tenantCli(dataDir, ['create', 'gamma', '--name', 'Gamma Salon', '--email', 'owner@gamma.test', '--password', 'gamma-pass-2026!!']);
  k = await startKairo({
    dataDir,
    env: {
      KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN,
      RESEND_API_BASE: resend.base, KAIRO_SHARED_RESEND_KEY: resend.fullKey, KAIRO_SHARED_FROM: 'bookings@kairobookings.com',
    },
  });
  for (const h of [ALPHA, BETA, GAMMA]) await k.api('GET', '/api/public/info', { host: h });
  // Alpha's owner has confirmed their email. Beta's has not — the case of an
  // account set up under an address the owner does not read.
  setVerified('alpha', OWNER_A.email, true);
  setVerified('beta', OWNER_B.email, false);
});
after(async () => { await k?.stop(); await resend?.close(); });

// ── Who gets an email ───────────────────────────────────────────────────────

test('a confirmed address gets a link to its own salon', async () => {
  const from = resend.sent.length;
  const r = await forgot(ALPHA, OWNER_A.email);
  assert.equal(r.status, 200);
  assert.match(r.json.message, FORGOT_SAYS);
  const [mail] = await inbox(OWNER_A.email, { from });
  assert.ok(mail, 'the email was sent');
  assert.match(mail.subject, /Reset your Kairo password — Alpha Salon/);
  const link = linkIn(mail);
  assert.equal(link.host, ALPHA, 'the link opens the salon the account belongs to');
  assert.match(link.url, /\/reset#t=/, "the token rides after '#', so it never reaches a server log");
});

test('an UNCONFIRMED address gets nothing — and the page cannot tell', async () => {
  const from = resend.sent.length;
  const unconfirmed = await forgot(BETA, OWNER_B.email);
  const nobody = await forgot(BETA, 'nobody-at-all@beta.test');
  assert.equal(unconfirmed.status, 200);
  assert.match(unconfirmed.json.message, FORGOT_SAYS, 'the same words a confirmed account gets');
  assert.deepEqual(unconfirmed.json, nobody.json,
    'an unconfirmed account and no account at all must get the identical answer');
  const mail = await inbox(OWNER_B.email, { from, expect: 1, waitMs: 800 });
  assert.equal(mail.length, 0, 'a reset link must never go to an address nobody has proved is theirs');
});

test('an empty email is a plain error, not a silent success', async () => {
  const r = await forgot(ALPHA, '');
  assert.equal(r.status, 400);
});

test('one address cannot be flooded: pressing again at once sends nothing more', async () => {
  addUser('gamma', 'flood@gamma.test', 'flood-pass-2026!!');
  const from = resend.sent.length;
  await forgot(GAMMA, 'flood@gamma.test');
  await forgot(GAMMA, 'flood@gamma.test');
  await forgot(GAMMA, 'flood@gamma.test');
  await new Promise((r) => setTimeout(r, 600));
  const mail = await inbox('flood@gamma.test', { from, expect: 2, waitMs: 500 });
  assert.equal(mail.length, 1, 'at most one email a minute to one address, however many presses');
});

// ── The link ────────────────────────────────────────────────────────────────

test('the link sets a new password, signs this browser in, and retires every other session', async () => {
  addUser('alpha', 'reset@alpha.test', 'old-pass-2026!!xy');
  const before = await login(ALPHA, 'reset@alpha.test', 'old-pass-2026!!xy');
  assert.equal(before.status, 200);

  const from = resend.sent.length;
  await forgot(ALPHA, 'reset@alpha.test');
  const { token } = linkIn((await inbox('reset@alpha.test', { from }))[0]);

  const check = await k.api('POST', '/api/auth/reset/check', { host: ALPHA, body: { token } });
  assert.equal(check.status, 200);
  assert.equal(check.json.email, 're•••@alpha.test', 'recognisable to its owner, not readable by anyone else');
  assert.equal(check.json.business, 'Alpha Salon');

  const done = await k.api('POST', '/api/auth/reset', { host: ALPHA, body: { token, password: 'brand-new-pass-2026' } });
  assert.equal(done.status, 200, done.text);
  const fresh = sessionFrom(done);
  assert.ok(fresh, 'signed straight in');
  const me = await k.api('GET', '/api/auth/me', { host: ALPHA, cookie: `kairo_session=${fresh}` });
  assert.equal(me.json.user.email, 'reset@alpha.test');

  const old = await k.api('GET', '/api/auth/me', { host: ALPHA, cookie: before.cookie });
  assert.equal(old.status, 401, 'whoever was signed in before is not any more');
  assert.equal((await login(ALPHA, 'reset@alpha.test', 'old-pass-2026!!xy')).status, 401, 'the old password is dead');
  assert.equal((await login(ALPHA, 'reset@alpha.test', 'brand-new-pass-2026')).status, 200, 'the new one works');

  const changed = await inbox('reset@alpha.test', { from, expect: 2 });
  assert.ok(changed.some((m) => /password was changed/i.test(m.subject)), 'and the address is told it happened');
});

test('a link works once', async () => {
  addUser('alpha', 'once@alpha.test', 'once-pass-2026!!xy');
  const from = resend.sent.length;
  await forgot(ALPHA, 'once@alpha.test');
  const { token } = linkIn((await inbox('once@alpha.test', { from }))[0]);
  const first = await k.api('POST', '/api/auth/reset', { host: ALPHA, body: { token, password: 'first-choice-2026' } });
  assert.equal(first.status, 200);
  const second = await k.api('POST', '/api/auth/reset', { host: ALPHA, body: { token, password: 'second-choice-2026' } });
  assert.equal(second.status, 410, 'a used link is dead');
  assert.equal((await login(ALPHA, 'once@alpha.test', 'first-choice-2026')).status, 200);
  const check = await k.api('POST', '/api/auth/reset/check', { host: ALPHA, body: { token } });
  assert.equal(check.status, 410);
});

test('a password that fails the rules costs a retry, not the link', async () => {
  addUser('alpha', 'retry@alpha.test', 'retry-pass-2026!!xy');
  const from = resend.sent.length;
  await forgot(ALPHA, 'retry@alpha.test');
  const { token } = linkIn((await inbox('retry@alpha.test', { from }))[0]);
  const short = await k.api('POST', '/api/auth/reset', { host: ALPHA, body: { token, password: 'short' } });
  assert.equal(short.status, 400);
  const ok = await k.api('POST', '/api/auth/reset', { host: ALPHA, body: { token, password: 'long-enough-pass-2026' } });
  assert.equal(ok.status, 200, 'the same link still works after a rejected password');
});

test('a link dies after thirty minutes', async () => {
  addUser('alpha', 'late@alpha.test', 'late-pass-2026!!xy');
  const from = resend.sent.length;
  await forgot(ALPHA, 'late@alpha.test');
  const { token } = linkIn((await inbox('late@alpha.test', { from }))[0]);
  const d = tenantDb('alpha');
  d.prepare("UPDATE password_resets SET expires_at = '2000-01-01 00:00:00'").run();
  d.close();
  const check = await k.api('POST', '/api/auth/reset/check', { host: ALPHA, body: { token } });
  assert.equal(check.status, 410, 'the page says so before anybody types');
  const r = await k.api('POST', '/api/auth/reset', { host: ALPHA, body: { token, password: 'too-late-pass-2026' } });
  assert.equal(r.status, 410);
  assert.equal((await login(ALPHA, 'late@alpha.test', 'late-pass-2026!!xy')).status, 200, 'nothing changed');
});

test('only the hash of a link is stored', async () => {
  addUser('alpha', 'hash@alpha.test', 'hash-pass-2026!!xy');
  const from = resend.sent.length;
  await forgot(ALPHA, 'hash@alpha.test');
  const { token } = linkIn((await inbox('hash@alpha.test', { from }))[0]);
  const d = tenantDb('alpha');
  const rows = d.prepare('SELECT token_hash FROM password_resets').all();
  d.close();
  assert.ok(rows.every((r) => r.token_hash !== token), 'the link itself is never in the database');
  assert.ok(rows.some((r) => r.token_hash === crypto.createHash('sha256').update(token).digest('hex')));
});

test('nonsense and missing links are refused plainly', async () => {
  for (const token of ['', 'x', 'A'.repeat(43), '../../etc/passwd']) {
    const r = await k.api('POST', '/api/auth/reset', { host: ALPHA, body: { token, password: 'whatever-pass-2026' } });
    assert.equal(r.status, 410, `token ${JSON.stringify(token)}`);
  }
});

// ── The front door ──────────────────────────────────────────────────────────

test('at the front door, each salon with a confirmed account sends its own link — and only its own works there', async () => {
  const both = { email: 'both@shared.test', password: 'shared-pass-2026!!' };
  addUser('alpha', both.email, both.password);
  addUser('beta', both.email, both.password);
  const from = resend.sent.length;
  const r = await k.api('POST', '/api/forgot', { host: LOGIN, body: { email: both.email } });
  assert.equal(r.status, 200);
  assert.match(r.json.message, FORGOT_SAYS);
  const mail = await inbox(both.email, { from, expect: 2 });
  assert.equal(mail.length, 2, 'one email per salon');
  const links = mail.map(linkIn);
  assert.deepEqual(links.map((l) => l.host).sort(), [ALPHA, BETA]);
  const alphaLink = links.find((l) => l.host === ALPHA);
  const wrongSalon = await k.api('POST', '/api/auth/reset/check', { host: BETA, body: { token: alphaLink.token } });
  assert.equal(wrongSalon.status, 410, "Alpha's link means nothing at Beta");
});

test('at the front door, unknown and unconfirmed addresses get the same answer and no email', async () => {
  const from = resend.sent.length;
  const unconfirmed = await k.api('POST', '/api/forgot', { host: LOGIN, body: { email: OWNER_B.email } });
  const unknown = await k.api('POST', '/api/forgot', { host: LOGIN, body: { email: 'ghost@nowhere.test' } });
  assert.deepEqual(unconfirmed.json, unknown.json);
  assert.equal((await inbox(OWNER_B.email, { from, waitMs: 800 })).length, 0);
  const get = await k.api('GET', '/api/forgot', { host: LOGIN });
  assert.equal(get.status, 405);
});

test('a reset lifts the front door\'s lock on that email', async () => {
  const who = { email: 'locked@alpha.test', password: 'locked-pass-2026!!' };
  addUser('alpha', who.email, who.password);
  // Trip the per-email lock. Spread over addresses so the per-IP limit is not what stops us.
  for (let i = 0; i < 8; i++) {
    await k.api('POST', '/api/login', {
      host: LOGIN, body: { email: who.email, password: `wrong-${i}` },
      headers: { 'x-forwarded-for': `10.9.0.${i}` },
    });
  }
  const locked = await k.api('POST', '/api/login', { host: LOGIN, body: who, headers: { 'x-forwarded-for': '10.9.1.1' } });
  assert.equal(locked.status, 429, 'locked, as intended');

  const from = resend.sent.length;
  await forgot(ALPHA, who.email);
  const { token } = linkIn((await inbox(who.email, { from }))[0]);
  await k.api('POST', '/api/auth/reset', { host: ALPHA, body: { token, password: 'unlocked-pass-2026' } });
  const after = await k.api('POST', '/api/login', {
    host: LOGIN, body: { email: who.email, password: 'unlocked-pass-2026' }, headers: { 'x-forwarded-for': '10.9.1.2' },
  });
  assert.equal(after.status, 200, 'proving the inbox and choosing a password unlocks the front door too');
});

// ── Changing the sign-in email ──────────────────────────────────────────────

test('changing the sign-in email needs the current password, tells the old address, and kills old links', async () => {
  const who = { email: 'mover@alpha.test', password: 'mover-pass-2026!!' };
  addUser('alpha', who.email, who.password);
  const { cookie } = await login(ALPHA, who.email, who.password);

  // A link already sitting in the old inbox.
  const from = resend.sent.length;
  await forgot(ALPHA, who.email);
  const { token } = linkIn((await inbox(who.email, { from }))[0]);

  const bare = await k.api('PUT', '/api/account/profile', { host: ALPHA, cookie, body: { name: 'Mover', email: 'new@mover.test' } });
  assert.equal(bare.status, 400, 'no password, no change');
  const wrong = await k.api('PUT', '/api/account/profile', {
    host: ALPHA, cookie, body: { name: 'Mover', email: 'new@mover.test', current_password: 'not-it' },
  });
  assert.equal(wrong.status, 400);

  const nameOnly = await k.api('PUT', '/api/account/profile', { host: ALPHA, cookie, body: { name: 'Mover Renamed', email: who.email } });
  assert.equal(nameOnly.status, 200, 'a name change alone needs no password');

  const moved = await k.api('PUT', '/api/account/profile', {
    host: ALPHA, cookie, body: { name: 'Mover', email: 'new@mover.test', current_password: who.password },
  });
  assert.equal(moved.status, 200, moved.text);
  assert.equal(moved.json.email, 'new@mover.test');
  assert.equal(moved.json.email_verified, false, 'the new address has to be confirmed before it can receive a reset');

  const notice = await inbox(who.email, { from, expect: 2 });
  assert.ok(notice.some((m) => /sign-in email was changed/i.test(m.subject)), 'the OLD address hears about it');
  const dead = await k.api('POST', '/api/auth/reset/check', { host: ALPHA, body: { token } });
  assert.equal(dead.status, 410, 'a link in the old inbox must not outlive the move');

  // And the new, unconfirmed address cannot be sent a link yet.
  const from2 = resend.sent.length;
  await forgot(ALPHA, 'new@mover.test');
  assert.equal((await inbox('new@mover.test', { from: from2, waitMs: 800 })).length, 0);
});

// ── Pages, and things this touched ──────────────────────────────────────────

test('the reset page is served by every salon', async () => {
  const r = await k.api('GET', '/reset', { host: ALPHA });
  assert.equal(r.status, 200);
  assert.match(r.text, /Choose a new password/);
  assert.match(r.text, /\/js\/reset\.js/);
});

test("the front door's own page is no longer served, half-filled, at a salon's address", async () => {
  const r = await k.api('GET', '/login.html', { host: ALPHA });
  assert.notEqual(r.status, 200);
  assert.doesNotMatch(r.text, /__SITE_URL__/);
  const door = await k.api('GET', '/', { host: LOGIN });
  assert.equal(door.status, 200);
  assert.match(door.text, /Forgot your password\?/);
  assert.doesNotMatch(door.text, /__[A-Z_]+__/);
});

test('on the shard, only the demo workspace can wipe itself back to demo data', async () => {
  const { cookie } = await login(BETA, OWNER_B.email, OWNER_B.password);
  const me = await k.api('GET', '/api/auth/me', { host: BETA, cookie });
  assert.equal(me.json.demo_reset_allowed, false, 'the button is not offered');
  const r = await k.api('POST', '/api/settings/reset-demo', { host: BETA, cookie });
  assert.equal(r.status, 403, 'an unconfirmed email must not be all that stands between a salon and an empty diary');
});

test("a live salon's sign-in screen no longer prints the built-in demo password", () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/app.js'), 'utf8');
  const at = src.indexOf('admin123');
  assert.ok(at > 0);
  assert.match(src.slice(Math.max(0, at - 400), at), /\$\{local \?/, 'the demo hint is only shown on a laptop');
});

test('the forgot button is rate-limited, and email changes share the password limit', async () => {
  // Every suite runs with the limiter off; this one turns it back on.
  const own = await startKairo({ env: { KAIRO_RATELIMIT: 'on' } });
  try {
    let last;
    for (let i = 0; i < 6; i++) last = await own.api('POST', '/api/auth/forgot', { body: { email: `limit-${i}@x.test` } });
    assert.equal(last.status, 429, 'five a quarter-hour from one address');
  } finally { await own.stop(); }
  const { classifyRequest } = await import('../src/ratelimit.js');
  assert.equal(classifyRequest('PUT', '/api/account/profile'), 'password',
    'changing the email checks the current password, so it must be as slow to guess as changing the password');
  assert.equal(classifyRequest('POST', '/api/auth/reset'), 'public_reset');
  assert.equal(classifyRequest('POST', '/api/auth/reset/check'), 'public_reset');
});
