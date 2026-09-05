// One process, many salons — each in its own SQLite file.
//
// A "tenant" is one business: a folder under DATA_DIR/tenants/<slug>/ holding
// its kairo.db and a small tenant.json. The request's Host header names the
// tenant; everything downstream (db.js, notify.js, backup.js …) reads the
// current tenant from an AsyncLocalStorage context and never has to know
// there is more than one. There is no shared database and no tenant_id
// column anywhere: the isolation is a different file, not a WHERE clause.
//
// Single-tenant mode is preserved exactly: with no tenants/ directory and no
// KAIRO_MULTI_TENANT=1, the one "legacy" tenant is DATA_DIR/kairo.db and
// every Host is that business. The two live salons run this way until they
// are moved (Phase 5).
//
// This file is the ONLY place a hostname becomes a file. It is the one line
// of code whose failure could show one salon another's data, which is why
// test/tenants.test.js exists and why test/falsify.mjs breaks it on purpose.
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DATA_DIR = process.env.KAIRO_DATA_DIR || path.join(ROOT, 'data');
export const TENANTS_DIR = path.join(DATA_DIR, 'tenants');
/** The platform domain: <slug>.<BASE_DOMAIN> is a tenant's address. */
export const BASE_DOMAIN = String(process.env.KAIRO_BASE_DOMAIN || 'kairobookings.com').trim().toLowerCase();
/** The same rule the onboarding script has always used for a subdomain. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/** Decided once at boot: a server never changes mode while running. */
export const MULTI = process.env.KAIRO_MULTI_TENANT === '1' || fs.existsSync(TENANTS_DIR);

const als = new AsyncLocalStorage();
const open = new Map();          // slug → record
let onOpen = null;               // db.js installs bootstrap() here
let legacy = null;

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const d = new DatabaseSync(dbPath);
  d.exec('PRAGMA journal_mode = WAL');
  d.exec('PRAGMA foreign_keys = ON');
  // Wait rather than fail when something else holds the write lock: the backup
  // script, the migration script and the app itself all open the same file.
  d.exec('PRAGMA busy_timeout = 5000');
  return d;
}

function readConfig(dir) {
  try {
    const p = path.join(dir, 'tenant.json');
    const st = fs.statSync(p);
    return { config: JSON.parse(fs.readFileSync(p, 'utf8')), mtime: st.mtimeMs };
  } catch {
    return { config: {}, mtime: 0 };
  }
}

/** Re-read tenant.json when it changed on disk, so `tenant.mjs set` takes effect without a restart. */
function refresh(record) {
  if (record.legacy) return record;
  let mtime = 0;
  try { mtime = fs.statSync(path.join(record.dir, 'tenant.json')).mtimeMs; } catch { /* no file */ }
  if (mtime !== record.configMtime) {
    const { config, mtime: m } = readConfig(record.dir);
    record.config = config;
    record.configMtime = m;
  }
  return record;
}

/** The one business of a single-tenant install: DATA_DIR/kairo.db, as always. */
export function legacyTenant() {
  if (!legacy) {
    legacy = {
      slug: '', legacy: true, dir: DATA_DIR,
      dbPath: process.env.KAIRO_DB_PATH || path.join(DATA_DIR, 'kairo.db'),
      config: {}, configMtime: 0, state: {}, db: null, booted: false,
    };
    legacy.db = openDb(legacy.dbPath);
  }
  return legacy;
}

/** Register what to run the first time a tenant's database is opened (bootstrap). */
export function setOpenHook(fn) { onOpen = fn; }

function boot(record) {
  if (record.booted) return record;
  record.booted = true;
  if (onOpen) als.run(record, () => onOpen(record));
  return record;
}

/**
 * The tenant this code is running for.
 *
 * In single-tenant mode there is always an answer. In multi-tenant mode code
 * that runs outside a request or a scheduler tick has no tenant, and asking is
 * a bug — so it throws rather than quietly picking one.
 */
export function current() {
  const t = als.getStore();
  if (t) return t;
  if (!MULTI) return boot(legacyTenant());
  throw new Error('No tenant in context: this code must run inside a request or withTenant()');
}

export function withTenant(record, fn) { return als.run(record, fn); }

/** Look a tenant up by slug; opens it on first use. null if it does not exist or is deleted. */
export function getTenant(slug) {
  if (!SLUG_RE.test(String(slug || ''))) return null;
  let rec = open.get(slug);
  if (!rec) {
    const dir = path.join(TENANTS_DIR, slug);
    if (!fs.existsSync(dir)) return null;
    const { config, mtime } = readConfig(dir);
    rec = { slug, legacy: false, dir, dbPath: path.join(dir, 'kairo.db'), config, configMtime: mtime, state: {}, db: null, booted: false };
    rec.db = openDb(rec.dbPath);
    open.set(slug, rec);
  }
  refresh(rec);
  if (rec.config.deleted) return null;
  rec.lastUsed = Date.now();
  return boot(rec);
}

