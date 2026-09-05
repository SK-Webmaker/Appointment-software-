// From "saw the post" to "taking bookings", as a state machine.
//
//   created ─► verified ─► payment_pending ─► paid ─► screening
//      │            │                                   ├─ flagged ──► (owner approves) ─┐
//      └ expired    └ expired                           └───────────── provisioning ◄────┘
//                                                                          │
//                                                                        ready
//
// Two rules hold the whole thing up:
//
//   1. Nothing is provisioned until Stripe's signed webhook says the money
//      moved. Not the browser's return, not the client's word.
//   2. Screening never REFUSES. It flags, and a flagged signup waits for one
//      tap from the owner. A refusal at 9pm on a stranger's judgement call is
//      how you turn a paying salon away for having a trading name.
import crypto from 'node:crypto';
import { db, record, setState, openTask, getSetting } from './db.js';
import { hashPassword } from '../src/auth.js';
import { checkPassword, checkBreached } from '../src/password.js';
import * as shard from './shard.js';
import * as stripe from './stripe.js';
import * as abr from './abr.js';
import * as notify from './notify.js';

export const BASE_DOMAIN = () => String(process.env.KAIRO_BASE_DOMAIN || 'kairobookings.com').trim().toLowerCase();
export const PRICE_CENTS = () => Number(process.env.KAIRO_PRICE_CENTS || 41000);
export const APP_URL = () => String(process.env.KAIRO_APP_URL || 'https://apps.apple.com/');
export const PLATFORM_ORIGIN = () => String(process.env.PLATFORM_ORIGIN || 'https://kairobookings.com').replace(/\/+$/, '');
/** No reason needed inside this many days. After it, the consumer law decides. */
export const REFUND_DAYS = Number(process.env.KAIRO_REFUND_DAYS || 14);
const CODE_TTL_MIN = 10;
const CODE_MAX_ATTEMPTS = 5;
/** How long an unpaid signup holds its address before somebody else may have it. */
const HOLD_DAYS = 7;

// Addresses that are ours, ambiguous, or would be mistaken for Kairo itself.
const RESERVED = new Set([
  'www', 'api', 'app', 'apps', 'admin', 'administrator', 'mail', 'email', 'smtp', 'imap', 'pop',
  'book', 'booking', 'bookings', 'demo', 'test', 'testing', 'staging', 'dev', 'kairo', 'kairobookings',
  'support', 'help', 'status', 'platform', 'shard', 'operator', 'account', 'accounts', 'billing',
  'pay', 'payments', 'stripe', 'blog', 'shop', 'store', 'my', 'me', 'new', 'signup', 'start', 'ns', 'mx',
]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const err = (status, message, data) => Object.assign(new Error(message), { status, data });

/** "ABC Hair Studio" → "abchairstudio". Their address, so it has to read like one. */
export function slugify(name) {
  const base = String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '').slice(0, 30);
  return SLUG_RE.test(base) ? base : '';
}

export async function slugAvailable(slug) {
  if (!SLUG_RE.test(slug)) return { ok: false, reason: 'Use lowercase letters, numbers and hyphens.' };
  if (slug.length < 3) return { ok: false, reason: 'A little longer, please — at least 3 characters.' };
  if (RESERVED.has(slug)) return { ok: false, reason: 'That address is reserved. Try another.' };
  if (db.prepare("SELECT id FROM businesses WHERE slug = ? AND state != 'expired'").get(slug)) return { ok: false, reason: 'That address is taken.' };
  try {
    if (await shard.getTenant(slug)) return { ok: false, reason: 'That address is taken.' };
  } catch { /* the shard being unreachable is not the visitor's problem; the unique index still protects us */ }
  return { ok: true };
}

function newCode(ownerId, kind) {
  // Six digits, uniform: crypto.randomInt, not Math.random shifted into range.
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  db.prepare("UPDATE codes SET used = 1 WHERE owner_id = ? AND kind = ? AND used = 0").run(ownerId, kind);
  db.prepare("INSERT INTO codes (owner_id, kind, code, expires_at) VALUES (?, ?, ?, datetime('now', ?))")
    .run(ownerId, kind, code, `+${CODE_TTL_MIN} minutes`);
  return code;
}

