// The control API: the six things the platform may do to a salon, and nothing
// else.
//
// Everything here is authenticated by an HMAC over the request, using a key
// (KAIRO_PLATFORM_KEY) that exists in exactly two places: this service's
// environment and the platform's. There is no session, no password, and no
// user — a signature or nothing.
//
// It is deliberately small. If the platform were ever compromised, what the
// attacker gains is this list — create a salon, flip its flags, set its
// settings, reset its owner's password, take an export, mark it deleted — and
// not a way to read one salon's data from another's address, because there is
// still no such route anywhere in Kairo.
//
// With no KAIRO_PLATFORM_KEY set, every path here answers 404 exactly as if
// the file did not exist. That is the state every existing deployment is in,
// including the two live salons.
import crypto from 'node:crypto';
import { readJson, sendJson, sendText, httpError } from './util.js';
import {
  MULTI, createTenant, getTenant, listTenantSlugs, updateTenantConfig, withTenant, SLUG_RE, BASE_DOMAIN,
} from './tenant.js';
import { db, getSetting, setSetting } from './db.js';
import { EDITABLE_SETTINGS, applySettings, sendTestMessage } from './api.js';
import { snapshot } from './backup.js';
import { VERSION } from './version.js';
import { sign as hmac } from './platform-sign.js';

/** Requests older than this are refused, so a captured one cannot be replayed. */
const MAX_AGE_MS = 5 * 60 * 1000;

const key = () => String(process.env.KAIRO_PLATFORM_KEY || '').trim();
export const platformEnabled = () => key().length >= 24;

export const sign = (t, method, path, rawBody, secret = key()) => hmac(t, method, path, rawBody, secret);

function verify(req, path, rawBody) {
  const header = String(req.headers['x-kairo-signature'] || '');
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header.trim());
  if (!m) return 'missing or malformed signature';
  const t = Number(m[1]);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > MAX_AGE_MS) return 'signature timestamp is outside the accepted window';
  const expected = sign(t, req.method, path, rawBody);
  const a = Buffer.from(m[2], 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'signature does not match';
  return null;
}

/** A tenant's public state — counts only, never a row of anybody's data. */
function tenantStatus(slug) {
  const t = getTenant(slug);
  if (!t) return null;
  return withTenant(t, () => ({
    slug,
    exists: true,
    business_name: getSetting('business_name', ''),
    public_url: getSetting('public_url', '') || t.config.public_url || '',
    plan_status: getSetting('plan_status', ''),
    read_only: Boolean(t.config.read_only),
    muted: Boolean(t.config.muted),
    counts: {
      clients: db.prepare('SELECT COUNT(*) AS n FROM clients').get().n,
      appointments: db.prepare('SELECT COUNT(*) AS n FROM appointments').get().n,
      invoices: db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n,
      messages: db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,
    },
    setup_complete: getSetting('setup_complete', '') === '1',
    created_at: t.config.created_at || '',
  }));
}

const CONFIG_KEYS = new Set(['read_only', 'muted', 'deleted', 'plan_status', 'plan', 'domains', 'public_url', 'name', 'platform_url', 'connect_token']);

/**
 * @returns {boolean} true when this request was handled here.
 */
export async function handlePlatform(req, res, pathname) {
  if (!pathname.startsWith('/api/platform/')) return false;
  // Not configured is indistinguishable from not existing. A shard that has
  // never been told a key must not advertise that this API is even here.
  if (!platformEnabled()) { sendJson(res, 404, { error: 'Not found' }); return true; }

  let raw = '';
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    try { raw = await new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > 2_000_000) { req.resume(); reject(httpError(413, 'Payload too large')); return; } chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    }); } catch (err) { sendJson(res, err.status || 400, { error: err.message }); return true; }
  }

  const bad = verify(req, pathname, raw);
  if (bad) { sendJson(res, 401, { error: `Unauthorised: ${bad}` }); return true; }

  let body = {};
  if (raw) {
    try { body = JSON.parse(raw); } catch { sendJson(res, 400, { error: 'Invalid JSON body' }); return true; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { sendJson(res, 400, { error: 'Expected a JSON object' }); return true; }
  }

  try {
    const result = await route(req, res, pathname, body);
    if (!res.writableEnded) sendJson(res, 200, result ?? { ok: true });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('platform:', err);
    if (!res.writableEnded) sendJson(res, status, { error: err.message || 'Server error' });
  }
  return true;
}

