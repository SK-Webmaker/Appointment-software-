// REST API. All routes live under /api. Handlers may return a value (sent as
// JSON 200), send the response themselves, or throw httpError(status, msg).
import {
  db, getSetting, setSetting, getSettings, nextInvoiceNumber, resetDemo, clearBusinessData, SECRET_SETTINGS,
  dbFileBytes, publicUrl, publicUrlFromEnv,
} from './db.js';
import {
  readJson, readBody, sendJson, sendText, httpError, parseCookies, addDaysStr, nowParts, isDateStr, clampInt, toCsv,
  isValidTimeZone,
} from './util.js';
import {
  hashPassword, verifyPassword, createSession, verifySession,
  sessionCookie, clearSessionCookie, secureForRequest, COOKIE_NAME,
  recordToken, recordTokenValid,
} from './auth.js';
import { checkPassword, checkBreached, MIN_LENGTH as PASSWORD_MIN } from './password.js';
import {
  queueAppointmentMessages, cancelQueuedMessages, requeueAppointmentMessages, queueRescheduleMessage,
  queueReceiptMessage, queueDepositReceipt, queueReviewRequest, queueOwnerNotification,
  queueCancellationMessages, cancelUrlFor,
  deliverMessage, processQueue, smsBalance, looksLikeEmail,
} from './notify.js';
import {
  depositCentsFor, stripeConfigured, createDepositCheckout, verifyDepositSession,
  createPosCheckout, verifyPosSession, createStripeRefund,
} from './stripe.js';
import { VERSION } from './version.js';
import { verifyTurnstile, turnstileSiteKey, turnstileEnabled } from './turnstile.js';
import {
  originStatus, resetOriginCounter, newOriginSecret, requestCameViaEdge, ORIGIN_HEADER, MODES,
} from './origin.js';
import { snapshot, emailBackup, backupStatus } from './backup.js';
// Shared with the calendar and the booking page (served from public/js), so all
// three answer "is this date open, and between what times" identically.
import { hoursForDate, parseDayRules, openDatesFrom, weekdayOf } from '../public/js/hours.js';
import { buildRoster, bookableWindow, rosteredShift, NO_ROSTER } from '../public/js/roster.js';
import { checkBody, s } from './validate.js';
import { hit as rateHit, clientIp, classifyRequest } from './ratelimit.js';
import { renderEmail } from './email-html.js';
import { sendEmail } from './notify.js';
import { parseXlsx } from './xlsx.js';
import { opportunities } from './opportunities.js';
import {
  listAutomations, getAutomation, saveAutomation, candidatesFor, runAutomation,
} from './automations.js';
import {
  recipientsFor, draftFor, messageCost, sendCampaign, CAMPAIGN_KINDS, AUDIENCES, lastSent,
  recentlyMessagedSet, setMarketingOptOut, clientByUnsubToken,
  attributionFor, attributionSummary, bookingsFromMessage, fillTokens, bookingLinkFor, mintToken,
} from './campaigns.js';
import {
  offerFreedSlot, listWaitlist, addToWaitlist, removeFromWaitlist, waitlistStats,
  waitlistEnabled, autofillEnabled,
} from './waitlist.js';
import crypto from 'node:crypto';

const APPT_STATUSES = new Set(['booked', 'confirmed', 'completed', 'cancelled', 'no_show']);
const INVOICE_STATUSES = new Set(['draft', 'sent', 'paid', 'void']);
const PAY_METHODS = new Set(['card', 'square', 'cash', 'transfer', 'other']);

/**
 * "Now" where the business actually is — the only clock the owner's day should
 * ever be measured against.
 *
 * The server's own clock is not that clock. On a hosted box it is UTC, so at
 * 10am in Melbourne the machine believes it is 11pm *yesterday*. Anything that
 * reaches for the raw server date lands on the wrong day for the entire morning:
 * the dashboard opens on yesterday's run, and a payment taken at 9am is filed
 * under yesterday's takings. The booking page has always used this zone; the
 * owner's side must too, or the two disagree about what day it is.
 */
const bizNow = () => nowParts(getSetting('business_tz', ''));
const bizToday = () => bizNow().date;

/** 'YYYY-MM-DD HH:MM:SS' in the business's zone, for stamping records. */
function bizStamp() {
  const { date, min } = bizNow();
  const p = (n) => String(n).padStart(2, '0');
  // Seconds are the same in every zone, so the server's are fine here.
  return `${date} ${p(Math.floor(min / 60))}:${p(min % 60)}:${p(new Date().getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Routing table
// ---------------------------------------------------------------------------

const routes = [];
// A path parameter is a row id — digits — unless it is named `date`, in which
// case it is a calendar date. Keeping the pattern strict per name means a
// malformed URL never reaches a handler: it simply doesn't match a route.
// A named parameter is digits unless it says otherwise — ids are the common
// case. Anything else has to be declared here, or the route silently never
// matches and every request to it comes back "Not found".
const PARAM_PATTERN = {
  date: '(\\d{4}-\\d{2}-\\d{2})',
  kind: '([a-z][a-z0-9_]{0,40})',
};
function route(method, pattern, handler, { auth = true } = {}) {
  const names = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:[a-zA-Z_]+/g, (m) => {
      const name = m.slice(1);
      names.push(name);
      return PARAM_PATTERN[name] || '(\\d+)';
    }) + '$'
  );
  routes.push({ method, regex, names, handler, auth });
}

function tooMany(res, over) {
  res.setHeader('Retry-After', String(over.retryAfterSec));
  sendJson(res, 429, {
    error: `Too many requests — please wait ${over.retryAfterSec > 90 ? Math.ceil(over.retryAfterSec / 60) + ' minutes' : over.retryAfterSec + ' seconds'} and try again`,
    retry_after: over.retryAfterSec,
  });
}

export async function handleApi(req, res, pathname, query) {
  // Rate limiting, before anything else touches the request:
  // an absolute per-IP ceiling across the whole API, plus a per-bucket policy
  // (login / booking / review / public reads each have their own limits).
  const ip = clientIp(req);
  const globalOver = rateHit('api_global', ip);
  if (globalOver) return tooMany(res, globalOver);
  const bucket = classifyRequest(req.method, pathname);
  if (bucket !== 'authed') {
    const over = rateHit(bucket, ip);
    if (over) return tooMany(res, over);
  }

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.regex.exec(pathname);
    if (!m) continue;
    const params = {};
    // Ids arrive as numbers because every handler treats them as one. A date
    // must stay the string it is — Number('2026-11-17') is NaN, which would
    // reach the handler as a date that fails every check.
    r.names.forEach((n, i) => { params[n] = PARAM_PATTERN[n] ? m[i + 1] : Number(m[i + 1]); });

    let user = null;
    if (r.auth) {
      const token = parseCookies(req)[COOKIE_NAME];
      const sess = verifySession(token, getSetting('session_secret'));
      if (sess) {
        const row = db.prepare('SELECT id, name, email, role, email_verified, token_version FROM users WHERE id = ?').get(sess.userId);
        // The token's version must still match the user's — a password change
        // (or "sign out everywhere") bumps it and instantly retires old cookies.
        if (row && row.token_version === sess.version) user = row;
      }
      if (!user) return sendJson(res, 401, { error: 'Not signed in' });
      // user-based limit on authenticated traffic (in addition to the IP ceiling)
      const userOver = rateHit('authed', `u${user.id}:${ip}`);
      if (userOver) return tooMany(res, userOver);
    }

    try {
      const result = await r.handler({ req, res, params, query, user });
      if (!res.writableEnded) sendJson(res, 200, result ?? { ok: true });
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      if (!res.writableEnded) sendJson(res, status, { error: err.message || 'Server error', ...(err.data || {}) });
    }
    return true;
  }
  sendJson(res, 404, { error: 'Not found' });
  return true;
}

const str = (v, max = 500) => (v == null ? '' : String(v).slice(0, max).trim());

// A real uploaded image is always a base64 data URI (browsers produce these
// via readAsDataURL). Requiring `;base64,` + a base64-only tail rejects
// markup-carrying values like `data:image/png,"><img onerror=…>`.
const isImageDataUri = (s) =>
  typeof s === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(s);

// Parse the stored gallery JSON, keeping only valid image data: URIs (max 4).
function safeGallery(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isImageDataUri).slice(0, 4);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

route('POST', '/api/auth/login', async ({ req, res }) => {
  // (brute-force limiting for this route lives in the central rate limiter's 'login' bucket)
  const { email, password } = checkBody(await readJson(req), {
    email: s.str(200, { required: true }),
    password: s.str(200, { required: true }),
  });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(str(email).toLowerCase());
  // Always run a hash comparison — even when the email is unknown — so response
  // timing can't be used to discover which emails have accounts.
  const ok = user
    ? verifyPassword(String(password || ''), user.salt, user.pass_hash)
    : verifyPassword(String(password || ''), 'decoy-salt', '00');
  if (!user || !ok) {
    throw httpError(401, 'Invalid email or password');
  }
  const token = createSession(user.id, getSetting('session_secret'), user.token_version || 0);
  res.setHeader('Set-Cookie', sessionCookie(token, secureForRequest(req)));
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role, email_verified: user.email_verified } };
}, { auth: false });

route('POST', '/api/auth/logout', async ({ req, res }) => {
  res.setHeader('Set-Cookie', clearSessionCookie(secureForRequest(req)));
  return { ok: true };
}, { auth: false });

route('GET', '/api/auth/me', async ({ user }) => {
  const { token_version, ...safeUser } = user; // don't expose the session epoch
  return { user: safeUser, settings: getSettings(), version: VERSION };
});

route('GET', '/api/version', async () => ({ version: VERSION }), { auth: false });

// ---------------------------------------------------------------------------
// Account — the owner's own profile, what they're paying, and what they're
// using. Separate from Settings, which configures the business: this page
// answers "who am I, what am I on, and what am I getting for it".
// ---------------------------------------------------------------------------

route('GET', '/api/account', async ({ user }) => {
  const row = db.prepare('SELECT id, name, email, role, created_at, email_verified FROM users WHERE id = ?').get(user.id);
  const one = (sql, ...args) => db.prepare(sql).get(...args)?.n ?? 0;
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const since30 = addDaysStr(bizToday(), -30);

  return {
    user: {
      ...row,
      email_verified: Boolean(row.email_verified),
      // Flagged so the Account page can nag about it in the one place the
      // owner goes to look at their account.
      default_password: getSetting('default_password_active') === '1',
      // Signed in with a password the operator generated and emailed them.
      handover_password: getSetting('handover_password_active') === '1',
    },
    business: {
      name: getSetting('business_name', ''),
      email: getSetting('business_email', ''),
      phone: getSetting('business_phone', ''),
      address: getSetting('business_address', ''),
    },
    plan: {
      name: getSetting('plan_name', 'Kairo'),
      status: getSetting('plan_status', 'active'),
      price_cents: Number(getSetting('plan_price_cents', '0')) || 0,
      interval: getSetting('plan_interval', 'month'),
      started_at: getSetting('plan_started_at', ''),
      renews_at: getSetting('plan_renews_at', ''),
      contact: getSetting('billing_contact', ''),
      note: getSetting('billing_note', ''),
      currency: getSetting('currency', '$'),
    },
    // What they're actually getting out of it. Also the honest basis for any
    // future metered pricing — no counter is invented that isn't already real.
    usage: {
      clients: one('SELECT COUNT(*) AS n FROM clients'),
      team: one('SELECT COUNT(*) AS n FROM staff WHERE active = 1'),
      services: one('SELECT COUNT(*) AS n FROM services WHERE active = 1'),
      products: one('SELECT COUNT(*) AS n FROM products WHERE active = 1'),
      appointments_30d: one("SELECT COUNT(*) AS n FROM appointments WHERE date >= ? AND status != 'cancelled'", since30),
      online_bookings_30d: one("SELECT COUNT(*) AS n FROM appointments WHERE date >= ? AND source = 'online' AND status != 'cancelled'", since30),
      messages_this_month: one('SELECT COUNT(*) AS n FROM messages WHERE substr(created_at, 1, 10) >= ?', monthStart),
      invoices_this_month: one('SELECT COUNT(*) AS n FROM invoices WHERE issue_date >= ?', monthStart),
      collected_cents_this_month: db.prepare(
        'SELECT COALESCE(SUM(amount_cents), 0) AS n FROM payments WHERE substr(paid_at, 1, 10) >= ?'
      ).get(monthStart).n,
    },
    instance: {
      version: VERSION,
      booking_url: publicUrl() ? `${publicUrl()}/book` : '/book',
      online_booking: getSetting('booking_enabled', '1') === '1',
      email_ready: Boolean(getSetting('resend_api_key') && getSetting('notif_from_email')),
      sms_ready: getSetting('sms_notifications_enabled', '1') === '1',
      db_bytes: dbFileBytes(),
    },
  };
});

route('PUT', '/api/account/profile', async ({ req, user }) => {
  const b = checkBody(await readJson(req), {
    name: s.str(100, { required: true }),
    email: s.str(200, { required: true }),
  });
  const name = str(b.name, 100).trim();
  const email = str(b.email, 200).trim().toLowerCase();
  if (!name) throw httpError(400, 'Your name is required');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpError(400, 'Enter a valid email address');
  const clash = db.prepare('SELECT id FROM users WHERE lower(email) = ? AND id != ?').get(email, user.id);
  if (clash) throw httpError(409, 'Another account already uses that email');

  const row = db.prepare('SELECT email, email_verified FROM users WHERE id = ?').get(user.id);
  const changed = row.email.toLowerCase() !== email;
  // A new address hasn't been proven yet, so verification starts over and the
  // old token is burned — otherwise changing the email would inherit a tick
  // that was earned by a different inbox.
  if (changed) {
    db.prepare("UPDATE users SET name = ?, email = ?, email_verified = 0, verify_token = '', verify_sent_at = '' WHERE id = ?")
      .run(name, email, user.id);
  } else {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
  }
  const after = db.prepare('SELECT id, name, email, role, created_at, email_verified FROM users WHERE id = ?').get(user.id);
  return { ...after, email_verified: Boolean(after.email_verified), email_changed: changed };
});

route('PUT', '/api/auth/password', async ({ req, res, user }) => {
  const { current, next } = checkBody(await readJson(req), {
    current: s.str(200, { required: true }),
    next: s.str(200, { required: true }),
  });
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!verifyPassword(String(current || ''), row.salt, row.pass_hash)) {
    throw httpError(400, 'Current password is incorrect');
  }
  // Rules first (instant, offline), then the breach check (network, fails open).
  const problem = checkPassword(next, [row.email, row.name, getSetting('business_name', '')]);
  if (problem) throw httpError(400, problem);
  const breached = await checkBreached(String(next));
  if (breached) throw httpError(400, breached);
  const { salt, hash } = hashPassword(String(next));
  // Bump token_version → every existing session (including any a thief holds)
  // is retired. Then hand THIS browser a fresh cookie so the owner stays in.
  const newVersion = (row.token_version || 0) + 1;
  db.prepare('UPDATE users SET pass_hash = ?, salt = ?, token_version = ? WHERE id = ?').run(hash, salt, newVersion, user.id);
  if (getSetting('default_password_active') === '1') setSetting('default_password_active', '0');
  // Whatever they were handed at setup is now gone, whichever kind it was.
  if (getSetting('handover_password_active') === '1') setSetting('handover_password_active', '0');
  res.setHeader('Set-Cookie', sessionCookie(createSession(user.id, getSetting('session_secret'), newVersion), secureForRequest(req)));
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Owner email verification. A random single-use token is emailed to the
// account address; visiting the link marks the account verified. Tokens
// expire after 48 hours and are replaced on every re-send.
// ---------------------------------------------------------------------------

route('POST', '/api/auth/send-verification', async ({ req, user }) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (row.email_verified) return { ok: true, already_verified: true };
  const token = crypto.randomBytes(24).toString('hex');
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  db.prepare('UPDATE users SET verify_token = ?, verify_sent_at = ? WHERE id = ?').run(token, now, user.id);

  // Build the link from the live request host — always correct, even before
  // public_url has been configured.
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const origin = publicUrl() || `${proto}://${req.headers.host}`;
  const url = `${origin}/api/auth/verify-email?token=${token}`;

  const html = renderEmail({
    heading: 'Verify your email address',
    greeting: `Hi ${row.name},`,
    paragraphs: [
      `Confirm that ${row.email} is yours to finish securing your ${getSetting('business_name', 'Kairo')} account.`,
      'This link works once and expires in 48 hours.',
    ],
    cta: { label: 'Verify my email', url },
    footNote: "If you didn't request this, you can safely ignore it.",
  });
  const result = await sendEmail(row.email, 'Verify your email — Kairo', `Verify your email by opening this link (valid 48h):\n${url}`, html);
  if (!result.ok) {
    throw httpError(result.skipped ? 400 : 502,
      result.skipped ? 'Set up email first (Settings → Notifications) so the verification email can be sent' : `Could not send: ${result.detail}`);
  }
  return { ok: true, sent_to: row.email };
});

route('GET', '/api/auth/verify-email', async ({ res, query }) => {
  const token = str(query.get('token'), 64);
  const page = (title, msg, good) => sendText(res, good ? 200 : 400, `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0b1220;font-family:system-ui,sans-serif;color:#e8edf6">
<div style="text-align:center;max-width:420px;padding:24px">
  <div style="font-size:44px;margin-bottom:12px">${good ? '✅' : '⚠️'}</div>
  <h1 style="font-size:21px;margin:0 0 8px">${title}</h1>
  <p style="color:#9aa7bd;line-height:1.6;margin:0 0 22px">${msg}</p>
  <a href="/" style="color:#38bdf8;font-weight:600;text-decoration:none">Go to your workspace →</a>
</div></body></html>`, 'text/html; charset=utf-8');

  if (!token) return page('Link not valid', 'This verification link is missing its code. Request a fresh one from Settings → Security.', false);
  const row = db.prepare('SELECT * FROM users WHERE verify_token = ?').get(token);
  if (!row) return page('Link not valid', 'This verification link was already used or has been replaced. Request a fresh one from Settings → Security.', false);
  const sentAt = new Date(`${row.verify_sent_at.replace(' ', 'T')}:00Z`).getTime();
  if (!sentAt || Date.now() - sentAt > 48 * 60 * 60 * 1000) {
    return page('Link expired', 'Verification links are valid for 48 hours. Request a fresh one from Settings → Security.', false);
  }
  db.prepare("UPDATE users SET email_verified = 1, verify_token = '' WHERE id = ?").run(row.id);
  return page('Email verified', `${row.email} is now confirmed. Your account is fully set up.`, true);
}, { auth: false });

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const EDITABLE_SETTINGS = new Set([
  'business_name', 'business_email', 'business_phone', 'business_address',
  'currency', 'tax_rate', 'open_min', 'close_min', 'slot_interval',
  'business_tz', 'booking_lead_min', 'cal_start_min', 'cal_end_min', 'rebook_weeks_default',
  'booking_horizon_days', 'cancel_window_hours', 'client_cancel_enabled',
  'plan_name', 'plan_status', 'plan_price_cents', 'plan_interval',
  'plan_started_at', 'plan_renews_at', 'billing_contact', 'billing_note',
  'booking_enabled', 'invoice_prefix', 'invoice_due_days', 'invoice_footer',
  'open_days', 'day_rules', 'brand_scheme',
  'confirm_enabled', 'reminders_enabled', 'reminder_hours', 'notif_from_email',
  'owner_notify_enabled',
  'receipts_enabled', 'review_requests_enabled', 'review_delay_hours', 'google_review_url',
  'chan_confirmation', 'chan_reminder', 'chan_receipt', 'chan_review_request',
  'notif_reply_to', 'clicksend_starter_from', 'clicksend_starter_dismissed',
  'marketing_cooldown_days', 'sms_cost_cents',
  'waitlist_enabled', 'waitlist_autofill', 'waitlist_channel', 'waitlist_max_offers',
  'sms_notifications_enabled', 'public_url',
  'backup_email_enabled', 'backup_frequency', 'backup_email_to',
  // origin_lock_mode and cf_origin_secret are deliberately absent: they can
  // lock the owner out of this very screen, so they move only through the
  // guarded /api/edge routes below.
  'turnstile_enabled', 'turnstile_site_key', 'turnstile_secret_key',
  'resend_api_key',
  'sms_provider',
  'clicksend_username', 'clicksend_api_key', 'clicksend_from',
  'telnyx_api_key', 'telnyx_from', 'telnyx_profile_id',
  'twilio_sid', 'twilio_token', 'twilio_from',
  'stripe_secret_key', 'currency_code', 'deposit_type', 'deposit_value',
  'pos_card_method',
  'brand_accent', 'brand_theme', 'brand_font', 'brand_logo', 'brand_cover',
  'brand_gallery', 'brand_tagline',
]);

// data: URIs are large; give image fields room, everything else a tight cap
const IMAGE_SETTINGS = new Set(['brand_logo', 'brand_cover']);
const settingCap = (k) => (k === 'brand_gallery' ? 3_500_000 : IMAGE_SETTINGS.has(k) ? 900_000 : 2000);

