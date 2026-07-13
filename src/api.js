// REST API. All routes live under /api. Handlers may return a value (sent as
// JSON 200), send the response themselves, or throw httpError(status, msg).
import {
  db, getSetting, setSetting, getSettings, nextInvoiceNumber, resetDemo, clearBusinessData, SECRET_SETTINGS,
} from './db.js';
import {
  readJson, sendJson, sendText, httpError, parseCookies, todayStr, isDateStr, clampInt, toCsv,
} from './util.js';
import {
  hashPassword, verifyPassword, createSession, verifySession,
  sessionCookie, clearSessionCookie, COOKIE_NAME,
} from './auth.js';
import {
  queueAppointmentMessages, cancelQueuedMessages, requeueAppointmentMessages,
  queueReceiptMessage, queueDepositReceipt, queueReviewRequest, queueOwnerNotification,
  deliverMessage, processQueue,
} from './notify.js';
import { depositCentsFor, stripeConfigured, createDepositCheckout, verifyDepositSession } from './stripe.js';
import { VERSION } from './version.js';
import { checkBody, s } from './validate.js';
import { hit as rateHit, clientIp, classifyRequest } from './ratelimit.js';
import { renderEmail } from './email-html.js';
import { sendEmail } from './notify.js';
import crypto from 'node:crypto';

const APPT_STATUSES = new Set(['booked', 'confirmed', 'completed', 'cancelled', 'no_show']);
const INVOICE_STATUSES = new Set(['draft', 'sent', 'paid', 'void']);
const PAY_METHODS = new Set(['card', 'cash', 'transfer', 'other']);

// ---------------------------------------------------------------------------
// Routing table
// ---------------------------------------------------------------------------

const routes = [];
function route(method, pattern, handler, { auth = true } = {}) {
  const names = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:[a-zA-Z_]+/g, (m) => { names.push(m.slice(1)); return '(\\d+)'; }) + '$'
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
    r.names.forEach((n, i) => { params[n] = Number(m[i + 1]); });

    let user = null;
    if (r.auth) {
      const token = parseCookies(req)[COOKIE_NAME];
      const userId = verifySession(token, getSetting('session_secret'));
      if (userId) user = db.prepare('SELECT id, name, email, role, email_verified FROM users WHERE id = ?').get(userId);
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
  if (!user || !verifyPassword(String(password || ''), user.salt, user.pass_hash)) {
    throw httpError(401, 'Invalid email or password');
  }
  const token = createSession(user.id, getSetting('session_secret'));
  res.setHeader('Set-Cookie', sessionCookie(token));
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role, email_verified: user.email_verified } };
}, { auth: false });

route('POST', '/api/auth/logout', async ({ res }) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  return { ok: true };
}, { auth: false });

route('GET', '/api/auth/me', async ({ user }) => ({ user, settings: getSettings(), version: VERSION }));

route('GET', '/api/version', async () => ({ version: VERSION }), { auth: false });

route('PUT', '/api/auth/password', async ({ req, user }) => {
  const { current, next } = checkBody(await readJson(req), {
    current: s.str(200, { required: true }),
    next: s.str(200, { required: true }),
  });
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!verifyPassword(String(current || ''), row.salt, row.pass_hash)) {
    throw httpError(400, 'Current password is incorrect');
  }
  if (!next || String(next).length < 8) throw httpError(400, 'New password must be at least 8 characters');
  const { salt, hash } = hashPassword(String(next));
  db.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').run(hash, salt, user.id);
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
  const origin = getSetting('public_url') || `${proto}://${req.headers.host}`;
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
  'booking_enabled', 'invoice_prefix', 'invoice_due_days', 'invoice_footer',
  'open_days', 'brand_scheme',
  'confirm_enabled', 'reminders_enabled', 'reminder_hours', 'notif_from_email',
  'owner_notify_enabled',
  'receipts_enabled', 'review_requests_enabled', 'review_delay_hours', 'google_review_url',
  'sms_notifications_enabled', 'public_url',
  'resend_api_key', 'twilio_sid', 'twilio_token', 'twilio_from',
  'stripe_secret_key', 'currency_code', 'deposit_type', 'deposit_value',
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
    setSetting(k, str(v, settingCap(k)));
  }
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
  service_id: s.num(), staff_id: s.num({ required: true }),
  date: s.str(10, { required: true }), start_min: s.num({ min: 0, max: 1439, required: true }),
  end_min: s.num({ min: 0, max: 1440 }),
  status: s.oneOf(['booked', 'confirmed', 'completed', 'cancelled', 'no_show']),
  notes: s.str(2000), force: s.bool(),
};

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

