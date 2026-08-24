// Getting a copy of the business off the machine it lives on.
//
// Kairo already keeps a few database copies beside the live one before each
// update. That protects against a bad upgrade. It does nothing about the case
// that actually ends a business: the disk goes, and the client book, the
// appointment history and every invoice go with it. Copies stored next to the
// original are not a backup — they are the same single point of failure with
// extra steps.
//
// So a copy leaves the building. Two ways, because they fail differently:
//   • the owner can download one on the spot, which needs nothing configured;
//   • Kairo emails one on a schedule to the business's own address, which needs
//     nobody to remember.
//
// The snapshot is taken with SQLite's own VACUUM INTO. Copying the file by hand
// while the server is running can catch it mid-write — VACUUM INTO produces a
// consistent, fully-formed database even with writes in flight, and compacts it
// on the way out. Gzipped it is tiny: a real salon's 6MB database goes out as
// about 200KB.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { db, getSetting, setSetting, DATA_DIR } from './db.js';
import { sendEmail } from './notify.js';

/** Past this, an emailed attachment stops being reasonable — offer a download. */
const MAX_EMAIL_BYTES = 20 * 1024 * 1024;

const FREQUENCIES = { off: 0, daily: 1, weekly: 7, fortnightly: 14 };

/** A filename an owner can recognise a year later, in a folder full of them. */
export function backupName(ext = 'db.gz') {
  const slug = String(getSetting('business_name', 'kairo'))
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'kairo';
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${slug}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.${ext}`;
}

/**
 * A consistent snapshot of the whole database, gzipped in memory.
 * The temporary file is always removed, including when the gzip throws.
 */
export function snapshot() {
  const tmp = path.join(os.tmpdir(), `kairo-backup-${process.pid}-${Date.now()}.db`);
  try {
    fs.rmSync(tmp, { force: true });   // VACUUM INTO refuses to overwrite
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const raw = fs.readFileSync(tmp);
    return {
      buffer: zlib.gzipSync(raw, { level: 9 }),
      raw_bytes: raw.length,
      filename: backupName(),
      taken_at: new Date().toISOString(),
    };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** Where an emailed backup goes: the business's own address. */
const backupRecipient = () => getSetting('backup_email_to') || getSetting('business_email', '');

/**
 * Send one now. Records what happened either way — a backup that silently
 * stopped working months ago is worse than no backup, because it is believed.
 */
export async function emailBackup({ manual = false } = {}) {
  const to = backupRecipient();
  if (!to) {
    return record({ ok: false, detail: 'No business email set — add one in Settings → Business profile.' });
  }
  let snap;
  try {
    snap = snapshot();
  } catch (err) {
    return record({ ok: false, detail: `Couldn't read the database: ${String(err.message).slice(0, 160)}` });
  }
  if (snap.buffer.length > MAX_EMAIL_BYTES) {
    return record({
      ok: false, bytes: snap.buffer.length,
      detail: 'Too large to email — download it from Settings → Backups instead.',
    });
  }

  const biz = getSetting('business_name', 'your business');
  const size = `${(snap.buffer.length / 1024).toFixed(0)} KB`;
  const result = await sendEmail(
    to,
    `${biz} — backup of your booking system (${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })})`,
    `Attached is a complete copy of ${biz}'s Kairo database: every client, appointment, invoice and payment, as of today.\n\n`
    + `Keep it somewhere that isn't your salon computer — the point of it is to survive the machine it came from.\n\n`
    + `If you ever need it restored, send this file back to whoever set Kairo up for you.\n\n`
    + `File: ${snap.filename} (${size})`,
    '',
    { attachments: [{ filename: snap.filename, content: snap.buffer }] },
  );
  return record({
    ok: result.ok, bytes: snap.buffer.length, manual,
    detail: result.ok ? `Emailed to ${to} (${size})` : result.detail,
  });
}

function record({ ok, detail, bytes = 0, manual = false }) {
  setSetting('backup_last_at', new Date().toISOString());
  setSetting('backup_last_ok', ok ? '1' : '0');
  setSetting('backup_last_detail', String(detail || '').slice(0, 300));
  setSetting('backup_last_bytes', String(bytes));
  if (ok && !manual) setSetting('backup_last_scheduled_at', new Date().toISOString());
  if (!ok) console.error('backup:', detail);
  return { ok, detail, bytes };
}

/** Is a scheduled backup due? */
export function backupDue(now = Date.now()) {
  const every = FREQUENCIES[getSetting('backup_frequency', 'weekly')] ?? 7;
  if (!every) return false;
  if (getSetting('backup_email_enabled', '1') !== '1') return false;
  if (!backupRecipient()) return false;
  const last = Date.parse(getSetting('backup_last_scheduled_at', '')) || 0;
  return now - last >= every * 24 * 60 * 60 * 1000;
}

/** Called by the scheduler. Never throws — a failed backup must not stop the app. */
export async function runScheduledBackup() {
  if (!backupDue()) return null;
  try {
    return await emailBackup();
  } catch (err) {
    return record({ ok: false, detail: `Backup failed: ${String(err.message).slice(0, 160)}` });
  }
}

/** What the Settings screen shows about the state of backups. */
export function backupStatus() {
  const lastAt = getSetting('backup_last_at', '');
  const localCopies = (() => {
    try {
      return fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('backup-') && f.endsWith('.db')).length;
    } catch { return 0; }
  })();
  return {
    enabled: getSetting('backup_email_enabled', '1') === '1',
    frequency: getSetting('backup_frequency', 'weekly'),
    to: backupRecipient(),
    last_at: lastAt,
    last_ok: getSetting('backup_last_ok', '') === '1',
    last_detail: getSetting('backup_last_detail', ''),
    last_bytes: Number(getSetting('backup_last_bytes', '0')) || 0,
    due: backupDue(),
    // Copies kept beside the live database before each update. Useful for a bad
    // upgrade, useless if the disk itself is lost — which is exactly why the
    // emailed copy exists, and why this is labelled honestly on screen.
    local_copies: localCopies,
  };
}