// Apply a settings object with the same validation everywhere (PUT + wizard):
// secrets are write-only, images must be genuine data URIs, others are capped.
function applySettings(body) {
  for (const [k, v] of Object.entries(body)) {
    if (!EDITABLE_SETTINGS.has(k)) continue;
    // The site address is pinned by the environment on the platform. The field
    // is shown disabled, and a disabled input submits as empty — so without
    // this, saving the form would quietly wipe the stored fallback and only
    // reveal it the day the variable is removed.
    if (k === 'public_url' && publicUrlFromEnv()) continue;
    // A From address Resend will reject is worth refusing at the point it is
    // typed. Saved silently, it looks fine in Settings and only surfaces when a
    // real customer's confirmation fails — with a raw 422 that names no field.
    if (k === 'notif_from_email') {
      const val = str(v, 320).trim();
      if (val !== '' && !looksLikeEmail(val)) {
        throw httpError(400, `"${val}" is not a valid email address. Use the full address on the domain you verified in Resend, e.g. hello@yourbusiness.kairobookings.com`);
      }
      setSetting(k, val);
      continue;
    }
    // Secrets are write-only: an empty value means "leave what's stored".
    // A real new value replaces it; the sentinel '__clear__' wipes it.
    if (SECRET_SETTINGS.has(k)) {
      const val = str(v, 4000);
      if (val === '') continue;
      setSetting(k, val === '__clear__' ? '' : val);
      continue;
    }
    // Logo/cover are rendered on the public page — accept only real base64
    // image data URIs (or empty to clear); reject anything that could carry markup.
    if (IMAGE_SETTINGS.has(k)) {
      const val = str(v, settingCap(k));
      if (val !== '' && !isImageDataUri(val)) continue;
      setSetting(k, val);
      continue;
    }
    // Per-day availability rules: re-serialise from the validated shape so only
    // well-formed rules are ever stored, and snap each repeating day's start
    // date onto its own weekday (an anchor on the wrong day would put the
    // whole alternating pattern out of phase).
    if (k === 'day_rules') {
      if (typeof v === 'string' && v.length > settingCap(k)) continue;
      const rules = parseDayRules(v);
      for (const [dow, rule] of Object.entries(rules)) {
        if (rule.anchor) rule.anchor = snapToWeekday(rule.anchor, Number(dow));
      }
      setSetting(k, JSON.stringify(rules));
      continue;
    }
    // A time zone the server can't resolve is worse than none at all: it is
    // stored, looks configured, and silently falls back to the server's own
    // clock — which on a hosted box is UTC. A salon then gets told its 9am
    // client is still "next up" at lunchtime, and its booking page offers
    // times that have already passed. Refuse the typo instead.
    if (k === 'business_tz') {
      const tz = str(v, 100).trim();
      if (tz && !isValidTimeZone(tz)) {
        throw httpError(400, `"${tz}" isn't a time zone Kairo recognises. Use a name like Australia/Melbourne.`);
      }
      setSetting(k, tz);
      continue;
    }
    setSetting(k, str(v, settingCap(k)));
  }
}

/** Move a date forward to the next occurrence of `dow` (0=Sun), if it isn't one. */
function snapToWeekday(dateStr, dow) {
  const shift = ((dow - weekdayOf(dateStr)) % 7 + 7) % 7;
  if (!shift) return dateStr;
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + shift);
  return d.toISOString().slice(0, 10);
}

// Shared field schemas (validate.js): type checks, length limits, and
// rejection of unexpected fields on every write endpoint.
const CLIENT_SCHEMA = {
  first_name: s.str(100, { required: true }), last_name: s.str(100),
  email: s.str(200), phone: s.str(50), notes: s.str(2000),
};
const SERVICE_SCHEMA = {
  name: s.str(200, { required: true }), category: s.str(100),
  duration_min: s.num({ min: 1, max: 1440 }), price: s.num({ min: 0, max: 1_000_000 }),
  price_cents: s.num({ min: 0, max: 100_000_000 }),
  price_type: s.oneOf(['fixed', 'from', 'free']), description: s.str(1000), active: s.bool(),
};
const INVOICE_ITEM_SCHEMA = {
  id: s.num(), invoice_id: s.num(),
  description: s.str(300), qty: s.num({ min: 0, max: 10000 }), unit_cents: s.num({ min: 0, max: 100_000_000 }),
};
const INVOICE_SCHEMA = {
  client_id: s.num(), appointment_id: s.num(),
  issue_date: s.str(10), due_date: s.str(10),
  status: s.oneOf(['draft', 'sent', 'paid', 'void']),
  tax_rate: s.num({ min: 0, max: 100 }), discount_cents: s.num({ min: 0, max: 100_000_000 }),
  notes: s.str(2000), items: s.arr(s.obj(INVOICE_ITEM_SCHEMA), 100),
};
const APPT_SCHEMA = {
  client_id: s.num(),
  new_client: s.obj({ first_name: s.str(100), last_name: s.str(100), email: s.str(200), phone: s.str(50) }),
  service_id: s.num(), service_ids: s.arr(s.num(), 20), staff_id: s.num({ required: true }),
  date: s.str(10, { required: true }), start_min: s.num({ min: 0, max: 1439, required: true }),
  end_min: s.num({ min: 0, max: 1440 }),
  status: s.oneOf(['booked', 'confirmed', 'completed', 'cancelled', 'no_show']),
  notes: s.str(2000), force: s.bool(),
  // Whether the client hears about this save, and by what. Read when a booking
  // is made, when its time moves, and when a save cancels it. Absent means yes,
  // so an older caller can't accidentally go silent; an absent channel means
  // whatever Settings → Notifications says.
  notify_client: s.bool(),
  notify_channel: s.oneOf(['email', 'sms', 'both']),
};

/** The owner's per-appointment channel pick, or '' for the standing setting. */
const chosenChannel = (b) => (['email', 'sms', 'both'].includes(b.notify_channel) ? b.notify_channel : '');

route('GET', '/api/settings', async () => getSettings());

route('PUT', '/api/settings', async ({ req }) => {
  const body = await readJson(req);
  for (const k of Object.keys(body)) {
    if (!EDITABLE_SETTINGS.has(k)) throw httpError(400, `Unexpected field: ${k}`);
  }
  applySettings(body);
  return getSettings();
});