/** Own booking domains (a salon that wants book.theirsalon.com): tenant.json { "domains": [...] }. */
let domainIndex = { at: 0, map: new Map() };
function tenantForDomain(host) {
  if (Date.now() - domainIndex.at > 30_000) {
    const map = new Map();
    for (const slug of listTenantSlugs()) {
      const { config } = readConfig(path.join(TENANTS_DIR, slug));
      for (const d of config.domains || []) map.set(String(d).toLowerCase(), slug);
    }
    domainIndex = { at: Date.now(), map };
  }
  const slug = domainIndex.map.get(host);
  return slug ? getTenant(slug) : null;
}

/**
 * Host header → tenant, or null. Never falls back to "some" tenant: an address
 * that names nobody gets nobody, which is what keeps one salon from ever being
 * served another salon's page.
 */
export function resolveHost(hostHeader) {
  if (!MULTI) return boot(legacyTenant());
  const host = String(hostHeader || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!host) return null;
  const suffix = `.${BASE_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const slug = host.slice(0, -suffix.length);
    if (slug.includes('.')) return null;   // one label only: a.b.<domain> is nobody
    return getTenant(slug);
  }
  return tenantForDomain(host);
}

export function listTenantSlugs() {
  if (!MULTI) return [];
  let names = [];
  try { names = fs.readdirSync(TENANTS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; }
  return names.filter((n) => SLUG_RE.test(n) && !readConfig(path.join(TENANTS_DIR, n)).config.deleted).sort();
}

/** Run `fn` once per tenant, each inside its own context. The scheduler's loop. */
export async function forEachTenant(fn) {
  if (!MULTI) { const t = boot(legacyTenant()); return als.run(t, () => fn(t)); }
  for (const slug of listTenantSlugs()) {
    const t = getTenant(slug);
    if (!t) continue;
    // eslint-disable-next-line no-await-in-loop
    await als.run(t, () => fn(t));
  }
  return undefined;
}

/**
 * Create a tenant: the folder, its tenant.json, then open it (which runs
 * bootstrap: schema, defaults, the owner from config). Refuses to overwrite.
 */
export function createTenant(slug, config = {}) {
  if (!SLUG_RE.test(String(slug || ''))) throw new Error(`"${slug}" is not a valid slug (lowercase letters, digits, hyphens)`);
  const dir = path.join(TENANTS_DIR, slug);
  if (fs.existsSync(dir)) throw new Error(`tenant "${slug}" already exists at ${dir}`);
  fs.mkdirSync(dir, { recursive: true });
  const full = { slug, created_at: new Date().toISOString(), plan_status: 'active', ...config };
  fs.writeFileSync(path.join(dir, 'tenant.json'), JSON.stringify(full, null, 2) + '\n');
  domainIndex.at = 0;
  return getTenant(slug);
}

/** Change tenant.json fields (read_only, muted, deleted, domains, public_url …). */
export function updateTenantConfig(slug, patch) {
  const dir = path.join(TENANTS_DIR, slug);
  const p = path.join(dir, 'tenant.json');
  if (!fs.existsSync(p)) throw new Error(`tenant "${slug}" has no tenant.json`);
  const cfg = { ...JSON.parse(fs.readFileSync(p, 'utf8')), ...patch };
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  domainIndex.at = 0;
  const rec = open.get(slug);
  if (rec) refresh(rec);
  return cfg;
}

/** Close a tenant's handle (before deleting or moving its folder). */
export function closeTenant(slug) {
  const rec = open.get(slug);
  if (!rec) return;
  try { rec.db.close(); } catch { /* already closed */ }
  open.delete(slug);
}

/**
 * Maintenance mode: writes refused with a friendly 503, reads untouched.
 * KAIRO_READ_ONLY=1 in the environment (whole process) or read_only:true in
 * tenant.json (one salon). Used for the five-minute window in which a salon
 * is copied to the shard, and for nothing else.
 */
export function isReadOnly() {
  if (String(process.env.KAIRO_READ_ONLY || '').trim() === '1') return true;
  const t = als.getStore() || (MULTI ? null : legacyTenant());
  return Boolean(t && refresh(t).config.read_only === true);
}

/** A rehearsal tenant: everything works, nothing is ever sent. */
export function isMuted() {
  const t = als.getStore() || (MULTI ? null : legacyTenant());
  return Boolean(t && refresh(t).config.muted === true);
}
