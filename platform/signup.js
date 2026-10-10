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
import { appStoreUrl } from '../src/app-store.js';
import * as shard from './shard.js';
import * as stripe from './stripe.js';
import * as abr from './abr.js';
import * as notify from './notify.js';

export const BASE_DOMAIN = () => String(process.env.KAIRO_BASE_DOMAIN || 'kairobookings.com').trim().toLowerCase();
export const PRICE_CENTS = () => Number(process.env.KAIRO_PRICE_CENTS || 41000);
// The listing itself once Apple has one (src/app-store.js finds it), the
// store's front page until then. KAIRO_APP_URL still wins if set.
export const APP_URL = () => String(process.env.KAIRO_APP_URL || appStoreUrl() || 'https://apps.apple.com/');
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
  // The front door. login.kairobookings.com is where every owner signs in
  // without knowing their own address; a salon registered under one of these
  // would be served instead of it, and every owner who typed their password
  // there would be typing it into a stranger's booking page.
  'login', 'signin', 'sign-in', 'logon', 'log-in', 'auth', 'sso', 'id', 'identity', 'password',
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

/** Step 1. Creates the account and the business, emails the code. Charges nothing. */
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
    const live = db.prepare("SELECT slug FROM businesses WHERE owner_id = ? AND state NOT IN ('refunded','deleted','expired','removed')").get(existing.id);
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

  await sendCodes(ownerId, email, businessId);
  return { token, slug, business_id: businessId };
}

// One code, by email. The mobile is still asked for — it is how support rings
// back, and it goes on the salon — but it is not checked with a text: every
// signup costing an SMS meant one empty ClickSend balance stopped all of them,
// and the email is the address that matters, since it is where the sign-in,
// the password reset and the refund all go.
async function sendCodes(ownerId, email, businessId) {
  const e = await notify.emailCode(email, newCode(ownerId, 'email'));
  record(businessId, 'code:email', e.ok ? 'sent' : e.detail);
  return { email: e };
}

const codeKind = (kind) => {
  // 'email' is the only code there is. Anything else is an old signup page
  // still open in somebody's tab, and is told plainly rather than half-served.
  if (kind !== 'email') throw err(400, 'Only the email code is needed now. Reload the page.');
  return kind;
};

export async function resendCode(token, kind = 'email') {
  codeKind(kind);
  const b = byToken(token);
  const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(b.owner_id);
  const r = await notify.emailCode(owner.email, newCode(owner.id, kind));
  record(b.id, `code:${kind}:resend`, r.ok ? 'sent' : r.detail);
  // Saying "sent" when nothing was sent leaves someone watching a code box
  // for a message that does not exist, and the only trace is an audit row
  // nobody reads at nine at night. Tell them instead — and open a task, so
  // the operator finds out that the platform cannot send at all.
  if (!r.ok) {
    openTask(b.id, `code:${kind}:undeliverable`, `A ${kind} code could not be sent: ${r.detail}`);
    throw err(502, 'We could not send the email just now. Try again in a moment, or contact support and we will verify you by hand.');
  }
  return { sent: true };
}

