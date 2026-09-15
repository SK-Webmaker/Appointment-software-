#!/usr/bin/env node
// Can Apple's reviewer actually sign in?
//
// The App Review notes hand a stranger an address, an email and a password and
// invite them to look around. If any of the three is wrong the build is
// rejected the same day, and docs/app-store/07-phase-7-launch.md already calls
// this "the most common avoidable rejection there is". It then asks a person to
// remember to check — which is the part that does not survive a busy morning.
//
// So this checks it, the way the reviewer will: a real sign-in over the public
// address, with the real credentials, followed by the question that actually
// matters — is there anything in there to look at?
//
// That last one is not padding. A reviewer who signs into an empty salon sees a
// blank calendar and no clients, and "minimum functionality" (guideline 4.2) is
// the second way this gets rejected. An empty demo passes a login test and
// fails a review.
//
//   KAIRO_REVIEW_URL=https://demo.kairobookings.com \
//   KAIRO_REVIEW_EMAIL=review@kairobookings.com \
//   KAIRO_REVIEW_PASSWORD=… \
//   node scripts/review-login-check.mjs
//
// The password is read from the environment and never printed, because the
// whole point is that it is the live one.
//
// Exit 0 means a reviewer can sign in and has something to review. Exit 1 means
// they cannot, and the line says which step failed.
const E = '\x1b[';
const ok = (s) => console.log(`  ${E}32m✓${E}0m ${s}`);
const bad = (s) => console.log(`  ${E}31m✗${E}0m ${s}`);
const dim = (s) => `${E}2m${s}${E}0m`;

const url = String(process.env.KAIRO_REVIEW_URL || '').replace(/\/+$/, '');
const email = String(process.env.KAIRO_REVIEW_EMAIL || '').trim();
const password = String(process.env.KAIRO_REVIEW_PASSWORD || '');

if (!url || !email || !password) {
  console.error(`
  Check that Apple's reviewer can sign in to the demo salon.

    KAIRO_REVIEW_URL=https://demo.kairobookings.com \\
    KAIRO_REVIEW_EMAIL=review@kairobookings.com \\
    KAIRO_REVIEW_PASSWORD=… \\
    node scripts/review-login-check.mjs
`);
  process.exit(2);
}

const fetchJson = async (path, init = {}) => {
  const res = await fetch(url + path, { redirect: 'manual', signal: AbortSignal.timeout(20000), ...init });
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, headers: res.headers, json, text };
};

console.log(`\n  Signing in at ${url} as ${email}\n`);
let failed = 0;

// 1. The address answers at all. A reviewer who gets a blank page never reaches
//    the sign-in form, and the address is in the notes where it cannot be
//    edited after submission.
try {
  const r = await fetchJson('/');
  if (r.status === 200) ok(`the address answers ${dim('http 200')}`);
  else { bad(`the address answered http ${r.status} — a reviewer sees this before anything else`); failed++; }
} catch (e) {
  bad(`the address is unreachable: ${e.message}`);
  process.exit(1);
}

// 2. The credentials in the review notes actually work.
let cookie = '';
try {
  const r = await fetchJson('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (r.status === 200) {
    const m = /kairo_session=([^;]+)/.exec(r.headers.get('set-cookie') || '');
    if (!m) { bad('signed in, but no session cookie came back — the reviewer would be bounced straight out'); failed++; }
    else { cookie = `kairo_session=${m[1]}`; ok(`signed in as ${r.json?.user?.name || email} ${dim(r.json?.user?.role || '')}`); }
  } else if (r.status === 401) {
    bad('the email and password in the review notes are REJECTED — this is the rejection the notes warn about');
    failed++;
  } else {
    bad(`sign-in answered http ${r.status} ${dim(String(r.text).slice(0, 120))}`);
    failed++;
  }
} catch (e) { bad(`sign-in failed: ${e.message}`); failed++; }

// 3. There is something in there worth reviewing. Guideline 4.2 is the second
//    way this gets rejected, and an empty salon passes every check above.
if (cookie) {
  try {
    const r = await fetchJson('/api/auth/me', { headers: { Cookie: cookie } });
    if (r.status !== 200) { bad(`signed in, but the app would not load for them: http ${r.status}`); failed++; }
    else {
      const name = r.json?.settings?.business_name || '(unnamed)';
      ok(`the salon loads as "${name}"`);
      if (r.json?.has_demo_data) ok(`there is sample data to look at ${dim('calendar, clients, invoices')}`);
      else { bad('the salon is EMPTY — a reviewer sees a blank calendar, which is how guideline 4.2 rejections happen'); failed++; }
    }
  } catch (e) { bad(`could not load the app: ${e.message}`); failed++; }
}

console.log('');
if (failed) {
  console.log(`  ${E}31m${failed} problem(s). Fix before submitting — a reviewer who cannot sign in rejects the build the same day.${E}0m\n`);
  process.exit(1);
}
console.log(`  ${E}32mA reviewer can sign in and has something to review.${E}0m\n`);
process.exit(0);