/** Step 1. Creates the account and the business, sends both codes. Charges nothing. */
export async function startSignup(input, { ip = '' } = {}) {
  const name = clean(input.name, 100);
  const businessName = clean(input.business_name, 80);
  const email = clean(input.email, 200).toLowerCase();
  const phone = clean(input.phone, 30);
  const abnDigits = clean(input.abn, 20).replace(/\s/g, '');
  const slug = clean(input.slug, 40).toLowerCase() || slugify(businessName);
  const password = String(input.password ?? '');

  if (!name) throw err(400, 'Your name is required');
  if (businessName.length < 2) throw err(400, 'Your business name is required');
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw err(400, 'That email address does not look right');
  if (!/^[0-9+()\s-]{8,20}$/.test(phone)) throw err(400, 'That mobile number does not look right');
  if (abnDigits && !abr.abnLooksValid(abnDigits)) throw err(400, 'That ABN is not valid. Leave it blank if you would rather.');

  const available = await slugAvailable(slug);
  if (!available.ok) throw err(409, available.reason);

  // The same password rules the salon's own Settings enforce — checked here so
  // nobody discovers on day two that they cannot change it to what they use.
  const problem = checkPassword(password, [email, name, businessName]);
  if (problem) throw err(400, problem);
  const breached = await checkBreached(password);
  if (breached) throw err(400, breached);

  const existing = db.prepare('SELECT * FROM owners WHERE email = ?').get(email);
  if (existing) {
    const live = db.prepare("SELECT slug FROM businesses WHERE owner_id = ? AND state NOT IN ('refunded','deleted','expired')").get(existing.id);
    if (live) throw err(409, 'There is already a Kairo for that email address. Sign in instead, or use another address.');
  }
  const ownerId = existing ? existing.id : Number(db.prepare('INSERT INTO owners (name, email, phone) VALUES (?, ?, ?)').run(name, email, phone).lastInsertRowid);
  if (existing) db.prepare('UPDATE owners SET name = ?, phone = ?, email_verified = 0, phone_verified = 0 WHERE id = ?').run(name, phone, ownerId);

  const { salt, hash } = hashPassword(password);
  const token = crypto.randomBytes(24).toString('base64url');
  const info = db.prepare(
    `INSERT INTO businesses (owner_id, slug, name, abn, tz, phone, price_cents, pass_hash, salt, signup_ip, token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(ownerId, slug, businessName, abnDigits, clean(input.tz, 60) || 'Australia/Melbourne', phone, PRICE_CENTS(), hash, salt, clean(ip, 60), token);
  const businessId = Number(info.lastInsertRowid);
  record(businessId, 'signup:start', `${businessName} <${email}> → ${slug}`);

  await sendCodes(ownerId, email, phone, businessId);
  return { token, slug, business_id: businessId };
}

async function sendCodes(ownerId, email, phone, businessId) {
  const e = await notify.emailCode(email, newCode(ownerId, 'email'));
  record(businessId, 'code:email', e.ok ? 'sent' : e.detail);
  const s = await notify.smsCode(phone, newCode(ownerId, 'phone'));
  record(businessId, 'code:phone', s.ok ? 'sent' : s.detail);
  return { email: e, sms: s };
}

export async function resendCode(token, kind) {
  const b = byToken(token);
  const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(b.owner_id);
  const code = newCode(owner.id, kind);
  const r = kind === 'phone' ? await notify.smsCode(owner.phone, code) : await notify.emailCode(owner.email, code);
  record(b.id, `code:${kind}:resend`, r.ok ? 'sent' : r.detail);
  return { sent: true };
}

/** Step 2. One code, five attempts, ten minutes, single use. */
export function verifyCode(token, kind, code) {
  const b = byToken(token);
  if (kind !== 'email' && kind !== 'phone') throw err(400, 'Unknown code type');
  const row = db.prepare("SELECT * FROM codes WHERE owner_id = ? AND kind = ? AND used = 0 ORDER BY id DESC LIMIT 1").get(b.owner_id, kind);
  if (!row) throw err(400, 'Ask for a new code.');
  if (row.attempts >= CODE_MAX_ATTEMPTS) throw err(429, 'Too many tries. Ask for a new code.');
  db.prepare('UPDATE codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
  if (new Date(`${row.expires_at.replace(' ', 'T')}Z`).getTime() < Date.now()) throw err(400, 'That code has expired. Ask for a new one.');
  const a = Buffer.from(String(code || '').trim());
  const bb = Buffer.from(row.code);
  if (a.length !== bb.length || !crypto.timingSafeEqual(a, bb)) throw err(400, 'That code is not right.');

  db.prepare('UPDATE codes SET used = 1 WHERE id = ?').run(row.id);
  db.prepare(`UPDATE owners SET ${kind === 'email' ? 'email_verified' : 'phone_verified'} = 1 WHERE id = ?`).run(b.owner_id);
  record(b.id, `verified:${kind}`);
  const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(b.owner_id);
  const both = owner.email_verified === 1 && owner.phone_verified === 1;
  if (both && b.state === 'created') setState(b.id, 'verified');
  return { email_verified: owner.email_verified === 1, phone_verified: owner.phone_verified === 1, ready_to_pay: both };
}

/** Step 3. The Checkout session. Verification first: no code, no payment page. */
export async function beginCheckout(token, origin) {
  const b = byToken(token);
  const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(b.owner_id);
  if (!(owner.email_verified && owner.phone_verified)) throw err(400, 'Verify your email and mobile first');
  if (['paid', 'provisioning', 'ready'].includes(b.state)) throw err(409, 'That business is already paid for');
  if (!stripe.stripeConfigured()) throw err(503, 'Payments are not available right now — please try again shortly');
  const session = await stripe.createCheckout({
    businessId: b.id, slug: b.slug, name: b.name, email: owner.email, priceCents: b.price_cents, origin,
  });
  db.prepare('UPDATE businesses SET stripe_session_id = ? WHERE id = ?').run(session.id, b.id);
  setState(b.id, 'payment_pending', session.id);
  return { checkout_url: session.url };
}

/**
 * Stripe says the money moved. Idempotent on the session id: a webhook Stripe
 * retries, or one replayed by hand, provisions exactly one salon.
 */
export async function onPaid({ sessionId, paymentIntent, amountTotal }) {
  const b = db.prepare('SELECT * FROM businesses WHERE stripe_session_id = ?').get(sessionId);
  if (!b) { record(null, 'webhook:unknown-session', sessionId); return { ignored: true }; }
  if (['paid', 'screening', 'flagged', 'provisioning', 'ready'].includes(b.state)) {
    record(b.id, 'webhook:duplicate', b.state);
    return { already: true, state: b.state };
  }
  db.prepare("UPDATE businesses SET stripe_payment_intent = ?, paid_at = datetime('now') WHERE id = ?").run(String(paymentIntent || ''), b.id);
  setState(b.id, 'paid', `${amountTotal || b.price_cents} cents`);
  return advance(b.id);
}

/** Screen, then provision — or flag and wait for one tap. */
export async function advance(businessId) {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!b) throw err(404, 'No such business');
  if (b.state === 'ready') return { state: 'ready' };
  if (b.state === 'paid') {
    setState(b.id, 'screening');
    const flags = await screen(b);
    if (flags.length) {
      db.prepare('UPDATE businesses SET flags = ? WHERE id = ?').run(JSON.stringify(flags), b.id);
      setState(b.id, 'flagged', flags.join(' · '));
      openTask(b.id, 'flagged', flags.join(' · '));
      return { state: 'flagged', flags };
    }
  }
  return provision(b.id);
}

/**
 * Every check produces a flag or nothing. None of them refuses a signup, and
 * a check that could not be made (the ABR down, no GUID configured) is never
 * a flag — an outage somewhere else must not read as suspicion here.
 */
export async function screen(b) {
  const flags = [];
  if (b.abn) {
    const res = await abr.lookup(b.abn);
    if (res.status === 'notfound') flags.push('The ABN could not be found');
    else if (res.status === 'inactive') flags.push(`The ABN is ${res.detail || 'not active'}`);
    else if (res.status === 'active') {
      db.prepare('UPDATE businesses SET abn_name = ? WHERE id = ?').run(res.name, b.id);
      if (res.name && !abr.namesOverlap(res.name, b.name)) {
        flags.push(`The ABN is registered to "${res.name}", which does not match "${b.name}"`);
      }
    }
    const dupe = db.prepare("SELECT slug FROM businesses WHERE abn = ? AND id != ? AND state NOT IN ('refunded','deleted','expired')").get(b.abn, b.id);
    if (dupe) flags.push(`That ABN already has a Kairo (${dupe.slug})`);
  }
  if (b.signup_ip) {
    const recent = db.prepare("SELECT COUNT(*) AS n FROM businesses WHERE signup_ip = ? AND id != ? AND created_at > datetime('now', '-1 day')").get(b.signup_ip, b.id).n;
    if (recent >= 2) flags.push(`${recent + 1} signups from one address today`);
  }
  const sameName = db.prepare("SELECT slug FROM businesses WHERE lower(name) = lower(?) AND id != ? AND state NOT IN ('refunded','deleted','expired')").get(b.name, b.id);
  if (sameName) flags.push(`Another Kairo already uses that business name (${sameName.slug})`);
  return flags;
}

/** The whole of provisioning: one call to the shard. Seconds, not minutes. */
export async function provision(businessId) {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!b) throw err(404, 'No such business');
  if (b.state === 'ready') return { state: 'ready', url: publicUrlFor(b.slug) };
  const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(b.owner_id);
  setState(b.id, 'provisioning');
  const url = publicUrlFor(b.slug);
  // The handle their Kairo uses to send them back here for the things only the
  // platform can do. Minted once and kept, so a retry does not invalidate a
  // link already sitting in their workspace.
  let connectToken = b.connect_token;
  if (!connectToken) {
    connectToken = crypto.randomBytes(24).toString('base64url');
    db.prepare('UPDATE businesses SET connect_token = ? WHERE id = ?').run(connectToken, b.id);
  }
  const host = `${b.slug}.${BASE_DOMAIN()}`;
  try {
    if (!b.pass_hash) throw new Error('the owner credential was already cleared — cannot re-provision');
    await shard.createTenant({
      slug: b.slug,
      name: b.name,
      public_url: url,
      price_cents: b.price_cents,
      plan_name: 'Kairo',
      platform_url: PLATFORM_ORIGIN(),
      connect_token: connectToken,
      owner: { name: owner.name, email: owner.email, pass_hash: b.pass_hash, salt: b.salt },
      settings: {
        business_name: b.name,
        business_email: owner.email,
        business_phone: b.phone,
        business_tz: b.tz,
        currency: '$',
        currency_code: 'aud',
        tax_rate: '10',
        public_url: url,
      },
    });
  } catch (e) {
    // "Already exists" means a previous attempt got that far — the address was
    // reserved by this same signup, so carrying on is right and retrying is
    // safe. Anything else is a real failure.
    if (e.status !== 409) {
      // A shard that is briefly unreachable must not cost somebody their money
      // or their address. The state stays where a retry can pick it up, and the
      // owner is told rather than the buyer being shown a stack trace.
      db.prepare('UPDATE businesses SET last_error = ? WHERE id = ?').run(String(e.message).slice(0, 500), b.id);
      setState(b.id, 'paid', `provisioning failed: ${e.message}`);
      openTask(b.id, 'provision_failed', String(e.message).slice(0, 500));
      throw err(502, 'We could not finish setting up your Kairo. Nothing is lost and we have been alerted — you will have an email shortly.');
    }
    record(b.id, 'provision:already-there', 'a previous attempt had already created it');
  }

  // Created is not the same as serving. Check the address actually answers
  // before anybody is told it is ready — a welcome email pointing at a page
  // that 404s is worse than a minute's wait.
  let serving = false;
  for (let i = 0; i < 10 && !serving; i++) {
    // eslint-disable-next-line no-await-in-loop
    const probe = await shard.servesBookingPage(b.slug, host);
    serving = probe.ok;
    // eslint-disable-next-line no-await-in-loop
    if (!serving) await new Promise((r) => setTimeout(r, 500));
  }
  if (!serving) {
    db.prepare('UPDATE businesses SET last_error = ? WHERE id = ?').run(`created but ${host} is not serving yet`, b.id);
    setState(b.id, 'paid', `created but ${host} is not serving`);
    openTask(b.id, 'provision_failed', `${b.name} was created on the shard but ${host} is not answering. Retry from here once the shard is healthy.`);
    throw err(502, 'We could not finish setting up your Kairo. Nothing is lost and we have been alerted — you will have an email shortly.');
  }

  // Provisioned: the hash now lives in the salon's own file, so the copy here
  // has no reason to exist.
  db.prepare("UPDATE businesses SET pass_hash = '', salt = '', last_error = '', ready_at = datetime('now') WHERE id = ?").run(b.id);
  setState(b.id, 'ready', url);
  db.prepare("UPDATE tasks SET state = 'done', done_at = datetime('now'), done_note = 'provisioned' WHERE business_id = ? AND kind IN ('flagged','provision_failed') AND state = 'open'").run(b.id);
  // Email setup is the one thing left, and the owner's queue carries it unless
  // the business chooses to do it themselves in Settings.
  openTask(b.id, 'email_setup', `${b.name} — connect Resend for ${b.slug}.${BASE_DOMAIN()}`);
  const sent = await notify.emailReady(owner.email, { businessName: b.name, url, appUrl: APP_URL() });
  record(b.id, 'email:ready', sent.ok ? 'sent' : sent.detail);
  return { state: 'ready', url };
}

/** Fourteen days, no reason needed: export first, refund, then stop serving. */
export async function refundBusiness(businessId, { reason = '', by = 'owner' } = {}) {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!b) throw err(404, 'No such business');
  if (b.refunded_at) return { already: true };
  let exported = 0;
  if (['ready', 'provisioning'].includes(b.state)) {
    try { exported = (await shard.exportTenant(b.slug)).length; record(b.id, 'refund:export', `${exported} bytes`); }
    catch (e) { record(b.id, 'refund:export-failed', e.message); }
  }
  if (b.stripe_payment_intent && stripe.stripeConfigured()) {
    try { const r = await stripe.refund(b.stripe_payment_intent); record(b.id, 'refund:stripe', r.id || 'ok'); }
    catch (e) { record(b.id, 'refund:stripe-failed', e.message); throw err(502, `Refund failed: ${e.message}`); }
  }
  try { await shard.deleteTenant(b.slug); } catch (e) { record(b.id, 'refund:shard-delete-failed', e.message); }
  db.prepare("UPDATE businesses SET refunded_at = datetime('now') WHERE id = ?").run(b.id);
  setState(b.id, 'refunded', `${by}: ${reason}`.slice(0, 300));
  db.prepare("UPDATE tasks SET state = 'done', done_at = datetime('now'), done_note = 'refunded' WHERE business_id = ? AND state = 'open'").run(b.id);
  return { refunded: true, exported_bytes: exported };
}

/** A deleted salon's files are kept this long, so a mistake at 11pm is fixable at 9am. */
export const DELETE_GRACE_DAYS = Number(process.env.KAIRO_DELETE_GRACE_DAYS || 7);

/**
 * The business deleting itself from inside the app.
 *
 * The salon has already shut itself before this is called, so nothing here is
 * allowed to fail loudly: this records the decision, refunds if they are still
 * inside the fourteen days, and opens the task that actually removes the files
 * once the grace period is up. Deleting them here and now would make an
 * accidental tap unrecoverable, which is a worse outcome than holding data for
 * a week and saying so.
 */
export async function selfDelete(connectToken, reason = '') {
  const b = byConnectToken(connectToken);
  if (b.deleted_at) return { already: true, files_removed_after: b.purge_after };
  const purgeAfter = new Date(Date.now() + DELETE_GRACE_DAYS * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('UPDATE businesses SET deleted_at = datetime(\'now\'), purge_after = ? WHERE id = ?').run(purgeAfter, b.id);
  record(b.id, 'account:deleted', reason.slice(0, 300));

  let refunded = false;
  if (!b.refunded_at && refundDaysLeft(b) > 0) {
    try { await refundBusiness(b.id, { reason: `deleted in the app: ${reason}`, by: 'business' }); refunded = true; }
    catch (e) { record(b.id, 'account:delete-refund-failed', e.message); }
  }
  if (!refunded) {
    // Not refunded means the shard still holds their book, so stop it serving
    // now and let the purge task remove it after the grace period.
    try { await shard.patchTenant(b.slug, { read_only: true, muted: true }); }
    catch (e) { record(b.id, 'account:delete-patch-failed', e.message); }
  }
  setState(b.id, 'deleted', reason.slice(0, 300));
  openTask(b.id, 'purge', `${b.name} asked to be deleted. Remove the files on or after ${purgeAfter}.`);
  return { deleted: true, refunded, files_removed_after: purgeAfter, grace_days: DELETE_GRACE_DAYS };
}

/** An address is held for a week; after that somebody else may have it. */
export function expireStale() {
  const rows = db.prepare(
    `SELECT id, slug FROM businesses
      WHERE state IN ('created','verified','payment_pending')
        AND created_at < datetime('now', ?)`
  ).all(`-${HOLD_DAYS} days`);
  for (const r of rows) {
    // Nobody paid, so nothing was ever provisioned and there is no data to
    // keep. Expiring releases the address: the unique index covers only the
    // signups that still hold one.
    setState(r.id, 'expired', 'unpaid hold ran out');
    db.prepare("UPDATE businesses SET pass_hash = '', salt = '' WHERE id = ?").run(r.id);
  }
  return rows.length;
}

export const publicUrlFor = (slug) => `https://${slug}.${BASE_DOMAIN()}`;

/** The business behind a connect link. Same shape of check as byToken. */
export function byConnectToken(token) {
  const b = db.prepare("SELECT * FROM businesses WHERE connect_token = ? AND connect_token != ''").get(clean(token, 64));
  if (!b) throw err(404, 'That link is no longer valid');
  return b;
}

/** How long is left on the no-reason refund, in whole days. Negative once gone. */
export function refundDaysLeft(b) {
  const paid = Date.parse(`${String(b.paid_at || '').replace(' ', 'T')}Z`) || 0;
  if (!paid) return REFUND_DAYS;
  return Math.ceil((paid + REFUND_DAYS * 86400000 - Date.now()) / 86400000);
}

/**
 * The business asking for its own refund, from its own Kairo.
 *
 * Inside the window it is automatic, because a policy that says "no reason
 * needed" and then asks for one is the kind the ACCC objects to. Outside it,
 * this opens a task rather than refusing outright — the consumer law may still
 * require a refund and that is a judgement, not a rule.
 */
export async function selfRefund(connectToken, reason = '') {
  const b = byConnectToken(connectToken);
  if (b.refunded_at) return { already: true };
  const left = refundDaysLeft(b);
  if (left <= 0) {
    openTask(b.id, 'refund_request', `Asked ${left * -1} day(s) after the ${REFUND_DAYS}-day window. Reason: ${reason || '(none given)'}`);
    record(b.id, 'refund:requested-late', reason);
    return { queued: true, days_left: left };
  }
  return { ...await refundBusiness(b.id, { reason, by: 'business' }), days_left: left };
}

export function byToken(token) {
  const b = db.prepare('SELECT * FROM businesses WHERE token = ? AND token != ?').get(clean(token, 64), '');
  if (!b) throw err(404, 'That signup link is no longer valid');
  return b;
}

/** What the signup page polls. Deliberately says nothing a stranger could use. */
export function statusFor(token) {
  const b = byToken(token);
  const owner = db.prepare('SELECT email, phone, email_verified, phone_verified FROM owners WHERE id = ?').get(b.owner_id);
  return {
    state: b.state,
    slug: b.slug,
    business_name: b.name,
    price_cents: b.price_cents,
    email: owner.email,
    phone_hint: String(owner.phone).replace(/.(?=.{3})/g, '•'),
    email_verified: owner.email_verified === 1,
    phone_verified: owner.phone_verified === 1,
    url: ['ready'].includes(b.state) ? publicUrlFor(b.slug) : '',
    app_url: APP_URL(),
    message: {
      created: 'Enter the codes we just sent you.',
      verified: 'Verified. One payment and your Kairo is yours.',
      payment_pending: 'Waiting for your payment to go through.',
      paid: 'Payment received — setting your Kairo up now.',
      screening: 'Payment received — setting your Kairo up now.',
      provisioning: 'Setting your Kairo up now.',
      flagged: "We're just checking a couple of details. You'll have an email within a few hours — nothing more to do.",
      ready: 'Your Kairo is ready.',
      refunded: 'This signup was refunded.',
      expired: 'This signup expired. Start again whenever you like.',
    }[b.state] || '',
  };
}
