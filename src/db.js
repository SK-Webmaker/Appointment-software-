// SQLite persistence via Node's built-in node:sqlite — zero external dependencies.
// The whole business lives in one file: data/kairo.db (easy to back up / restore).
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './auth.js';
import { dateStr } from './util.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.KAIRO_DATA_DIR || path.join(ROOT, 'data');
const DB_PATH = process.env.KAIRO_DB_PATH || path.join(DATA_DIR, 'kairo.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
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
  `);
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

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  delete out.session_secret;
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
  slot_interval: '15',
  booking_enabled: '1',
  invoice_prefix: 'INV-',
  invoice_due_days: '7',
  invoice_footer: 'Thank you for your business!',
};

export function bootstrap() {
  initSchema();
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
  const hasStaff = db.prepare('SELECT COUNT(*) AS n FROM staff').get().n > 0;
  if (!hasStaff) seedDemo();
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

  const insStaff = db.prepare('INSERT INTO staff (name, title, color) VALUES (?, ?, ?)');
  const staffIds = [
    insStaff.run('Sha', 'Senior Stylist', '#3987e5').lastInsertRowid,
    insStaff.run('Maya', 'Colour Specialist', '#199e70').lastInsertRowid,
    insStaff.run('Jordan', 'Stylist', '#9085e9').lastInsertRowid,
  ].map(Number);

  const services = [
    ['K18 Treatment', 'Treatments', 45, 8500],
    ['Deep Conditioning', 'Treatments', 30, 4500],
    ['Scalp Therapy', 'Treatments', 40, 6000],
    ['Root Colour + Refresh', 'Colour', 105, 14500],
    ['Full Colour', 'Colour', 120, 16500],
    ['Balayage', 'Colour', 150, 22000],
    ['Toner + Gloss', 'Colour', 45, 7500],
    ['Cut & Finish', 'Styling', 60, 9500],
    ['Blow Dry', 'Styling', 45, 5500],
    ['Silk Press', 'Styling', 90, 12000],
    ['Braids — Full Head', 'Braids', 240, 25000],
    ['Braids Removal', 'Braids', 90, 6500],
  ];
  const insService = db.prepare(
    'INSERT INTO services (name, category, duration_min, price_cents) VALUES (?, ?, ?, ?)'
  );
  const serviceRows = services.map(([name, cat, dur, price]) => ({
    id: Number(insService.run(name, cat, dur, price).lastInsertRowid),
    name, duration_min: dur, price_cents: price,
  }));

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
      const staffId = pick(staffIds);
      const start = pick(startChoices) + (rand() < 0.3 ? 15 : 0);
      const end = start + svc.duration_min;
      if (end > 1200) continue;
      const taken = usedByStaff.get(staffId);
      if (taken.some(([s, e]) => start < e && end > s)) continue; // keep demo data conflict-free
      taken.push([start, end]);
      const status = d < 0 ? (rand() < 0.92 ? 'completed' : 'no_show') : d === 0 ? 'confirmed' : rand() < 0.7 ? 'booked' : 'confirmed';
      const source = rand() < 0.35 ? 'online' : 'staff';
      const clientId = pick(clientIds);
      const id = Number(insAppt.run(clientId, staffId, svc.id, date, start, end, status, source, '').lastInsertRowid);
      if (d < 0 && status === 'completed') {
        pastAppointments.push({ id, clientId, svc, date });
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
    insItem.run(invId, appt.svc.name, 1, appt.svc.price_cents);
    if (rand() < 0.35) insItem.run(invId, 'Aftercare product', 1, 2200);
    if (status === 'paid') {
      const total = db
        .prepare('SELECT CAST(ROUND(SUM(qty * unit_cents) * ? ) AS INTEGER) AS t FROM invoice_items WHERE invoice_id = ?')
        .get(1 + taxRate / 100, invId).t;
      insPayment.run(invId, total, pick(['card', 'card', 'cash', 'transfer']), `${appt.date} 18:00:00`);
    }
  }
}

/** Wipe all business data and reseed the demo dataset (used for sales demos). */
export function resetDemo() {
  db.exec(`
    DELETE FROM payments; DELETE FROM invoice_items; DELETE FROM invoices;
    DELETE FROM appointments; DELETE FROM services; DELETE FROM clients; DELETE FROM staff;
    DELETE FROM sqlite_sequence WHERE name IN ('payments','invoice_items','invoices','appointments','services','clients','staff');
  `);
  setSetting('invoice_seq', '1000');
  seedDemo();
}