/** Step 2. One code, five attempts, ten minutes, single use. */
export function verifyCode(token, kind, code) {
  codeKind(kind);
  const b = byToken(token);
  const row = db.prepare("SELECT * FROM codes WHERE owner_id = ? AND kind = ? AND used = 0 ORDER BY id DESC LIMIT 1").get(b.owner_id, kind);
  if (!row) throw err(400, 'Ask for a new code.');
  if (row.attempts >= CODE_MAX_ATTEMPTS) throw err(429, 'Too many tries. Ask for a new code.');
  db.prepare('UPDATE codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
  if (new Date(`${row.expires_at.replace(' ', 'T')}Z`).getTime() < Date.now()) throw err(400, 'That code has expired. Ask for a new one.');
  const a = Buffer.from(String(code || '').trim());
  const bb = Buffer.from(row.code);
  if (a.length !== bb.length || !crypto.timingSafeEqual(a, bb)) throw err(400, 'That code is not right.');

  db.prepare('UPDATE codes SET used = 1 WHERE id = ?').run(row.id);
  db.prepare('UPDATE owners SET email_verified = 1 WHERE id = ?').run(b.owner_id);
  record(b.id, `verified:${kind}`);
  if (b.state === 'created') setState(b.id, 'verified');
  return { email_verified: true, ready_to_pay: true };
}

/** Step 3. The Checkout session. Verification first: no code, no payment page. */
export async function beginCheckout(token, origin) {
  const b = byToken(token);
  const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(b.owner_id);
  if (!owner.email_verified) throw err(400, 'Confirm your email first');
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
    const dupe = db.prepare("SELECT slug FROM businesses WHERE abn = ? AND id != ? AND state NOT IN ('refunded','deleted','expired','removed')").get(b.abn, b.id);
    if (dupe) flags.push(`That ABN already has a Kairo (${dupe.slug})`);
  }
  if (b.signup_ip) {
    const recent = db.prepare("SELECT COUNT(*) AS n FROM businesses WHERE signup_ip = ? AND id != ? AND created_at > datetime('now', '-1 day')").get(b.signup_ip, b.id).n;
    if (recent >= 2) flags.push(`${recent + 1} signups from one address today`);
  }
  const sameName = db.prepare("SELECT slug FROM businesses WHERE lower(name) = lower(?) AND id != ? AND state NOT IN ('refunded','deleted','expired','removed')").get(b.name, b.id);
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
  // What the shard says about the salon it just built, including how it will
  // send. Null on the retry path, where the tenant already existed.
  let created = null;
  try {
    if (!b.pass_hash) throw new Error('the owner credential was already cleared — cannot re-provision');
    created = await shard.createTenant({
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
        // NOT 10. GST registration is only compulsory above $75k turnover, and
        // a good share of the salons Kairo is sold to are sole traders under
        // it. Provisioning them at 10% put GST on invoices they are not
        // registered to collect — their problem with the ATO, caused by a
        // default they never chose and would likely never question, because
        // the setup wizard shows the number already filled in.
        // Kairo's own default is 0 (src/db.js) and the wizard asks. Let it.
        tax_rate: '0',
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
  // Only ask for help when the salon genuinely cannot send.
  //
  // This used to open for EVERY new salon, because every new salon arrived
  // unable to send anything until somebody pasted a Resend key. A shard with
  // its own sending account makes that untrue, and a task that opens for
  // everyone regardless is noise the operator learns to scroll past — which is
  // how the one that matters gets missed. The shard is asked rather than
  // assumed, since whether sending works is its configuration, not this one's.
  // How this salon ends up sending — from the shard's own answer when it built
  // it, so there is no second call to fail and no guess to get wrong. On the
  // retry path the tenant already existed and there is no fresh answer, so it
  // falls back to 'none' and the task opens: one unnecessary glance costs
  // nothing, a salon that cannot send and nobody knows costs a customer.
  const sending = String(created?.email_sending || 'none').trim() || 'none';
  if (sending === 'none') {
    openTask(b.id, 'email_setup', `${b.name} — connect Resend for ${b.slug}.${BASE_DOMAIN()}`);
  } else {
    record(b.id, 'email:sending', sending === 'own' ? 'its own Resend account' : 'the platform account');
  }
  const sent = await notify.emailReady(owner.email, { businessName: b.name, url, appUrl: APP_URL(), sending });
  record(b.id, 'email:ready', sent.ok ? 'sent' : sent.detail);
  return { state: 'ready', url };
}

/**
 * Fourteen days, no reason needed. In this order: email the owner their data,
 * refund, switch the salon off, and set the date its files are deleted.
 *
 * The copy goes first because nothing after it can be taken back. If it could
 * not be sent the refund still happens — it is theirs, and holding money
 * hostage to an email server is not a policy — but the files are kept and a
 * person is asked to send the copy by hand. Nothing is deleted that the owner
 * has not been sent.
 */
export async function refundBusiness(businessId, { reason = '', by = 'owner' } = {}) {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!b) throw err(404, 'No such business');
  if (b.refunded_at) return { already: true };
  const owner = db.prepare('SELECT email FROM owners WHERE id = ?').get(b.owner_id) || {};
  const hadSalon = ['ready', 'provisioning'].includes(b.state);
  let copy = { ok: false, detail: 'there was no salon to copy' };
  if (hadSalon) {
    try { copy = await shard.emailPartingCopy(b.slug, owner.email); } catch (e) { copy = { ok: false, detail: e.message }; }
    record(b.id, copy.ok ? 'refund:copy-emailed' : 'refund:copy-failed', copy.detail);
  }
  if (b.stripe_payment_intent && stripe.stripeConfigured()) {
    try { const r = await stripe.refund(b.stripe_payment_intent); record(b.id, 'refund:stripe', r.id || 'ok'); }
    catch (e) { record(b.id, 'refund:stripe-failed', e.message); throw err(502, `Refund failed: ${e.message}`); }
  }
  let off = false;
  try { await shard.deleteTenant(b.slug); off = true; } catch (e) {
    // 404: nothing was ever built, so there is nothing to switch off.
    if (e.status !== 404) record(b.id, 'refund:shard-delete-failed', e.message);
  }
  db.prepare("UPDATE businesses SET refunded_at = datetime('now') WHERE id = ?").run(b.id);
  setState(b.id, 'refunded', `${by}: ${reason}`.slice(0, 300));
  db.prepare("UPDATE tasks SET state = 'done', done_at = datetime('now'), done_note = 'refunded' WHERE business_id = ? AND state = 'open'").run(b.id);

  let filesDeletedAfter = '';
  if (hadSalon && off && copy.ok) {
    filesDeletedAfter = sqlTime(Date.now() + DELETE_GRACE_DAYS * 86400000);
    db.prepare('UPDATE businesses SET files_purge_at = ? WHERE id = ?').run(filesDeletedAfter, b.id);
    record(b.id, 'refund:files-delete-scheduled', filesDeletedAfter);
  } else if (hadSalon && !off) {
    openTask(b.id, 'switch_off', `${b.name} was refunded but the server did not switch ${b.slug} off. Switch it off by hand; the files are kept.`);
  } else if (hadSalon) {
    openTask(b.id, 'parting_copy', `${b.name} was refunded, but their data could not be emailed (${copy.detail}). Press "Send their data again" once email is working; it goes to ${owner.email}. The files are kept until it has gone.`);
  }
  return { refunded: true, copy_emailed: Boolean(copy.ok), files_deleted_after: filesDeletedAfter };
}

const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/**
 * The operator's "Send their data": the copy a refund could not email. Once it
 * has gone, the deletion that was held back is scheduled like any other.
 */
export async function sendPartingCopy(businessId) {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!b) throw err(404, 'No such business');
  const owner = db.prepare('SELECT email FROM owners WHERE id = ?').get(b.owner_id) || {};
  let copy;
  try { copy = await shard.emailPartingCopy(b.slug, owner.email); } catch (e) { copy = { ok: false, detail: e.message }; }
  record(b.id, copy.ok ? 'copy:emailed' : 'copy:failed', copy.detail);
  if (!copy.ok) throw err(502, `Could not send it: ${copy.detail}`);
  db.prepare("UPDATE tasks SET state = 'done', done_at = datetime('now'), done_note = 'copy emailed' WHERE business_id = ? AND kind = 'parting_copy' AND state = 'open'").run(b.id);
  let filesDeletedAfter = '';
  if (b.refunded_at && !b.files_purge_at && !b.files_purged_at) {
    filesDeletedAfter = sqlTime(Date.now() + DELETE_GRACE_DAYS * 86400000);
    db.prepare('UPDATE businesses SET files_purge_at = ? WHERE id = ?').run(filesDeletedAfter, b.id);
    record(b.id, 'refund:files-delete-scheduled', filesDeletedAfter);
  }
  return { sent: true, to: owner.email, files_deleted_after: filesDeletedAfter };
}

let purging = false;

/**
 * Delete the files of refunded salons whose week is up. Hourly.
 *
 * Only rows a refund scheduled (files_purge_at). The shard makes the final
 * check from the salon's own file and refuses anything still switched on, so
 * this cannot reach a trading salon even if a row here were wrong.
 */
export async function purgeDue() {
  if (purging) return 0;
  purging = true;
  try {
    const due = db.prepare(
      `SELECT id, slug, name FROM businesses
        WHERE refunded_at != '' AND files_purge_at != '' AND files_purged_at = '' AND files_purge_at <= datetime('now')`
    ).all();
    for (const b of due) {
      try {
        const r = await shard.purgeTenant(b.slug);
        db.prepare("UPDATE businesses SET files_purged_at = datetime('now') WHERE id = ?").run(b.id);
        record(b.id, 'purge:done', r?.gone ? 'already gone' : 'files deleted');
        // A salon deleted in the app and refunded also has the hand-made task.
        db.prepare("UPDATE tasks SET state = 'done', done_at = datetime('now'), done_note = 'files deleted automatically' WHERE business_id = ? AND kind IN ('purge','purge_failed') AND state = 'open'").run(b.id);
      } catch (e) {
        record(b.id, 'purge:failed', e.message);
        // Too soon by the shard's clock: the next hour tries again. Anything
        // else is not going to fix itself, so stop trying and tell a person.
        if (e.status === 409 && /kept until/.test(e.message)) continue;
        db.prepare("UPDATE businesses SET files_purge_at = '' WHERE id = ?").run(b.id);
        openTask(b.id, 'purge_failed', `${b.name}'s files could not be deleted automatically: ${e.message}`);
      }
    }
    return due.length;
  } finally {
    purging = false;
  }
}

/** Paid, or nearly: money may have moved and no salon exists yet. */
const UNSETTLED = new Set(['paid', 'screening', 'flagged', 'provisioning']);

/**
 * Take a test signup off the operator's books.
 *
 * For records left behind by testing — a salon bought in Stripe's test mode
 * and since cleared away, a signup that never paid. It changes no money and
 * touches no salon: the record is marked 'removed', kept with its history, and
 * drops out of the queue and the totals. So it refuses anything that might be
 * a real customer: a salon still live on the shard (refund it instead), and a
 * signup that has paid but has no salon yet (retry, approve or refund it).
 */
export async function removeTestRecord(businessId) {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!b) throw err(404, 'No such business');
  if (b.state === 'removed') return { already: true };
  if (UNSETTLED.has(b.state)) {
    throw err(409, `That signup is ${b.state}: money may have moved and there is no salon yet. Retry, approve or refund it instead.`);
  }
  let tenant;
  try { tenant = await shard.getTenant(b.slug); } catch (e) {
    throw err(503, `Could not check the server, so nothing was changed: ${e.message}`);
  }
  // A refunded or deleted salon reads as absent here, exactly like one never built.
  if (tenant) {
    throw err(409, `${b.slug} is a live salon. Refund it instead — Remove only tidies away records whose salon is already gone.`);
  }
  setState(b.id, 'removed', 'operator: test record');
  db.prepare("UPDATE tasks SET state = 'done', done_at = datetime('now'), done_note = 'record removed' WHERE business_id = ? AND state = 'open'").run(b.id);
  return { removed: true };
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
  const owner = db.prepare('SELECT email, phone, email_verified FROM owners WHERE id = ?').get(b.owner_id);
  return {
    state: b.state,
    slug: b.slug,
    business_name: b.name,
    price_cents: b.price_cents,
    email: owner.email,
    phone_hint: String(owner.phone).replace(/.(?=.{3})/g, '•'),
    email_verified: owner.email_verified === 1,
    url: ['ready'].includes(b.state) ? publicUrlFor(b.slug) : '',
    app_url: APP_URL(),
    message: {
      created: 'Enter the code we just emailed you.',
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
