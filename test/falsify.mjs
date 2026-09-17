#!/usr/bin/env node
// A test that cannot fail is not a test.
//
// This deliberately breaks Kairo — one defect at a time, in a throwaway copy
// of the repo — and requires the suite that guards that behaviour to FAIL.
// A mutation that survives means the suite is not actually checking what it
// claims to, and this script exits non-zero so CI goes red.
//
//   npm run test:falsify            # every mutation
//   node test/falsify.mjs auth-gate # one, by name
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// name → { file, find, replace, suites }. `find` must occur exactly once.
const MUTATIONS = {
  'auth-gate': {
    file: 'src/api.js', suites: ['auth'],
    find: "if (!user) return sendJson(res, 401, { error: 'Not signed in' });",
    replace: "if (false) return sendJson(res, 401, { error: 'Not signed in' });",
  },
  'session-version-ignored': {
    file: 'src/api.js', suites: ['auth'],
    find: 'if (row && row.token_version === sess.version) user = row;',
    replace: 'if (row) user = row;',
  },
  'cookie-not-httponly': {
    file: 'src/auth.js', suites: ['auth'],
    find: 'return `Path=/; HttpOnly; SameSite=Lax${secure ? \'; Secure\' : \'\'}`;',
    replace: 'return `Path=/; SameSite=Lax${secure ? \'; Secure\' : \'\'}`;',
  },
  'double-booking-allowed': {
    file: 'src/api.js', suites: ['public-booking'],
    find: 'if (!freeSlotsFor(staffId, b.date, duration).includes(start)) {',
    replace: 'if (false) {',
  },
  'unknown-fields-accepted': {
    file: 'src/validate.js', suites: ['public-booking', 'settings'],
    find: 'if (!(key in schema)) throw httpError(400, `Unexpected field: ${path}${key}`);',
    replace: '',
  },
  'rate-limit-never-fires': {
    file: 'src/ratelimit.js', suites: ['ratelimit'],
    find: 'if (w.count > policy.limit) {',
    replace: 'if (false) {',
  },
  'secrets-unmasked': {
    file: 'src/db.js', suites: ['settings', 'security'],
    find: 'if (SECRET_SETTINGS.has(r.key)) {',
    replace: 'if (false) {',
  },
  'csp-missing': {
    file: 'server.js', suites: ['boot'],
    find: "res.setHeader('Content-Security-Policy', cspFor(url.pathname));",
    replace: '',
  },
  'ics-without-token': {
    file: 'src/api.js', suites: ['security'],
    find: "if (!recordTokenValid('ics', params.id, query.get('t'), getSetting('session_secret'))) {",
    replace: 'if (false) {',
  },
  'cancel-window-ignored': {
    file: 'src/api.js', suites: ['cancel'],
    find: 'if (ctx.tooLate) {',
    replace: 'if (false) {',
  },
  'origin-lock-never-blocks': {
    file: 'src/origin.js', suites: ['origin-lock'],
    find: "block: m === 'enforce',",
    replace: 'block: false,',
  },
  'admin-email-case-kept': {
    file: 'src/db.js', suites: ['backup-and-boot'],
    find: "String(process.env.KAIRO_ADMIN_EMAIL || 'admin@kairo.local').trim().toLowerCase(),",
    replace: "String(process.env.KAIRO_ADMIN_EMAIL || 'admin@kairo.local'),",
  },
  'move-drops-client': {
    file: 'src/api.js', suites: ['messages'],
    find: "const clientId = ('client_id' in a.b || a.b.new_client) ? a.clientId : before.client_id;",
    replace: 'const clientId = a.clientId;',
  },
  'forwarded-host-trusted-without-the-secret': {
    file: 'src/tenant.js', suites: ['tenants'],
    find: "  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return headers.host;",
    replace: '',
  },
  'front-door-on-without-a-secret': {
    file: 'src/tenant.js', suites: ['tenants'],
    find: '  if (!want || !real) return headers.host;',
    replace: '  if (!real) return headers.host;',
  },
  // An address that names nobody must get nobody. Falling back to "some"
  // tenant is how one salon ends up served another salon's client list. The
  // parse moved into slugForHost on 13 September; the property did not.
  'host-routing-picks-first-tenant': {
    file: 'src/tenant.js', suites: ['tenants'],
    find: '  const slug = slugForHost(hostHeader);\n  return slug ? getTenant(slug) : null;',
    replace: '  const slug = slugForHost(hostHeader);\n  return getTenant(slug || listTenantSlugs()[0]);',
  },
  'read-only-not-enforced': {
    file: 'server.js', suites: ['tenants'],
    find: "if (isReadOnly() && req.method !== 'GET' && req.method !== 'HEAD'",
    replace: "if (false && req.method !== 'GET' && req.method !== 'HEAD'",
  },
  'muted-still-sends': {
    file: 'src/notify.js', suites: ['tenants'],
    find: 'if (isMuted()) {',
    replace: 'if (false) {',
  },
  'rate-limit-shared-across-salons': {
    file: 'src/api.js', suites: ['tenants'],
    find: 'const over = rateHit(bucket, slug ? `${slug}:${ip}` : ip);',
    replace: 'const over = rateHit(bucket, ip);',
  },
  'verifier-ignores-row-counts': {
    file: 'scripts/migrate-tenant.mjs', suites: ['migrate'],
    find: "  for (const t of a.tables) check(`rows: ${t}`, a.counts[t], b.counts[t]);",
    replace: '',
  },
  // --across-versions is the one place that is allowed to turn a red check
  // green, so each of its guards gets its own mutation. A survivor here means
  // the move could wave a real difference through at one in the morning.
  'across-versions-explains-everything': {
    file: 'scripts/migrate-tenant.mjs', suites: ['migrate'],
    find: '  return rows.map((r) => {\n    if (r.pass) return r;',
    replace: "  return rows.map((r) => {\n    if (r.pass) return r;\n    return { ...r, pass: true, benign: 'version change' };",
  },
  'across-versions-allows-a-removed-table': {
    file: 'scripts/migrate-tenant.mjs', suites: ['migrate'],
    find: '      if (removedTables.length === 0 && addedTables.length > 0 && addedTablesEmpty) {',
    replace: '      if (addedTables.length > 0 && addedTablesEmpty) {',
  },
  'across-versions-allows-a-populated-new-table': {
    file: 'scripts/migrate-tenant.mjs', suites: ['migrate'],
    find: '  const addedTablesEmpty = addedTables.every((t) => b.counts[t] === 0);',
    replace: '  const addedTablesEmpty = true;',
  },
  'across-versions-allows-a-removed-setting': {
    file: 'scripts/migrate-tenant.mjs', suites: ['migrate'],
    find: '  const settingsAdditive = removedKeys.length === 0 && addedKeysDefault;',
    replace: '  const settingsAdditive = addedKeysDefault;',
  },
  'across-versions-allows-a-non-default-setting': {
    file: 'scripts/migrate-tenant.mjs', suites: ['migrate'],
    find: "const isDefault = (v) => v === '' || v === '0';",
    replace: 'const isDefault = () => true;',
  },
  'across-versions-stamp-value-unchecked': {
    file: 'scripts/migrate-tenant.mjs', suites: ['migrate'],
    find: '    if (m && SELF_UPDATING.has(m[1]) && looksLikeStamp(r.a) && looksLikeStamp(r.b)) {',
    replace: '    if (m && SELF_UPDATING.has(m[1])) {',
  },
  // The purchase funnel's silent failure: a code that never sent, reported as
  // sent. Three guards, three mutations.
  'resend-claims-success-when-it-failed': {
    file: 'platform/signup.js', suites: ['signup'],
    find: '  if (!r.ok) {',
    replace: '  if (false) {',
  },
  'undeliverable-code-tells-nobody': {
    file: 'platform/signup.js', suites: ['signup'],
    find: "    openTask(b.id, `code:${kind}:undeliverable`, `A ${kind} code could not be sent: ${r.detail}`);",
    replace: '',
  },
  'policies-only-answer-with-dot-html': {
    file: 'platform/server.js', suites: ['signup'],
    find: "    if (POLICY_PAGES.has(p.slice(1))) return serveStatic(res, `${p.slice(1)}.html`);",
    replace: '',
  },
  'provisioning-assumes-gst-registered': {
    file: 'platform/signup.js', suites: ['signup'],
    find: "        tax_rate: '0',",
    replace: "        tax_rate: '10',",
  },
  // The cutover script must fall back to the judged comparison. Without it,
  // every real cross-version move stops at step 3 — which is what happened on
  // the first move, and why four rows got diffed by hand at one in the morning.
  'cutover-stops-on-any-version-difference': {
    file: 'scripts/move-tenant.mjs', suites: ['move-tenant'],
    find: "  v = verify(['--across-versions']);",
    replace: '',
  },
  'cutover-skips-the-strict-comparison': {
    file: 'scripts/move-tenant.mjs', suites: ['move-tenant'],
    find: 'let v = verify();',
    replace: "let v = verify(['--across-versions']);",
  },
  // Updating a shard safely. Each of these was the real behaviour until
  // 13 September, and the first one ended the process for every salon at once.
  'one-salons-bad-database-takes-the-shard-down': {
    file: 'src/tenant.js', suites: ['shard-updates'],
    find: '  } catch (err) {',
    replace: '  } catch (err) { throw err;',
  },
  'a-request-that-throws-ends-the-process': {
    file: 'server.js', suites: ['shard-updates'],
    find: '    console.error(`request ${req.method} ${req.url}:`, err?.stack || err?.message || err);',
    replace: '    throw err;',
  },
  'a-broken-salon-is-told-it-does-not-exist': {
    file: 'server.js', suites: ['shard-updates'],
    find: '    if (MULTI && tenantFault(slugForHost(host))) { salonUnavailable(res, url.pathname); return; }',
    replace: '',
  },
  'readiness-only-reports-salons-something-already-opened': {
    file: 'server.js', suites: ['shard-updates'],
    find: '  if (MULTI) for (const slug of listTenantSlugs()) getTenant(slug);',
    replace: '',
  },
  'readiness-always-says-ok': {
    file: 'server.js', suites: ['shard-updates'],
    find: '    ok: degraded.length === 0,',
    replace: '    ok: true,',
  },
  'readiness-never-reports-a-shard-serving-nobody': {
    file: 'server.js', suites: ['shard-updates'],
    find: '  sendJson(res, serving > 0 || salons === 0 ? 200 : 503, {',
    replace: '  sendJson(res, 200, {',
  },
  // Reaching the new tenant before its address points at the shard. The old
  // way — a <slug>-preview alias in tenant.json domains — passed its tests and
  // could never work in production, because the domains index is only
  // consulted for a host OUTSIDE the base domain and the alias was inside it.
  'cutover-compares-without-forwarding-the-real-hostname': {
    file: 'scripts/move-tenant.mjs', suites: ['move-tenant'],
    find: "  ...(via ? [] : ['--forward-secret', secret])],",
    replace: '  ],',
  },
  'cutover-sends-the-salon-before-knowing-it-can-check-it': {
    file: 'scripts/move-tenant.mjs', suites: ['move-tenant'],
    find: 'if (!via && !secret) {',
    replace: 'if (false) {',
  },
  // Whether a salon still has an off-site copy. Every salon on a shard shares
  // one disk, so this is the only thing between a lost disk and a lost
  // business — and it is the kind of thing that fails in silence.
  'backup-check-calls-a-stopped-schedule-healthy': {
    file: 'scripts/backup-check.mjs', suites: ['backup-check'],
    find: '  if (ageDays > every * 2) {',
    replace: '  if (false) {',
  },
  'backup-check-ignores-a-failed-attempt': {
    file: 'scripts/backup-check.mjs', suites: ['backup-check'],
    find: "  if (b.last_ok === false) return { fault: true, why: `last attempt FAILED — ${b.last_detail || 'no reason recorded'}` };",
    replace: '',
  },
  'backup-check-accepts-having-nowhere-to-send-it': {
    file: 'scripts/backup-check.mjs', suites: ['backup-check'],
    find: "  if (!b.to_set) return { fault: true, why: 'no recipient — the backup has nowhere to go' };",
    replace: '',
  },
  'backup-status-never-reaches-the-control-api': {
    file: 'src/platform.js', suites: ['backup-check'],
    find: '      return { ...rest, last_detail: withoutAddresses, to_set: Boolean(to) };',
    replace: '      return undefined;',
  },
  'backup-status-republishes-the-owners-address': {
    file: 'src/platform.js', suites: ['backup-check'],
    find: "      const withoutAddresses = String(rest.last_detail || '').replace(/[^\\s@]+@[^\\s@]+\\.[^\\s@,)]+/g, '(the owner)');",
    replace: '      const withoutAddresses = rest.last_detail;',
  },
  // How often a backup happens, and what happens when one fails. The live
  // shard was retrying the demo salon's failed backup every 60 seconds,
  // forever, because a failure never advanced the schedule marker.
  'failed-backup-retries-every-minute-forever': {
    file: 'src/backup.js', suites: ['backup-and-boot'],
    find: "    setSetting('backup_retry_after', ok ? '' : new Date(Date.now() + RETRY_AFTER_MS).toISOString());",
    replace: '',
  },
  'backup-ignores-its-own-backoff': {
    file: 'src/backup.js', suites: ['backup-and-boot'],
    find: '  if (now < retryAfter) return false;',
    replace: '',
  },
  'an-unusable-backup-frequency-is-stored-anyway': {
    file: 'src/api.js', suites: ['backup-and-boot'],
    find: '      if (!Object.hasOwn(FREQUENCIES, val)) {',
    replace: '      if (false) {',
  },
  'kai-promises-a-frequency-that-does-not-exist': {
    file: 'src/kai-actions.js', suites: ['kai'],
    find: "    const freq = /^(every second month|every two months|bi-?monthly)$/.test(said) ? 'bimonthly'",
    replace: "    const freq = /^(never-matches-anything)$/.test(said) ? 'bimonthly'",
  },
  'never-leaves-the-tick-box-saying-backups-are-on': {
    file: 'src/api.js', suites: ['backup-and-boot'],
    find: "      if (val === 'off') setSetting('backup_email_enabled', '0');",
    replace: '',
  },
  'switching-backups-on-leaves-them-scheduled-for-never': {
    file: 'src/api.js', suites: ['backup-and-boot'],
    find: "      if (on && getSetting('backup_frequency', 'weekly') === 'off' && !Object.hasOwn(body, 'backup_frequency')) {",
    replace: '      if (false) {',
  },
  // A half-set pair is OFF — emailSender() requires both — but it looks
  // configured to anyone reading a dashboard. Reporting it as on is how a
  // salon goes weeks sending nothing while every screen says it is fine.
  'boot-banner-calls-half-set-shared-sending-on': {
    file: 'server.js', suites: ['shared-sender'],
    find: "    if (sharedKey && sharedFrom) console.log(`    Shared sender: on, from ${sharedFrom}`);",
    replace: "    if (sharedKey || sharedFrom) console.log(`    Shared sender: on, from ${sharedFrom}`);",
  },
  // ── Motion ───────────────────────────────────────────────────────────────
  // Somebody tidying the reduced-motion guard will reach for `animation: none`,
  // because it reads as obviously correct. It strands every to-only keyframe at
  // its hidden starting frame — the launch sequence never appears and the app
  // looks broken to the one person who asked for less movement.
  'reduced-motion-removes-animations-instead-of-finishing-them': {
    file: 'public/css/app.css', suites: ['motion'],
    find: '    animation-duration: 0.01ms !important;',
    replace: '    animation: none !important;',
  },
  // An infinite pulse with a 0.01ms duration does not stop; it loops
  // imperceptibly fast and burns a phone battery doing it.
  'reduced-motion-lets-infinite-animations-keep-looping': {
    file: 'public/css/app.css', suites: ['motion'],
    find: '    animation-iteration-count: 1 !important;',
    replace: '    animation-fill-mode: both !important;',
  },
  // ── The whole business model, end to end ────────────────────────────────
  // journey.test.js walks a stranger from the shop front to a paid invoice.
  // These four break one link each, because a six-act story that cannot fail
  // is a very long way of asserting nothing.

  // A client hits Reply on their confirmation — "can I move to 3pm?" — and on
  // the shared sender the From address is Kairo's. Without the reply-to that
  // message reaches US and the salon never learns it was asked. A lost client,
  // silently, which is the worst shape a bug can have.
  'confirmation-reply-goes-to-kairo-not-the-salon': {
    file: 'src/notify.js', suites: ['journey'],
    find: '      ...(replyTo ? { reply_to: replyTo } : {}),',
    replace: '      ...(false ? { reply_to: replyTo } : {}),',
  },
  // The invoice must be the price of the service that was booked. Billing a
  // different number than the one on the menu is the single most damaging
  // thing this software could do quietly.
  'invoice-bills-a-different-price-than-the-menu': {
    file: 'src/api.js', suites: ['journey'],
    find: '    for (const svc of services) lineItem.run(invId, svc.name, svc.price_cents || 0);',
    replace: '    for (const svc of services) lineItem.run(invId, svc.name, 0);',
  },
  // The platform keeps the owner's password hash only long enough to create
  // her salon with it. Holding it afterwards is a credential Kairo has no
  // reason to have and every reason not to.
  'platform-keeps-the-owners-password-after-provisioning': {
    file: 'platform/signup.js', suites: ['journey', 'signup'],
    find: `db.prepare("UPDATE businesses SET pass_hash = '', salt = '', last_error = '', ready_at = datetime('now') WHERE id = ?").run(b.id);`,
    replace: `db.prepare("UPDATE businesses SET last_error = '', ready_at = datetime('now') WHERE id = ?").run(b.id);`,
  },
  // The reviewer's sign-in. Their own launch doc calls a broken demo login the
  // most common avoidable rejection there is, so the check that guards it has
  // to be able to fail.
  'review-check-accepts-a-rejected-password': {
    file: 'scripts/review-login-check.mjs', suites: ['review-login'],
    find: "  } else if (r.status === 401) {",
    replace: "  } else if (false) {",
  },
  // Signing in is not the same as having something to review. A reviewer who
  // lands on a blank calendar with no clients is guideline 4.2, and every other
  // assertion in this script passes in that state.
  'review-check-passes-an-empty-salon': {
    file: 'scripts/review-login-check.mjs', suites: ['review-login'],
    find: "      if (r.json?.has_demo_data) ok(`there is sample data to look at ${dim('calendar, clients, invoices')}`);",
    replace: "      if (true) ok(`there is sample data to look at ${dim('calendar, clients, invoices')}`);",
  },
  // The seller is the party to the contract. A blank is caught by the launch
  // check; two pages naming two DIFFERENT sellers is the failure that looks
  // like nothing at all, so the name lives in platform/seller.js and the pages
  // are read back against it.
  'terms-names-a-different-seller': {
    file: 'platform/public/terms.html', suites: ['signup'],
    find: 'sold by <b>Shamalka Kiridena</b>',
    replace: 'sold by <b>Kairo Pty Ltd</b>',
  },
  // "Kairo Bookings" is a trading name with no ABN behind it, so ASIC has not
  // registered it and it is not an entity that can sell anything. Naming it in
  // a contract names nobody — which is exactly as weak as the blank was.
  'terms-names-an-unregistered-entity': {
    file: 'platform/public/terms.html', suites: ['signup'],
    find: 'sold by <b>Shamalka Kiridena</b>',
    replace: 'sold by <b>Kairo Bookings</b>',
  },
  // The Privacy Policy has to say who holds the data, not just what is held —
  // it is the page Apple's reviewer opens and the page a salon's own client
  // ends up on when they ask where their details went.
  'privacy-stops-saying-who-holds-the-data': {
    file: 'platform/public/privacy.html', suites: ['signup'],
    find: 'Kairo is operated by <b>Shamalka Kiridena</b>, Australia.',
    replace: 'Kairo is operated by our team.',
  },
  // Apple's reviewer opens the Support and Privacy URLs and clicks what is on
  // them, and those two addresses cannot be edited once the app is submitted.
  'a-policy-page-links-somewhere-dead': {
    file: 'platform/public/support.html', suites: ['signup'],
    find: 'see the <a href="/refunds">Refund Policy</a>',
    replace: 'see the <a href="/refund-policy">Refund Policy</a>',
  },
  // The cutover unmute. A salon left muted serves perfectly and sends nothing
  // — no confirmations, no reminders — and no screen says so, so the only
  // thing standing between that and a silent salon is this script actually
  // asking the shard afterwards rather than trusting its own PATCH.
  'unmute-trusts-the-patch-instead-of-asking-again': {
    file: 'scripts/shard-mute.mjs', suites: ['shard-mute'],
    find: 't = await state();\nif (t.muted !== want) {',
    replace: 'if (t.muted !== want) {',
  },
  'unmute-waves-through-a-salon-that-cannot-send-at-all': {
    file: 'scripts/shard-mute.mjs', suites: ['shard-mute'],
    find: "  if (t.email_sending === 'none') {",
    replace: '  if (false) {',
  },
  'unmute-reassures-with-undefined-on-a-shard-that-cannot-answer': {
    file: 'scripts/shard-mute.mjs', suites: ['shard-mute'],
    find: '  if (!t.email_sending) {',
    replace: '  if (false) {',
  },
  'reporting-the-state-quietly-changes-it': {
    file: 'scripts/shard-mute.mjs', suites: ['shard-mute'],
    find: "if (!on && !off) { console.log(''); process.exit(0); }",
    replace: '',
  },
  // Shared sending. The two ways this quietly ruins a salon: moving one that
  // has its own account onto Kairo's, and dropping the reply-to so a client's
  // "can I move to 3pm?" lands in Kairo's inbox instead of theirs.
  'shared-sender-overrides-their-own': {
    file: 'src/db.js', suites: ['shared-sender'],
    find: "  if (own && ownFrom) return { key: own, from: ownFrom, shared: false };",
    replace: '',
  },
  'shared-send-drops-the-reply-to': {
    file: 'src/notify.js', suites: ['shared-sender'],
    find: '      ...(replyTo ? { reply_to: replyTo } : {}),',
    replace: '',
  },
  'shared-send-uses-kairos-name-not-theirs': {
    file: 'src/notify.js', suites: ['shared-sender'],
    find: "      from: fromHeader(getSetting('business_name', 'Bookings'), from),",
    replace: '      from,',
  },
  'checklist-still-blocks-when-sending-works': {
    file: 'src/checklist.js', suites: ['shared-sender'],
    find: '    required: !sendingWorks,',
    replace: '    required: true,',
  },
  // The operator queue is only useful if what lands in it needs a person. A
  // task opened for every salon regardless is noise, and an operator who learns
  // to scroll past noise misses the one that matters.
  'email-task-opens-for-everyone': {
    file: 'platform/signup.js', suites: ['signup'],
    find: "  if (sending === 'none') {",
    replace: '  if (true) {',
  },
  'shard-never-reports-how-it-sends': {
    file: 'src/platform.js', suites: ['control-api'],
    find: '    email_sending: emailSending(),',
    replace: '',
  },
  'control-api-signature-ignored': {
    file: 'src/platform.js', suites: ['control-api'],
    find: "  if (!m) return 'missing or malformed signature';",
    replace: '  if (!m) return null;',
  },
  'self-export-open-to-anyone': {
    file: 'src/platform.js', suites: ['control-api'],
    find: "  const bad = verify(req, pathname, raw);\n  if (bad) { sendJson(res, 401, { error: `Unauthorised: ${bad}` }); return true; }",
    replace: '',
  },
  'import-overwrites-existing': {
    file: 'src/platform.js', suites: ['control-api'],
    find: "    if (getTenant(slug) || fs.existsSync(path.join(TENANTS_DIR, slug))) throw httpError(409, `A salon already uses \"${slug}\" — import never overwrites`);",
    replace: '',
  },
  'import-skips-integrity-check': {
    file: 'src/platform.js', suites: ['control-api'],
    find: "        if (ic?.integrity_check !== 'ok') throw httpError(400, `snapshot failed its integrity check: ${JSON.stringify(ic)}`);",
    replace: '',
  },
  'control-api-replay-window-open': {
    file: 'src/platform.js', suites: ['control-api'],
    find: "  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > MAX_AGE_MS) return 'signature timestamp is outside the accepted window';",
    replace: "  if (!Number.isFinite(t)) return 'no timestamp';",
  },
  'webhook-signature-ignored': {
    file: 'platform/stripe.js', suites: ['signup'],
    find: "  if (!secret) return { ok: false, reason: 'no STRIPE_WEBHOOK_SECRET set' };",
    replace: '  return { ok: true };',
  },
  'screening-never-flags': {
    file: 'platform/signup.js', suites: ['signup'],
    find: '  return flags;\n}',
    replace: '  return [];\n}',
  },
  'owner-credential-kept-after-provisioning': {
    file: 'platform/signup.js', suites: ['signup'],
    find: "  db.prepare(\"UPDATE businesses SET pass_hash = '', salt = '', last_error = '', ready_at = datetime('now') WHERE id = ?\").run(b.id);",
    replace: "  db.prepare(\"UPDATE businesses SET last_error = '', ready_at = datetime('now') WHERE id = ?\").run(b.id);",
  },
  'expired-signup-keeps-its-address': {
    file: 'platform/signup.js', suites: ['signup'],
    find: "  if (db.prepare(\"SELECT id FROM businesses WHERE slug = ? AND state != 'expired'\").get(slug)) return { ok: false, reason: 'That address is taken.' };",
    replace: "  if (db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug)) return { ok: false, reason: 'That address is taken.' };",
  },
  'dns-written-but-not-checked': {
    file: 'platform/connect.js', suites: ['connect'],
    find: "      const clash = dns.find((r) => !r.ok);\n      if (clash) throw new Error(`${clash.type} ${clash.name} already exists with a different value — someone must look at it`);\n      await cf.ensureDmarc(zone);",
    replace: '      await cf.ensureDmarc(zone);',
  },
  'second-dmarc-record-allowed': {
    file: 'platform/cloudflare.js', suites: ['connect'],
    find: "  const existing = (await listRecords(zone)).find((r) => r.type === 'TXT' && String(r.name).toLowerCase() === name);\n  if (existing) return { name, action: 'already there — a second record would void DMARC for every salon', ok: true };",
    replace: '',
  },
  'sending-key-not-scoped': {
    file: 'platform/resend.js', suites: ['connect'],
    find: "  call(key, 'POST', '/api-keys', { name, permission: 'sending_access', domain_id: domainId });",
    replace: "  call(key, 'POST', '/api-keys', { name, permission: 'full_access' });",
  },
  'setup-key-left-behind': {
    file: 'platform/connect.js', suites: ['connect'],
    find: "      if (mine) { await resend.deleteKey(setupKey, mine.id); record(businessId, 'email:cleanup', 'setup key deleted from their account'); }",
    replace: '      if (mine) record(businessId, \'email:cleanup\', \'left alone\');',
  },
  'unverified-domain-accepted': {
    file: 'platform/connect.js', suites: ['connect'],
    find: "    if (status !== 'verified') {",
    replace: '    if (false) {',
  },
  'refund-window-not-enforced': {
    file: 'platform/signup.js', suites: ['connect'],
    find: '  if (left <= 0) {',
    replace: '  if (false) {',
  },
  'checklist-never-hides': {
    file: 'src/checklist.js', suites: ['connect'],
    find: '    show: !items.every((i) => i.done),',
    replace: '    show: true,',
  },
  'own-number-code-not-checked': {
    file: 'src/notify.js', suites: ['connect'],
    find: "    if (!r.ok) return { ok: false, detail: `ClickSend: ${r.data?.response_msg || r.data?.error_message || `that code was not accepted`}` };",
    replace: '    if (false) return { ok: false, detail: \'x\' };',
  },
  'pre-update-backup-skipped': {
    file: 'src/db.js', suites: ['backup-and-boot'],
    find: 'if (priorVersion && priorVersion !== VERSION) backupBeforeUpdate(priorVersion);',
    replace: '',
  },

  // ── slice 6: the app ─────────────────────────────────────────────────────
  'closing-the-account-has-no-button': {
    // The state this was actually in: the route worked, the tests passed, and
    // no owner could reach it. Apple requires the deletion to be IN the app.
    file: 'public/js/pages/account.js', suites: ['app'],
    find: "        const r = await api.post('/api/account/delete', {",
    replace: "        const r = await api.post('/api/account/close-it', {",
  },
  'any-device-token-accepted': {
    file: 'src/api.js', suites: ['app'],
    find: "if (!/^[0-9a-fA-F]{32,200}$/.test(token)) throw httpError(400, 'That is not a device token');",
    replace: '',
  },
  'device-token-case-splits-phones': {
    file: 'src/api.js', suites: ['app'],
    find: 'const row = registerDevice(user.id, token.toLowerCase(), {',
    replace: 'const row = registerDevice(user.id, token, {',
  },
  'apns-signature-der': {
    file: 'src/push.js', suites: ['app'],
    find: "    dsaEncoding: 'ieee-p1363',",
    replace: '',
  },
  'provider-token-minted-every-send': {
    file: 'src/push.js', suites: ['app'],
    find: 'if (cached.token && cached.kid === kid && now - cached.at < TOKEN_TTL_MS) return cached.token;',
    replace: '',
  },
  'dead-device-kept-forever': {
    file: 'src/push.js', suites: ['app'],
    find: "  if (out.status === 410 || out.reason === 'BadDeviceToken' || out.reason === 'Unregistered') {",
    replace: '  if (false) {',
  },
  'delete-without-the-password': {
    file: 'src/api.js', suites: ['app'],
    find: "  if (!row || !verifyPassword(str(b.password, 200), row.salt, row.pass_hash)) {\n    throw httpError(403, 'That password is not right');\n  }",
    replace: '',
  },
  'delete-leaves-everyone-signed-in': {
    file: 'src/api.js', suites: ['app'],
    find: "  db.prepare('UPDATE users SET token_version = token_version + 1').run();",
    replace: '',
  },
  'workspace-quotes-a-price': {
    file: 'src/db.js', suites: ['app'],
    find: "  plan_price_cents: '0',",
    replace: "  plan_price_cents: '41000',",
  },
  'universal-link-swallows-the-domain': {
    file: 'server.js', suites: ['app'],
    find: "details: [{ appID: appId, paths: ['/book', '/book/*', '/r/*'] }],",
    replace: "details: [{ appID: appId, paths: ['*'] }],",
  },
  // ── Kai ────────────────────────────────────────────────────────────────
  //
  // Kai is the only place in Kairo that changes a setting from a sentence, so
  // the mutations that matter are the ones that make it act when it should not.
  'kai-question-is-a-command': {
    file: 'src/kai-actions.js', suites: ['kai'],
    find: 'if (!asked || (ASKING.test(asked) && !NEGATED_ORDER.test(asked))) {',
    replace: 'if (!asked) {',
  },
  'kai-guesses-between-readings': {
    file: 'src/kai-actions.js', suites: ['kai'],
    find: '  if (plans[0].score - plans[1].score >= 8) return { plan: plans[0], options: [] };',
    replace: '  return { plan: plans[0], options: [] };',
  },
  'kai-undo-restores-nothing': {
    file: 'src/kai-actions.js', suites: ['kai'],
    find: '  for (const step of [...steps].reverse()) {',
    replace: '  for (const step of []) {',
  },
  'kai-undo-restores-everything': {
    // The prior value of only the keys a change WROTE goes back. Restoring a
    // blob of settings would quietly undo whatever somebody else changed in
    // another tab in between.
    file: 'src/kai-actions.js', suites: ['kai'],
    find: '      for (const [k, v] of Object.entries(step.before)) setSetting(k, v);',
    replace: '      for (const [k, v] of Object.entries(step.before)) setSetting(k, v);\n      setSetting(\'business_name\', \'Glow Bar\');',
  },
  'kai-looking-is-trading': {
    // "Open my calendar on Saturday" must not start opening the salon on
    // Saturdays. One word apart from "open on Saturday", opposite meanings.
    file: 'src/kai-actions.js', suites: ['kai'],
    find: '    if (VIEWING.test(ctx.raw)) return [];',
    replace: '    if (false) return [];',
  },
  'kai-navigates-away-from-an-answer': {
    file: 'src/kai-nav.js', suites: ['kai'],
    find: '  const bare = said.size > 0 && [...said].every((w) => vocab.has(w)) && !asking;',
    replace: '  const bare = true;',
  },
  'kai-drops-the-day': {
    file: 'src/kai-nav.js', suites: ['kai'],
    find: '  const href = best.dated && date ? `${best.href}?date=${date}` : best.href;',
    replace: '  const href = best.href;',
  },
  'kai-settings-cards-unreachable': {
    file: 'src/kai-nav.js', suites: ['kai'],
    find: '      href: `#/settings?open=${s.id}`,',
    replace: "      href: '#/settings',",
  },
  'kai-books-without-being-asked': {
    // The line the whole assistant is built to stay on the safe side of: a
    // booking texts a real person and there is no undo for that.
    file: 'src/kai-booking.js', suites: ['kai'],
    find: '  return people.slice(0, 3).map(build);',
    replace: '  return [build(people[0])];',
  },
  'kai-booking-eats-a-setting': {
    file: 'src/kai-booking.js', suites: ['kai'],
    find: '  if (!raw || !BOOKS.test(raw) || NOT_A_BOOKING.test(raw)) return [];',
    replace: '  if (!raw || !BOOKS.test(raw)) return [];',
  },
  'kai-booking-loses-the-client': {
    // Deleting the line outright leaves a dangling `else` and the suite fails
    // to parse, which is a mutation the tests "catch" without testing
    // anything. This one has to be valid code that behaves wrongly.
    file: 'src/kai-booking.js', suites: ['kai'],
    find: "    if (client) params.set('client', String(client.id));",
    replace: '    if (false) params.set(\'client\', String(client.id));',
  },
  'kai-booking-hides-the-clash': {
    file: 'src/kai-booking.js', suites: ['kai'],
    find: '    warnings: warnFor(client),',
    replace: '    warnings: [],',
  },
  'kai-booking-checks-the-whole-shop': {
    // A clash has to be about one stylist's diary. Across the whole salon it
    // fires on almost every booking and names somebody else's client, which
    // reads as though THEY are the person being booked.
    file: 'src/kai-booking.js', suites: ['kai'],
    find: "        WHERE a.date = ? AND a.staff_id = ? AND a.status NOT IN ('cancelled', 'no_show')`",
    replace: "        WHERE a.date = ? AND (a.staff_id = ? OR 1) AND a.status NOT IN ('cancelled', 'no_show')`",
  },
  'kai-booking-picks-a-different-stylist-than-the-form': {
    // The form selects the first of the team when nobody is named. Kai has to
    // check that same diary, or it warns about a column nobody is looking at.
    file: 'src/kai-booking.js', suites: ['kai'],
    find: '  const who = staff[0] || team[0] || null;',
    replace: '  const who = staff[0] || team[team.length - 1] || null;',
  },
  'growth-plan-stops-checking-itself': {
    // The plan's whole claim: a step is done because the setting is on, not
    // because somebody ticked a box to feel productive.
    file: 'src/growth-plan.js', suites: ['growth'],
    find: '      isDone = auto ? !!s.done() : !!ticks[s.id];',
    replace: '      isDone = !!ticks[s.id];',
  },
  'growth-ideas-drop-their-reason': {
    // "Post a before-and-after" is advice. "Braids earned you $2,000, more
    // than anything else" is a reason, and an owner acts on the second.
    file: 'src/growth-content.js', suites: ['growth'],
    find: '  return [...out, ...evergreen].sort((a, b) => b.score - a.score);',
    replace: "  return [...out, ...evergreen].map((i) => ({ ...i, reason: '' })).sort((a, b) => b.score - a.score);",
  },
  'kai-growth-read-after-navigation': {
    // "How do I get more clients" answered by opening the Clients list, which
    // is the one response nobody asking that question wants.
    file: 'src/api.js', suites: ['growth'],
    find: '    const path = kaiGrowth(q);',
    replace: '    const path = kaiNav(q, { today: bizToday() }) ? null : kaiGrowth(q);',
  },
  'kai-voice-eats-a-date': {
    // A hyphen is not an en dash. With one in the range rule, a patch-test
    // record reads out as "2026 to 08 to 29".
    file: 'src/kai-voice.js', suites: ['growth'],
    find: "    .replace(/(\\d(?::\\d\\d)?\\s*(?:am|pm)?)\\s*[–—]\\s*(\\d)/gi, '$1 to $2')",
    replace: "    .replace(/(\\d(?::\\d\\d)?\\s*(?:am|pm)?)\\s*[–—-]\\s*(\\d)/gi, '$1 to $2')",
  },
  'demo-removal-ignores-the-flag': {
    // Scoped to the flag, never "delete everything and hope they had not
    // started". An owner who added real clients while looking around keeps them.
    file: 'src/db.js', suites: ['demo-data'],
    find: 'export function clearDemoData() {\n  db.exec(`',
    replace: 'export function clearDemoData() {\n  if (true) { clearBusinessData(); return; }\n  db.exec(`',
  },
  'demo-rows-go-unflagged': {
    // An unflagged seed row is invisible to the label AND to the delete.
    file: 'src/db.js', suites: ['demo-data'],
    find: "  for (const t of ['clients', 'appointments', 'services', 'staff', 'products']) {\n    db.prepare(`UPDATE ${t} SET is_demo = 1`).run();",
    replace: "  for (const t of ['appointments', 'services', 'staff', 'products']) {\n    db.prepare(`UPDATE ${t} SET is_demo = 1`).run();",
  },
  'demo-clients-become-messageable': {
    // A salon that switches an automation on before clearing the demo would
    // spend its first send on people who do not exist.
    file: 'src/automations.js', suites: ['demo-data'],
    find: "WHERE marketing_opt_out = 1 OR is_demo = 1",
    replace: "WHERE marketing_opt_out = 1",
  },
  'payment-charges-only-one-service': {
    // A haircut and a beard trim is ONE payment for the combined total. This
    // mutation charges for the haircut and lets the customer walk on the rest.
    file: 'src/api.js', suites: ['payments'],
    find: '      const items = svc.services.map((x) => ({ name: x.name, cents: x.price_cents }));',
    replace: '      const items = svc.services.slice(0, 1).map((x) => ({ name: x.name, cents: x.price_cents }));',
  },
  'payment-ignores-pay-in-person': {
    // Choosing to pay at the counter must not open a checkout.
    file: 'src/payments.js', suites: ['payments'],
    find: "  if (mode === 'choice') return payChoice === 'now';",
    replace: "  if (mode === 'choice') return true;",
  },
  'payment-offers-a-card-it-cannot-take': {
    // A booking page that offers a card the business has not connected.
    file: 'src/payments.js', suites: ['payments'],
    find: "  if (mode !== 'none' && !paymentsConfigured()) return 'none';",
    replace: "  if (false) return 'none';",
  },
  'payment-trusts-the-return-url': {
    // "?paid=success" is a claim by whoever typed it.
    file: 'src/api.js', suites: ['payments'],
    find: "    const check = await verifyPayPayment(ref, appt.pay_provider || '');\n    paid = check.paid;",
    replace: "    const check = await verifyPayPayment(ref, appt.pay_provider || '');\n    paid = true;",
  },
  'setup-ignores-keep-the-samples': {
    // The welcome screen asks. Overriding the answer is not an option, it is a
    // question with the reply thrown away.
    file: 'src/api.js', suites: ['demo-data'],
    find: '  if (!b.keep_samples) clearDemoData();',
    replace: '  clearDemoData();',
  },
  'setup-default-flips-to-keeping': {
    // Clearing is the safe default: a real business must never end up running
    // on somebody else's fake salon by saying nothing.
    file: 'src/api.js', suites: ['demo-data'],
    find: '  if (!b.keep_samples) clearDemoData();',
    replace: '  if (b.keep_samples === false) clearDemoData();',
  },
  'guarantee-is-invented-locally': {
    // A countdown drawn by a screen that knows nothing about any payment is a
    // promise about somebody's money.
    file: 'src/api.js', suites: ['connect'],
    find: "    return { available: false, reason: 'not_platform' };",
    replace: "    return { available: true, days_left: 14, refunded: false, window_days: 14 };",
  },
  'logout-everywhere-only-signs-out-here': {
    // The whole point is the OTHER device — the phone in the taxi. Without the
    // token_version bump it is an ordinary sign-out wearing a bigger label.
    file: 'src/api.js', suites: ['connect'],
    find: "  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(user.id);",
    replace: '  // (bump removed)',
  },
  'refund-reports-success-it-did-not-get': {
    // An owner told "refunded" who was not finds out from their bank statement.
    file: 'src/api.js', suites: ['connect'],
    find: "  if (!r.ok) throw httpError(r.status === 404 ? 404 : 502, out?.error || 'The refund could not be completed. Nothing has changed.');",
    replace: '  if (!r.ok) return { refunded: true };',
  },
  'page-hours-lose-the-per-day-override': {
    // The page would show the salon's default hours on a day it opens late,
    // which sends somebody to a locked door.
    file: 'src/api.js', suites: ['booking-page'],
    find: '      open_min: closed ? null : (rule?.open_min ?? baseOpen),',
    replace: '      open_min: closed ? null : baseOpen,',
  },
  'page-section-turns-itself-on-empty': {
    // An empty Location tab reads as a broken page.
    file: 'src/api.js', suites: ['booking-page'],
    find: "    location: on('page_show_location', hasAddress ? '1' : '0'),",
    replace: "    location: on('page_show_location', '1'),",
  },
  'contact-tab-opens-on-nothing': {
    // Every salon on the shared sender has a mail_domain, so this gives a
    // phone-less, email-less business a Contact tab pointing at an empty box.
    file: 'public/js/book.js', suites: ['booking-page'],
    find: '    contact: p.contact && (b.business_phone || b.business_email),',
    replace: '    contact: p.contact && (b.business_phone || b.business_email || b.mail_domain),',
  },
  'reviews-publish-themselves': {
    // An upgrade that lands overnight and puts a salon's rating on its booking
    // page by morning, without anybody choosing that.
    file: 'src/api.js', suites: ['booking-page'],
    find: "    reviews: on('page_show_reviews', '0'),",
    replace: "    reviews: on('page_show_reviews', '1'),",
  },
  'unpublished-rating-still-in-the-json': {
    // "Off" meaning only "not drawn": the rating the owner chose not to publish
    // sits in the page's own JSON for anyone who opens the network tab.
    file: 'src/api.js', suites: ['booking-page'],
    find: '    reviews: pageSections().reviews\n      ? publicReviewSummary()\n      : { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },',
    replace: '    reviews: publicReviewSummary(),',
  },
  'settings-boxes-read-the-stored-keys': {
    // The state this was in: every box drawn unticked over a page that was
    // showing five sections, and a save that then switched them all off.
    file: 'public/js/pages/settings.js', suites: ['booking-page'],
    find: "  const live = await livePageSections(s);",
    replace: "  const live = { about: s.page_show_about === '1', contact: s.page_show_contact === '1', location: s.page_show_location === '1', map: s.page_show_map === '1', hours: s.page_show_hours === '1', reviews: s.page_show_reviews === '1' };",
  },
  'stars-lose-their-fill-colour': {
    // The real bug, put back: a loose `span` rule under .bk-rev-score wins the
    // specificity fight against .bk-stars-on, and a 4.6 renders as five
    // identical grey stars while every number behind it stays correct.
    file: 'public/css/app.css', suites: ['booking-page'],
    find: '.bk-rev-n { display: block; font-size: 12.5px; color: var(--text-2); margin-top: 6px; }',
    replace: '.bk-rev-score span { display: block; font-size: 12.5px; color: var(--text-2); margin-top: 6px; }',
  },
  'rating-drops-the-bad-reviews': {
    // An average computed from the reviews a business liked is not an average.
    file: 'src/api.js', suites: ['booking-page'],
    find: "      'SELECT rating, COUNT(*) AS n FROM reviews GROUP BY rating'",
    replace: "      'SELECT rating, COUNT(*) AS n FROM reviews WHERE rating >= 4 GROUP BY rating'",
  },
  'kai-voice-edits-the-receipt': {
    // The personality is a prefix and nothing else: `warm` must always end
    // with `said`, character for character.
    file: 'src/kai-voice.js', suites: ['kai'],
    find: '  return opener ? `${opener} ${fact}` : fact;',
    replace: '  return opener ? `${opener} ${fact.toLowerCase()}` : fact;',
  },
};

