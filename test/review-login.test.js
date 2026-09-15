// Can Apple's reviewer actually sign in?
//
// The review notes hand a stranger an address, an email and a password. If any
// of the three is wrong the build is rejected the same day — the notes
// themselves call it the most common avoidable rejection there is, and then ask
// a person to remember to check.
//
// scripts/review-login-check.mjs checks it instead. These tests exist to prove
// that script can FAIL, because a pre-submission check that always passes is
// worse than none: it is a reason not to look.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startKairo, ADMIN } from './helpers/kairo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let k;

// spawn, not spawnSync: the script talks to a server running in this process's
// test harness, and spawnSync blocks the event loop that would answer it.
const run = (env) => new Promise((resolve) => {
  const cp = spawn(process.execPath, [path.join(ROOT, 'scripts/review-login-check.mjs')], {
    env: { ...process.env, ...env },
  });
  let out = '';
  cp.stdout.on('data', (c) => { out += c; });
  cp.stderr.on('data', (c) => { out += c; });
  // ANSI codes sit between the tick and the words; assertions read stripped text.
  cp.on('close', (code) => resolve({ code, out: out.replace(/\x1b\[[0-9;]*m/g, '') }));
});

before(async () => { k = await startKairo(); });
after(async () => { await k?.stop(); });

test('a reviewer who can sign in and has data to look at passes', async () => {
  const r = await run({
    KAIRO_REVIEW_URL: k.base,
    KAIRO_REVIEW_EMAIL: ADMIN.email,
    KAIRO_REVIEW_PASSWORD: ADMIN.password,
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /can sign in and has something to review/);
});

test('a wrong password fails, and says it is the rejection the notes warn about', async () => {
  const r = await run({
    KAIRO_REVIEW_URL: k.base,
    KAIRO_REVIEW_EMAIL: ADMIN.email,
    KAIRO_REVIEW_PASSWORD: 'not-the-password',
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /REJECTED/);
});

test('an email that has no account fails rather than passing quietly', async () => {
  const r = await run({
    KAIRO_REVIEW_URL: k.base,
    KAIRO_REVIEW_EMAIL: 'review@kairobookings.com',   // the address in the notes — not created yet
    KAIRO_REVIEW_PASSWORD: ADMIN.password,
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /REJECTED/);
});

test('an unreachable address fails instead of hanging', async () => {
  const r = await run({
    KAIRO_REVIEW_URL: 'http://127.0.0.1:1',
    KAIRO_REVIEW_EMAIL: ADMIN.email,
    KAIRO_REVIEW_PASSWORD: ADMIN.password,
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /unreachable/);
});

test('missing configuration exits 2 and prints usage, rather than reporting a pass', async () => {
  const r = await run({ KAIRO_REVIEW_URL: '', KAIRO_REVIEW_EMAIL: '', KAIRO_REVIEW_PASSWORD: '' });
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /reviewer can sign in/);
});

test('an EMPTY salon fails, because that is how a 4.2 rejection happens', async () => {
  // A reviewer signing into a blank calendar with no clients is the second
  // documented way this gets rejected. Logging in successfully is not the same
  // as having something to review, and only this assertion tells them apart.
  const empty = await startKairo();
  try {
    const { cookie } = await empty.login();
    const cleared = await empty.api('POST', '/api/demo/clear', { cookie });
    assert.equal(cleared.status, 200, cleared.text);
    assert.equal(cleared.json.has_demo_data, false, 'the salon should now be empty');
    const r = await run({
      KAIRO_REVIEW_URL: empty.base,
      KAIRO_REVIEW_EMAIL: ADMIN.email,
      KAIRO_REVIEW_PASSWORD: ADMIN.password,
    });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /EMPTY/);
  } finally { await empty.stop(); }
});