route('POST', '/api/settings/reset-demo', async ({ user }) => {
  // A verified business is a real, live business — never let the demo reset
  // wipe their clients/appointments/invoices (the button is hidden in the UI
  // too, this guards a crafted request).
  if (user?.email_verified) throw httpError(403, 'Demo reset is disabled once your email is verified — this protects your live data.');
  resetDemo();
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Guided setup wizard (owner-facing, first login)
// ---------------------------------------------------------------------------

route('POST', '/api/setup/skip', async () => {
  setSetting('setup_complete', '1');
  return { ok: true };
});

route('POST', '/api/setup/apply', async ({ req }) => {
  const b = await readJson(req);
  checkBody(b, {
    fresh: s.bool(),
    settings: { type: 'raw' },                      // validated against EDITABLE_SETTINGS below
    team: s.arr(s.obj({ name: s.str(100), title: s.str(100) }), 30),
    services: s.arr(s.obj({
      name: s.str(200), category: s.str(100), duration_min: s.num({ min: 1, max: 1440 }),
      price: s.num({ min: 0, max: 1_000_000 }), price_type: s.oneOf(['fixed', 'from', 'free']),
    }), 200),
  });
  if (b.settings) {
    for (const k of Object.keys(b.settings)) {
      if (!EDITABLE_SETTINGS.has(k)) throw httpError(400, `Unexpected field: settings.${k}`);
    }
  }
  if (b.fresh) clearBusinessData();

  // Ensure a location exists (staff attach to it; booking page uses it).
  let locId = db.prepare('SELECT id FROM locations WHERE active = 1 ORDER BY id LIMIT 1').get()?.id;
  if (!locId) {
    locId = Number(db.prepare('INSERT INTO locations (name, address, phone) VALUES (?, ?, ?)').run(
      str(b.settings?.business_name, 150) || 'Main location',
      str(b.settings?.business_address, 300),
      str(b.settings?.business_phone, 50)
    ).lastInsertRowid);
  }

  const palette = ['#3987e5', '#199e70', '#9085e9', '#e5a039', '#d55181', '#2dd4bf'];
  (Array.isArray(b.team) ? b.team : []).slice(0, 30).forEach((m, i) => {
    if (!str(m.name)) return;
    db.prepare('INSERT INTO staff (name, title, color, location_id) VALUES (?, ?, ?, ?)')
      .run(str(m.name, 100), str(m.title, 100), palette[i % palette.length], locId);
  });

  let servicesAdded = 0;
  for (const svc of (Array.isArray(b.services) ? b.services : []).slice(0, 200)) {
    try {
      db.prepare('INSERT INTO services (name, category, duration_min, price_cents, price_type, description) VALUES (?, ?, ?, ?, ?, ?)')
        .run(...serviceBody(svc));
      servicesAdded++;
    } catch { /* skip malformed rows */ }
  }

  if (b.settings) applySettings(b.settings);
  setSetting('setup_complete', '1');
  return { ok: true, services_added: servicesAdded, booking_path: '/book' };
});

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

route('GET', '/api/locations', async ({ query }) => {
  const all = query.get('all') === '1';
  return db.prepare(`SELECT * FROM locations ${all ? '' : 'WHERE active = 1'} ORDER BY id`).all();
});

route('POST', '/api/locations', async ({ req }) => {
  const b = checkBody(await readJson(req), { name: s.str(150), address: s.str(300), phone: s.str(50), active: s.bool() });
  if (!str(b.name)) throw httpError(400, 'Location name is required');
  const info = db.prepare('INSERT INTO locations (name, address, phone) VALUES (?, ?, ?)')
    .run(str(b.name, 150), str(b.address, 300), str(b.phone, 50));
  return db.prepare('SELECT * FROM locations WHERE id = ?').get(info.lastInsertRowid);
});

route('PUT', '/api/locations/:id', async ({ req, params }) => {
  const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(params.id);
  if (!existing) throw httpError(404, 'Location not found');
  const b = checkBody(await readJson(req), { name: s.str(150), address: s.str(300), phone: s.str(50), active: s.bool() });
  db.prepare('UPDATE locations SET name = ?, address = ?, phone = ?, active = ? WHERE id = ?').run(
    str(b.name, 150) || existing.name, str(b.address, 300), str(b.phone, 50),
    b.active === undefined ? existing.active : (b.active ? 1 : 0), params.id
  );
  return db.prepare('SELECT * FROM locations WHERE id = ?').get(params.id);
});

route('DELETE', '/api/locations/:id', async ({ params }) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM locations').get().n;
  if (total <= 1) throw httpError(400, 'You need at least one location');
  const used = db.prepare('SELECT COUNT(*) AS n FROM staff WHERE location_id = ?').get(params.id).n;
  if (used > 0) {
    db.prepare('UPDATE locations SET active = 0 WHERE id = ?').run(params.id);
    return { ok: true, deactivated: true };
  }
  db.prepare('DELETE FROM locations WHERE id = ?').run(params.id);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const STAFF_SELECT = `
  SELECT s.*, l.name AS location_name FROM staff s
  LEFT JOIN locations l ON l.id = s.location_id`;

route('GET', '/api/staff', async ({ query }) => {
  const all = query.get('all') === '1';
  return db.prepare(`${STAFF_SELECT} ${all ? '' : 'WHERE s.active = 1'} ORDER BY s.id`).all();
});

route('POST', '/api/staff', async ({ req }) => {
  const b = checkBody(await readJson(req), { name: s.str(100), title: s.str(100), color: s.str(20), active: s.bool(), location_id: s.num() });
  if (!str(b.name)) throw httpError(400, 'Name is required');
  const info = db.prepare('INSERT INTO staff (name, title, color, location_id) VALUES (?, ?, ?, ?)')
    .run(str(b.name, 100), str(b.title, 100), str(b.color, 20) || '#3987e5', Number(b.location_id) || null);
  return db.prepare(`${STAFF_SELECT} WHERE s.id = ?`).get(info.lastInsertRowid);
});

route('PUT', '/api/staff/:id', async ({ req, params }) => {
  const b = checkBody(await readJson(req), { name: s.str(100), title: s.str(100), color: s.str(20), active: s.bool(), location_id: s.num() });
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(params.id);
  if (!existing) throw httpError(404, 'Staff member not found');
  db.prepare('UPDATE staff SET name = ?, title = ?, color = ?, active = ?, location_id = ? WHERE id = ?').run(
    str(b.name, 100) || existing.name,
    str(b.title, 100),
    str(b.color, 20) || existing.color,
    b.active === undefined ? existing.active : (b.active ? 1 : 0),
    b.location_id === undefined ? existing.location_id : (Number(b.location_id) || null),
    params.id
  );
  return db.prepare(`${STAFF_SELECT} WHERE s.id = ?`).get(params.id);
});

// ---------------------------------------------------------------------------
// The roster — who is working, when
// ---------------------------------------------------------------------------

const SHIFT_SCHEMA = {
  weekday: s.num({ min: 0, max: 6 }),
  date: s.str(10),
  start_min: s.num({ min: 0, max: 1440 }),
  end_min: s.num({ min: 0, max: 1440 }),
  working: s.bool(),
  note: s.str(200),
};

/** Every shift row for a member, weekly pattern and one-offs together. */
route('GET', '/api/staff/:id/shifts', async ({ params }) => {
  if (!db.prepare('SELECT id FROM staff WHERE id = ?').get(params.id)) throw httpError(404, 'Team member not found');
  const rows = db.prepare(
    `SELECT id, weekday, date, start_min, end_min, working, note FROM staff_shifts
     WHERE staff_id = ? ORDER BY date, weekday`
  ).all(params.id);
  return {
    weekly: rows.filter((r) => !r.date),
    overrides: rows.filter((r) => r.date),
    // Nothing set means they simply follow the salon's opening hours, which is
    // a different state from "rostered off every day" and reads differently.
    follows_opening_hours: rows.filter((r) => !r.date).length === 0,
  };
});

/**
 * Replace a member's weekly pattern in one write.
 *
 * Sent whole rather than day by day: a roster is read as a week, and a
 * half-applied one — Tuesday saved, Wednesday not — would quietly take a
 * stylist off the booking page for a day nobody meant to change.
 */
route('PUT', '/api/staff/:id/shifts', async ({ req, params }) => {
  if (!db.prepare('SELECT id FROM staff WHERE id = ?').get(params.id)) throw httpError(404, 'Team member not found');
  const b = checkBody(await readJson(req), { days: s.arr(s.obj(SHIFT_SCHEMA), 7) });
  const days = Array.isArray(b.days) ? b.days : [];

  const clean = [];
  for (const d of days) {
    const dow = Number(d.weekday);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) continue;
    if (d.working === false) continue;                    // a blank day is simply not stored
    const start = clampInt(d.start_min, 0, 1440, NaN);
    const end = clampInt(d.end_min, 0, 1440, NaN);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      throw httpError(400, 'A shift has to finish after it starts');
    }
    clean.push({ weekday: dow, start, end });
  }

  const tx = db.prepare('SELECT 1');   // keep the two writes together
  db.exec('BEGIN');
  try {
    db.prepare("DELETE FROM staff_shifts WHERE staff_id = ? AND date = ''").run(params.id);
    const ins = db.prepare(
      "INSERT INTO staff_shifts (staff_id, weekday, date, start_min, end_min, working) VALUES (?, ?, '', ?, ?, 1)"
    );
    for (const c of clean) ins.run(params.id, c.weekday, c.start, c.end);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  void tx;
  return { ok: true, days: clean.length };
});

/**
 * A single date for one member: a different shift, or a day off.
 *
 * `working: false` records the day off explicitly — which is not the same as
 * deleting the row, because deleting would fall back to the weekly pattern and
 * put them straight back on the booking page.
 */
route('PUT', '/api/staff/:id/shifts/:date', async ({ req, params }) => {
  if (!db.prepare('SELECT id FROM staff WHERE id = ?').get(params.id)) throw httpError(404, 'Team member not found');
  if (!isDateStr(params.date)) throw httpError(400, 'Date must be YYYY-MM-DD');
  const b = checkBody(await readJson(req), SHIFT_SCHEMA);

  const working = b.working !== false;
  let start = 0, end = 0;
  if (working) {
    start = clampInt(b.start_min, 0, 1440, NaN);
    end = clampInt(b.end_min, 0, 1440, NaN);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      throw httpError(400, 'A shift has to finish after it starts');
    }
  }
  db.prepare(
    `INSERT INTO staff_shifts (staff_id, weekday, date, start_min, end_min, working, note)
     VALUES (?, NULL, ?, ?, ?, ?, ?)
     ON CONFLICT(staff_id, date) WHERE date != '' DO UPDATE SET
       start_min = excluded.start_min, end_min = excluded.end_min,
       working = excluded.working, note = excluded.note`
  ).run(params.id, params.date, start, end, working ? 1 : 0, str(b.note, 200));

  // Anyone already booked into a time the member no longer works is the
  // owner's to sort out, so say so rather than silently stranding them.
  const stranded = strandedBookings(params.id, params.date);
  return { ok: true, working, stranded };
});

/** Back to the weekly pattern for that date. */
route('DELETE', '/api/staff/:id/shifts/:date', async ({ params }) => {
  if (!isDateStr(params.date)) throw httpError(400, 'Date must be YYYY-MM-DD');
  db.prepare('DELETE FROM staff_shifts WHERE staff_id = ? AND date = ?').run(params.id, params.date);
  return { ok: true, stranded: strandedBookings(params.id, params.date) };
});

/** Live bookings that now fall outside what this member is rostered for. */
function strandedBookings(staffId, date) {
  const window = staffWindow(staffId, date);
  const appts = db.prepare(
    `${APPT_SELECT} WHERE a.staff_id = ? AND a.date = ? AND a.status NOT IN ('cancelled', 'no_show')
     ORDER BY a.start_min`
  ).all(staffId, date);
  return appts
    .filter((a) => !window || a.start_min < window.open || a.end_min > window.close)
    .map((a) => ({ id: a.id, client_name: a.client_name, start_min: a.start_min, end_min: a.end_min }));
}

/**
 * Every member's raw shift rows in one call, for the calendar's shading.
 *
 * The grid route below answers "who works when" for a specific week; this
 * answers "what is everyone's pattern", which is what a calendar needs to shade
 * any date the owner scrolls to without asking again.
 */
route('GET', '/api/roster/patterns', async () => {
  const rows = db.prepare(
    'SELECT staff_id, weekday, date, start_min, end_min, working FROM staff_shifts'
  ).all();
  const rosters = {};
  for (const r of rows) (rosters[r.staff_id] ||= []).push(r);
  return { rosters };
});

/**
 * The roster as a grid: every active member across a span of dates.
 *
 * One call for the whole week, because the Team screen draws it as a week and
 * one request per member per day would be seven times the work for the same
 * answer.
 */
route('GET', '/api/roster', async ({ query }) => {
  const from = isDateStr(query.get('from')) ? query.get('from') : bizToday();
  const to = isDateStr(query.get('to')) ? query.get('to') : addDaysStr(from, 6);
  if (to < from) throw httpError(400, 'That date range runs backwards');
  const dates = [];
  for (let d = from; d <= to && dates.length < 31; d = addDaysStr(d, 1)) dates.push(d);

  const staff = db.prepare(`${STAFF_SELECT} WHERE s.active = 1 ORDER BY s.id`).all();
  const salon = Object.fromEntries(dates.map((d) => [d, hoursFor(d)]));

  return {
    from, to, dates,
    salon_hours: salon,
    members: staff.map((m) => {
      const roster = rosterFor(m.id);
      const days = dates.map((d) => {
        const shift = rosteredShift(d, roster);
        const window = bookableWindow(d, roster, salon[d]);
        return {
          date: d,
          working: Boolean(window),
          open_min: window?.open ?? null,
          close_min: window?.close ?? null,
          // Where the answer came from, so the grid can say "follows the salon"
          // rather than pretending the owner set these hours by hand.
          source: shift === NO_ROSTER ? 'salon' : (roster.overrides?.[d] ? 'date' : 'weekly'),
          salon_closed: !salon[d],
        };
      });
      return {
        id: m.id, name: m.name, title: m.title, color: m.color,
        follows_opening_hours: !roster.hasWeekly,
        days,
        minutes: days.reduce((n, x) => n + (x.working ? x.close_min - x.open_min : 0), 0),
      };
    }),
  };
});

route('DELETE', '/api/staff/:id', async ({ params }) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM appointments WHERE staff_id = ?').get(params.id).n;
  if (used > 0) {
    db.prepare('UPDATE staff SET active = 0 WHERE id = ?').run(params.id);
    return { ok: true, deactivated: true };
  }
  db.prepare('DELETE FROM staff WHERE id = ?').run(params.id);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const CLIENT_LIST_SQL = `
  SELECT c.*,
    (SELECT COUNT(*) FROM appointments a WHERE a.client_id = c.id AND a.status != 'cancelled') AS appointment_count,
    (SELECT MAX(a.date) FROM appointments a WHERE a.client_id = c.id AND a.status = 'completed') AS last_visit,
    COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.client_id = c.id), 0) AS total_paid_cents
  FROM clients c`;

route('GET', '/api/clients', async ({ query }) => {
  const q = str(query.get('q'), 100);
  if (q) {
    const like = `%${q}%`;
    return db.prepare(
      `${CLIENT_LIST_SQL} WHERE c.first_name || ' ' || c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?
       ORDER BY c.first_name, c.last_name`
    ).all(like, like, like);
  }
  return db.prepare(`${CLIENT_LIST_SQL} ORDER BY c.first_name, c.last_name`).all();
});

route('GET', '/api/clients/export', async ({ res }) => {
  const rows = db.prepare('SELECT first_name, last_name, email, phone, notes FROM clients ORDER BY first_name').all();
  const csv = toCsv(
    [
      { key: 'first_name', label: 'First Name' }, { key: 'last_name', label: 'Last Name' },
      { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'notes', label: 'Notes' },
    ],
    rows
  );
  sendText(res, 200, csv, 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="clients.csv"' });
});

// Likely duplicates, grouped: two clients belong together when they share an
// email, a phone number, or an identical full name. Union-find stitches those
// signals into one group so "same email" + "same phone" collapse together.
// (Registered before /api/clients/:id so ":id" doesn't capture "duplicates".)
route('GET', '/api/clients/duplicates', async () => {
  const clients = db.prepare(`${CLIENT_LIST_SQL}`).all();
  const parent = new Map(clients.map((c) => [c.id, c.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const norm = (v) => String(v || '').trim().toLowerCase();
  const digits = (v) => String(v || '').replace(/\D/g, '');
  const linkBy = (keyOf) => {
    const seen = new Map();
    for (const c of clients) {
      const k = keyOf(c); if (!k) continue;
      if (seen.has(k)) union(seen.get(k), c.id); else seen.set(k, c.id);
    }
  };
  linkBy((c) => norm(c.email));
  linkBy((c) => { const d = digits(c.phone); return d.length >= 6 ? d : ''; });
  linkBy((c) => { const n = `${norm(c.first_name)} ${norm(c.last_name)}`.trim(); return n.length >= 3 ? `n:${n}` : ''; });
  const groups = new Map();
  for (const c of clients) { const r = find(c.id); (groups.get(r) || groups.set(r, []).get(r)).push(c); }
  // keep only real groups; suggest the richest record (most visits, then spend) as the keeper first
  const dupes = [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => g.sort((a, b) => (b.appointment_count - a.appointment_count) || (b.total_paid_cents - a.total_paid_cents) || (a.id - b.id)))
    .sort((a, b) => b.length - a.length);
  return { groups: dupes };
});

route('GET', '/api/clients/:id', async ({ params }) => {
  const client = db.prepare(`${CLIENT_LIST_SQL} WHERE c.id = ?`).get(params.id);
  if (!client) throw httpError(404, 'Client not found');
  client.appointments = db.prepare(
    `SELECT a.*, s.name AS staff_name, sv.name AS service_name, sv.price_cents
     FROM appointments a
     LEFT JOIN staff s ON s.id = a.staff_id
     LEFT JOIN services sv ON sv.id = a.service_id
     WHERE a.client_id = ? ORDER BY a.date DESC, a.start_min DESC LIMIT 50`
  ).all(params.id);
  client.invoices = db.prepare(
    `SELECT i.*,
       COALESCE((SELECT CAST(ROUND(SUM(qty * unit_cents)) AS INTEGER) FROM invoice_items WHERE invoice_id = i.id), 0) AS subtotal_cents,
       COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id = i.id), 0) AS paid_cents
     FROM invoices i WHERE i.client_id = ? ORDER BY i.issue_date DESC LIMIT 50`
  ).all(params.id);
  return client;
});

function clientBody(b) {
  checkBody(b, CLIENT_SCHEMA);
  const first = str(b.first_name, 100);
  if (!first) throw httpError(400, 'First name is required');
  return [first, str(b.last_name, 100), str(b.email, 200).toLowerCase(), str(b.phone, 50), str(b.notes, 2000)];
}

route('POST', '/api/clients', async ({ req }) => {
  const info = db.prepare(
    'INSERT INTO clients (first_name, last_name, email, phone, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(...clientBody(await readJson(req)));
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
});

route('PUT', '/api/clients/:id', async ({ req, params }) => {
  if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(params.id)) throw httpError(404, 'Client not found');
  db.prepare(
    'UPDATE clients SET first_name = ?, last_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?'
  ).run(...clientBody(await readJson(req)), params.id);
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(params.id);
});

route('DELETE', '/api/clients/:id', async ({ params }) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(params.id);
  return { ok: true };
});

// Merge duplicate clients into one: every appointment, invoice, message and
// review from the duplicates is reassigned to the keeper, any details the
// keeper is missing (email/phone/last name) are filled in from them, their
// notes are appended, and the duplicate rows are deleted — all in one
// transaction so nothing is half-merged. Deletes only the merged-away records.
route('POST', '/api/clients/:id/merge', async ({ req, params }) => {
  const keepId = Number(params.id);
  const keeper = db.prepare('SELECT * FROM clients WHERE id = ?').get(keepId);
  if (!keeper) throw httpError(404, 'Client not found');
  const b = checkBody(await readJson(req), { from_ids: s.arr(s.num({ min: 1 }), 100, { required: true }) });
  const fromIds = [...new Set(b.from_ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0 && n !== keepId);
  if (!fromIds.length) throw httpError(400, 'Choose at least one other client to merge in');
  const ph = fromIds.map(() => '?').join(',');
  const dupes = db.prepare(`SELECT * FROM clients WHERE id IN (${ph})`).all(...fromIds);
  if (dupes.length !== fromIds.length) throw httpError(400, 'One of the clients to merge no longer exists');

  db.exec('BEGIN');
  try {
    for (const table of ['appointments', 'invoices', 'messages', 'reviews']) {
      db.prepare(`UPDATE ${table} SET client_id = ? WHERE client_id IN (${ph})`).run(keepId, ...fromIds);
    }
    let { email, phone, last_name: lastName, notes } = keeper;
    for (const d of dupes) {
      if (!email && d.email) email = d.email;
      if (!phone && d.phone) phone = d.phone;
      if (!lastName && d.last_name) lastName = d.last_name;
      if (d.notes && !String(notes).includes(d.notes)) notes = notes ? `${notes}\n${d.notes}` : d.notes;
    }
    db.prepare('UPDATE clients SET email = ?, phone = ?, last_name = ?, notes = ? WHERE id = ?')
      .run(email, phone, lastName, str(notes, 2000), keepId);
    db.prepare(`DELETE FROM clients WHERE id IN (${ph})`).run(...fromIds);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { ok: true, merged: fromIds.length, client: db.prepare(`${CLIENT_LIST_SQL} WHERE c.id = ?`).get(keepId) };
});

// Phone helpers, shared by the import matcher. `digitsOf` is used for matching
// (two numbers are the "same" when their digits match); `tidyPhone` cleans a
// number for storage — a leading "+" then digits only, which is lossless for
// dialling and gives every imported number a consistent, SMS-ready shape.
const digitsOf = (v) => String(v || '').replace(/\D/g, '');
const tidyPhone = (v) => {
  const raw = String(v || '').trim();
  if (!raw) return '';
  const d = digitsOf(raw);
  return d ? (raw.startsWith('+') ? '+' : '') + d : '';
};
// A phone we consider "real" (enough digits to dial / send an SMS to).
const hasPhone = (v) => digitsOf(v).length >= 7;

const normEmail = (v) => String(v || '').trim().toLowerCase();
// Hardened name key for matching: strip accents, then reduce to just the
// letters/digits (no spaces or punctuation) so every spelling of the same name
// collapses together — "Chantelle Dubé" -> "chantelledube", and
// "O'Neill" == "ONeill" == "O Neill". This is what makes matching two Fresha
// exports (which share names but not always emails) reliable.
const nameKey = (f, l) => `${f || ''} ${l || ''}`
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');

// The shared match-and-enrich engine behind both the CSV import and the
// spreadsheet contact sync. Each incoming row is matched to an existing client
// by email → phone → name, then that client's details are updated from the row.
//   enrich          fill in details the client is MISSING (phone/email/last/notes)
//   updateContacts  treat the sheet as the source of truth: also OVERWRITE an
//                   existing phone/email when the sheet has a different value
//   addNew          insert people who don't match anyone (off = only touch
//                   existing clients and report the rest as "unmatched")
//   dryRun          compute the outcome without writing anything
function matchAndEnrich(rows, { enrich = true, updateContacts = false, addNew = true, dryRun = false } = {}) {
  const people = db.prepare('SELECT * FROM clients').all().map((c) => ({
    id: c.id, first_name: c.first_name, last_name: c.last_name,
    email: c.email, phone: c.phone, notes: c.notes,
    _origEmail: c.email, _origPhone: c.phone, _origLast: c.last_name, _origNotes: c.notes, _new: false,
  }));
  const emailIdx = new Map();  // normEmail -> person
  const phoneIdx = new Map();  // phone digits -> person
  const nameIdx = new Map();   // nameKey -> [person, ...]
  const indexPerson = (p) => {
    const e = normEmail(p.email); if (e && !emailIdx.has(e)) emailIdx.set(e, p);
    const d = digitsOf(p.phone); if (d.length >= 7 && !phoneIdx.has(d)) phoneIdx.set(d, p);
    const n = nameKey(p.first_name, p.last_name);
    if (n.length >= 3) { const arr = nameIdx.get(n) || nameIdx.set(n, []).get(n); if (!arr.includes(p)) arr.push(p); }
  };
  people.forEach(indexPerson);

  let invalid = 0, matchedNoChange = 0, ambiguous = 0;
  const unmatched = [];
  for (const raw of rows) {
    let fields;
    try { fields = clientBody(raw); } catch { invalid++; continue; }
    let [first, last, email, phone, notes] = fields;
    email = normEmail(email);
    phone = tidyPhone(phone);

    // email → phone → name. A name shared by several existing clients is only
    // used when exactly one of them is missing a phone (the obvious target);
    // otherwise it's left as ambiguous rather than guessing.
    let match = null;
    if (email && emailIdx.has(email)) match = emailIdx.get(email);
    if (!match && hasPhone(phone) && phoneIdx.has(digitsOf(phone))) match = phoneIdx.get(digitsOf(phone));
    if (!match) {
      const named = nameKey(first, last).length >= 3 ? nameIdx.get(nameKey(first, last)) : null;
      if (named && named.length === 1) match = named[0];
      else if (named && named.length > 1) {
        const needy = named.filter((p) => !hasPhone(p.phone));
        if (needy.length === 1) match = needy[0]; else ambiguous++;
      }
    }

    if (match && (enrich || updateContacts)) {
      let changed = false;
      // Email: fill when missing; refresh when the sheet is authoritative.
      if (email && (!normEmail(match.email) || (updateContacts && normEmail(match.email) !== email))) {
        match.email = email; emailIdx.set(email, match); changed = true;
      }
      // Phone: fill when missing; refresh a different number when authoritative.
      if (hasPhone(phone) && (!hasPhone(match.phone) || (updateContacts && digitsOf(match.phone) !== digitsOf(phone)))) {
        match.phone = phone; phoneIdx.set(digitsOf(phone), match); changed = true;
      }
      if (!String(match.last_name || '').trim() && last) { match.last_name = last; changed = true; }
      if (notes && !String(match.notes || '').includes(notes)) { match.notes = match.notes ? `${match.notes}\n${notes}` : notes; changed = true; }
      if (!changed) matchedNoChange++;
    } else if (match) {
      matchedNoChange++; // updates disabled: matched rows are left untouched
    } else if (addNew) {
      const p = { id: null, first_name: first, last_name: last, email, phone, notes, _new: true };
      people.push(p); indexPerson(p);
    } else {
      unmatched.push(`${first} ${last}`.trim() || email || phone);
    }
  }

  // Diff the working set against the originals for accurate counts.
  const changed = people.filter((p) => !p._new && (
    p.email !== p._origEmail || p.phone !== p._origPhone || p.last_name !== p._origLast || p.notes !== p._origNotes));
  const created = people.filter((p) => p._new);
  const phonesAdded = changed.filter((p) => !hasPhone(p._origPhone) && hasPhone(p.phone)).length;
  const phonesUpdated = changed.filter((p) => hasPhone(p._origPhone) && digitsOf(p._origPhone) !== digitsOf(p.phone)).length;
  const emailsAdded = changed.filter((p) => !normEmail(p._origEmail) && normEmail(p.email)).length;
  const emailsUpdated = changed.filter((p) => normEmail(p._origEmail) && normEmail(p._origEmail) !== normEmail(p.email)).length;

  if (!dryRun && (changed.length || created.length)) {
    db.exec('BEGIN');
    try {
      const upd = db.prepare('UPDATE clients SET last_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?');
      for (const p of changed) upd.run(str(p.last_name, 100), str(p.email, 200), str(p.phone, 50), str(p.notes, 2000), p.id);
      const ins = db.prepare('INSERT INTO clients (first_name, last_name, email, phone, notes) VALUES (?, ?, ?, ?, ?)');
      for (const p of created) ins.run(str(p.first_name, 100), str(p.last_name, 100), str(p.email, 200), str(p.phone, 50), str(p.notes, 2000));
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
  }

  return {
    dryRun, enrich, updateContacts, addNew,
    created: created.length, updated: changed.length, matchedNoChange, invalid, ambiguous,
    phonesAdded, phonesUpdated, emailsAdded, emailsUpdated,
    unmatched: unmatched.length, unmatchedSample: unmatched.slice(0, 12),
    existingBefore: people.length - created.length,
    totalAfter: people.length,
    // Legacy keys kept so anything reading the old shape still works.
    imported: created.length, skipped: matchedNoChange,
  };
}

// Smart client import / re-import (CSV rows already parsed by the browser).
route('POST', '/api/clients/import', async ({ req }) => {
  const { rows, dryRun = false, enrich = true, updateContacts = false, addNew = true } = await readJson(req);
  if (!Array.isArray(rows)) throw httpError(400, 'Expected { rows: [...] }');
  if (rows.length > 5000) throw httpError(400, 'Import is limited to 5000 rows at a time');
  return matchAndEnrich(rows, { enrich, updateContacts, addNew, dryRun });
});

// Parse an uploaded spreadsheet (.xlsx) into { headers, records } so the import
// / contact-sync wizard can map its columns. Reading the real Excel file avoids
// the phone-number corruption a CSV round-trip through Excel causes (a dropped
// leading 0, or "0412…" becoming 4.12E+11).
route('POST', '/api/clients/parse-sheet', async ({ req }) => {
  const { dataBase64 } = await readJson(req);
  if (!dataBase64 || typeof dataBase64 !== 'string') throw httpError(400, 'Expected { dataBase64 }');
  let buf;
  try { buf = Buffer.from(dataBase64, 'base64'); } catch { throw httpError(400, 'Could not read the uploaded file'); }
  if (!buf.length) throw httpError(400, 'The uploaded file is empty');
  if (buf.length > 8 * 1024 * 1024) throw httpError(413, 'Spreadsheet is too large (max 8 MB)');
  const { headers, records } = parseXlsx(buf);
  if (!headers.length) throw httpError(400, 'No rows found in the spreadsheet — check it has a header row and data');
  return { headers, records: records.slice(0, 5000) };
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

route('GET', '/api/services', async ({ query }) => {
  const all = query.get('all') === '1';
  return db.prepare(`SELECT * FROM services ${all ? '' : 'WHERE active = 1'} ORDER BY category, name`).all();
});

const PRICE_TYPE_LABEL = { fixed: 'Fixed', from: 'From', free: 'Free' };

route('GET', '/api/services/export', async ({ res }) => {
  const rows = db.prepare('SELECT name, category, duration_min, price_cents, price_type, description FROM services ORDER BY category, name').all()
    .map((r) => ({ ...r, price: (r.price_cents / 100).toFixed(2), price_type_label: PRICE_TYPE_LABEL[r.price_type] || 'Fixed' }));
  const csv = toCsv(
    [
      { key: 'name', label: 'Service' }, { key: 'category', label: 'Category' },
      { key: 'duration_min', label: 'Duration (min)' }, { key: 'price', label: 'Price' },
      { key: 'price_type_label', label: 'Price Type' }, { key: 'description', label: 'Description' },
    ],
    rows
  );
  sendText(res, 200, csv, 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="services.csv"' });
});

const PRICE_TYPES = new Set(['fixed', 'from', 'free']);

function serviceBody(b) {
  checkBody(b, SERVICE_SCHEMA);
  const name = str(b.name, 200);
  if (!name) throw httpError(400, 'Service name is required');
  const duration = clampInt(b.duration_min, 5, 24 * 60, NaN);
  if (Number.isNaN(duration)) throw httpError(400, 'Duration must be a number of minutes');
  const priceType = PRICE_TYPES.has(b.price_type) ? b.price_type : 'fixed';
  let cents = b.price_cents;
  if (cents == null && b.price != null) cents = Math.round(parseFloat(String(b.price).replace(/[^0-9.\-]/g, '')) * 100);
  cents = Number.isFinite(Number(cents)) ? Math.max(0, Math.round(Number(cents))) : NaN;
  if (priceType === 'free') cents = 0; // "Free" services never carry a price
  else if (Number.isNaN(cents)) throw httpError(400, 'Price must be a number');
  return [name, str(b.category, 100) || 'General', duration, cents, priceType, str(b.description, 1000)];
}

route('POST', '/api/services', async ({ req }) => {
  const info = db.prepare(
    'INSERT INTO services (name, category, duration_min, price_cents, price_type, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(...serviceBody(await readJson(req)));
  return db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid);
});

route('PUT', '/api/services/:id', async ({ req, params }) => {
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(params.id);
  if (!existing) throw httpError(404, 'Service not found');
  const b = await readJson(req);
  db.prepare(
    'UPDATE services SET name = ?, category = ?, duration_min = ?, price_cents = ?, price_type = ?, description = ?, active = ? WHERE id = ?'
  ).run(...serviceBody(b), b.active === undefined ? existing.active : (b.active ? 1 : 0), params.id);
  return db.prepare('SELECT * FROM services WHERE id = ?').get(params.id);
});

route('DELETE', '/api/services/:id', async ({ params }) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM appointments WHERE service_id = ?').get(params.id).n;
  if (used > 0) {
    db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(params.id);
    return { ok: true, deactivated: true };
  }
  db.prepare('DELETE FROM services WHERE id = ?').run(params.id);
  return { ok: true };
});

route('POST', '/api/services/import', async ({ req }) => {
  const { rows } = await readJson(req);
  if (!Array.isArray(rows)) throw httpError(400, 'Expected { rows: [...] }');
  if (rows.length > 2000) throw httpError(400, 'Import is limited to 2000 rows at a time');
  const dupe = db.prepare('SELECT id FROM services WHERE name = ? AND category = ?');
  const ins = db.prepare('INSERT INTO services (name, category, duration_min, price_cents, price_type, description) VALUES (?, ?, ?, ?, ?, ?)');
  let imported = 0, skipped = 0, invalid = 0;
  for (const raw of rows) {
    let fields;
    try { fields = serviceBody(normalizePriceTypeImport(raw)); } catch { invalid++; continue; }
    if (dupe.get(fields[0], fields[1])) { skipped++; continue; }
    ins.run(...fields);
    imported++;
  }
  return { imported, skipped, invalid };
});

// Accepts a "Price Type" column as free text (Fixed/From/Free, any case, or
// a bare "from $85" / "free" in the price cell) so imports from other tools
// don't need an exact match.
function normalizePriceTypeImport(raw) {
  const row = { ...raw };
  const typeCell = str(row.price_type, 30).toLowerCase();
  if (typeCell.startsWith('from')) row.price_type = 'from';
  else if (typeCell.startsWith('free') || typeCell === '0' || typeCell === 'no') row.price_type = 'free';
  else if (typeCell.startsWith('fix')) row.price_type = 'fixed';
  else {
    const priceCell = str(row.price ?? row.price_cents, 40).toLowerCase();
    if (priceCell.startsWith('from')) { row.price_type = 'from'; row.price = priceCell.replace(/from/i, ''); }
    else if (/^(free|0(\.00?)?)$/.test(priceCell.trim())) row.price_type = 'free';
  }
  return row;
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

const APPT_SELECT = `
  SELECT a.*,
    c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS client_name,
    c.phone AS client_phone, c.email AS client_email,
    -- The client's standing notes (allergies, colour formulas, preferences) so
    -- the calendar can surface them before the appointment starts. Owner-only.
    c.notes AS client_notes,
    s.name AS staff_name, s.color AS staff_color,
    sv.name AS service_name, sv.price_cents AS service_price_cents,
    (SELECT group_concat(nm, ' + ') FROM (
       SELECT sv2.name AS nm FROM appointment_services aps
       JOIN services sv2 ON sv2.id = aps.service_id
       WHERE aps.appointment_id = a.id ORDER BY aps.sort_order, aps.id
     )) AS services_summary,
    (SELECT group_concat(sid) FROM (
       SELECT aps.service_id AS sid FROM appointment_services aps
       WHERE aps.appointment_id = a.id ORDER BY aps.sort_order, aps.id
     )) AS service_ids_csv,
    (SELECT COUNT(*) FROM appointment_services aps WHERE aps.appointment_id = a.id) AS service_count,
    (SELECT i.id FROM invoices i WHERE i.appointment_id = a.id AND i.status != 'void' LIMIT 1) AS invoice_id
  FROM appointments a
  LEFT JOIN clients c ON c.id = a.client_id
  LEFT JOIN staff s ON s.id = a.staff_id
  LEFT JOIN services sv ON sv.id = a.service_id`;

/** Full ordered service list for an appointment (with pricing/duration). */
function apptServiceRows(apptId) {
  return db.prepare(
    `SELECT sv.id, sv.name, sv.price_cents, sv.price_type, sv.duration_min
     FROM appointment_services aps JOIN services sv ON sv.id = aps.service_id
     WHERE aps.appointment_id = ? ORDER BY aps.sort_order, aps.id`
  ).all(apptId);
}

/** Replace an appointment's service list with the given ordered ids. */
function setApptServices(apptId, serviceIds) {
  db.prepare('DELETE FROM appointment_services WHERE appointment_id = ?').run(apptId);
  const ins = db.prepare('INSERT INTO appointment_services (appointment_id, service_id, sort_order) VALUES (?, ?, ?)');
  serviceIds.forEach((sid, i) => ins.run(apptId, sid, i));
}

/**
 * Resolve a validated list of services from a request body. Accepts a
 * `service_ids` array (multi-service) or falls back to a single `service_id`.
 * Returns { ids:[], services:[], primaryId, totalDuration } — ids/services in
 * booking order, primaryId the first (kept on appointments.service_id).
 */
function resolveServices(body, { required = false, allowInactive = false } = {}) {
  let ids = [];
  if (Array.isArray(body.service_ids) && body.service_ids.length) {
    ids = body.service_ids.map((v) => Number(v)).filter(Boolean);
  } else if (body.service_id) {
    ids = [Number(body.service_id)];
  }
  const services = [];
  for (const id of ids) {
    const svc = allowInactive
      ? db.prepare('SELECT * FROM services WHERE id = ?').get(id)
      : db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(id);
    if (!svc) throw httpError(400, 'One of the chosen services is unavailable');
    services.push(svc);
  }
  if (required && !services.length) throw httpError(400, 'Choose at least one service');
  return {
    ids: services.map((s) => s.id),
    services,
    primaryId: services[0]?.id || null,
    totalDuration: services.reduce((sum, s) => sum + s.duration_min, 0),
  };
}

route('GET', '/api/appointments', async ({ query }) => {
  const from = query.get('from'), to = query.get('to');
  const conds = [], args = [];
  if (isDateStr(from)) { conds.push('a.date >= ?'); args.push(from); }
  if (isDateStr(to)) { conds.push('a.date <= ?'); args.push(to); }
  const staffId = Number(query.get('staff_id'));
  if (staffId) { conds.push('a.staff_id = ?'); args.push(staffId); }
  const status = query.get('status');
  if (status && APPT_STATUSES.has(status)) { conds.push('a.status = ?'); args.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return db.prepare(`${APPT_SELECT} ${where} ORDER BY a.date, a.start_min LIMIT 2000`).all(...args);
});

function findConflict(staffId, date, startMin, endMin, excludeId = 0) {
  return db.prepare(
    `${APPT_SELECT}
     WHERE a.staff_id = ? AND a.date = ? AND a.id != ?
       AND a.status NOT IN ('cancelled', 'no_show')
       AND a.start_min < ? AND a.end_min > ?
     LIMIT 1`
  ).get(staffId, date, excludeId, endMin, startMin);
}

// ---------------------------------------------------------------------------
// Blocked time — owner-only periods that online booking must skip
// ---------------------------------------------------------------------------

/** Blocks covering one staff member on one date (a NULL staff_id = whole team). */
function blocksFor(staffId, date) {
  return db.prepare(
    'SELECT start_min, end_min FROM time_blocks WHERE date = ? AND (staff_id IS NULL OR staff_id = ?)'
  ).all(date, staffId);
}

/** The first block a proposed appointment would run into, if any. */
function findBlockConflict(staffId, date, startMin, endMin) {
  return db.prepare(
    `SELECT * FROM time_blocks
     WHERE date = ? AND (staff_id IS NULL OR staff_id = ?)
       AND start_min < ? AND end_min > ?
     LIMIT 1`
  ).get(date, staffId, endMin, startMin);
}

const BLOCK_SCHEMA = {
  staff_id: s.num(), date: s.str(10, { required: true }),
  start_min: s.num({ min: 0, max: 1439, required: true }),
  end_min: s.num({ min: 1, max: 1440, required: true }),
  reason: s.str(500),
};

async function blockBody(req) {
  const b = checkBody(await readJson(req), BLOCK_SCHEMA);
  if (!isDateStr(b.date)) throw httpError(400, 'Date must be YYYY-MM-DD');
  const start = clampInt(b.start_min, 0, 1439, NaN);
  const end = clampInt(b.end_min, 1, 1440, NaN);
  if (Number.isNaN(start) || Number.isNaN(end)) throw httpError(400, 'Start and end times are required');
  if (end <= start) throw httpError(400, 'The end time must be after the start time');
  // staff_id 0 / missing = every team member.
  const staffId = Number(b.staff_id) || 0;
  if (staffId && !db.prepare('SELECT id FROM staff WHERE id = ?').get(staffId)) throw httpError(400, 'Unknown team member');
  return [staffId || null, b.date, start, end, str(b.reason, 500)];
}

route('GET', '/api/time-blocks', async ({ query }) => {
  const from = query.get('from'), to = query.get('to');
  const conds = [], args = [];
  if (isDateStr(from)) { conds.push('b.date >= ?'); args.push(from); }
  if (isDateStr(to)) { conds.push('b.date <= ?'); args.push(to); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return db.prepare(
    `SELECT b.*, st.name AS staff_name FROM time_blocks b
     LEFT JOIN staff st ON st.id = b.staff_id
     ${where} ORDER BY b.date, b.start_min LIMIT 2000`
  ).all(...args);
});

route('POST', '/api/time-blocks', async ({ req }) => {
  const fields = await blockBody(req);
  const info = db.prepare(
    'INSERT INTO time_blocks (staff_id, date, start_min, end_min, reason) VALUES (?, ?, ?, ?, ?)'
  ).run(...fields);
  return db.prepare('SELECT * FROM time_blocks WHERE id = ?').get(info.lastInsertRowid);
});

route('PUT', '/api/time-blocks/:id', async ({ req, params }) => {
  if (!db.prepare('SELECT id FROM time_blocks WHERE id = ?').get(params.id)) throw httpError(404, 'Block not found');
  db.prepare(
    'UPDATE time_blocks SET staff_id = ?, date = ?, start_min = ?, end_min = ?, reason = ? WHERE id = ?'
  ).run(...(await blockBody(req)), params.id);
  return db.prepare('SELECT * FROM time_blocks WHERE id = ?').get(params.id);
});

route('DELETE', '/api/time-blocks/:id', async ({ params }) => {
  db.prepare('DELETE FROM time_blocks WHERE id = ?').run(params.id);
  return { ok: true };
});

async function apptBody(req) {
  const b = checkBody(await readJson(req), APPT_SCHEMA);
  const staffId = Number(b.staff_id);
  if (!db.prepare('SELECT id FROM staff WHERE id = ?').get(staffId)) throw httpError(400, 'Choose a staff member');
  if (!isDateStr(b.date)) throw httpError(400, 'Date must be YYYY-MM-DD');
  const start = clampInt(b.start_min, 0, 1439, NaN);
  if (Number.isNaN(start)) throw httpError(400, 'Start time is required');

  // Multi-service: `service_ids` (ordered) wins; else the legacy `service_id`.
  // The first is stored as the appointment's primary service for back-compat.
  // `serviceIds === null` means the caller didn't send a service list at all
  // (e.g. a drag/resize) — leave the existing services untouched in that case.
  const svc = resolveServices(b, { allowInactive: true });
  const sentServices = Array.isArray(b.service_ids) || b.service_id != null;
  const serviceId = svc.primaryId;
  let end = clampInt(b.end_min, start + 5, 1440, NaN);
  if (Number.isNaN(end)) end = start + (svc.totalDuration || 30);

  let clientId = Number(b.client_id) || null;
  if (!clientId && b.new_client && str(b.new_client.first_name)) {
    const info = db.prepare('INSERT INTO clients (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)')
      .run(str(b.new_client.first_name, 100), str(b.new_client.last_name, 100),
           str(b.new_client.email, 200).toLowerCase(), str(b.new_client.phone, 50));
    clientId = Number(info.lastInsertRowid);
  }

  const status = APPT_STATUSES.has(b.status) ? b.status : 'booked';
  return { b, staffId, date: b.date, start, end, serviceId, serviceIds: svc.ids, sentServices, clientId, status, notes: str(b.notes, 2000) };
}

route('POST', '/api/appointments', async ({ req }) => {
  const a = await apptBody(req);
  const conflict = findConflict(a.staffId, a.date, a.start, a.end);
  if (conflict && !a.b.force) {
    throw Object.assign(httpError(409, 'This time overlaps another appointment'), { data: { conflict } });
  }
  const block = findBlockConflict(a.staffId, a.date, a.start, a.end);
  if (block && !a.b.force) {
    throw Object.assign(httpError(409, 'This time is blocked out'), { data: { block } });
  }
  const info = db.prepare(
    `INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'staff')`
  ).run(a.clientId, a.staffId, a.serviceId, a.date, a.start, a.end, a.status, a.notes);
  const apptId = Number(info.lastInsertRowid);
  if (a.serviceIds.length) setApptServices(apptId, a.serviceIds);
  carryNoteToClient(a.clientId, a.notes, a.date);
  // The owner decides whether this booking is announced. Booking someone in
  // while they're standing at the counter doesn't need an email a second later,
  // and one made from a phone call might be better confirmed by text. The
  // reminder is a standing setting and is scheduled either way.
  const tell = a.b.notify_client !== false;
  queueAppointmentMessages(apptId, { confirmation: tell, reminder: true, channels: chosenChannel(a.b) });
  processQueue().catch(() => {});
  return {
    ...db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(apptId),
    client_notified: tell && countMessages(apptId, 'confirmation') > 0,
  };
});

/** How many messages of a kind exist for an appointment — "was it really sent?" */
function countMessages(apptId, kind, since = 0) {
  return db.prepare(
    'SELECT COUNT(*) AS n FROM messages WHERE appointment_id = ? AND kind = ? AND id > ?'
  ).get(apptId, kind, since).n;
}

/**
 * Carry an appointment's note onto the client's own record.
 *
 * A note written on the booking ("wants to go shorter next time", "reacted to
 * the toner") is about the person, not the hour — but it was only ever visible
 * on that one appointment, so by the next visit it was effectively lost. This
 * appends it to their profile, dated by the visit it came from, so it turns up
 * on every future booking with them.
 *
 * Only ever adds. The same note re-sent by a drag, a resize or an edit is
 * matched and skipped, so a note cannot accumulate copies of itself. The
 * client's own notes field is never rewritten or reordered — anything the owner
 * typed there by hand stays exactly where they put it.
 */
const CLIENT_NOTES_CAP = 2000;

function carryNoteToClient(clientId, note, whenDate) {
  const text = str(note, 500).trim();
  if (!clientId || !text) return false;
  const client = db.prepare('SELECT notes FROM clients WHERE id = ?').get(clientId);
  if (!client) return false;
  const existing = String(client.notes || '');
  // Already carried across (or the owner typed the same thing themselves).
  if (existing.includes(text)) return false;

  const stamp = isDateStr(whenDate)
    ? new Date(`${whenDate}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const line = stamp ? `${stamp} — ${text}` : text;
  const merged = existing ? `${existing}\n${line}` : line;
  if (merged.length > CLIENT_NOTES_CAP) {
    // Keep the newest notes: drop whole lines off the front until it fits, so
    // the field never silently truncates mid-sentence.
    const lines = merged.split('\n');
    while (lines.length > 1 && lines.join('\n').length > CLIENT_NOTES_CAP) lines.shift();
    db.prepare('UPDATE clients SET notes = ? WHERE id = ?').run(lines.join('\n').slice(-CLIENT_NOTES_CAP), clientId);
  } else {
    db.prepare('UPDATE clients SET notes = ? WHERE id = ?').run(merged, clientId);
  }
  return true;
}

route('PUT', '/api/appointments/:id', async ({ req, params }) => {
  const before = db.prepare('SELECT * FROM appointments WHERE id = ?').get(params.id);
  if (!before) throw httpError(404, 'Appointment not found');
  const a = await apptBody(req);
  const conflict = findConflict(a.staffId, a.date, a.start, a.end, params.id);
  if (conflict && !a.b.force) {
    throw Object.assign(httpError(409, 'This time overlaps another appointment'), { data: { conflict } });
  }
  const block = findBlockConflict(a.staffId, a.date, a.start, a.end);
  if (block && !a.b.force) {
    throw Object.assign(httpError(409, 'This time is blocked out'), { data: { block } });
  }
  // Only overwrite the service list when the caller sent one. A drag/resize
  // sends just the primary service_id (or none), so we keep the existing
  // multi-service rows intact rather than flattening them to one.
  const serviceId = a.sentServices ? a.serviceId : before.service_id;
  // Setting Status to Cancelled in the editor IS a cancellation, so it takes
  // the same path as the Cancel button — including the owner's choice about
  // whether the client hears about it, and the undo window that follows.
  //
  // The status is deliberately left alone in this write: cancelAppointment
  // reads the row to work out what the booking is coming FROM. Writing
  // 'cancelled' here first made it find a booking that was already cancelled,
  // so it returned early and nobody — client or owner — was ever told.
  const cancelling = a.status === 'cancelled' && before.status !== 'cancelled';
  db.prepare(
    `UPDATE appointments SET client_id = ?, staff_id = ?, service_id = ?, date = ?, start_min = ?, end_min = ?, status = ?, notes = ?
     WHERE id = ?`
  ).run(a.clientId, a.staffId, serviceId, a.date, a.start, a.end,
    cancelling ? before.status : a.status, a.notes, params.id);
  if (Array.isArray(a.b.service_ids)) setApptServices(params.id, a.serviceIds);
  carryNoteToClient(a.clientId, a.notes, a.date);
  if (cancelling) {
    return cancelAppointment(params.id, { by: 'owner', notifyClient: a.b.notify_client !== false });
  }
  // A move is the change a client most needs to hear about, and until now it
  // was the one nobody told them about: the reminder was re-queued for the new
  // time and that was all, so a client rung up and moved on the owner's say-so
  // was fine, but one moved quietly still had the old time in writing.
  const moved = before.date !== a.date || before.start_min !== a.start;
  let rescheduleSent = 0;
  if (['cancelled', 'no_show', 'completed'].includes(a.status)) {
    cancelQueuedMessages(params.id);
    if (a.status === 'completed' && before.status !== 'completed') queueReviewRequest(params.id);
  } else if (moved) {
    requeueAppointmentMessages(params.id); // rescheduled → fresh reminder
    if (a.b.notify_client !== false) {
      // After the requeue, which skips everything still pending — otherwise
      // this notice is swept away along with the stale reminder.
      rescheduleSent = queueRescheduleMessage(params.id, {
        from: { date: before.date, start_min: before.start_min },
        channels: chosenChannel(a.b),
      });
      processQueue().catch(() => {});
    }
  }
  return {
    ...db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(params.id),
    moved,
    client_notified: rescheduleSent > 0,
  };
});

route('PATCH', '/api/appointments/:id/status', async ({ req, params }) => {
  const b = checkBody(await readJson(req), {
    status: s.oneOf(['booked', 'confirmed', 'completed', 'cancelled', 'no_show'], { required: true }),
    notify_client: s.bool(),
  });
  const { status } = b;
  if (!APPT_STATUSES.has(status)) throw httpError(400, 'Invalid status');
  const before = db.prepare('SELECT status FROM appointments WHERE id = ?').get(params.id);
  if (status === 'cancelled' && before?.status !== 'cancelled') {
    const out = cancelAppointment(params.id, { by: 'owner', notifyClient: b.notify_client !== false });
    if (!out) throw httpError(404, 'Appointment not found');
    return out;
  }
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, params.id);
  if (['cancelled', 'no_show', 'completed'].includes(status)) {
    cancelQueuedMessages(params.id);
    if (status === 'completed' && before?.status !== 'completed') queueReviewRequest(params.id);
  }
  return db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(params.id);
});

/**
 * The one way an appointment gets cancelled — used by the owner's calendar, a
 * status change to "cancelled", and the client's own cancel link.
 *
 * Cancelling and deleting were separate actions doing practically the same
 * job, except deleting threw away the history and told nobody. Now there is a
 * single path: the booking stays on record marked cancelled, its pending
 * reminders are dropped, both sides are emailed, and the slot is immediately
 * bookable again — availability already ignores cancelled bookings, so the
 * time reopens the moment this runs.
 *
 * Returns null if there was nothing to cancel, so callers can 404 honestly.
 */
/**
 * How long the client's cancellation message is held back when the OWNER
 * cancels, so an undo can catch it before it goes.
 *
 * Cancelling is one tap next to a diary full of other taps, and the message it
 * sends cannot be recalled once a client has read it. Holding it briefly costs
 * the client nothing — they hear a minute later — and turns a misfire from an
 * apologetic phone call into a button. A client who cancels themselves is never
 * held: they asked for it and want the receipt now.
 *
 * Two minutes, not one, because the queue's send_after is stored to the minute:
 * a 60-second hold applied at 10:30:59 lands on "10:31" and goes out a second
 * later. At 120 the worst case is still just over a minute of cover, which is
 * comfortably longer than the undo is offered for.
 */
const CANCEL_HOLD_SECONDS = 120;

function cancelAppointment(id, { by = 'owner', reason = '', notifyClient = true } = {}) {
  const a = db.prepare('SELECT id, status FROM appointments WHERE id = ?').get(id);
  if (!a) return null;
  const already = a.status === 'cancelled';
  const holdSeconds = by === 'client' ? 0 : CANCEL_HOLD_SECONDS;
  const lastMsgId = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM messages').get().m;
  if (!already) {
    db.prepare(
      `UPDATE appointments SET status = 'cancelled', prev_status = ?, cancelled_at = ?,
         cancelled_by = ?, cancel_reason = ? WHERE id = ?`
    ).run(a.status, new Date().toISOString().slice(0, 19).replace('T', ' '),
      by === 'client' ? 'client' : 'owner', str(reason, 300), id);
    cancelQueuedMessages(id);          // no reminder for a visit that isn't happening
    queueCancellationMessages(id, { by, notifyClient, holdSeconds });
    // The slot is free again — tell anyone waiting for it. Deliberately after
    // the cancellation is committed and wrapped so it can never be the reason
    // an appointment fails to cancel: a broken waitlist must cost the owner an
    // offer, not the ability to cancel a booking.
    try {
      const full = db.prepare(
        `SELECT a.date, a.start_min, a.staff_id, a.service_id, sv.name AS service_name
         FROM appointments a LEFT JOIN services sv ON sv.id = a.service_id WHERE a.id = ?`
      ).get(id);
      if (full && full.date >= bizToday()) {
        offerFreedSlot({
          date: full.date, startMin: full.start_min, staffId: full.staff_id,
          serviceId: full.service_id, serviceName: full.service_name,
          skipClients: recentlyMessagedSet(),
        });
      }
    } catch (err) {
      console.error('waitlist offer failed (cancellation still went through):', err.message);
    }
  }
  // Whether the client was actually told — counted, not assumed. Asking for a
  // message doesn't create a way to send one: a walk-in with no email or phone
  // gets nothing, and the owner must never be left thinking otherwise.
  const clientTold = db.prepare(
    "SELECT COUNT(*) AS n FROM messages WHERE appointment_id = ? AND kind = 'cancellation' AND id > ?"
  ).get(id, lastMsgId).n > 0;
  return {
    ...db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(id),
    already_cancelled: already,
    client_notified: clientTold,
    // How long the owner has to change their mind before the client is told.
    undo_seconds: already || !clientTold ? 0 : holdSeconds,
  };
}

/**
 * Put a cancelled appointment back exactly as it was.
 *
 * Two things have to be true for this to be safe, and both are checked rather
 * than assumed: the slot must still be free (the booking page reopened it the
 * moment it was cancelled, so a customer may have taken it), and we must be
 * honest about whether the client already heard. If the held message has gone
 * out, restoring the appointment quietly would leave the owner believing the
 * client still expects them.
 */
function undoCancellation(id) {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  if (!a) return null;
  if (a.status !== 'cancelled') throw httpError(400, 'That appointment is not cancelled');

  // Did anyone take the slot while it was free?
  const clash = db.prepare(
    `SELECT id FROM appointments WHERE staff_id = ? AND date = ? AND id != ?
       AND status NOT IN ('cancelled', 'no_show') AND start_min < ? AND end_min > ?`
  ).get(a.staff_id, a.date, a.id, a.end_min, a.start_min);
  if (clash) {
    throw httpError(409, 'That time has been booked by someone else since you cancelled — rebook it instead.');
  }

  // Held messages that haven't gone yet are dropped; anything already sent is
  // reported back so the owner knows to make a phone call.
  const pending = db.prepare(
    "SELECT COUNT(*) AS n FROM messages WHERE appointment_id = ? AND kind = 'cancellation' AND status = 'queued'"
  ).get(id).n;
  const alreadySent = db.prepare(
    "SELECT COUNT(*) AS n FROM messages WHERE appointment_id = ? AND kind = 'cancellation' AND status = 'sent'"
  ).get(id).n;

  db.prepare(
    `UPDATE appointments SET status = ?, prev_status = '', cancelled_at = '', cancelled_by = '', cancel_reason = ''
     WHERE id = ?`
  ).run(APPT_STATUSES.has(a.prev_status) && a.prev_status !== 'cancelled' ? a.prev_status : 'booked', id);

  requeueAppointmentMessages(id);      // the reminder comes back with it
  return {
    ...db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(id),
    restored: true,
    held_messages_stopped: pending,
    client_already_told: alreadySent > 0,
  };
}

// Kept as DELETE so existing callers keep working, but it cancels rather than
// erases: same outcome for the calendar, without losing the record or the
// chance to tell the client.
route('DELETE', '/api/appointments/:id', async ({ params, query }) => {
  // ?notify=0 for a quiet cancellation — a DELETE carries no body, so the
  // choice has to live in the query string.
  const out = cancelAppointment(params.id, { by: 'owner', notifyClient: query.get('notify') !== '0' });
  if (!out) throw httpError(404, 'Appointment not found');
  return { ok: true, cancelled: true, appointment: out };
});

// Undo an owner's cancellation. Deliberately a separate route rather than a
// status PATCH: it has to check the slot is still free and report what the
// client was already told, which a plain status change would skip.
route('POST', '/api/appointments/:id/undo-cancel', async ({ params }) => {
  const out = undoCancellation(params.id);
  if (!out) throw httpError(404, 'Appointment not found');
  processQueue().catch(() => {});
  return out;
});

route('POST', '/api/appointments/:id/cancel', async ({ req, params }) => {
  const b = checkBody(await readJson(req), { reason: s.str(300), notify_client: s.bool() });
  // Telling the client is the default; the owner opts out per cancellation
  // when they'd rather say it themselves.
  const out = cancelAppointment(params.id, {
    by: 'owner',
    reason: b.reason || '',
    notifyClient: b.notify_client !== false,   // schema guarantees a real boolean or absent
  });
  if (!out) throw httpError(404, 'Appointment not found');
  return out;
});

// ---------------------------------------------------------------------------
// Messages (confirmations & reminders log)
// ---------------------------------------------------------------------------

route('GET', '/api/messages', async ({ query }) => {
  const conds = [], args = [];
  const status = query.get('status');
  if (status && ['queued', 'sent', 'failed', 'skipped'].includes(status)) {
    conds.push('m.status = ?'); args.push(status);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  // led_to_cents / led_to_bookings: what this exact message produced. A left
  // join rather than a lookup per row, so the log stays one query however long
  // it gets. Cancelled bookings are excluded — a booking that was cancelled
  // recovered nothing, and counting it would flatter every campaign.
  return db.prepare(
    `SELECT m.*, c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS client_name,
            a.date AS appt_date, a.start_min AS appt_start,
            COALESCE(led.n, 0)     AS led_to_bookings,
            COALESCE(led.cents, 0) AS led_to_cents
     FROM messages m
     LEFT JOIN clients c ON c.id = m.client_id
     LEFT JOIN appointments a ON a.id = m.appointment_id
     LEFT JOIN (
       SELECT b.source_message_id AS mid, COUNT(*) AS n, COALESCE(SUM(sv.price_cents), 0) AS cents
         FROM appointments b
         LEFT JOIN services sv ON sv.id = b.service_id
        WHERE b.source_message_id IS NOT NULL AND b.status != 'cancelled'
        GROUP BY b.source_message_id
     ) led ON led.mid = m.id
     ${where} ORDER BY m.id DESC LIMIT 300`
  ).all(...args);
});

// ---------------------------------------------------------------------------
// Marketing automations
// ---------------------------------------------------------------------------

route('GET', '/api/automations', async () => ({
  automations: listAutomations(),
  // Email is free but Resend's free tier stops at 100 a day, so an owner
  // choosing "email" for a big list needs to know it will spread out.
  sent_today: db.prepare(
    "SELECT COUNT(*) AS n FROM automation_sends WHERE substr(created_at, 1, 10) = date('now')"
  ).get().n,
}));

route('PUT', '/api/automations/:kind', async ({ req, params }) => {
  const b = await readJson(req);
  return saveAutomation(params.kind, b);
});

/**
 * Who this would reach, before it is switched on.
 *
 * The same function the runner uses, so what an owner approves is what
 * actually happens. Nothing is queued — this only looks.
 */
route('GET', '/api/automations/:kind/preview', async ({ params }) => {
  const conf = getAutomation(params.kind);
  if (!conf) throw httpError(404, 'Unknown automation');
  const found = candidatesFor(params.kind, { limit: 25 });
  return {
    ...conf,
    ...found,
    // What one run would actually cost, at today's cap.
    cost: messageCost(conf.body, conf.channel,
      found.eligible.slice(0, conf.max_per_day).map((c) => ({ phone: c.phone }))),
    example: fillTokens(conf.body, {
      firstName: found.eligible[0]?.first_name || 'Sam',
      token: 'EXAMPLE',
      businessName: getSetting('business_name', ''),
    }),
  };
});

/** Run one now, rather than waiting for tomorrow morning. */
route('POST', '/api/automations/:kind/run', async ({ req, params }) => {
  const b = await readJson(req).catch(() => ({}));
  return runAutomation(params.kind, { dryRun: b?.dry_run === true });
});

/**
 * What the messages actually earned, by kind.
 *
 * Only bookings traced to a message by its own token — never "they booked
 * sometime after we texted", which is the number every marketing tool quotes
 * and none of them can defend.
 */
route('GET', '/api/attribution', async ({ query }) => {
  const since = isDateStr(query.get('since')) ? query.get('since') : '';
  const rows = attributionSummary({ since, kind: query.get('kind') || '' });
  return {
    since,
    by_kind: rows,
    bookings: rows.reduce((n, r) => n + r.bookings, 0),
    revenue_cents: rows.reduce((n, r) => n + r.revenue_cents, 0),
  };
});

/**
 * The SMS credit left with the provider.
 *
 * Cached for a couple of minutes: this is shown on a settings page and on the
 * Messages page, both of which get opened repeatedly, and the number moves by
 * cents. `?refresh=1` forces a fresh read for the button that says it will.
 */
let smsBalanceCache = { at: 0, key: '', data: null };
const SMS_BALANCE_TTL_MS = 120_000;

route('GET', '/api/sms/balance', async ({ query }) => {
  // Changing the credentials or the provider must not serve the old account's
  // balance back, so they are part of the cache key.
  const key = [getSetting('sms_provider', 'clicksend'), getSetting('clicksend_username'),
    getSetting('clicksend_api_key') ? 'set' : ''].join('|');
  const fresh = query.get('refresh') === '1';
  if (!fresh && smsBalanceCache.data && smsBalanceCache.key === key
      && Date.now() - smsBalanceCache.at < SMS_BALANCE_TTL_MS) {
    return { ...smsBalanceCache.data, cached: true };
  }
  const data = await smsBalance();
  smsBalanceCache = { at: Date.now(), key, data };
  return { ...data, cached: false };
});

// ---------------------------------------------------------------------------
// Backups — getting a copy off this machine
// ---------------------------------------------------------------------------

route('GET', '/api/backup/status', async () => backupStatus());

// ---------------------------------------------------------------------------
// The edge — making a Cloudflare layer actually apply, and keeping bots off
// the one form that is deliberately open
// ---------------------------------------------------------------------------

route('GET', '/api/edge/status', async ({ req }) => ({
  origin: originStatus(req),
  turnstile: { enabled: turnstileEnabled(), site_key: turnstileSiteKey() },
}));

/**
 * Move the lock, with the one check that stops it being a foot-gun.
 *
 * Enforce is only allowed if the request asking for it arrived carrying the
 * header — proof that Cloudflare is already forwarding correctly for this
 * browser, and therefore that the owner will still be able to reach Settings
 * afterwards to turn it back off. Without that check the switch is a coin flip
 * with the business's own admin access on it.
 */
route('POST', '/api/edge/lock-mode', async ({ req }) => {
  const wanted = String((await readJson(req))?.mode || '').trim();
  if (!MODES.includes(wanted)) throw httpError(400, 'Choose Off, Monitor or Enforce.');
  if (wanted !== 'off' && !getSetting('cf_origin_secret', '')) {
    throw httpError(400, 'Generate the Cloudflare secret first — there is nothing to check against yet.');
  }
  if (wanted === 'enforce' && !requestCameViaEdge(req)) {
    throw httpError(400,
      'This request did not come through Cloudflare, so enforcing would lock you out of Settings. '
      + 'Add the header rule in Cloudflare, reload this page through your own domain, and try again.');
  }
  setSetting('origin_lock_mode', wanted);
  return originStatus(req);
});

/**
 * Mint the shared secret here rather than asking the owner to invent one.
 * Returned in full exactly once — it has to be pasted into Cloudflare — and
 * write-only from then on, like every other secret in Settings.
 */
route('POST', '/api/edge/origin-secret', async ({ req }) => {
  const secret = newOriginSecret();
  setSetting('cf_origin_secret', secret);
  resetOriginCounter();
  // Cloudflare is still sending the old value, so enforcing against the new one
  // would shut the door on everybody including the owner. Step back to monitor
  // and let them enforce again once the rule is updated.
  const steppedDown = getSetting('origin_lock_mode', 'off') === 'enforce';
  if (steppedDown) setSetting('origin_lock_mode', 'monitor');
  return {
    secret, header: ORIGIN_HEADER, stepped_down: steppedDown,
    status: originStatus(req),
    instructions: `In Cloudflare → Rules → Transform Rules → Modify Request Header, add a static header `
      + `"${ORIGIN_HEADER}" with this value to every request. Then set the lock to Monitor here, watch `
      + `for a day, and only switch to Enforce once nothing is arriving directly.`,
  };
});

/** Start the count again — after fixing the Cloudflare rule, before enforcing. */
route('POST', '/api/edge/reset-counter', async ({ req }) => { resetOriginCounter(); return originStatus(req); });

/** Download a snapshot right now. Nothing to configure, nothing to remember. */
route('GET', '/api/backup/download', async ({ res }) => {
  const snap = snapshot();
  res.writeHead(200, {
    'Content-Type': 'application/gzip',
    'Content-Disposition': `attachment; filename="${snap.filename}"`,
    'Content-Length': snap.buffer.length,
    'Cache-Control': 'no-store',
  });
  res.end(snap.buffer);
});

/** Send one now, so the owner can see the whole path works before trusting it. */
route('POST', '/api/backup/email', async () => {
  const out = await emailBackup({ manual: true });
  return { ...out, status: backupStatus() };
});

route('POST', '/api/messages/:id/retry', async ({ params }) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(params.id);
  if (!msg) throw httpError(404, 'Message not found');
  const result = await deliverMessage(msg);
  return { ok: result.ok, status: result.status, detail: result.detail };
});

route('POST', '/api/messages/test', async ({ req }) => {
  const b = checkBody(await readJson(req), {
    channel: s.oneOf(['email', 'sms']),
    to: s.str(200),
  });
  const channel = b.channel === 'sms' ? 'sms' : 'email';
  const target = str(b.to, 200) || (channel === 'sms' ? getSetting('business_phone') : getSetting('business_email'));
  if (!target) throw httpError(400, 'No destination — set your business email/phone first');
  const testHtml = channel === 'email' ? renderEmail({
    heading: 'Your notifications are working!',
    greeting: 'Hi there,',
    paragraphs: [
      `This is a test from ${getSetting('business_name', 'Kairo')}. If you're reading this, your email setup is live —`
      + ' confirmations, reminders, receipts and review requests will look just like this.',
    ],
    details: [['Status', 'Connected ✓'], ['Sent from', getSetting('notif_from_email', '')]],
  }) : '';
  const info = db.prepare(
    `INSERT INTO messages (channel, kind, to_addr, subject, body, html, status, send_after)
     VALUES (?, 'test', ?, ?, ?, ?, 'queued', '')`
  ).run(channel, target,
        'Kairo test message', `This is a test from ${getSetting('business_name', 'Kairo')} — your notification setup works! 🎉`, testHtml);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
  const result = await deliverMessage(msg);
  return { ok: result.ok, status: result.status, detail: result.detail };
});

// ---------------------------------------------------------------------------
// Invoices & payments
// ---------------------------------------------------------------------------

const INVOICE_SELECT = `
  SELECT i.*,
    c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS client_name,
    c.email AS client_email, c.phone AS client_phone,
    COALESCE((SELECT CAST(ROUND(SUM(qty * unit_cents)) AS INTEGER) FROM invoice_items WHERE invoice_id = i.id), 0) AS subtotal_cents,
    COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id = i.id), 0) AS paid_cents
  FROM invoices i
  LEFT JOIN clients c ON c.id = i.client_id`;

function invoiceTotals(inv) {
  const taxable = Math.max(0, inv.subtotal_cents - inv.discount_cents);
  inv.tax_cents = Math.round(taxable * (inv.tax_rate / 100));
  inv.total_cents = taxable + inv.tax_cents;
  inv.balance_cents = inv.total_cents - inv.paid_cents;
  return inv;
}

function getInvoice(id) {
  const inv = db.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id);
  if (!inv) throw httpError(404, 'Invoice not found');
  inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id);
  inv.payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY paid_at, id').all(id);
  return invoiceTotals(inv);
}

/** Flip a non-void invoice to `paid` when fully covered, back to `sent` otherwise. */
function refreshPaidStatus(id) {
  const inv = db.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id);
  if (!inv || inv.status === 'void' || inv.status === 'draft') return;
  invoiceTotals(inv);
  const next = inv.paid_cents >= inv.total_cents && inv.total_cents > 0 ? 'paid' : 'sent';
  if (next !== inv.status) db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(next, id);
}

route('GET', '/api/invoices', async ({ query }) => {
  const conds = [], args = [];
  const status = query.get('status');
  if (status && INVOICE_STATUSES.has(status)) { conds.push('i.status = ?'); args.push(status); }
  const q = str(query.get('q'), 100);
  if (q) {
    conds.push("(i.number LIKE ? OR c.first_name || ' ' || c.last_name LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = db.prepare(`${INVOICE_SELECT} ${where} ORDER BY i.id DESC LIMIT 500`).all(...args);
  return rows.map(invoiceTotals);
});

route('GET', '/api/invoices/:id', async ({ params }) => getInvoice(params.id));

function writeItems(invoiceId, items) {
  db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_cents) VALUES (?, ?, ?, ?)');
  for (const it of items || []) {
    const desc = str(it.description, 300);
    if (!desc) continue;
    const qty = Math.max(0, Number(it.qty) || 1);
    const cents = Math.max(0, Math.round(Number(it.unit_cents) || 0));
    ins.run(invoiceId, desc, qty, cents);
  }
}

route('POST', '/api/invoices', async ({ req }) => {
  const b = checkBody(await readJson(req), INVOICE_SCHEMA);
  const clientId = Number(b.client_id) || null;
  const issue = isDateStr(b.issue_date) ? b.issue_date : bizToday();
  const dueDays = clampInt(getSetting('invoice_due_days', '7'), 0, 365, 7);
  const due = isDateStr(b.due_date) ? b.due_date : addDays(issue, dueDays);
  const taxRate = Number.isFinite(Number(b.tax_rate)) ? Number(b.tax_rate) : Number(getSetting('tax_rate', '0'));
  const status = INVOICE_STATUSES.has(b.status) ? b.status : 'draft';
  const info = db.prepare(
    `INSERT INTO invoices (number, client_id, appointment_id, issue_date, due_date, status, tax_rate, discount_cents, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(nextInvoiceNumber(), clientId, Number(b.appointment_id) || null, issue, due, status, taxRate,
        Math.max(0, Math.round(Number(b.discount_cents) || 0)), str(b.notes, 2000));
  writeItems(Number(info.lastInsertRowid), b.items);
  return getInvoice(Number(info.lastInsertRowid));
});

route('POST', '/api/invoices/from-appointment', async ({ req }) => {
  const { appointment_id } = checkBody(await readJson(req), { appointment_id: s.num({ required: true }) });
  const appt = db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(Number(appointment_id));
  if (!appt) throw httpError(404, 'Appointment not found');
  if (appt.invoice_id) return getInvoice(appt.invoice_id);
  const issue = bizToday();
  const dueDays = clampInt(getSetting('invoice_due_days', '7'), 0, 365, 7);
  const info = db.prepare(
    `INSERT INTO invoices (number, client_id, appointment_id, issue_date, due_date, status, tax_rate)
     VALUES (?, ?, ?, ?, ?, 'draft', ?)`
  ).run(nextInvoiceNumber(), appt.client_id, appt.id, issue, addDays(issue, dueDays), Number(getSetting('tax_rate', '0')));
  const invId = Number(info.lastInsertRowid);
  // Bill every service on the appointment (multi-service bookings become
  // multiple line items); fall back to the primary service for legacy rows.
  const services = apptServiceRows(appt.id);
  const lineItem = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_cents) VALUES (?, ?, 1, ?)');
  if (services.length) {
    for (const svc of services) lineItem.run(invId, svc.name, svc.price_cents || 0);
  } else if (appt.service_id) {
    lineItem.run(invId, appt.service_name, appt.service_price_cents || 0);
  }
  // an online deposit already collected counts as a payment on this invoice
  if (appt.deposit_status === 'paid' && appt.deposit_cents > 0) {
    db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(invId);
    db.prepare('INSERT INTO payments (invoice_id, amount_cents, method, paid_at, note) VALUES (?, ?, ?, ?, ?)')
      .run(invId, appt.deposit_cents, 'card', `${bizToday()} 00:00:00`, 'Online booking deposit (Stripe)');
    refreshPaidStatus(invId);
  }
  return getInvoice(invId);
});

route('PUT', '/api/invoices/:id', async ({ req, params }) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(params.id);
  if (!existing) throw httpError(404, 'Invoice not found');
  const b = checkBody(await readJson(req), INVOICE_SCHEMA);
  db.prepare(
    'UPDATE invoices SET client_id = ?, issue_date = ?, due_date = ?, tax_rate = ?, discount_cents = ?, notes = ? WHERE id = ?'
  ).run(
    Number(b.client_id) || existing.client_id,
    isDateStr(b.issue_date) ? b.issue_date : existing.issue_date,
    isDateStr(b.due_date) ? b.due_date : existing.due_date,
    Number.isFinite(Number(b.tax_rate)) ? Number(b.tax_rate) : existing.tax_rate,
    Math.max(0, Math.round(Number(b.discount_cents) || 0)),
    str(b.notes, 2000),
    params.id
  );
  if (b.items) writeItems(params.id, b.items);
  refreshPaidStatus(params.id);
  return getInvoice(params.id);
});

route('PATCH', '/api/invoices/:id/status', async ({ req, params }) => {
  const { status } = checkBody(await readJson(req), { status: s.oneOf(['draft', 'sent', 'paid', 'void'], { required: true }) });
  if (!INVOICE_STATUSES.has(status)) throw httpError(400, 'Invalid status');
  if (!db.prepare('SELECT id FROM invoices WHERE id = ?').get(params.id)) throw httpError(404, 'Invoice not found');
  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, params.id);
  if (status === 'sent') refreshPaidStatus(params.id);
  return getInvoice(params.id);
});

route('DELETE', '/api/invoices/:id', async ({ params }) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(params.id);
  return { ok: true };
});

route('POST', '/api/invoices/:id/payments', async ({ req, params }) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(params.id);
  if (!inv) throw httpError(404, 'Invoice not found');
  if (inv.status === 'void') throw httpError(400, 'Cannot record a payment on a void invoice');
  const b = checkBody(await readJson(req), {
    amount_cents: s.num({ min: 1, max: 100_000_000, required: true }),
    method: s.oneOf(['card', 'square', 'cash', 'transfer', 'other']),
    note: s.str(500),
  });
  const amount = Math.round(Number(b.amount_cents));
  if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, 'Payment amount must be positive');
  const method = PAY_METHODS.has(b.method) ? b.method : 'card';
  db.prepare('INSERT INTO payments (invoice_id, amount_cents, method, paid_at, note) VALUES (?, ?, ?, ?, ?)')
    .run(params.id, amount, method, bizStamp(), str(b.note, 500));
  if (inv.status === 'draft') db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(params.id);
  refreshPaidStatus(params.id);
  const updated = getInvoice(params.id);
  queueReceiptMessage(Number(params.id), { amountCents: amount, method, balanceCents: Math.max(0, updated.balance_cents) });
  processQueue().catch(() => {});
  return updated;
});

// ---------------------------------------------------------------------------
// Products (retail inventory sold at the POS counter)
// ---------------------------------------------------------------------------

const PRODUCT_SCHEMA = {
  name: s.str(150, { required: true }),
  category: s.str(80), supplier: s.str(120),
  sku: s.str(60), barcode: s.str(60),
  retail_cents: s.num({ min: 0, max: 100_000_000 }),
  cost_cents: s.num({ min: 0, max: 100_000_000 }),
  stock_qty: s.num({ min: 0, max: 1_000_000 }),
  low_stock_at: s.num({ min: 0, max: 100_000 }),
  image: s.str(900_000), taxable: s.bool(), active: s.bool(),
};

function productBody(b) {
  const image = str(b.image, 900_000);
  if (image && !isImageDataUri(image)) throw httpError(400, 'Product image must be an uploaded image');
  return [
    str(b.name, 150), str(b.category, 80) || 'General', str(b.supplier, 120),
    str(b.sku, 60), str(b.barcode, 60),
    clampInt(b.retail_cents, 0, 100_000_000, 0), clampInt(b.cost_cents, 0, 100_000_000, 0),
    clampInt(b.stock_qty, 0, 1_000_000, 0), clampInt(b.low_stock_at, 0, 100_000, 3),
    image, b.taxable === false ? 0 : 1, b.active === false ? 0 : 1,
  ];
}

route('GET', '/api/products', async ({ query }) => {
  const q = str(query.get('q'), 100);
  const all = query.get('all') === '1'; // include archived
  const conds = all ? [] : ['active = 1'];
  const args = [];
  if (q) {
    conds.push('(name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR category LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM products ${where} ORDER BY category, name LIMIT 1000`).all(...args);
});

route('POST', '/api/products', async ({ req }) => {
  const b = checkBody(await readJson(req), PRODUCT_SCHEMA);
  if (!str(b.name)) throw httpError(400, 'Product name is required');
  const info = db.prepare(
    `INSERT INTO products (name, category, supplier, sku, barcode, retail_cents, cost_cents, stock_qty, low_stock_at, image, taxable, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(...productBody(b));
  return db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
});

route('PUT', '/api/products/:id', async ({ req, params }) => {
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(params.id)) throw httpError(404, 'Product not found');
  const b = checkBody(await readJson(req), PRODUCT_SCHEMA);
  db.prepare(
    `UPDATE products SET name = ?, category = ?, supplier = ?, sku = ?, barcode = ?, retail_cents = ?,
       cost_cents = ?, stock_qty = ?, low_stock_at = ?, image = ?, taxable = ?, active = ? WHERE id = ?`
  ).run(...productBody(b), params.id);
  return db.prepare('SELECT * FROM products WHERE id = ?').get(params.id);
});

route('DELETE', '/api/products/:id', async ({ params }) => {
  // Products that were ever sold are archived (history must keep pointing at
  // them); never-sold products can be removed outright.
  const sold = db.prepare('SELECT 1 FROM invoice_items WHERE product_id = ? LIMIT 1').get(params.id);
  if (sold) db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(params.id);
  else db.prepare('DELETE FROM products WHERE id = ?').run(params.id);
  return { ok: true, archived: Boolean(sold) };
});

// ---------------------------------------------------------------------------
// Point of Sale. The server re-prices every line from the database (client
// input chooses WHAT is sold, never what it costs), wraps invoice + items in
// a transaction, and records payment + stock exactly once — verified against
// Stripe directly (pull model), so no webhook is needed and nothing can be
// spoofed from the browser.
// ---------------------------------------------------------------------------

const POS_SALE_SCHEMA = {
  client_id: s.num(), appointment_id: s.num(),
  items: s.arr(s.obj({
    type: s.oneOf(['service', 'product', 'custom'], { required: true }),
    id: s.num(),
    description: s.str(150),
    qty: s.num({ min: 1, max: 999 }),
    unit_cents: s.num({ min: 0, max: 100_000_000 }),
  }), 50, { required: true }),
  discount_cents: s.num({ min: 0, max: 100_000_000 }),
  method: s.oneOf(['stripe', 'square', 'cash', 'other'], { required: true }),
  origin: s.str(300),
};

/** Re-price sale lines from the database; returns rows ready for invoice_items. */
function posPriceItems(items) {
  if (!items.length) throw httpError(400, 'Add at least one item to the sale');
  return items.map((it) => {
    const qty = clampInt(it.qty, 1, 999, 1);
    if (it.type === 'service') {
      const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(Number(it.id));
      if (!svc) throw httpError(400, 'One of the services no longer exists');
      // "From $X" services: staff set the final price at checkout; it can't be
      // below the advertised floor.
      let unit = svc.price_cents;
      if (svc.price_type === 'from' && it.unit_cents != null) {
        unit = Math.max(svc.price_cents, clampInt(it.unit_cents, 0, 100_000_000, svc.price_cents));
      }
      return { description: svc.name, qty, unit_cents: unit, product_id: null };
    }
    if (it.type === 'product') {
      const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(Number(it.id));
      if (!p) throw httpError(400, 'One of the products is unavailable');
      if (p.stock_qty < qty) throw httpError(409, `Only ${p.stock_qty} × ${p.name} left in stock`);
      return { description: p.name, qty, unit_cents: p.retail_cents, product_id: p.id };
    }
    // custom line — description + amount are the staff's own entry
    const desc = str(it.description, 150);
    if (!desc) throw httpError(400, 'Custom items need a description');
    return { description: desc, qty, unit_cents: clampInt(it.unit_cents, 0, 100_000_000, 0), product_id: null };
  });
}

/** Decrement stock for a sale's product lines — exactly once per invoice. */
function fulfillPosStock(invoiceId) {
  const inv = db.prepare('SELECT pos_fulfilled FROM invoices WHERE id = ?').get(invoiceId);
  if (!inv || inv.pos_fulfilled) return;
  const lines = db.prepare('SELECT product_id, qty FROM invoice_items WHERE invoice_id = ? AND product_id IS NOT NULL').all(invoiceId);
  for (const l of lines) {
    db.prepare('UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?').run(Math.round(l.qty), l.product_id);
  }
  db.prepare('UPDATE invoices SET pos_fulfilled = 1 WHERE id = ?').run(invoiceId);
}

/** Record a verified Stripe POS payment idempotently (dedupe on payment intent). */
function recordPosStripePayment(invoiceId, amountCents, paymentIntent) {
  if (paymentIntent && db.prepare('SELECT 1 FROM payments WHERE invoice_id = ? AND stripe_pi = ?').get(invoiceId, paymentIntent)) {
    return false; // already recorded — a poll race or double status call
  }
  db.prepare('INSERT INTO payments (invoice_id, amount_cents, method, paid_at, note, stripe_pi) VALUES (?, ?, ?, ?, ?, ?)')
    .run(invoiceId, amountCents, 'card', bizStamp(), 'POS — paid via Stripe', paymentIntent || '');
  return true;
}

route('POST', '/api/pos/sale', async ({ req }) => {
  const b = checkBody(await readJson(req), POS_SALE_SCHEMA);
  const priced = posPriceItems(b.items);
  const clientId = Number(b.client_id) || null;
  const apptId = Number(b.appointment_id) || null;
  const discount = clampInt(b.discount_cents, 0, 100_000_000, 0);
  const taxRate = Number(getSetting('tax_rate', '0')) || 0;

  const subtotal = priced.reduce((sum, l) => sum + l.qty * l.unit_cents, 0);
  if (discount > subtotal) throw httpError(400, 'Discount cannot exceed the subtotal');
  const total = Math.round((subtotal - discount) * (1 + taxRate / 100));
  if (total <= 0) throw httpError(400, 'Sale total must be above zero');
  if (b.method === 'stripe' && total < 50) throw httpError(400, 'Card payments need a total of at least 50 cents');

  const issue = bizToday();
  db.exec('BEGIN');
  let invId;
  try {
    const info = db.prepare(
      `INSERT INTO invoices (number, client_id, appointment_id, issue_date, due_date, status, tax_rate, discount_cents)
       VALUES (?, ?, ?, ?, ?, 'sent', ?, ?)`
    ).run(nextInvoiceNumber(), clientId, apptId, issue, issue, taxRate, discount);
    invId = Number(info.lastInsertRowid);
    const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_cents, product_id) VALUES (?, ?, ?, ?, ?)');
    for (const l of priced) insItem.run(invId, l.description, l.qty, l.unit_cents, l.product_id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  if (b.method === 'cash' || b.method === 'other' || b.method === 'square') {
    // Paid on the spot (cash, bank transfer, or a card charged on the owner's
    // own Square reader/terminal): record, fulfil stock, receipt — all now.
    const note = b.method === 'square' ? 'POS — card charged on Square' : 'POS sale';
    db.prepare('INSERT INTO payments (invoice_id, amount_cents, method, paid_at, note) VALUES (?, ?, ?, ?, ?)')
      .run(invId, total, b.method, bizStamp(), note);
    refreshPaidStatus(invId);
    fulfillPosStock(invId);
    const updated = getInvoice(invId);
    queueReceiptMessage(invId, { amountCents: total, method: b.method, balanceCents: 0 });
    processQueue().catch(() => {});
    return { paid: true, invoice_id: invId, total_cents: total, invoice: updated };
  }

  // Card via Stripe Checkout. If Stripe rejects (bad key, offline), the sale
  // is voided so no half-finished invoice lingers — staff just retry or take cash.
  if (!stripeConfigured()) {
    db.prepare("UPDATE invoices SET status = 'void', notes = 'POS: Stripe not configured' WHERE id = ?").run(invId);
    throw httpError(400, 'Card payments need a Stripe key first (Settings → Online deposits)');
  }
  try {
    const origin = str(b.origin, 300) || `http://localhost:${process.env.PORT || 4820}`;
    const taxLabel = taxRate > 0 ? ` (incl. ${taxRate}% GST/tax)` : '';
    const items = discount > 0 || taxRate > 0
      // One consolidated line keeps Stripe's total exactly equal to ours after
      // discount + tax; itemized lines otherwise.
      ? [{ description: `Sale at ${getSetting('business_name', 'salon')}${taxLabel}`, qty: 1, unit_cents: total }]
      : priced;
    const idemToken = crypto.randomBytes(12).toString('hex');
    db.prepare('UPDATE invoices SET pos_token = ? WHERE id = ?').run(idemToken, invId);
    const session = await createPosCheckout({ invoiceId: invId, items, origin, idemToken });
    db.prepare('UPDATE invoices SET stripe_session_id = ? WHERE id = ?').run(session.session_id, invId);
    return { paid: false, invoice_id: invId, total_cents: total, checkout_url: session.url };
  } catch (err) {
    db.prepare("UPDATE invoices SET status = 'void', notes = ? WHERE id = ?").run(`POS: Stripe error — ${str(err.message, 300)}`, invId);
    throw httpError(502, `Card payment could not start: ${err.message}`);
  }
});

route('GET', '/api/pos/status/:id', async ({ params }) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(params.id);
  if (!inv) throw httpError(404, 'Sale not found');
  if (inv.status === 'paid') {
    return { paid: true, invoice: getInvoice(inv.id) };
  }
  if (inv.status === 'void') return { paid: false, void: true };
  if (!inv.stripe_session_id) return { paid: false, pending: true };
  try {
    const check = await verifyPosSession(inv.stripe_session_id);
    if (!check.paid) return { paid: false, pending: true };
    // Verified with Stripe — record once (poll races dedupe on the intent).
    recordPosStripePayment(inv.id, check.amount_cents, check.payment_intent);
    refreshPaidStatus(inv.id);
    fulfillPosStock(inv.id);
    const updated = getInvoice(inv.id);
    if (updated.status === 'paid') {
      queueReceiptMessage(inv.id, { amountCents: check.amount_cents, method: 'card', balanceCents: 0 });
      processQueue().catch(() => {});
    }
    return { paid: updated.status === 'paid', invoice: updated };
  } catch {
    return { paid: false, pending: true }; // Stripe unreachable — keep polling
  }
});

// Refunds: full or partial; Stripe-paid sales are refunded at Stripe first
// (idempotent per amount), and product lines can restock. The invoice keeps
// its Paid status — the refund lives in payment history and reduces revenue.
route('POST', '/api/invoices/:id/refund', async ({ req, params }) => {
  const inv = getInvoice(params.id);
  const b = checkBody(await readJson(req), {
    amount_cents: s.num({ min: 1, max: 100_000_000 }),
    restock: s.bool(),
    note: s.str(300),
  });
  const paidIn = inv.payments.filter((p) => p.amount_cents > 0).reduce((sum, p) => sum + p.amount_cents, 0);
  const refunded = inv.payments.filter((p) => p.amount_cents < 0).reduce((sum, p) => sum - p.amount_cents, 0);
  const refundable = paidIn - refunded;
  const amount = b.amount_cents != null ? Math.round(Number(b.amount_cents)) : refundable;
  if (refundable <= 0) throw httpError(400, 'Nothing left to refund on this invoice');
  if (amount <= 0 || amount > refundable) throw httpError(400, `Refund must be between 1 and ${refundable} cents`);

  // Refund at Stripe first when the money went through Stripe.
  const stripePay = inv.payments.find((p) => p.stripe_pi && p.amount_cents > 0);
  let stripeRefundId = '';
  if (stripePay) {
    const r = await createStripeRefund(stripePay.stripe_pi, amount, refunded); // throws on Stripe failure — nothing recorded
    stripeRefundId = r.refund_id;
  }
  db.prepare('INSERT INTO payments (invoice_id, amount_cents, method, paid_at, note, stripe_pi) VALUES (?, ?, ?, ?, ?, ?)')
    .run(inv.id, -amount, stripePay ? 'card' : 'cash',
         bizStamp(),
         str(b.note, 300) || (stripeRefundId ? `Refund (Stripe ${stripeRefundId})` : 'Refund'),
         stripeRefundId);

  // Full refunds can put product stock back on the shelf.
  if (b.restock && amount === refundable) {
    const lines = db.prepare('SELECT product_id, qty FROM invoice_items WHERE invoice_id = ? AND product_id IS NOT NULL').all(inv.id);
    for (const l of lines) db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(Math.round(l.qty), l.product_id);
  }
  return getInvoice(inv.id);
});

route('DELETE', '/api/invoices/:id/payments/:pid', async ({ params }) => {
  db.prepare('DELETE FROM payments WHERE id = ? AND invoice_id = ?').run(params.pid, params.id);
  refreshPaidStatus(params.id);
  return getInvoice(params.id);
});

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Reviews (staff-facing)
// ---------------------------------------------------------------------------

const REVIEW_SELECT = `
  SELECT r.*,
    c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS client_name,
    s.name AS staff_name, a.date AS appt_date, sv.name AS service_name
  FROM reviews r
  LEFT JOIN clients c ON c.id = r.client_id
  LEFT JOIN staff s ON s.id = r.staff_id
  LEFT JOIN appointments a ON a.id = r.appointment_id
  LEFT JOIN services sv ON sv.id = a.service_id`;

route('GET', '/api/reviews', async ({ query }) => {
  const minRating = clampInt(query.get('max_rating'), 1, 5, 0);
  const where = minRating ? `WHERE r.rating <= ${minRating}` : '';
  const rows = db.prepare(`${REVIEW_SELECT} ${where} ORDER BY r.created_at DESC LIMIT 300`).all();
  const stats = db.prepare('SELECT COUNT(*) AS n, COALESCE(AVG(rating), 0) AS avg FROM reviews').get();
  const monthAgo = addDays(bizToday(), -30);
  const recent = db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE created_at >= ?").get(`${monthAgo} 00:00:00`).n;
  return { reviews: rows, total: stats.n, average: Math.round(stats.avg * 10) / 10, last_30d: recent };
});

route('PUT', '/api/reviews/:id/response', async ({ req, params }) => {
  if (!db.prepare('SELECT id FROM reviews WHERE id = ?').get(params.id)) throw httpError(404, 'Review not found');
  const { response } = checkBody(await readJson(req), { response: s.str(2000) });
  db.prepare('UPDATE reviews SET response = ? WHERE id = ?').run(str(response, 2000), params.id);
  return db.prepare(`${REVIEW_SELECT} WHERE r.id = ?`).get(params.id);
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

route('GET', '/api/dashboard', async ({ query }) => {
  // The day this panel is about, and the minute it is measured against.
  //
  // The business's own zone is the default. The owner's device can override it
  // (?date=&now_min=), and normally does: the calendar has always drawn the
  // day the phone is standing in, so the dashboard follows the same clock and
  // the two can't tell the owner different things. A misconfigured zone then
  // shows up as a warning on the panel instead of as yesterday's appointments.
  const server = bizNow();
  const asked = query.get('date');
  const today = isDateStr(asked) ? asked : server.date;
  // Out of range is a broken caller, not a preference — fall back to the
  // business's own clock rather than pinning the day to 23:59.
  const askedMin = Number.parseInt(query.get('now_min'), 10);
  const nowMin = Number.isInteger(askedMin) && askedMin >= 0 && askedMin <= 1439 ? askedMin : server.min;
  const weekAgo = addDays(today, -6);
  const monthAgo = addDays(today, -29);

  const todayRow = db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(sv.price_cents), 0) AS expected
     FROM appointments a LEFT JOIN services sv ON sv.id = a.service_id
     WHERE a.date = ? AND a.status NOT IN ('cancelled', 'no_show')`
  ).get(today);

  const weekRevenue = db.prepare(
    'SELECT COALESCE(SUM(amount_cents), 0) AS v FROM payments WHERE substr(paid_at, 1, 10) >= ?'
  ).get(weekAgo).v;

  const outstanding = db.prepare(
    `SELECT COALESCE(SUM(t.balance), 0) AS v FROM (
       SELECT CAST(ROUND((COALESCE((SELECT SUM(qty * unit_cents) FROM invoice_items WHERE invoice_id = i.id), 0) - i.discount_cents)
              * (1 + i.tax_rate / 100)) AS INTEGER)
              - COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id = i.id), 0) AS balance
       FROM invoices i WHERE i.status = 'sent'
     ) t WHERE t.balance > 0`
  ).get().v;

  const clientsTotal = db.prepare('SELECT COUNT(*) AS n FROM clients').get().n;
  const clientsNew = db.prepare("SELECT COUNT(*) AS n FROM clients WHERE substr(created_at, 1, 10) >= ?").get(monthAgo).n;

  const upcoming = db.prepare(
    `${APPT_SELECT}
     WHERE a.date >= ? AND a.status IN ('booked', 'confirmed')
     ORDER BY a.date, a.start_min LIMIT 8`
  ).all(today);

  // ---- Today at a glance -------------------------------------------------
  // The full run of the day, plus what's next, where the gaps are and what has
  // actually been taken so far — the operational view the owner opens on.
  const todayAppts = db.prepare(
    `${APPT_SELECT} WHERE a.date = ? ORDER BY a.start_min`
  ).all(today);
  const liveToday = todayAppts.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show');

  const doneCount = liveToday.filter((a) => a.status === 'completed' || a.end_min <= nowMin).length;
  const next = liveToday.find((a) => a.start_min > nowMin && a.status !== 'completed') || null;
  const inProgress = liveToday.find((a) => a.start_min <= nowMin && a.end_min > nowMin && a.status !== 'completed') || null;

  const takingsToday = db.prepare(
    'SELECT COALESCE(SUM(amount_cents), 0) AS v FROM payments WHERE substr(paid_at, 1, 10) = ?'
  ).get(today).v;

  // Free windows left in the day: opening hours minus appointments and blocks,
  // from now onwards, so the owner can see where they could fit someone in.
  const gaps = [];
  const todayHours = hoursFor(today);
  if (todayHours) {
    const openM = todayHours.open;
    const closeM = todayHours.close;
    const busy = [
      ...liveToday.map((a) => ({ start_min: a.start_min, end_min: a.end_min })),
      ...db.prepare('SELECT start_min, end_min FROM time_blocks WHERE date = ?').all(today),
    ].sort((a, b) => a.start_min - b.start_min);
    let cursor = Math.max(openM, Math.floor(nowMin / 15) * 15);
    for (const b of busy) {
      if (b.end_min <= cursor) continue;
      if (b.start_min > cursor) gaps.push({ start_min: cursor, end_min: Math.min(b.start_min, closeM) });
      cursor = Math.max(cursor, b.end_min);
      if (cursor >= closeM) break;
    }
    if (cursor < closeM) gaps.push({ start_min: cursor, end_min: closeM });
  }
  const openGaps = gaps.filter((g) => g.end_min - g.start_min >= 15);

  // ---- Client growth & retention ----------------------------------------
  const visitCounts = db.prepare(
    `SELECT client_id, COUNT(*) AS n, MAX(date) AS last_date FROM appointments
     WHERE client_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show')
     GROUP BY client_id`
  ).all();
  const byClient = new Map(visitCounts.map((r) => [r.client_id, r]));

  // New vs returning across the last 30 days: an appointment counts as
  // "returning" when that client had an earlier visit before it.
  const recentAppts = db.prepare(
    `SELECT client_id, date FROM appointments
     WHERE date >= ? AND date <= ? AND client_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show')
     ORDER BY date`
  ).all(monthAgo, today);
  const firstVisit = new Map(
    db.prepare(
      `SELECT client_id, MIN(date) AS first_date FROM appointments
       WHERE client_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show') GROUP BY client_id`
    ).all().map((r) => [r.client_id, r.first_date])
  );
  let newVisits = 0, returningVisits = 0;
  for (const a of recentAppts) {
    if (firstVisit.get(a.client_id) === a.date) newVisits++; else returningVisits++;
  }

  // Rebooking rate: of the clients seen in the 30 days before last month, how
  // many came back again afterwards. A plain, honest loyalty read.
  const priorStart = addDays(today, -59), priorEnd = addDays(today, -30);
  const priorClients = db.prepare(
    `SELECT DISTINCT client_id FROM appointments
     WHERE date >= ? AND date <= ? AND client_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show')`
  ).all(priorStart, priorEnd).map((r) => r.client_id);
  const cameBack = priorClients.filter((id) => {
    const r = byClient.get(id);
    return r && r.last_date > priorEnd;
  }).length;
  const rebookRate = priorClients.length ? Math.round((cameBack / priorClients.length) * 100) : null;

  // Lapsed regulars: 2+ past visits but nothing in 8 weeks and nothing booked.
  const lapsedCutoff = addDays(today, -56);
  const booked = new Set(
    db.prepare("SELECT DISTINCT client_id FROM appointments WHERE date >= ? AND status IN ('booked','confirmed') AND client_id IS NOT NULL").all(today).map((r) => r.client_id)
  );
  const lapsedRows = visitCounts
    .filter((r) => r.n >= 2 && r.last_date < lapsedCutoff && !booked.has(r.client_id))
    .sort((a, b) => (b.n - a.n) || (a.last_date < b.last_date ? -1 : 1))
    .slice(0, 6);
  const lapsed = lapsedRows.map((r) => {
    const c = db.prepare('SELECT id, first_name, last_name, phone, email FROM clients WHERE id = ?').get(r.client_id);
    return c ? { ...c, visits: r.n, last_visit: r.last_date } : null;
  }).filter(Boolean);
  const lapsedCount = visitCounts.filter((r) => r.n >= 2 && r.last_date < lapsedCutoff && !booked.has(r.client_id)).length;

  const revenueByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const v = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS v FROM payments WHERE substr(paid_at, 1, 10) = ?').get(d).v;
    revenueByDay.push({ date: d, cents: v });
  }

  const rhythmRows = db.prepare(
    `SELECT (start_min / 60) AS hour, COUNT(*) AS n FROM appointments
     WHERE date >= ? AND date <= ? AND status NOT IN ('cancelled') GROUP BY hour ORDER BY hour`
  ).all(monthAgo, today);
  const bookingsByHour = rhythmRows.map((r) => ({ hour: r.hour, count: r.n }));

  const topServices = db.prepare(
    `SELECT sv.name, COUNT(*) AS n, COALESCE(SUM(sv.price_cents), 0) AS revenue_cents
     FROM appointments a JOIN services sv ON sv.id = a.service_id
     WHERE a.date >= ? AND a.status NOT IN ('cancelled', 'no_show')
     GROUP BY sv.id ORDER BY n DESC LIMIT 5`
  ).all(monthAgo);

  return {
    today: {
      date: today,
      count: todayRow.n,
      expected_cents: todayRow.expected,
      takings_cents: takingsToday,
      done_count: doneCount,
      remaining_count: Math.max(0, liveToday.length - doneCount),
      now_min: nowMin,
      // What the business's configured zone believes, whether or not it was
      // used. The panel compares this with the device to tell the owner their
      // time zone is wrong — which still matters even when the panel itself
      // reads correctly, because reminders and the booking page use the zone.
      server_date: server.date,
      server_now_min: server.min,
      is_open_day: isOpenDay(today),
      appointments: liveToday,
      cancelled_count: todayAppts.length - liveToday.length,
      next,
      in_progress: inProgress,
      gaps: openGaps,
      free_min: openGaps.reduce((n, g) => n + (g.end_min - g.start_min), 0),
    },
    week_revenue_cents: weekRevenue,
    outstanding_cents: outstanding,
    clients: {
      total: clientsTotal,
      new_30d: clientsNew,
      new_visits_30d: newVisits,
      returning_visits_30d: returningVisits,
      rebook_rate: rebookRate,
      lapsed,
      lapsed_count: lapsedCount,
    },
    upcoming,
    revenue_by_day: revenueByDay,
    bookings_by_hour: bookingsByHour,
    top_services: topServices,
  };
});

/**
 * What the diary is quietly costing the business — empty time, regulars who
 * have drifted, cancellations nobody backfilled, the weekly dead spot, and the
 * few clients behind most of the no-shows.
 *
 * Read-only by design. This route computes and returns; it never sends a
 * message, changes an appointment or spends a cent, which is what makes it
 * safe to show a live salon before any of the automation exists.
 */
route('GET', '/api/opportunities', async ({ query }) => {
  const asked = query.get('date');
  const today = isDateStr(asked) ? asked : bizToday();
  return opportunities({ today, hoursFor, staffWindow, blocksFor });
});

/**
 * Everything the owner needs to decide on one campaign, before anything is
 * sent: who it would go to and why, the words, and what it will actually cost.
 *
 * Still read-only. This is the screen that makes the send safe, so it has to
 * be reachable without committing to anything.
 */
route('GET', '/api/campaigns/preview', async ({ query }) => {
  const kind = String(query.get('kind') || '');
  if (!CAMPAIGN_KINDS.has(kind)) throw httpError(400, 'Unknown campaign');
  const channel = ['email', 'sms', 'both'].includes(query.get('channel')) ? query.get('channel') : 'email';
  const today = isDateStr(query.get('date')) ? query.get('date') : bizToday();
  const context = {
    weekday: query.get('weekday') === null ? undefined : Number(query.get('weekday')),
    when: str(query.get('when') || '', 60),
    times: str(query.get('times') || '', 60),
  };

  // Who it goes to. A broadcast is always email — two hundred texts is real
  // money for a long shot, and the whole reason this option is safe to offer is
  // that it costs nothing.
  const audience = AUDIENCES.has(query.get('audience')) ? query.get('audience') : 'matched';
  const chan = audience === 'everyone' ? 'email' : channel;

  const recipients = recipientsFor(kind, { today, channel: chan, context, audience });
  const draft = draftFor(kind, context, audience);
  const selectable = recipients.filter((r) => !r.cooling_off);
  return {
    kind,
    channel: chan,
    audience,
    draft,
    recipients,
    cost: messageCost(draft.body, chan, selectable),
    cooldown_days: Number(getSetting('marketing_cooldown_days', '14')) || 0,
    booking_url: publicUrl() ? `${publicUrl()}/book` : '',
    last_sent: lastSent(kind),
    // So the switch between the two can show what each would reach without the
    // owner having to click it to find out.
    audience_sizes: {
      matched: recipientsFor(kind, { today, channel, context, audience: 'matched' })
        .filter((r) => !r.cooling_off).length,
      everyone: recipientsFor(kind, { today, channel: 'email', context, audience: 'everyone' })
        .filter((r) => !r.cooling_off).length,
    },
  };
});

/**
 * Send it. One person, one button, having seen the list.
 *
 * The cooldown is re-checked inside sendCampaign rather than trusted from
 * here — a preview left open while another campaign went out would otherwise
 * message somebody twice.
 */
// ---------------------------------------------------------------------------
// Waitlist — the one automation that acts without the owner in the loop, and
// therefore the one that is off until they switch it on.
// ---------------------------------------------------------------------------

route('GET', '/api/waitlist', async () => ({
  enabled: waitlistEnabled(),
  autofill: autofillEnabled(),
  entries: listWaitlist(),
  stats: waitlistStats(),
}));

route('POST', '/api/waitlist', async ({ req }) => {
  const b = checkBody(await readJson(req), {
    client_id: s.num({ min: 1, required: true }),
    service_id: s.num({ min: 1 }),
    staff_id: s.num({ min: 1 }),
    weekdays: s.str(20),
    from_date: s.str(10),
    until_date: s.str(10),
    note: s.str(300),
  });
  if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(b.client_id)) {
    throw httpError(400, 'That client does not exist');
  }
  const id = addToWaitlist({
    clientId: b.client_id, serviceId: b.service_id, staffId: b.staff_id,
    weekdays: b.weekdays || '', fromDate: b.from_date || '',
    untilDate: b.until_date || '', note: b.note || '',
  });
  return { id, entries: listWaitlist() };
});

route('DELETE', '/api/waitlist/:id', async ({ params }) => {
  if (!removeFromWaitlist(params.id)) throw httpError(404, 'Not on the waitlist');
  return { ok: true, entries: listWaitlist() };
});

route('POST', '/api/campaigns/send', async ({ req }) => {
  const b = checkBody(await readJson(req), {
    kind: s.str(40, { required: true }),
    channel: s.oneOf(['email', 'sms', 'both'], { required: true }),
    subject: s.str(200),
    body: s.str(1600, { required: true }),
    client_ids: s.arr(s.num({ min: 1 }), 500, { required: true }),
  });
  if (!CAMPAIGN_KINDS.has(b.kind)) throw httpError(400, 'Unknown campaign');
  if (!b.client_ids.length) throw httpError(400, 'Nobody is selected');
  // A blank message is the owner's slip, not a server fault — say so plainly
  // rather than letting campaigns.js throw and turn it into a 500 with a stack
  // trace in the log. (The guard stays there too, for any other caller.)
  if (!String(b.body || '').trim()) throw httpError(400, 'The message is empty — write something first.');

  const out = sendCampaign(b.kind, {
    clientIds: b.client_ids, channel: b.channel,
    subject: b.subject || '', body: b.body, renderEmail,
  });
  processQueue().catch(() => {});
  const aside = [
    out.skipped ? `${out.skipped} skipped (messaged recently)` : '',
    out.refused ? `${out.refused} opted out` : '',
  ].filter(Boolean).join(', ');
  return {
    ...out,
    detail: out.queued
      ? `${out.queued} message${out.queued === 1 ? '' : 's'} queued${aside ? `, ${aside}` : ''}`
      : 'Nobody was messaged — everyone selected has heard from you recently or opted out.',
  };
});

/**
 * "Don't send me offers."
 *
 * Its own route rather than a field on the client form, because it is the one
 * thing on a client record that is the client's decision rather than the
 * owner's note-keeping, and it should be as easy to honour as it was to ask.
 */
route('PUT', '/api/clients/:id/marketing', async ({ params, req }) => {
  const b = checkBody(await readJson(req), { opt_out: s.bool() });
  const optOut = Boolean(b.opt_out);
  if (!setMarketingOptOut(params.id, optOut)) throw httpError(404, 'No such client');
  return { ok: true, opt_out: optOut };
});

// ---------------------------------------------------------------------------
// Public booking (no auth) — powers /book
// ---------------------------------------------------------------------------

route('GET', '/api/public/info', async () => {
  if (getSetting('booking_enabled', '1') !== '1') throw httpError(404, 'Online booking is disabled');
  return {
    business_name: getSetting('business_name'),
    business_phone: getSetting('business_phone'),
    business_address: getSetting('business_address'),
    // The DOMAIN mail leaves from — never the mailbox. It is already on every
    // message this business sends, so it discloses nothing new, and it lets
    // scripts/verify-business.mjs check DKIM and SPF on the domain actually in
    // use instead of guessing the platform one. Guessing produced a confident
    // "records missing" against a salon whose email was working perfectly,
    // because that salon sends from its own domain.
    mail_domain: String(getSetting('notif_from_email', '')).split('@')[1] || '',
    currency: getSetting('currency', '$'),
    open_min: Number(getSetting('open_min', '480')),
    close_min: Number(getSetting('close_min', '1200')),
    open_days: String(getSetting('open_days', '0,1,2,3,4,5,6')).split(',').map(Number),
    // Every date customers may book, worked out here rather than in the
    // browser — a day that only runs on alternating weeks can't be derived
    // from the weekday alone. The full horizon is sent (not just the next
    // fortnight) so someone can book two or three months ahead.
    open_dates: openDatesFrom(bizToday(), hourSettings(),
      bookingHorizonDays(), bookingHorizonDays()),
    booking_horizon_days: bookingHorizonDays(),
    cancel_window_hours: getSetting('client_cancel_enabled', '1') === '1'
      ? Math.max(0, Number(getSetting('cancel_window_hours', '12')) || 0) : -1,
    brand: {
      accent: getSetting('brand_accent', '#38bdf8'),
      theme: getSetting('brand_theme', 'dark'),
      scheme: getSetting('brand_scheme', ''),
      font: getSetting('brand_font', 'modern'),
      logo: getSetting('brand_logo', ''),
      cover: getSetting('brand_cover', ''),
      gallery: safeGallery(getSetting('brand_gallery', '')),
      tagline: getSetting('brand_tagline', ''),
    },
    services: db.prepare('SELECT id, name, category, duration_min, price_cents, price_type, description FROM services WHERE active = 1 ORDER BY category, name').all(),
    // Each member carries the dates they are actually rostered for, so the date
    // strip can drop the days the chosen stylist doesn't work instead of
    // offering a Tuesday that turns out to have no times on it.
    staff: db.prepare('SELECT id, name, title, location_id FROM staff WHERE active = 1 ORDER BY id').all()
      .map((m) => {
        const roster = rosterFor(m.id);
        return {
          ...m,
          open_dates: openDatesFrom(bizToday(), hourSettings(), bookingHorizonDays(), bookingHorizonDays())
            .filter((d) => bookableWindow(d.date, roster, { open: d.open_min, close: d.close_min }))
            .map((d) => d.date),
        };
      }),
    locations: db.prepare('SELECT id, name, address, phone FROM locations WHERE active = 1 ORDER BY id').all(),
    // The public half of the Turnstile pair — meant for the browser. Empty
    // when it is off, which is how the page knows not to render the widget.
    turnstile_site_key: turnstileSiteKey(),
    waitlist_enabled: waitlistEnabled(),
    deposit: {
      enabled: stripeConfigured() && getSetting('deposit_type', 'none') !== 'none',
      type: getSetting('deposit_type', 'none'),
      value: Number(getSetting('deposit_value', '0')) || 0,
    },
  };
}, { auth: false });

/** How far ahead customers may book online (days), clamped to something sane. */
function bookingHorizonDays() {
  return clampInt(getSetting('booking_horizon_days', '90'), 1, 365, 90);
}

/** The hour settings the shared rules engine needs. */
function hourSettings() {
  return {
    open_days: getSetting('open_days', '0,1,2,3,4,5,6'),
    open_min: getSetting('open_min', '480'),
    close_min: getSetting('close_min', '1200'),
    day_rules: getSetting('day_rules', '{}'),
  };
}

/**
 * Opening hours for a date, or null when shut — honouring both the weekly
 * open days and any per-day rule (alternating weeks, different hours).
 */
function hoursFor(date) {
  return hoursForDate(date, hourSettings());
}

function isOpenDay(date) {
  return hoursFor(date) !== null;
}

/**
 * One team member's roster, tidied for the resolver.
 *
 * Read per request rather than cached: a roster changes when the owner edits
 * it, and a customer being offered a slot the stylist no longer works is worse
 * than a query.
 */
function rosterFor(staffId) {
  return buildRoster(db.prepare(
    'SELECT weekday, date, start_min, end_min, working FROM staff_shifts WHERE staff_id = ?'
  ).all(staffId));
}

/**
 * The window a member can be booked in on a date — their shift clipped to the
 * salon's hours, or the salon's hours alone if they have no roster yet.
 */
function staffWindow(staffId, date) {
  return bookableWindow(date, rosterFor(staffId), hoursFor(date));
}

function freeSlotsFor(staffId, date, durationMin) {
  // Not "is the salon open" but "is this person there" — the two are different
  // questions the moment a salon has more than one pair of hands.
  const hours = staffWindow(staffId, date);
  if (!hours) return []; // shut, or nobody rostered on
  const { open, close } = hours;
  const step = Math.max(5, Number(getSetting('slot_interval', '15')));
  const busy = db.prepare(
    "SELECT start_min, end_min FROM appointments WHERE staff_id = ? AND date = ? AND status NOT IN ('cancelled', 'no_show')"
  ).all(staffId, date);
  // Owner-blocked time (lunch, training, holiday…) is unbookable online, exactly
  // like an existing appointment. A block with no staff_id covers the whole team.
  busy.push(...blocksFor(staffId, date));

  // "Now" in the business's own time zone, so a slot that has already passed
  // today is never offered (the server may run in UTC while the salon is in
  // Australia). A minimum-notice buffer pushes the earliest bookable time
  // further out if the owner wants advance warning.
  const { date: todayLocal, min: nowMin } = bizNow();
  const isToday = date === todayLocal;
  const leadMin = Math.max(0, Number(getSetting('booking_lead_min', '0')) || 0);
  const earliest = nowMin + leadMin; // slots must start strictly after this today

  const slots = [];
  for (let t = open; t + durationMin <= close; t += step) {
    if (isToday && (t <= nowMin || t < earliest)) continue;
    if (!busy.some((b) => t < b.end_min && t + durationMin > b.start_min)) slots.push(t);
  }
  return slots;
}

route('GET', '/api/public/availability', async ({ query }) => {
  if (getSetting('booking_enabled', '1') !== '1') throw httpError(404, 'Online booking is disabled');
  const date = query.get('date');
  const todayForSlots = bizToday();
  if (!isDateStr(date) || date < todayForSlots) throw httpError(400, 'Choose an upcoming date');
  if (date > addDaysStr(todayForSlots, bookingHorizonDays())) throw httpError(400, 'That date is too far ahead');
  // Duration is the sum of every chosen service (service_ids CSV), or a single
  // service (service_id). All must be real, active services.
  const idsParam = (query.get('service_ids') || '').split(',').map((v) => Number(v)).filter(Boolean);
  const ids = idsParam.length ? idsParam : [Number(query.get('service_id'))];
  let totalDuration = 0;
  for (const id of ids) {
    const svc = db.prepare('SELECT duration_min FROM services WHERE id = ? AND active = 1').get(id);
    if (!svc) throw httpError(400, 'Choose a service');
    totalDuration += svc.duration_min;
  }
  if (!totalDuration) throw httpError(400, 'Choose a service');

  const staffParam = query.get('staff_id');
  const locationId = Number(query.get('location_id')) || 0;
  const staffList = staffParam && staffParam !== 'any'
    ? db.prepare('SELECT id, name FROM staff WHERE id = ? AND active = 1').all(Number(staffParam))
    : locationId
      ? db.prepare('SELECT id, name FROM staff WHERE active = 1 AND location_id = ? ORDER BY id').all(locationId)
      : db.prepare('SELECT id, name FROM staff WHERE active = 1 ORDER BY id').all();

  // slot -> first staff free at that time (keeps "Any available" simple and fair)
  const slotMap = new Map();
  for (const s of staffList) {
    for (const t of freeSlotsFor(s.id, date, totalDuration)) {
      if (!slotMap.has(t)) slotMap.set(t, s.id);
    }
  }
  return {
    duration_min: totalDuration,
    slots: [...slotMap.entries()].sort((a, b) => a[0] - b[0]).map(([start_min, staff_id]) => ({ start_min, staff_id })),
  };
}, { auth: false });

/**
 * A customer putting their name down for a time that isn't free.
 *
 * Rate-limited like every other public write, and it creates a client record if
 * they are new — somebody who wants a Saturday badly enough to ask is worth
 * having in the book whether or not a slot ever opens.
 */
route('POST', '/api/public/waitlist', async ({ req }) => {
  if (!waitlistEnabled()) throw httpError(404, 'The waitlist is not open');
  const b = checkBody(await readJson(req), {
    first_name: s.str(80, { required: true }),
    last_name: s.str(80),
    email: s.str(160),
    phone: s.str(40),
    service_id: s.num({ min: 1 }),
    staff_id: s.num({ min: 1 }),
    weekdays: s.str(20),
    from_date: s.str(10),
    until_date: s.str(10),
    note: s.str(300),
  });
  // Without one of these there is no way to tell them a slot opened, which
  // makes the whole entry pointless — say so rather than storing a dead row.
  if (!String(b.email || '').trim() && !String(b.phone || '').trim()) {
    throw httpError(400, 'Please leave an email or a phone number so we can let you know.');
  }

  const email = str(b.email || '').trim().toLowerCase();
  const phone = str(b.phone || '').trim();
  const existing = email
    ? db.prepare('SELECT id FROM clients WHERE lower(email) = ?').get(email)
    : (phone ? db.prepare('SELECT id FROM clients WHERE phone = ?').get(phone) : null);
  const clientId = existing ? existing.id : Number(db.prepare(
    'INSERT INTO clients (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)'
  ).run(str(b.first_name, 80), str(b.last_name || '', 80), email, phone).lastInsertRowid);

  addToWaitlist({
    clientId, serviceId: b.service_id, staffId: b.staff_id,
    weekdays: b.weekdays || '', fromDate: b.from_date || '',
    untilDate: b.until_date || '', note: b.note || '',
  });
  return { ok: true, detail: "You're on the list. We'll message you the moment something opens up." };
}, { auth: false });

route('POST', '/api/public/book', async ({ req }) => {
  if (getSetting('booking_enabled', '1') !== '1') throw httpError(404, 'Online booking is disabled');
  const b = checkBody(await readJson(req), {
    service_id: s.num(), service_ids: s.arr(s.num(), 20), staff_id: s.num(), location_id: s.num(),
    date: s.str(10, { required: true }), start_min: s.num({ min: 0, max: 1439, required: true }),
    notes: s.str(1000), origin: s.str(300), turnstile_token: s.str(2048),
    from_message: s.str(64),
    client: s.obj({ first_name: s.str(100), last_name: s.str(100), email: s.str(200), phone: s.str(50) }, { required: true }),
  });
  // Before anything is written: is there a person on the other end? Checked
  // here rather than in the browser, because a bot never runs the browser half.
  const human = await verifyTurnstile(b.turnstile_token, clientIp(req));
  if (!human.ok) throw httpError(400, human.detail);
  // One or more services; the first is the appointment's primary service.
  const svc = resolveServices(b, { required: true });
  const service = svc.services[0];
  const duration = svc.totalDuration;
  const { date: todayLocal, min: nowMin } = bizNow();
  if (!isDateStr(b.date) || b.date < todayLocal) throw httpError(400, 'Choose an upcoming date');
  // Far-future bookings are welcome, but not beyond the horizon the owner set —
  // otherwise a crafted request could sit in the diary years out.
  if (b.date > addDaysStr(todayLocal, bookingHorizonDays())) {
    throw httpError(400, `We only take bookings up to ${bookingHorizonDays()} days ahead`);
  }
  const start = clampInt(b.start_min, 0, 1439, NaN);
  if (Number.isNaN(start)) throw httpError(400, 'Choose a time');
  // Reject a time that's already passed today, even if a stale page offered it.
  const leadMin = Math.max(0, Number(getSetting('booking_lead_min', '0')) || 0);
  if (b.date === todayLocal && start <= nowMin) throw httpError(400, 'That time has already passed — please pick a later time');
  if (b.date === todayLocal && start < nowMin + leadMin) throw httpError(400, 'That time is too soon — please pick a later time');

  const first = str(b.client?.first_name, 100);
  const phone = str(b.client?.phone, 50);
  if (!first) throw httpError(400, 'Your first name is required');
  if (!phone && !str(b.client?.email)) throw httpError(400, 'A phone number or email is required');

  // Shut that day — a closed weekday, or an off week of a day that only runs
  // every 2nd/3rd/4th week. Said plainly, because "that time was just taken"
  // would send someone hunting for another slot that was never there.
  if (!isOpenDay(b.date)) throw httpError(409, "We're closed that day — please pick another date");

  let staffId = Number(b.staff_id) || 0;
  if (staffId) {
    if (!freeSlotsFor(staffId, b.date, duration).includes(start)) {
      throw httpError(409, 'That time was just taken — please pick another slot');
    }
  } else {
    const locationId = Number(b.location_id) || 0;
    const staffList = locationId
      ? db.prepare('SELECT id FROM staff WHERE active = 1 AND location_id = ? ORDER BY id').all(locationId)
      : db.prepare('SELECT id FROM staff WHERE active = 1 ORDER BY id').all();
    staffId = staffList.find((s) => freeSlotsFor(s.id, b.date, duration).includes(start))?.id;
    if (!staffId) throw httpError(409, 'That time was just taken — please pick another slot');
  }

  const email = str(b.client?.email, 200).toLowerCase();
  let client = email ? db.prepare('SELECT * FROM clients WHERE email = ?').get(email) : null;
  if (!client && phone) client = db.prepare('SELECT * FROM clients WHERE phone = ? AND first_name = ?').get(phone, first);
  if (!client) {
    const info = db.prepare('INSERT INTO clients (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)')
      .run(first, str(b.client?.last_name, 100), email, phone);
    client = { id: Number(info.lastInsertRowid) };
  }

  // Which message brought them, if any. Looked up rather than trusted: the
  // token has to name a real message we sent to this same client, so a token
  // shared between friends credits nobody rather than crediting the wrong
  // person and inflating what the campaign appears to have earned.
  const credited = attributionFor(str(b.from_message, 64), client.id);

  const info = db.prepare(
    `INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status, notes, source, source_message_id)
     VALUES (?, ?, ?, ?, ?, ?, 'booked', ?, 'online', ?)`
  ).run(client.id, staffId, service.id, b.date, start, start + duration, str(b.notes, 1000), credited);
  const apptId = Number(info.lastInsertRowid);
  setApptServices(apptId, svc.ids);

  // Deposit via Stripe Checkout (optional). If Stripe errors, never lose the
  // booking — it proceeds without a deposit and the workspace still sees it.
  // A percentage deposit is taken on the combined price of all services.
  let checkoutUrl = null;
  const totalPriceCents = svc.services.reduce((sum, x) => sum + (x.price_cents || 0), 0);
  const serviceLabel = svc.services.map((x) => x.name).join(' + ');
  const depositCents = depositCentsFor({ price_cents: totalPriceCents });
  if (depositCents > 0 && stripeConfigured()) {
    try {
      const origin = str(b.origin, 300) || `http://localhost:${process.env.PORT || 4820}`;
      const session = await createDepositCheckout({
        appointmentId: apptId, serviceName: serviceLabel, depositCents, origin,
      });
      db.prepare("UPDATE appointments SET deposit_cents = ?, deposit_status = 'pending', stripe_session_id = ? WHERE id = ?")
        .run(depositCents, session.session_id, apptId);
      checkoutUrl = session.url;
    } catch (err) {
      console.error('Stripe checkout failed, booking continues without deposit:', err.message);
    }
  }

  queueAppointmentMessages(apptId);
  queueOwnerNotification(apptId); // alert the owner: a customer just booked
  processQueue().catch(() => {});

  const appt = db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(apptId);
  return {
    reference: `BK-${String(appt.id).padStart(5, '0')}`,
    appointment_id: appt.id,
    // The signed link for this booking's calendar file — the customer gets it
    // because they just made the booking, not because they know its id.
    ics_url: `/api/public/ics/${appt.id}?t=${recordToken('ics', appt.id, getSetting('session_secret'))}`,
    date: appt.date, start_min: appt.start_min, end_min: appt.end_min,
    service: appt.services_summary || appt.service_name, staff: appt.staff_name,
    business_name: getSetting('business_name'),
    checkout_url: checkoutUrl,
    deposit_cents: checkoutUrl ? depositCents : 0,
  };
}, { auth: false });

route('POST', '/api/public/confirm-deposit', async ({ req }) => {
  const { appointment_id, session_id } = checkBody(await readJson(req), {
    appointment_id: s.num({ required: true }), session_id: s.str(300, { required: true }),
  });
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(Number(appointment_id));
  if (!appt) throw httpError(404, 'Booking not found');
  if (!appt.stripe_session_id || appt.stripe_session_id !== str(session_id, 300)) {
    throw httpError(400, 'That payment session does not match this booking');
  }
  let paid = appt.deposit_status === 'paid';
  let cents = appt.deposit_cents;
  if (!paid) {
    const check = await verifyDepositSession(appt.stripe_session_id);
    paid = check.paid;
    if (paid) {
      cents = check.amount_cents || appt.deposit_cents;
      db.prepare("UPDATE appointments SET deposit_status = 'paid', deposit_cents = ?, status = 'confirmed' WHERE id = ?")
        .run(cents, appt.id);
      queueDepositReceipt(appt.id, cents);
      processQueue().catch(() => {});
    }
  }
  const full = db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(appt.id);
  return {
    paid, deposit_cents: cents,
    reference: `BK-${String(full.id).padStart(5, '0')}`,
    appointment_id: full.id,
    ics_url: `/api/public/ics/${full.id}?t=${recordToken('ics', full.id, getSetting('session_secret'))}`,
    date: full.date, start_min: full.start_min, end_min: full.end_min,
    service: full.service_name, staff: full.staff_name,
    business_name: getSetting('business_name'),
  };
}, { auth: false });

// "Add to calendar" file for a confirmed booking. Exposes only service/time/
// business (no client details), so a guessed id leaks nothing personal.
// The calendar file for one booking. The appointment id alone is not proof of
// anything — ids are sequential, so without a token anyone could walk 1,2,3…
// and read back the salon's whole diary: every date, time and service booked.
// The signed token in the link is the credential, exactly as it is for the
// cancel and review links. A wrong or missing one is a 404, not a 403, so the
// response never confirms whether that booking exists.
route('GET', '/api/public/ics/:id', async ({ res, params, query }) => {
  if (!recordTokenValid('ics', params.id, query.get('t'), getSetting('session_secret'))) {
    throw httpError(404, 'Booking not found');
  }
  const a = db.prepare(
    `SELECT a.*, sv.name AS service_name FROM appointments a
     LEFT JOIN services sv ON sv.id = a.service_id WHERE a.id = ?`
  ).get(params.id);
  if (!a || a.status === 'cancelled') throw httpError(404, 'Booking not found');
  const biz = getSetting('business_name', 'Appointment');
  const d = a.date.replace(/-/g, '');
  const t = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kairo//Booking//EN',
    'BEGIN:VEVENT',
    `UID:kairo-appt-${a.id}@kairo`,
    `DTSTART:${d}T${t(a.start_min)}`,
    `DTEND:${d}T${t(a.end_min)}`,
    `SUMMARY:${(a.service_name || 'Appointment').replace(/[,;]/g, ' ')} — ${biz.replace(/[,;]/g, ' ')}`,
    `LOCATION:${getSetting('business_address', '').replace(/[,;]/g, ' ')}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  sendText(res, 200, ics, 'text/calendar; charset=utf-8', { 'Content-Disposition': 'attachment; filename="appointment.ics"' });
}, { auth: false });

// ---------------------------------------------------------------------------
// Public reviews — reached via a random per-appointment token, not the
// numeric id, so a guessed/incremented URL can't leave a review on someone
// else's visit. Only a 'completed' appointment can be reviewed, once.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Client self-cancellation (no auth — the token in the link IS the credential)
// ---------------------------------------------------------------------------

/** Everything the cancel page and the cancel action both need to decide. */
function cancelLinkContext(token) {
  const a = db.prepare(
    `SELECT a.id, a.status, a.date, a.start_min, a.end_min, a.cancelled_by,
            c.first_name, s.name AS staff_name
     FROM appointments a
     LEFT JOIN clients c ON c.id = a.client_id
     LEFT JOIN staff s ON s.id = a.staff_id
     WHERE a.cancel_token = ? AND a.cancel_token != ''`
  ).get(token);
  if (!a) return null;
  const names = db.prepare(
    `SELECT sv.name FROM appointment_services aps JOIN services sv ON sv.id = aps.service_id
     WHERE aps.appointment_id = ? ORDER BY aps.sort_order, aps.id`
  ).all(a.id).map((r) => r.name);
  a.service_name = names.join(' + ') || db.prepare(
    'SELECT sv.name FROM appointments ap LEFT JOIN services sv ON sv.id = ap.service_id WHERE ap.id = ?'
  ).get(a.id)?.name || 'your appointment';

  // Minutes from now until the appointment starts, in the business's own time
  // zone — the same clock the booking page uses, so "12 hours before" means
  // the same thing to the client and the salon.
  const { date: todayLocal, min: nowMin } = bizNow();
  const dayDiff = (Date.parse(`${a.date}T00:00:00Z`) - Date.parse(`${todayLocal}T00:00:00Z`)) / 86400000;
  const minutesUntil = dayDiff * 1440 + a.start_min - nowMin;
  const windowHrs = Math.max(0, Number(getSetting('cancel_window_hours', '12')) || 0);

  return {
    appt: a,
    windowHrs,
    minutesUntil,
    past: minutesUntil <= 0,
    tooLate: minutesUntil > 0 && minutesUntil < windowHrs * 60,
    enabled: getSetting('client_cancel_enabled', '1') === '1',
  };
}

const cancelPayload = (ctx) => ({
  business_name: getSetting('business_name'),
  business_phone: getSetting('business_phone', ''),
  first_name: ctx.appt.first_name || '',
  service_name: ctx.appt.service_name,
  staff_name: ctx.appt.staff_name || '',
  date: ctx.appt.date,
  start_min: ctx.appt.start_min,
  end_min: ctx.appt.end_min,
  status: ctx.appt.status,
  cancelled_by: ctx.appt.cancelled_by || '',
  cancel_window_hours: ctx.windowHrs,
  can_cancel: ctx.enabled && !ctx.past && !ctx.tooLate && ctx.appt.status !== 'cancelled' && ctx.appt.status !== 'completed',
  too_late: ctx.tooLate,
  past: ctx.past,
  disabled: !ctx.enabled,
  brand: {
    accent: getSetting('brand_accent', '#38bdf8'),
    theme: getSetting('brand_theme', 'dark'),
    scheme: getSetting('brand_scheme', ''),
    font: getSetting('brand_font', 'modern'),
    logo: getSetting('brand_logo', ''),
  },
});

/**
 * The business's logo as a real image over HTTP.
 *
 * It is stored as a data: URI, which is fine in a browser but blocked outright
 * by Gmail and Outlook — so an email has to point at a URL instead. Public by
 * design: it is the same logo already on the booking page.
 */
route('GET', '/api/public/logo', async ({ res }) => {
  const raw = getSetting('brand_logo', '');
  const m = /^data:(image\/[a-z+.-]{1,20});base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw || '');
  if (!m) throw httpError(404, 'No logo set');
  const bytes = Buffer.from(m[2], 'base64');
  if (!bytes.length) throw httpError(404, 'No logo set');
  res.writeHead(200, {
    'Content-Type': m[1],
    'Content-Length': bytes.length,
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox", // it is an image, never a document
  });
  res.end(bytes);
}, { auth: false });

/**
 * The unsubscribe link at the foot of every campaign email.
 *
 * Two steps rather than one, deliberately. A GET that changes something is
 * followed by corporate link-scanners and mail-security products, and a client
 * quietly dropped off a salon's list by their own IT department is a failure
 * nobody would ever see. So the link opens a page with a button, and the button
 * is what does it.
 *
 * Plain HTML with no scripts: this has to work in a stripped-down in-app
 * browser, on a slow phone, with JavaScript off. It is the one page where
 * "didn't load" is not an acceptable outcome.
 */
/* The only HTML this module builds by hand, so the escaper lives with it. */
const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const unsubPage = (title, body, buttonToken) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#f4f5f7; color:#16202c; padding:24px;
    font:16px/1.65 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif; }
  @media (prefers-color-scheme: dark) { body { background:#10151b; color:#e7ecf2; } .card { background:#19202a !important; border-color:#2a3441 !important; } }
  .card { background:#fff; border:1px solid #dfe4ea; border-radius:14px; padding:30px 28px;
    max-width:30rem; width:100%; box-shadow:0 10px 30px -22px rgba(0,0,0,.5); }
  h1 { font-size:20px; margin:0 0 12px; line-height:1.3; }
  p { margin:0 0 14px; }
  p:last-child { margin-bottom:0; }
  .muted { color:#68727f; font-size:14px; }
  button { font:inherit; font-weight:600; cursor:pointer; margin-top:6px;
    background:#16202c; color:#fff; border:none; border-radius:9px; padding:11px 18px; }
  button:hover { background:#2a3745; }
</style>
</head><body><div class="card">
<h1>${escHtml(title)}</h1>
${body}
${buttonToken ? `<form method="POST" action="/api/public/unsubscribe">
  <input type="hidden" name="t" value="${escHtml(buttonToken)}">
  <button type="submit">Yes, stop sending me offers</button>
</form>` : ''}
</div></body></html>`;

const sendUnsubPage = (res, status, html) => {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
  });
  res.end(html);
};

route('GET', '/api/public/unsubscribe', async ({ res, query }) => {
  const biz = getSetting('business_name', 'this business');
  const c = clientByUnsubToken(str(query.get('t'), 64));
  if (!c) {
    sendUnsubPage(res, 404, unsubPage('That link has expired',
      '<p class="muted">We couldn\'t match this link to anyone. If you\'re still getting messages '
      + 'you don\'t want, just reply to one of them and we\'ll sort it out.</p>', ''));
    return;
  }
  if (c.marketing_opt_out) {
    sendUnsubPage(res, 200, unsubPage('You\'re already unsubscribed',
      `<p>You won't be sent offers from ${escHtml(biz)}.</p>`
      + '<p class="muted">You\'ll still get confirmations and reminders for appointments you book — '
      + 'those aren\'t marketing, and you\'d want to know what time to turn up.</p>', ''));
    return;
  }
  sendUnsubPage(res, 200, unsubPage('Stop receiving offers?',
    `<p>Hi ${escHtml(c.first_name || 'there')} — confirm and ${escHtml(biz)} won't send you offers again.</p>`
    + '<p class="muted">You\'ll still get confirmations and reminders for appointments you book. '
    + 'Those aren\'t marketing, and you\'d want to know what time to turn up.</p>',
  str(query.get('t'), 64)));
}, { auth: false });

route('POST', '/api/public/unsubscribe', async ({ req, res }) => {
  // Sent as a plain form post, because the page it comes from has no scripts.
  const raw = await readBody(req);
  const token = str(new URLSearchParams(raw).get('t') || '', 64);
  const biz = getSetting('business_name', 'this business');
  const c = clientByUnsubToken(token);
  if (!c) {
    sendUnsubPage(res, 404, unsubPage('That link has expired',
      '<p class="muted">We couldn\'t match this link to anyone. Reply to any message from us and '
      + 'we\'ll take you off by hand.</p>', ''));
    return;
  }
  setMarketingOptOut(c.id, true);
  sendUnsubPage(res, 200, unsubPage('Done — no more offers',
    `<p>${escHtml(biz)} won't send you offers again.</p>`
    + '<p class="muted">You\'ll still get confirmations and reminders for appointments you book. '
    + 'Changed your mind? Just let us know next time you\'re in.</p>', ''));
}, { auth: false });

route('GET', '/api/public/cancel', async ({ query }) => {
  const ctx = cancelLinkContext(str(query.get('token'), 64));
  if (!ctx) throw httpError(404, 'This cancellation link is no longer valid');
  return cancelPayload(ctx);
}, { auth: false });

route('POST', '/api/public/cancel', async ({ req }) => {
  const b = checkBody(await readJson(req), { token: s.str(64, { required: true }), reason: s.str(300) });
  const ctx = cancelLinkContext(str(b.token, 64));
  if (!ctx) throw httpError(404, 'This cancellation link is no longer valid');
  if (!ctx.enabled) throw httpError(403, 'Online cancellation is turned off — please call us instead');
  if (ctx.appt.status === 'cancelled') return { ...cancelPayload(ctx), ok: true, already: true };
  if (ctx.appt.status === 'completed') throw httpError(409, 'That visit has already happened');
  if (ctx.past) throw httpError(409, 'That appointment has already started — please call us');
  if (ctx.tooLate) {
    throw httpError(409, `Cancellations need ${ctx.windowHrs} hours' notice — please call us so we can free the slot`);
  }
  cancelAppointment(ctx.appt.id, { by: 'client', reason: b.reason || '' });
  const after = cancelLinkContext(str(b.token, 64));
  return { ...cancelPayload(after), ok: true };
}, { auth: false });

route('GET', '/api/public/review', async ({ query }) => {
  const token = str(query.get('token'), 64);
  if (!token) throw httpError(400, 'Missing review link');
  const a = db.prepare(
    `SELECT a.id, a.status, a.date, c.first_name, sv.name AS service_name, s.name AS staff_name
     FROM appointments a
     LEFT JOIN clients c ON c.id = a.client_id
     LEFT JOIN services sv ON sv.id = a.service_id
     LEFT JOIN staff s ON s.id = a.staff_id
     WHERE a.review_token = ?`
  ).get(token);
  if (!a || a.status !== 'completed') throw httpError(404, 'This review link is no longer valid');
  const existing = db.prepare('SELECT rating, comment FROM reviews WHERE appointment_id = ?').get(a.id);
  return {
    business_name: getSetting('business_name'),
    first_name: a.first_name || '',
    service_name: a.service_name || 'your visit',
    staff_name: a.staff_name || '',
    date: a.date,
    already_reviewed: Boolean(existing),
    existing_rating: existing?.rating || 0,
    google_review_url: getSetting('google_review_url', ''),
    brand: {
      accent: getSetting('brand_accent', '#38bdf8'),
      theme: getSetting('brand_theme', 'dark'),
      scheme: getSetting('brand_scheme', ''),
      font: getSetting('brand_font', 'modern'),
    },
  };
}, { auth: false });

route('POST', '/api/public/review', async ({ req }) => {
  const b = checkBody(await readJson(req), {
    token: s.str(64, { required: true }),
    rating: s.num({ min: 1, max: 5, required: true }),
    comment: s.str(1000),
  });
  const token = str(b.token, 64);
  if (!token) throw httpError(400, 'Missing review link');
  const rating = clampInt(b.rating, 1, 5, NaN);
  if (Number.isNaN(rating)) throw httpError(400, 'Choose a star rating');
  const a = db.prepare('SELECT id, client_id, staff_id, status FROM appointments WHERE review_token = ?').get(token);
  if (!a || a.status !== 'completed') throw httpError(404, 'This review link is no longer valid');
  if (db.prepare('SELECT 1 FROM reviews WHERE appointment_id = ?').get(a.id)) {
    throw httpError(409, 'You already left a review for this visit — thank you!');
  }
  db.prepare('INSERT INTO reviews (appointment_id, client_id, staff_id, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(a.id, a.client_id, a.staff_id, rating, str(b.comment, 1000));
  return { ok: true, google_review_url: rating >= 4 ? getSetting('google_review_url', '') : '' };
}, { auth: false });