const only = process.argv.slice(2);
const names = only.length ? only : Object.keys(MUTATIONS);
for (const n of names) if (!MUTATIONS[n]) { console.error(`unknown mutation: ${n}`); process.exit(2); }

const SKIP = new Set(['.git', 'data', 'node_modules', 'docs', 'scratchpad', 'audit']);
function copyRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-falsify-'));
  fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) || src === ROOT });
  return dir;
}

/**
 * Check every mutation still matches the code, BEFORE running any of them.
 *
 * A `find` string goes stale the moment somebody edits the line it quotes, and
 * until this existed that threw from inside the loop — killing the run at
 * whatever position the stale entry happened to sit in, so every mutation after
 * it silently never ran. The job went red, which looks like a caught bug and is
 * actually a coverage hole: on 16 September one stale entry at position 92 of
 * 121 meant a third of the gate had not run, and the red cross said nothing
 * about that.
 *
 * So: all of them are checked up front, ALL the stale ones are named at once
 * rather than one per run, and nothing is executed until they are fixed.
 */
const stale = [];
for (const name of names) {
  const m = MUTATIONS[name];
  const src = fs.readFileSync(path.join(ROOT, m.file), 'utf8');
  const count = src.split(m.find).length - 1;
  if (count !== 1) stale.push(`  ${name}: found ${count} matches in ${m.file}`);
}
if (stale.length) {
  console.error(`\n${stale.length} mutation${stale.length === 1 ? ' no longer matches' : 's no longer match'} the code.`);
  console.error('The code moved; update the mutation, or delete it if what it guarded is gone.\n');
  console.error(stale.join('\n'));
  console.error('\nNothing was run — a partial mutation run is not a gate.\n');
  process.exit(1);
}