route('POST', '/api/clients/import', async ({ req }) => {
  const { rows } = await readJson(req);
  if (!Array.isArray(rows)) throw httpError(400, 'Expected { rows: [...] }');
  if (rows.length > 5000) throw httpError(400, 'Import is limited to 5000 rows at a time');
  const byEmail = db.prepare('SELECT id FROM clients WHERE email = ? AND email != ?');
  const byNamePhone = db.prepare("SELECT id FROM clients WHERE first_name = ? AND last_name = ? AND phone = ? AND phone != ''");
  const ins = db.prepare('INSERT INTO clients (first_name, last_name, email, phone, notes) VALUES (?, ?, ?, ?, ?)');
  let imported = 0, skipped = 0, invalid = 0;
  for (const raw of rows) {
    let fields;
    try { fields = clientBody(raw); } catch { invalid++; continue; }
    const [first, last, email, phone] = fields;
    const dupe = (email && byEmail.get(email, '')) || byNamePhone.get(first, last, phone);
    if (dupe) { skipped++; continue; }
    ins.run(...fields);
    imported++;
  }
  return { imported, skipped, invalid };
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
    s.name AS staff_name, s.color AS staff_color,
    sv.name AS service_name, sv.price_cents AS service_price_cents,
    (SELECT i.id FROM invoices i WHERE i.appointment_id = a.id AND i.status != 'void' LIMIT 1) AS invoice_id
  FROM appointments a
  LEFT JOIN clients c ON c.id = a.client_id
  LEFT JOIN staff s ON s.id = a.staff_id
  LEFT JOIN services sv ON sv.id = a.service_id`;

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

async function apptBody(req) {
  const b = checkBody(await readJson(req), APPT_SCHEMA);
  const staffId = Number(b.staff_id);
  if (!db.prepare('SELECT id FROM staff WHERE id = ?').get(staffId)) throw httpError(400, 'Choose a staff member');
  if (!isDateStr(b.date)) throw httpError(400, 'Date must be YYYY-MM-DD');
  const start = clampInt(b.start_min, 0, 1439, NaN);
  if (Number.isNaN(start)) throw httpError(400, 'Start time is required');

  const serviceId = Number(b.service_id) || null;
  const service = serviceId ? db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) : null;
  let end = clampInt(b.end_min, start + 5, 1440, NaN);
  if (Number.isNaN(end)) end = start + (service ? service.duration_min : 30);

  let clientId = Number(b.client_id) || null;
  if (!clientId && b.new_client && str(b.new_client.first_name)) {
    const info = db.prepare('INSERT INTO clients (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)')
      .run(str(b.new_client.first_name, 100), str(b.new_client.last_name, 100),
           str(b.new_client.email, 200).toLowerCase(), str(b.new_client.phone, 50));
    clientId = Number(info.lastInsertRowid);
  }

  const status = APPT_STATUSES.has(b.status) ? b.status : 'booked';
  return { b, staffId, date: b.date, start, end, serviceId, clientId, status, notes: str(b.notes, 2000) };
}

route('POST', '/api/appointments', async ({ req }) => {
  const a = await apptBody(req);
  const conflict = findConflict(a.staffId, a.date, a.start, a.end);
  if (conflict && !a.b.force) {
    throw Object.assign(httpError(409, 'This time overlaps another appointment'), { data: { conflict } });
  }
  const info = db.prepare(
    `INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'staff')`
  ).run(a.clientId, a.staffId, a.serviceId, a.date, a.start, a.end, a.status, a.notes);
  queueAppointmentMessages(Number(info.lastInsertRowid));
  processQueue().catch(() => {});
  return db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(info.lastInsertRowid);
});

route('PUT', '/api/appointments/:id', async ({ req, params }) => {
  const before = db.prepare('SELECT * FROM appointments WHERE id = ?').get(params.id);
  if (!before) throw httpError(404, 'Appointment not found');
  const a = await apptBody(req);
  const conflict = findConflict(a.staffId, a.date, a.start, a.end, params.id);
  if (conflict && !a.b.force) {
    throw Object.assign(httpError(409, 'This time overlaps another appointment'), { data: { conflict } });
  }
  db.prepare(
    `UPDATE appointments SET client_id = ?, staff_id = ?, service_id = ?, date = ?, start_min = ?, end_min = ?, status = ?, notes = ?
     WHERE id = ?`
  ).run(a.clientId, a.staffId, a.serviceId, a.date, a.start, a.end, a.status, a.notes, params.id);
  if (['cancelled', 'no_show', 'completed'].includes(a.status)) {
    cancelQueuedMessages(params.id);
    if (a.status === 'completed' && before.status !== 'completed') queueReviewRequest(params.id);
  } else if (before.date !== a.date || before.start_min !== a.start) {
    requeueAppointmentMessages(params.id); // rescheduled → fresh reminder
  }
  return db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(params.id);
});

route('PATCH', '/api/appointments/:id/status', async ({ req, params }) => {
  const { status } = checkBody(await readJson(req), { status: s.oneOf(['booked', 'confirmed', 'completed', 'cancelled', 'no_show'], { required: true }) });
  if (!APPT_STATUSES.has(status)) throw httpError(400, 'Invalid status');
  const before = db.prepare('SELECT status FROM appointments WHERE id = ?').get(params.id);
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, params.id);
  if (['cancelled', 'no_show', 'completed'].includes(status)) {
    cancelQueuedMessages(params.id);
    if (status === 'completed' && before?.status !== 'completed') queueReviewRequest(params.id);
  }
  return db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(params.id);
});

route('DELETE', '/api/appointments/:id', async ({ params }) => {
  cancelQueuedMessages(params.id);
  db.prepare('DELETE FROM appointments WHERE id = ?').run(params.id);
  return { ok: true };
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
  return db.prepare(
    `SELECT m.*, c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS client_name,
            a.date AS appt_date, a.start_min AS appt_start
     FROM messages m
     LEFT JOIN clients c ON c.id = m.client_id
     LEFT JOIN appointments a ON a.id = m.appointment_id
     ${where} ORDER BY m.id DESC LIMIT 300`
  ).all(...args);
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
  const issue = isDateStr(b.issue_date) ? b.issue_date : todayStr();
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
  const issue = todayStr();
  const dueDays = clampInt(getSetting('invoice_due_days', '7'), 0, 365, 7);
  const info = db.prepare(
    `INSERT INTO invoices (number, client_id, appointment_id, issue_date, due_date, status, tax_rate)
     VALUES (?, ?, ?, ?, ?, 'draft', ?)`
  ).run(nextInvoiceNumber(), appt.client_id, appt.id, issue, addDays(issue, dueDays), Number(getSetting('tax_rate', '0')));
  const invId = Number(info.lastInsertRowid);
  if (appt.service_id) {
    db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_cents) VALUES (?, ?, 1, ?)')
      .run(invId, appt.service_name, appt.service_price_cents || 0);
  }
  // an online deposit already collected counts as a payment on this invoice
  if (appt.deposit_status === 'paid' && appt.deposit_cents > 0) {
    db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(invId);
    db.prepare('INSERT INTO payments (invoice_id, amount_cents, method, paid_at, note) VALUES (?, ?, ?, ?, ?)')
      .run(invId, appt.deposit_cents, 'card', `${todayStr()} 00:00:00`, 'Online booking deposit (Stripe)');
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
    method: s.oneOf(['card', 'cash', 'transfer', 'other']),
    note: s.str(500),
  });
  const amount = Math.round(Number(b.amount_cents));
  if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, 'Payment amount must be positive');
  const method = PAY_METHODS.has(b.method) ? b.method : 'card';
  db.prepare('INSERT INTO payments (invoice_id, amount_cents, method, paid_at, note) VALUES (?, ?, ?, ?, ?)')
    .run(params.id, amount, method, `${todayStr()} ${new Date().toTimeString().slice(0, 8)}`, str(b.note, 500));
  if (inv.status === 'draft') db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(params.id);
  refreshPaidStatus(params.id);
  const updated = getInvoice(params.id);
  queueReceiptMessage(Number(params.id), { amountCents: amount, method, balanceCents: Math.max(0, updated.balance_cents) });
  processQueue().catch(() => {});
  return updated;
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
  const monthAgo = addDays(todayStr(), -30);
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

route('GET', '/api/dashboard', async () => {
  const today = todayStr();
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
    today: { count: todayRow.n, expected_cents: todayRow.expected },
    week_revenue_cents: weekRevenue,
    outstanding_cents: outstanding,
    clients: { total: clientsTotal, new_30d: clientsNew },
    upcoming,
    revenue_by_day: revenueByDay,
    bookings_by_hour: bookingsByHour,
    top_services: topServices,
  };
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
    currency: getSetting('currency', '$'),
    open_min: Number(getSetting('open_min', '480')),
    close_min: Number(getSetting('close_min', '1200')),
    open_days: String(getSetting('open_days', '0,1,2,3,4,5,6')).split(',').map(Number),
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
    staff: db.prepare('SELECT id, name, title, location_id FROM staff WHERE active = 1 ORDER BY id').all(),
    locations: db.prepare('SELECT id, name, address, phone FROM locations WHERE active = 1 ORDER BY id').all(),
    deposit: {
      enabled: stripeConfigured() && getSetting('deposit_type', 'none') !== 'none',
      type: getSetting('deposit_type', 'none'),
      value: Number(getSetting('deposit_value', '0')) || 0,
    },
  };
}, { auth: false });

/** Weekday numbers (0=Sun…6=Sat) the business is open. */
function openDays() {
  return String(getSetting('open_days', '0,1,2,3,4,5,6'))
    .split(',').map((d) => Number(d.trim())).filter((d) => d >= 0 && d <= 6);
}

function isOpenDay(date) {
  return openDays().includes(new Date(`${date}T12:00:00`).getDay());
}

function freeSlotsFor(staffId, date, durationMin) {
  if (!isOpenDay(date)) return []; // closed that day of the week
  const open = Number(getSetting('open_min', '480'));
  const close = Number(getSetting('close_min', '1200'));
  const step = Math.max(5, Number(getSetting('slot_interval', '15')));
  const busy = db.prepare(
    "SELECT start_min, end_min FROM appointments WHERE staff_id = ? AND date = ? AND status NOT IN ('cancelled', 'no_show')"
  ).all(staffId, date);

  const now = new Date();
  const isToday = date === todayStr();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const slots = [];
  for (let t = open; t + durationMin <= close; t += step) {
    if (isToday && t <= nowMin) continue;
    if (!busy.some((b) => t < b.end_min && t + durationMin > b.start_min)) slots.push(t);
  }
  return slots;
}

route('GET', '/api/public/availability', async ({ query }) => {
  if (getSetting('booking_enabled', '1') !== '1') throw httpError(404, 'Online booking is disabled');
  const date = query.get('date');
  if (!isDateStr(date) || date < todayStr()) throw httpError(400, 'Choose an upcoming date');
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(Number(query.get('service_id')));
  if (!service) throw httpError(400, 'Choose a service');

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
    for (const t of freeSlotsFor(s.id, date, service.duration_min)) {
      if (!slotMap.has(t)) slotMap.set(t, s.id);
    }
  }
  return {
    duration_min: service.duration_min,
    slots: [...slotMap.entries()].sort((a, b) => a[0] - b[0]).map(([start_min, staff_id]) => ({ start_min, staff_id })),
  };
}, { auth: false });

route('POST', '/api/public/book', async ({ req }) => {
  if (getSetting('booking_enabled', '1') !== '1') throw httpError(404, 'Online booking is disabled');
  const b = checkBody(await readJson(req), {
    service_id: s.num({ required: true }), staff_id: s.num(), location_id: s.num(),
    date: s.str(10, { required: true }), start_min: s.num({ min: 0, max: 1439, required: true }),
    notes: s.str(1000), origin: s.str(300),
    client: s.obj({ first_name: s.str(100), last_name: s.str(100), email: s.str(200), phone: s.str(50) }, { required: true }),
  });
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(Number(b.service_id));
  if (!service) throw httpError(400, 'Choose a service');
  if (!isDateStr(b.date) || b.date < todayStr()) throw httpError(400, 'Choose an upcoming date');
  const start = clampInt(b.start_min, 0, 1439, NaN);
  if (Number.isNaN(start)) throw httpError(400, 'Choose a time');

  const first = str(b.client?.first_name, 100);
  const phone = str(b.client?.phone, 50);
  if (!first) throw httpError(400, 'Your first name is required');
  if (!phone && !str(b.client?.email)) throw httpError(400, 'A phone number or email is required');

  let staffId = Number(b.staff_id) || 0;
  const duration = service.duration_min;
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

  const info = db.prepare(
    `INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, 'booked', ?, 'online')`
  ).run(client.id, staffId, service.id, b.date, start, start + duration, str(b.notes, 1000));
  const apptId = Number(info.lastInsertRowid);

  // Deposit via Stripe Checkout (optional). If Stripe errors, never lose the
  // booking — it proceeds without a deposit and the workspace still sees it.
  let checkoutUrl = null;
  const depositCents = depositCentsFor(service);
  if (depositCents > 0 && stripeConfigured()) {
    try {
      const origin = str(b.origin, 300) || `http://localhost:${process.env.PORT || 4820}`;
      const session = await createDepositCheckout({
        appointmentId: apptId, serviceName: service.name, depositCents, origin,
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
    date: appt.date, start_min: appt.start_min, end_min: appt.end_min,
    service: appt.service_name, staff: appt.staff_name,
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
    date: full.date, start_min: full.start_min, end_min: full.end_min,
    service: full.service_name, staff: full.staff_name,
    business_name: getSetting('business_name'),
  };
}, { auth: false });

// "Add to calendar" file for a confirmed booking. Exposes only service/time/
// business (no client details), so a guessed id leaks nothing personal.
route('GET', '/api/public/ics/:id', async ({ res, params }) => {
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
