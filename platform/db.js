// The platform's own store: who signed up, what they paid, what was
// provisioned, and what still needs a human.
//
// It holds NO salon's client data — not a name, not a booking, not a phone
// number belonging to anybody's customer. That lives in each salon's own file
// on the shard and never comes here. What is here is the business itself (its
// owner, its ABN, its address on the platform), the money, and the audit trail.
//
// Same rules as Kairo: node:sqlite, one file, WAL, no dependencies.
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DATA_DIR = process.env.PLATFORM_DATA_DIR || path.join(ROOT, 'data', 'platform');
const DB_PATH = path.join(DATA_DIR, 'platform.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');

  -- The person who bought Kairo. One row per email, ever.
  CREATE TABLE IF NOT EXISTS owners (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    phone          TEXT NOT NULL DEFAULT '',
    email_verified INTEGER NOT NULL DEFAULT 0,
    phone_verified INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- One salon. Its state column is the whole of provisioning; every change is
  -- also an events row, so "what happened to this signup" is answerable later.
  --
  -- pass_hash and salt are the OWNER'S KAIRO PASSWORD, hashed with scrypt by
  -- the signup handler. The plaintext is never written anywhere. They are
  -- cleared the moment the salon is provisioned, because after that the hash
  -- lives in the salon's own file and there is no reason to keep a copy.
  CREATE TABLE IF NOT EXISTS businesses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id      INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    slug          TEXT NOT NULL,
    name          TEXT NOT NULL,
    abn           TEXT NOT NULL DEFAULT '',
    abn_name      TEXT NOT NULL DEFAULT '',
    tz            TEXT NOT NULL DEFAULT 'Australia/Melbourne',
    phone         TEXT NOT NULL DEFAULT '',
    state         TEXT NOT NULL DEFAULT 'created',
    price_cents   INTEGER NOT NULL DEFAULT 0,
    door          TEXT NOT NULL DEFAULT 'web',
    pass_hash     TEXT NOT NULL DEFAULT '',
    salt          TEXT NOT NULL DEFAULT '',
    stripe_session_id TEXT NOT NULL DEFAULT '',
    stripe_payment_intent TEXT NOT NULL DEFAULT '',
    flags         TEXT NOT NULL DEFAULT '',   -- JSON array of screening reasons
    last_error    TEXT NOT NULL DEFAULT '',
    signup_ip     TEXT NOT NULL DEFAULT '',
    token         TEXT NOT NULL DEFAULT '',   -- unguessable handle the signup page polls with
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at       TEXT NOT NULL DEFAULT '',
    ready_at      TEXT NOT NULL DEFAULT '',
    refunded_at   TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_biz_state ON businesses(state);
  -- Unique among the signups that still hold their address. An abandoned,
  -- never-paid signup releases it after a week (state 'expired') and somebody
  -- else may have it; a salon that paid and later refunded keeps it reserved,
  -- because its data is still on the shard and its old links are still in
  -- people's phones.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_slug_live ON businesses(slug) WHERE state != 'expired';
  CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_token ON businesses(token) WHERE token != '';

  -- Six digits to an inbox or a handset. Attempts are counted so a code cannot
  -- be guessed, and a code is single-use so a forwarded email cannot be replayed.
  CREATE TABLE IF NOT EXISTS codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id   INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,                 -- email|phone
    code       TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_codes ON codes(owner_id, kind, used);

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    at          TEXT NOT NULL DEFAULT (datetime('now')),
    kind        TEXT NOT NULL,
    detail      TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_events ON events(business_id, id);

  -- The owner's queue. The only place a human is required, and it is a phone
  -- screen with two buttons rather than a console session.
  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,                -- flagged|email_setup|refund_request|provision_failed
    state       TEXT NOT NULL DEFAULT 'open', -- open|done|dismissed
    detail      TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    done_at     TEXT NOT NULL DEFAULT '',
    done_note   TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_open ON tasks(state, id);
`);

// Additive migrations, the same rule Kairo follows: add, never drop or rewrite.
const addColumn = (table, column, ddl) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
};
// The handle a signed-in owner follows from their Kairo to the pages only the
// platform can serve: connecting their email, and cancelling. Unguessable, and
// only ever shown inside their own workspace.
addColumn('businesses', 'connect_token', "connect_token TEXT NOT NULL DEFAULT ''");
addColumn('businesses', 'email_state', "email_state TEXT NOT NULL DEFAULT 'none'");   // none|working|verifying|done|failed
addColumn('businesses', 'email_detail', "email_detail TEXT NOT NULL DEFAULT ''");
addColumn('businesses', 'email_domain', "email_domain TEXT NOT NULL DEFAULT ''");
addColumn('businesses', 'email_started_at', "email_started_at TEXT NOT NULL DEFAULT ''");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_connect ON businesses(connect_token) WHERE connect_token != ''");

export function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}
if (!getSetting('platform_secret')) setSetting('platform_secret', crypto.randomBytes(32).toString('hex'));

/** Record what happened. Never throws: an audit trail must not break a signup. */
export function record(businessId, kind, detail = '') {
  try {
    db.prepare('INSERT INTO events (business_id, kind, detail) VALUES (?, ?, ?)')
      .run(businessId || null, String(kind).slice(0, 60), typeof detail === 'string' ? detail.slice(0, 2000) : JSON.stringify(detail).slice(0, 2000));
  } catch (err) { console.error('platform event:', err.message); }
}

/** Move a business to a new state, with the reason, in one place. */
export function setState(id, state, detail = '') {
  db.prepare('UPDATE businesses SET state = ? WHERE id = ?').run(state, id);
  record(id, `state:${state}`, detail);
}

export function openTask(businessId, kind, detail = '') {
  const existing = db.prepare("SELECT id FROM tasks WHERE business_id = ? AND kind = ? AND state = 'open'").get(businessId, kind);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO tasks (business_id, kind, detail) VALUES (?, ?, ?)').run(businessId, kind, String(detail).slice(0, 2000));
  record(businessId, `task:${kind}`, detail);
  return Number(info.lastInsertRowid);
}