let survived = 0;
const rows = [];
for (const name of names) {
  const m = MUTATIONS[name];
  const dir = copyRepo();
  try {
    const file = path.join(dir, m.file);
    const src = fs.readFileSync(file, 'utf8');
    const count = src.split(m.find).length - 1;
    if (count !== 1) throw new Error(`"${name}": expected exactly one occurrence in ${m.file}, found ${count} — the code moved; update the mutation`);
    fs.writeFileSync(file, src.replace(m.find, m.replace));
    const suites = m.suites.map((s) => path.join('test', `${s}.test.js`));
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', ...suites], {
      cwd: dir, encoding: 'utf8', timeout: 180_000, env: { ...process.env },
    });
    const failed = r.status !== 0;
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    rows.push([name, failed ? 'caught' : 'SURVIVED', `${secs}s`, m.suites.join(', ')]);
    if (!failed) {
      survived++;
      console.error(`\n--- mutation "${name}" survived: ${m.suites.join(', ')} still pass. Output:\n${r.stdout.slice(-2000)}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const w = Math.max(...rows.map((r) => r[0].length));
console.log('');
for (const [n, verdict, secs, suites] of rows) console.log(`  ${n.padEnd(w)}  ${verdict.padEnd(8)}  ${secs.padStart(6)}  ${suites}`);
console.log(`\n${rows.length - survived}/${rows.length} mutations caught.${survived ? ` ${survived} SURVIVED — a test that cannot fail is not a test.` : ''}\n`);
process.exit(survived ? 1 : 0);