async function route(req, res, pathname, body) {
  const rest = pathname.slice('/api/platform/'.length);
  const parts = rest.split('/').filter(Boolean);

  // GET /api/platform/health — is this shard alive, which version, how many salons.
  if (parts[0] === 'health' && parts.length === 1 && req.method === 'GET') {
    return { ok: true, version: VERSION, multi_tenant: MULTI, base_domain: BASE_DOMAIN, tenants: listTenantSlugs().length };
  }

  if (parts[0] !== 'tenants') throw httpError(404, 'Not found');

  // GET /api/platform/tenants
  if (parts.length === 1 && req.method === 'GET') {
    return { tenants: listTenantSlugs() };
  }

  // POST /api/platform/tenants — provision a salon. This is the whole of
  // provisioning: no DNS call, no certificate wait, because the wildcard
  // domain already resolves. A folder, a file, and it is serving.
  if (parts.length === 1 && req.method === 'POST') {
    if (!MULTI) throw httpError(400, 'This Kairo is single-tenant; it cannot create salons');
    const slug = String(body.slug || '').trim().toLowerCase();
    if (!SLUG_RE.test(slug)) throw httpError(400, 'slug must be lowercase letters, digits and hyphens');
    if (getTenant(slug)) throw httpError(409, `A salon already uses "${slug}"`);
    const owner = body.owner || {};
    if (!owner.email || !owner.pass_hash || !owner.salt) throw httpError(400, 'owner.email, owner.pass_hash and owner.salt are required');
    for (const k of Object.keys(body.settings || {})) {
      if (!EDITABLE_SETTINGS.has(k)) throw httpError(400, `Unexpected setting: ${k}`);
    }
    const t = createTenant(slug, {
      name: String(body.name || '').slice(0, 150),
      public_url: String(body.public_url || `https://${slug}.${BASE_DOMAIN}`),
      // A real business starts empty and meets the wizard. 'demo' is for the
      // demo tenant and for a laptop.
      seed: body.seed === 'demo' ? 'demo' : 'none',
      // Where the owner goes for the things only the platform can do —
      // connecting their email, cancelling, deleting. Not a secret the owner
      // must keep, but not public either: shown only inside their workspace.
      platform_url: String(body.platform_url || '').slice(0, 200),
      connect_token: String(body.connect_token || '').slice(0, 64),
      plan: String(body.plan || 'once').slice(0, 40),
      owner: {
        name: String(owner.name || 'Owner').slice(0, 100),
        email: String(owner.email).trim().toLowerCase(),
        pass_hash: String(owner.pass_hash), salt: String(owner.salt),
      },
    });
    withTenant(t, () => {
      if (body.settings) applySettings(body.settings);
      // The plan the owner bought, shown read-only on their Account page.
      setSetting('plan_name', String(body.plan_name || 'Kairo').slice(0, 80));
      setSetting('plan_status', 'active');
      setSetting('plan_interval', 'once');
      setSetting('plan_price_cents', String(Number(body.price_cents) || 0));
      setSetting('plan_started_at', new Date().toISOString().slice(0, 10));
      setSetting('plan_renews_at', '');
    });
    return { created: true, ...tenantStatus(slug) };
  }

  const slug = String(parts[1] || '').toLowerCase();
  if (!SLUG_RE.test(slug)) throw httpError(404, 'Not found');
  const tail = parts.slice(2).join('/');

  // GET /api/platform/tenants/:slug
  if (!tail && req.method === 'GET') {
    const st = tenantStatus(slug);
    if (!st) throw httpError(404, 'No such salon');
    return st;
  }

  // PATCH /api/platform/tenants/:slug — maintenance, mute, plan, own domains.
  if (!tail && req.method === 'PATCH') {
    if (!getTenant(slug)) throw httpError(404, 'No such salon');
    const patch = {};
    for (const [k, v] of Object.entries(body)) {
      if (!CONFIG_KEYS.has(k)) throw httpError(400, `Unexpected field: ${k}`);
      patch[k] = v;
    }
    updateTenantConfig(slug, patch);
    return tenantStatus(slug);
  }

  // DELETE /api/platform/tenants/:slug — stops serving the address. The file
  // is KEPT: a refund, a chargeback and a mistake all look the same from here,
  // and only one of them should be irreversible.
  if (!tail && req.method === 'DELETE') {
    if (!getTenant(slug)) throw httpError(404, 'No such salon');
    updateTenantConfig(slug, { deleted: true, deleted_at: new Date().toISOString() });
    return { deleted: true, slug, note: 'The address stops serving. The database file is kept.' };
  }

  // PUT /api/platform/tenants/:slug/settings
  if (tail === 'settings' && req.method === 'PUT') {
    const t = getTenant(slug);
    if (!t) throw httpError(404, 'No such salon');
    for (const k of Object.keys(body)) {
      if (!EDITABLE_SETTINGS.has(k)) throw httpError(400, `Unexpected setting: ${k}`);
    }
    withTenant(t, () => applySettings(body));
    return tenantStatus(slug);
  }

  // POST /api/platform/tenants/:slug/password — the reset flow's last step.
  // Takes a hash, never a password: the plaintext the owner typed reaches the
  // platform and stops there.
  if (tail === 'password' && req.method === 'POST') {
    const t = getTenant(slug);
    if (!t) throw httpError(404, 'No such salon');
    const { pass_hash: hash, salt, email } = body;
    if (!hash || !salt) throw httpError(400, 'pass_hash and salt are required');
    return withTenant(t, () => {
      const user = email
        ? db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase())
        : db.prepare('SELECT * FROM users ORDER BY id LIMIT 1').get();
      if (!user) throw httpError(404, 'That salon has no owner account');
      // Bump the token version so every existing session dies with the old
      // password — the same rule the owner's own password change follows.
      db.prepare('UPDATE users SET pass_hash = ?, salt = ?, token_version = token_version + 1 WHERE id = ?')
        .run(String(hash), String(salt), user.id);
      setSetting('default_password_active', '0');
      setSetting('handover_password_active', '0');
      return { ok: true, email: user.email };
    });
  }

  // POST /api/platform/tenants/:slug/test-message — prove a just-installed
  // provider key actually works, and leave the attempt in the salon's own
  // Messages log where the owner can see it.
  if (tail === 'test-message' && req.method === 'POST') {
    const t = getTenant(slug);
    if (!t) throw httpError(404, 'No such salon');
    const channel = body.channel === 'sms' ? 'sms' : 'email';
    const to = String(body.to || '').slice(0, 200);
    if (!to) throw httpError(400, 'to is required');
    return withTenant(t, () => sendTestMessage({ channel, to }));
  }

  // GET /api/platform/tenants/:slug/export — the whole business as one gzipped
  // file, for a refund, a deletion, or an owner who asks for their data.
  if (tail === 'export' && req.method === 'GET') {
    const t = getTenant(slug);
    if (!t) throw httpError(404, 'No such salon');
    const snap = withTenant(t, () => snapshot());
    res.writeHead(200, {
      'Content-Type': 'application/gzip',
      'Content-Length': snap.buffer.length,
      'Content-Disposition': `attachment; filename="${snap.filename}"`,
      'Cache-Control': 'no-store',
    });
    res.end(snap.buffer);
    return undefined;
  }

  throw httpError(404, 'Not found');
}

/** Used by the shard's own boot banner. */
export const platformKeyFingerprint = () =>
  (platformEnabled() ? crypto.createHash('sha256').update(key()).digest('hex').slice(0, 8) : '');

export { sendText };
