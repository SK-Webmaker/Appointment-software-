// SQLite persistence via Node's built-in node:sqlite — zero external dependencies.
// The whole business lives in one file: data/kairo.db (easy to back up / restore).
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword } from './auth.js';
import { dateStr } from './util.js';
import { VERSION } from './version.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.KAIRO_DATA_DIR || path.join(ROOT, 'data');
const DB_PATH = process.env.KAIRO_DB_PATH || path.join(DATA_DIR, 'kairo.db');

/**
 * Is this database sitting somewhere that will be wiped?
 *
 * Render, Railway, Fly and Heroku all give a container a fresh filesystem on
 * every deploy and restart. Anything written inside the app's own folder goes
 * with it — so a salon that has been taking bookings for a month loses the lot
 * the next time the code is updated, silently, with no error anywhere.
 *
 * The fix is always the same: attach a persistent disk and point
 * KAIRO_DATA_DIR at its mount path. This detects the dangerous case so it can
 * be said out loud at boot and shown in the app, rather than discovered later.
 *
 * Returns null when the storage is safe, or when we can't tell — a plain VPS
 * keeps its disk, so there is nothing to warn about there.
 */
export function storageWarning() {
  const host = process.env.RENDER ? 'Render'
    : process.env.RAILWAY_ENVIRONMENT ? 'Railway'
      : process.env.FLY_APP_NAME ? 'Fly.io'
        : process.env.DYNO ? 'Heroku' : null;
  if (!host) return null;
  const dir = path.resolve(DATA_DIR);
  const appDir = path.resolve(ROOT);
  // Inside the checked-out app directory = on the container's own throwaway disk.
  if (dir !== appDir && !dir.startsWith(appDir + path.sep)) return null;
  return {
    host,
    dir,
    message: `This database is inside the app folder on ${host}, which is erased on every deploy `
      + 'and restart. Every client, booking and invoice would be lost. Attach a persistent disk '
      + 'and set KAIRO_DATA_DIR to its mount path (e.g. /var/data).',
  };
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

/** Size of the database file on disk — the whole business, in bytes. */
export function dbFileBytes() {
  try { return fs.statSync(DB_PATH).size; } catch { return 0; }
}
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      pass_hash  TEXT NOT NULL,
      salt       TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS staff (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      title      TEXT NOT NULL DEFAULT '',
      color      TEXT NOT NULL DEFAULT '#3987e5',
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL DEFAULT '',
      email      TEXT NOT NULL DEFAULT '',
      phone      TEXT NOT NULL DEFAULT '',
      notes      TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'General',
      duration_min INTEGER NOT NULL DEFAULT 30,
      price_cents  INTEGER NOT NULL DEFAULT 0,
      price_type   TEXT NOT NULL DEFAULT 'fixed', -- fixed|from|free
      description  TEXT NOT NULL DEFAULT '',
      active       INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id  INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      staff_id   INTEGER NOT NULL REFERENCES staff(id),
      service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
      date       TEXT NOT NULL,             -- YYYY-MM-DD
      start_min  INTEGER NOT NULL,          -- minutes from midnight
      end_min    INTEGER NOT NULL,
      status     TEXT NOT NULL DEFAULT 'booked', -- booked|confirmed|completed|cancelled|no_show
      notes      TEXT NOT NULL DEFAULT '',
      source     TEXT NOT NULL DEFAULT 'staff',  -- staff|online
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_date  ON appointments(date);
    CREATE INDEX IF NOT EXISTS idx_appointments_staff ON appointments(staff_id, date);

    -- One appointment can bundle several services (e.g. Colour + Blow Dry).
    -- appointments.service_id stays as the "primary" (first) service for
    -- backward compatibility; this table holds the full ordered list.
    CREATE TABLE IF NOT EXISTS appointment_services (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      service_id     INTEGER REFERENCES services(id) ON DELETE SET NULL,
      sort_order     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_appt_services ON appointment_services(appointment_id);

    -- Retail products sold at the counter (POS) alongside services.
    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL DEFAULT 'General',
      supplier      TEXT NOT NULL DEFAULT '',
      sku           TEXT NOT NULL DEFAULT '',
      barcode       TEXT NOT NULL DEFAULT '',
      retail_cents  INTEGER NOT NULL DEFAULT 0,
      cost_cents    INTEGER NOT NULL DEFAULT 0,
      stock_qty     INTEGER NOT NULL DEFAULT 0,
      low_stock_at  INTEGER NOT NULL DEFAULT 3,
      image         TEXT NOT NULL DEFAULT '',   -- data: URI, like brand images
      taxable       INTEGER NOT NULL DEFAULT 1, -- GST applies
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      number         TEXT NOT NULL UNIQUE,
      client_id      INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      issue_date     TEXT NOT NULL,
      due_date       TEXT NOT NULL DEFAULT '',
      status         TEXT NOT NULL DEFAULT 'draft', -- draft|sent|paid|void
      tax_rate       REAL NOT NULL DEFAULT 0,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      notes          TEXT NOT NULL DEFAULT '',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL DEFAULT '',
      qty         REAL NOT NULL DEFAULT 1,
      unit_cents  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_items ON invoice_items(invoice_id);

    CREATE TABLE IF NOT EXISTS payments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      method       TEXT NOT NULL DEFAULT 'card', -- card|cash|transfer|other
      paid_at      TEXT NOT NULL,
      note         TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_payments ON payments(invoice_id);

    CREATE TABLE IF NOT EXISTS locations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      address    TEXT NOT NULL DEFAULT '',
      phone      TEXT NOT NULL DEFAULT '',
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      client_id      INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      channel        TEXT NOT NULL DEFAULT 'email',  -- email|sms
      kind           TEXT NOT NULL DEFAULT 'reminder', -- confirmation|reminder|receipt|review_request|test
      to_addr        TEXT NOT NULL DEFAULT '',
      subject        TEXT NOT NULL DEFAULT '',
      body           TEXT NOT NULL DEFAULT '',
      status         TEXT NOT NULL DEFAULT 'queued', -- queued|sent|failed|skipped
      detail         TEXT NOT NULL DEFAULT '',
      send_after     TEXT NOT NULL DEFAULT '',       -- local 'YYYY-MM-DD HH:MM'
      sent_at        TEXT NOT NULL DEFAULT '',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status, send_after);

    CREATE TABLE IF NOT EXISTS reviews (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      client_id      INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      staff_id       INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      rating         INTEGER NOT NULL, -- 1..5
      comment        TEXT NOT NULL DEFAULT '',
      response       TEXT NOT NULL DEFAULT '',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Owner-only blocked time (lunch, training, holiday…). Blocked periods are
    -- removed from online-booking availability; the reason is never shown to
    -- customers, only on the owner's calendar. staff_id NULL = the whole team.
    CREATE TABLE IF NOT EXISTS time_blocks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id   INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      date       TEXT NOT NULL,             -- YYYY-MM-DD
      start_min  INTEGER NOT NULL,          -- minutes from midnight
      end_min    INTEGER NOT NULL,
      reason     TEXT NOT NULL DEFAULT '',  -- owner's note, private
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_time_blocks_date ON time_blocks(date);

    -- When each team member works. Two kinds of row live here:
    --   the weekly pattern  → weekday 0-6, date ''
    --   a one-off for a day → weekday NULL, date 'YYYY-MM-DD'
    -- A one-off with working = 0 is a day off. See public/js/roster.js for how
    -- the two are resolved against each other and against opening hours.
    CREATE TABLE IF NOT EXISTS staff_shifts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      weekday    INTEGER,                       -- 0=Sun … 6=Sat, NULL for a one-off
      date       TEXT NOT NULL DEFAULT '',      -- '' for the weekly pattern
      start_min  INTEGER NOT NULL DEFAULT 0,
      end_min    INTEGER NOT NULL DEFAULT 0,
      working    INTEGER NOT NULL DEFAULT 1,    -- 0 = explicitly not working
      note       TEXT NOT NULL DEFAULT '',      -- "Annual leave", owner-only
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- One row per member per weekday, and per member per date: writing a shift
    -- replaces what was there rather than stacking a second one behind it.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_weekly ON staff_shifts(staff_id, weekday) WHERE date = '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_date ON staff_shifts(staff_id, date) WHERE date != '';
  `);
  migrate();
}

/** Additive column migrations so existing v1 databases upgrade in place. */
function migrate() {
  const addColumn = (table, column, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  addColumn('staff', 'location_id', 'location_id INTEGER REFERENCES locations(id)');
  addColumn('appointments', 'deposit_cents', "deposit_cents INTEGER NOT NULL DEFAULT 0");
  addColumn('appointments', 'deposit_status', "deposit_status TEXT NOT NULL DEFAULT ''"); // ''|pending|paid
  addColumn('appointments', 'stripe_session_id', "stripe_session_id TEXT NOT NULL DEFAULT ''");
  addColumn('services', 'price_type', "price_type TEXT NOT NULL DEFAULT 'fixed'");
  addColumn('appointments', 'review_token', "review_token TEXT NOT NULL DEFAULT ''");
  addColumn('messages', 'html', "html TEXT NOT NULL DEFAULT ''");
  addColumn('users', 'email_verified', 'email_verified INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'verify_token', "verify_token TEXT NOT NULL DEFAULT ''");
  addColumn('users', 'verify_sent_at', "verify_sent_at TEXT NOT NULL DEFAULT ''");
  // Bumped on password change / "sign out everywhere" to invalidate old cookies.
  addColumn('users', 'token_version', 'token_version INTEGER NOT NULL DEFAULT 0');
  // POS: link invoice line items to products (for inventory + purchase history),
  // track the Stripe Checkout session on the invoice, whether stock has been
  // decremented (exactly once), and the payment intent on payments (for refunds).
  addColumn('invoice_items', 'product_id', 'product_id INTEGER REFERENCES products(id) ON DELETE SET NULL');
  addColumn('invoices', 'stripe_session_id', "stripe_session_id TEXT NOT NULL DEFAULT ''");
  addColumn('invoices', 'pos_fulfilled', 'pos_fulfilled INTEGER NOT NULL DEFAULT 0');
  // Random per-sale token used as the Stripe idempotency key: unlike the
  // invoice id it can never collide after a demo reset re-uses id numbers.
  addColumn('invoices', 'pos_token', "pos_token TEXT NOT NULL DEFAULT ''");
  addColumn('payments', 'stripe_pi', "stripe_pi TEXT NOT NULL DEFAULT ''");
  // Self-service cancellation: the token is the client's link from their
  // confirmation message; who/when is kept so the owner can see at a glance
  // whether the client dropped out or the salon called it off.
  addColumn('appointments', 'cancel_token', "cancel_token TEXT NOT NULL DEFAULT ''");
  addColumn('appointments', 'cancelled_at', "cancelled_at TEXT NOT NULL DEFAULT ''");
  addColumn('appointments', 'cancelled_by', "cancelled_by TEXT NOT NULL DEFAULT ''"); // ''|client|owner
  addColumn('appointments', 'cancel_reason', "cancel_reason TEXT NOT NULL DEFAULT ''");
  // What the appointment was before it was cancelled, so an undo can put it
  // back exactly as it stood rather than guessing at 'booked'.
  addColumn('appointments', 'prev_status', "prev_status TEXT NOT NULL DEFAULT ''");

  // Backfill appointment_services from the legacy single service_id so every
  // existing appointment has at least its primary service listed. Runs once:
  // guarded by "no rows yet" and only touches appointments that have a service.
  const hasApptServices = db.prepare('SELECT id FROM appointment_services LIMIT 1').get();
  if (!hasApptServices) {
    db.prepare(
      `INSERT INTO appointment_services (appointment_id, service_id, sort_order)
       SELECT id, service_id, 0 FROM appointments WHERE service_id IS NOT NULL`
    ).run();
  }
}

// --- settings helpers -------------------------------------------------------

export function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

// Secret settings never leave the server as plaintext. getSettings() replaces
// each with an empty string plus a `<key>_set` boolean, so the UI can show
// "configured — leave blank to keep" without the value ever reaching a browser.
export const SECRET_SETTINGS = new Set([
  'session_secret', 'resend_api_key', 'stripe_secret_key',
  'twilio_token', 'clicksend_api_key', 'telnyx_api_key',
]);

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) {
    if (SECRET_SETTINGS.has(r.key)) {
      out[`${r.key}_set`] = r.value ? '1' : '';
    } else {
      out[r.key] = r.value;
    }
  }
  delete out.session_secret_set; // internal only — never referenced by the UI
  delete out.invoice_seq;
  return out;
}

export function nextInvoiceNumber() {
  const seq = Number(getSetting('invoice_seq', '1000')) + 1;
  setSetting('invoice_seq', seq);
  const prefix = getSetting('invoice_prefix', 'INV-');
  return `${prefix}${seq}`;
}

// --- first-run bootstrap -----------------------------------------------------

const DEFAULT_SETTINGS = {
  business_name: 'Demo Studio',
  business_email: 'hello@demostudio.com',
  business_phone: '(555) 010-2030',
  business_address: '12 Market Street',
  currency: '$',
  tax_rate: '0',
  open_min: '480',        // 08:00
  close_min: '1200',      // 20:00
  open_days: '1,2,3,4,5,6', // weekday numbers, 0=Sun … 6=Sat (default Mon–Sat)
  // Per-weekday exceptions, keyed by weekday number:
  //   {"0":{"every_weeks":2,"anchor":"2026-08-09","open_min":600,"close_min":900}}
  // every_weeks 2-4 runs the day only on alternating weeks counted from the
  // anchor date; open_min/close_min override the usual hours for that day.
  // Empty object = every open day runs weekly on the usual hours.
  day_rules: '{}',
  slot_interval: '15',
  // IANA time zone (e.g. 'Australia/Melbourne'), auto-captured from the owner's
  // browser. Empty = use the server's own clock. Makes the booking page's
  // "no past times today" filter correct even when the server runs in UTC.
  business_tz: '',
  booking_lead_min: '0',  // minimum notice before an online slot can be booked (minutes)
  // How far ahead customers may book online, and how late they may cancel
  // themselves. The cancellation window is the owner's protection: inside it
  // the link stops working and the client is told to ring instead, so a
  // no-notice drop-out is always a conversation rather than a silent gap.
  // What this business is paying whoever sold them Kairo. Set per deployment by
  // the reseller; the owner sees it read-only on their Account page. Kept as
  // settings rather than a table because one instance is one business on one
  // plan — an invoice history table can come when there are invoices to store.
  plan_name: 'Kairo',
  plan_status: 'active',        // active | trial | pilot | past_due | cancelled
  plan_price_cents: '0',
  plan_interval: 'month',       // month | year | once
  plan_started_at: '',          // YYYY-MM-DD
  plan_renews_at: '',           // YYYY-MM-DD, blank while nothing is being charged
  billing_contact: '',          // who the owner asks about their bill
  billing_note: '',

  booking_horizon_days: '90',
  cancel_window_hours: '12',
  client_cancel_enabled: '1',
  rebook_weeks_default: '4', // "see you in N weeks" — the usual gap for this business
  // Owner's preferred visible calendar window (minutes from midnight). Empty =
  // auto (a couple of hours around opening time). Purely a display preference.
  cal_start_min: '',
  cal_end_min: '',
  booking_enabled: '1',
  invoice_prefix: 'INV-',
  invoice_due_days: '7',
  invoice_footer: 'Thank you for your business!',
  // Notifications (work out of the box once provider keys are pasted in Settings)
  confirm_enabled: '1',
  reminders_enabled: '1',
  reminder_hours: '24',
  owner_notify_enabled: '1',  // email the owner when a customer books online
  receipts_enabled: '1',
  review_requests_enabled: '1',
  review_delay_hours: '1',
  // Per-type delivery channel: email | sms | both. Default email so nothing
  // costs money until the owner opts a type into SMS (and turns SMS on).
  chan_confirmation: 'email',
  chan_reminder: 'email',
  chan_receipt: 'email',
  chan_review_request: 'email',
  google_review_url: '',
  public_url: '',  // captured automatically by the setup wizard (location.origin)
  notif_from_email: '',
  resend_api_key: '',
  // SMS provider is selectable: clicksend (default, simplest AU setup) | telnyx
  // (cheapest, more setup) | twilio. Only the chosen provider's keys are used.
  sms_provider: 'clicksend',
  clicksend_username: '',
  clicksend_api_key: '',
  clicksend_from: '',      // sender ID (business name) or dedicated number
  telnyx_api_key: '',
  telnyx_from: '',         // Telnyx number or alphanumeric sender ID
  telnyx_profile_id: '',   // optional messaging profile id
  twilio_sid: '',
  twilio_token: '',
  twilio_from: '',
  // SMS costs money per message — off by default so a new deployment never
  // sends a paid text without the owner opting in.
  sms_notifications_enabled: '0',
  // Online deposits via Stripe Checkout
  stripe_secret_key: '',
  currency_code: 'usd',
  deposit_type: 'none',   // none|fixed|percent
  deposit_value: '20',
  // How in-person POS card payments are taken:
  //   stripe → Kairo generates a checkout/pay-link the customer completes (auto-confirmed)
  //   square → owner charges on their own Square reader/app, then taps "Paid" in Kairo
  pos_card_method: 'stripe',
  // Booking page branding (per business)
  brand_accent: '#38bdf8',
  brand_theme: 'dark',    // dark|light (base mode; superseded by brand_scheme when set)
  brand_scheme: '',       // preset scheme id ('noir','cream',…) or '' = follow brand_theme
  brand_font: 'modern',   // modern|classic|rounded
  brand_logo: '',         // data: URI, uploaded in Settings
  brand_cover: '',        // data: URI, hero banner on the booking page
  brand_gallery: '',      // JSON array of data: URIs (up to 4 photos)
  brand_tagline: '',
};

/**
 * Make a consistent, safe copy of the database before an update applies its
 * migrations — so an upgrade is always reversible. Uses VACUUM INTO (atomic,
 * WAL-safe). Keeps the 5 most recent backups.
 */
function backupBeforeUpdate(fromVersion) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(DATA_DIR, `backup-v${fromVersion}-${stamp}.db`);
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
    const backups = fs.readdirSync(DATA_DIR)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.db'))
      .sort()
      .reverse();
    for (const old of backups.slice(5)) {
      try { fs.unlinkSync(path.join(DATA_DIR, old)); } catch { /* ignore */ }
    }
    console.log(`  ↳ database backed up before update → data/${path.basename(dest)}`);
  } catch (err) {
    console.error('  ↳ pre-update backup failed (continuing):', err.message);
  }
}

/** Read a setting even before initSchema has run (returns '' if unavailable). */
function settingIfExists(key) {
  try { return getSetting(key, ''); } catch { return ''; }
}

export function bootstrap() {
  // If this database was created by an older version, snapshot it before the
  // new version's migrations touch the schema. Fresh databases have no prior
  // version, so nothing is backed up on first install.
  const priorVersion = settingIfExists('app_version');
  if (priorVersion && priorVersion !== VERSION) backupBeforeUpdate(priorVersion);

  initSchema();
  setSetting('app_version', VERSION);
  if (!getSetting('session_secret')) {
    setSetting('session_secret', crypto.randomBytes(32).toString('hex'));
  }
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (getSetting(k, null) === null) setSetting(k, v);
  }
  const hasUser = db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0;
  if (!hasUser) {
    const { salt, hash } = hashPassword(process.env.KAIRO_ADMIN_PASSWORD || 'admin123');
    db.prepare('INSERT INTO users (name, email, pass_hash, salt) VALUES (?, ?, ?, ?)').run(
      'Admin',
      process.env.KAIRO_ADMIN_EMAIL || 'admin@kairo.local',
      hash,
      salt
    );
  }
  // Flag whether the built-in default password ('admin123') is still in use, so
  // the app can nag the owner to change it — a live instance on its default
  // credentials is the single biggest real-world risk. Recomputed every boot,
  // and also cleared the moment the password is changed.
  const admin = db.prepare('SELECT salt, pass_hash FROM users ORDER BY id LIMIT 1').get();
  const onDefault = admin && verifyPassword('admin123', admin.salt, admin.pass_hash);
  setSetting('default_password_active', onDefault ? '1' : '0');

  const hasStaff = db.prepare('SELECT COUNT(*) AS n FROM staff').get().n > 0;
  if (!hasStaff) seedDemo();
  // A brand-new deployment (no prior user) starts un-configured, so the owner
  // meets the guided setup wizard on first login. Existing installs are
  // grandfathered in as already set up — no surprise wizard.
  if (getSetting('setup_complete', null) === null) {
    setSetting('setup_complete', hasUser ? '1' : '');
  }
}

// --- demo seed ----------------------------------------------------------------
// Deterministic pseudo-random so every fresh install demos identically.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedDemo() {
  const rand = mulberry32(20260710);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  setSetting('business_name', 'Luxe Hair Studio');
  setSetting('business_email', 'hello@luxehair.studio');
  setSetting('business_phone', '(555) 010-2030');
  setSetting('business_address', '12 Market Street');
  setSetting('tax_rate', '8.5');
  setSetting('open_days', '1,2,3,4,5,6'); // the demo salon is closed Sundays (matches seeded appointments)

  const locationId = Number(
    db.prepare('INSERT INTO locations (name, address, phone) VALUES (?, ?, ?)')
      .run('Main Studio', '12 Market Street', '(555) 010-2030').lastInsertRowid
  );

  const insStaff = db.prepare('INSERT INTO staff (name, title, color, location_id) VALUES (?, ?, ?, ?)');
  const staffIds = [
    insStaff.run('Sha', 'Senior Stylist', '#3987e5', locationId).lastInsertRowid,
    insStaff.run('Maya', 'Colour Specialist', '#199e70', locationId).lastInsertRowid,
    insStaff.run('Jordan', 'Stylist', '#9085e9', locationId).lastInsertRowid,
  ].map(Number);

  // duration-min price-cents price-type — 'from' demos variable-length services
  // (colour/braids where the real price depends on hair length/thickness),
  // 'free' demos a no-charge consult.
  const services = [
    ['K18 Treatment', 'Treatments', 45, 8500, 'fixed'],
    ['Deep Conditioning', 'Treatments', 30, 4500, 'fixed'],
    ['Scalp Therapy', 'Treatments', 40, 6000, 'fixed'],
    ['Colour Consultation', 'Treatments', 15, 0, 'free'],
    ['Root Colour + Refresh', 'Colour', 105, 14500, 'fixed'],
    ['Full Colour', 'Colour', 120, 16500, 'from'],
    ['Balayage', 'Colour', 150, 22000, 'from'],
    ['Toner + Gloss', 'Colour', 45, 7500, 'fixed'],
    ['Cut & Finish', 'Styling', 60, 9500, 'fixed'],
    ['Blow Dry', 'Styling', 45, 5500, 'fixed'],
    ['Silk Press', 'Styling', 90, 12000, 'fixed'],
    ['Braids — Full Head', 'Braids', 240, 25000, 'from'],
    ['Braids Removal', 'Braids', 90, 6500, 'fixed'],
  ];
  const insService = db.prepare(
    'INSERT INTO services (name, category, duration_min, price_cents, price_type) VALUES (?, ?, ?, ?, ?)'
  );
  const serviceRows = services.map(([name, cat, dur, price, ptype]) => ({
    id: Number(insService.run(name, cat, dur, price, ptype).lastInsertRowid),
    name, duration_min: dur, price_cents: price, price_type: ptype,
  }));

  // Retail products for the POS counter — realistic salon shelf.
  const products = [
    // name, category, supplier, sku, retail, cost, stock, low_at
    ['Olaplex No.3 Hair Perfector', 'Hair care', 'Olaplex AU', 'OLA-N3', 4500, 2600, 14, 4],
    ['K18 Leave-In Molecular Mask 50ml', 'Hair care', 'K18 Distribution', 'K18-50', 9900, 6100, 8, 3],
    ['Moroccanoil Treatment 100ml', 'Hair care', 'Moroccanoil', 'MOR-100', 6900, 3900, 11, 4],
    ['Heat Protect Spray 200ml', 'Styling', 'SalonPro Supply', 'HPS-200', 3200, 1500, 20, 6],
    ['Curl Defining Cream', 'Styling', 'SalonPro Supply', 'CDC-150', 2800, 1300, 9, 3],
    ['Silk Pillowcase', 'Accessories', 'Luxe Goods Co', 'SPC-01', 5900, 3000, 5, 2],
    ['Wide-Tooth Detangling Comb', 'Accessories', 'Luxe Goods Co', 'WTC-01', 1400, 500, 2, 3],
    ['Purple Toning Shampoo 300ml', 'Hair care', 'SalonPro Supply', 'PTS-300', 3400, 1700, 13, 4],
  ];
  const insProduct = db.prepare(
    `INSERT INTO products (name, category, supplier, sku, retail_cents, cost_cents, stock_qty, low_stock_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of products) insProduct.run(...p);

  const people = [
    ['Jeanen', 'Brooks', 'jeanen.brooks@example.com', '(555) 210-8841'],
    ['Kesha', 'Alexander', 'kesha.alex@example.com', '(555) 342-9917'],
    ['Ruki', 'Adeyemi', 'ruki.a@example.com', '(555) 771-2306'],
    ['Amara', 'Osei', 'amara.osei@example.com', '(555) 883-4412'],
    ['Tanya', 'Williams', 'tanya.w@example.com', '(555) 664-9083'],
    ['Denise', 'Carter', 'denise.carter@example.com', '(555) 490-7755'],
    ['Priya', 'Nair', 'priya.nair@example.com', '(555) 231-6640'],
    ['Simone', 'Baptiste', 'simone.b@example.com', '(555) 118-2094'],
    ['Leah', 'Mokoena', 'leah.m@example.com', '(555) 905-3321'],
    ['Chantelle', 'Dube', 'chantelle.d@example.com', '(555) 377-8810'],
    ['Naomi', 'Reid', 'naomi.reid@example.com', '(555) 542-1169'],
    ['Fatima', 'Hassan', 'fatima.h@example.com', '(555) 689-4425'],
    ['Grace', 'Owusu', 'grace.owusu@example.com', '(555) 810-7734'],
    ['Bianca', 'Moore', 'bianca.moore@example.com', '(555) 953-2287'],
  ];
  const insClient = db.prepare(
    'INSERT INTO clients (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)'
  );
  const clientIds = people.map((p) => Number(insClient.run(...p).lastInsertRowid));

  const insAppt = db.prepare(
    `INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status, source, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insApptSvc = db.prepare(
    'INSERT INTO appointment_services (appointment_id, service_id, sort_order) VALUES (?, ?, ?)'
  );

  // Busy-hours weighting mirrors a real salon: peak 9–11 AM, quieter late afternoon.
  const startChoices = [540, 540, 570, 600, 600, 630, 660, 720, 780, 840, 900, 960, 480];

  const today = new Date();
  const pastAppointments = [];
  for (let d = -30; d <= 13; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() + d);
    if (day.getDay() === 0) continue; // closed Sundays
    const date = dateStr(day);
    const perDay = 2 + Math.floor(rand() * 4); // 2–5 appointments/day
    const usedByStaff = new Map(staffIds.map((id) => [id, []]));
    for (let i = 0; i < perDay; i++) {
      const svc = pick(serviceRows);
      // ~18% of bookings bundle a second service (e.g. Colour + Blow Dry),
      // so multi-service appointments show on the calendar out of the box.
      const services = [svc];
      if (rand() < 0.18) {
        const second = pick(serviceRows);
        if (second.id !== svc.id) services.push(second);
      }
      const totalDuration = services.reduce((sum, x) => sum + x.duration_min, 0);
      const staffId = pick(staffIds);
      const start = pick(startChoices) + (rand() < 0.3 ? 15 : 0);
      const end = start + totalDuration;
      if (end > 1200) continue;
      const taken = usedByStaff.get(staffId);
      if (taken.some(([s, e]) => start < e && end > s)) continue; // keep demo data conflict-free
      taken.push([start, end]);
      const status = d < 0 ? (rand() < 0.92 ? 'completed' : 'no_show') : d === 0 ? 'confirmed' : rand() < 0.7 ? 'booked' : 'confirmed';
      const source = rand() < 0.35 ? 'online' : 'staff';
      const clientId = pick(clientIds);
      const id = Number(insAppt.run(clientId, staffId, svc.id, date, start, end, status, source, '').lastInsertRowid);
      services.forEach((sv, idx) => insApptSvc.run(id, sv.id, idx));
      if (d < 0 && status === 'completed') {
        pastAppointments.push({ id, clientId, staffId, svc, services, date });
      }
    }
  }

  // Bill most completed past appointments; leave a few outstanding so the
  // dashboard and invoice list show a realistic mix of paid / sent / draft.
  const insInvoice = db.prepare(
    `INSERT INTO invoices (number, client_id, appointment_id, issue_date, due_date, status, tax_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insItem = db.prepare(
    'INSERT INTO invoice_items (invoice_id, description, qty, unit_cents) VALUES (?, ?, ?, ?)'
  );
  const insPayment = db.prepare(
    'INSERT INTO payments (invoice_id, amount_cents, method, paid_at) VALUES (?, ?, ?, ?)'
  );
  const taxRate = 8.5;
  for (const appt of pastAppointments) {
    if (rand() < 0.15) continue; // some visits not billed yet
    const roll = rand();
    const status = roll < 0.78 ? 'paid' : roll < 0.92 ? 'sent' : 'draft';
    const due = new Date(appt.date);
    due.setDate(due.getDate() + 7);
    const invId = Number(
      insInvoice.run(nextInvoiceNumber(), appt.clientId, appt.id, appt.date, dateStr(due), status, taxRate).lastInsertRowid
    );
    for (const sv of (appt.services || [appt.svc])) insItem.run(invId, sv.name, 1, sv.price_cents);
    if (rand() < 0.35) insItem.run(invId, 'Aftercare product', 1, 2200);
    if (status === 'paid') {
      const total = db
        .prepare('SELECT CAST(ROUND(SUM(qty * unit_cents) * ? ) AS INTEGER) AS t FROM invoice_items WHERE invoice_id = ?')
        .get(1 + taxRate / 100, invId).t;
      insPayment.run(invId, total, pick(['card', 'card', 'cash', 'transfer']), `${appt.date} 18:00:00`);
    }
  }

  // Sample reviews on a subset of completed visits — mostly glowing (realistic
  // for a repeat-client salon), a couple of average ones, one with an owner
  // reply, so the Reviews page demos with real texture on first look.
  const insReview = db.prepare(
    'INSERT INTO reviews (appointment_id, client_id, staff_id, rating, comment, response, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const positiveComments = [
    'Absolutely loved it — best colour I’ve had in years!', 'So relaxing and my stylist really listened to what I wanted.',
    'Quick, professional, and the result speaks for itself.', 'Been coming here for months, never disappointed.',
    'Great atmosphere and my hair has never looked better.', '',
  ];
  const midComments = ['Good overall, ran a little behind schedule.', 'Nice result, a bit pricier than I expected.', ''];
  let reviewCount = 0;
  for (const appt of pastAppointments) {
    if (reviewCount >= 9) break;
    if (rand() < 0.55) continue; // not every visit gets reviewed
    const roll = rand();
    const rating = roll < 0.65 ? 5 : roll < 0.9 ? 4 : roll < 0.97 ? 3 : 2;
    const comment = rating >= 4 ? pick(positiveComments) : pick(midComments);
    const response = rating <= 3 && rand() < 0.6 ? 'Thanks for the feedback — we’d love the chance to make your next visit five stars. Call us anytime!' : '';
    insReview.run(appt.id, appt.clientId, appt.staffId, rating, comment, response, `${appt.date} 19:00:00`);
    reviewCount++;
  }
}

/** Wipe all business data (staff, services, clients, appointments, billing). */
export function clearBusinessData() {
  db.exec(`
    DELETE FROM messages; DELETE FROM reviews; DELETE FROM payments; DELETE FROM invoice_items; DELETE FROM invoices;
    DELETE FROM time_blocks;
    DELETE FROM appointment_services; DELETE FROM appointments; DELETE FROM services; DELETE FROM products; DELETE FROM clients; DELETE FROM staff; DELETE FROM locations;
    DELETE FROM sqlite_sequence WHERE name IN ('messages','reviews','payments','invoice_items','invoices','time_blocks','appointment_services','appointments','services','products','clients','staff','locations');
  `);
  setSetting('invoice_seq', '1000');
}

/** Wipe all business data and reseed the demo dataset (used for sales demos). */
export function resetDemo() {
  clearBusinessData();
  seedDemo();
  setSetting('setup_complete', '1'); // the demo represents a configured business
}
