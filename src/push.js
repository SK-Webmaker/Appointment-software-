// Push notifications to the owner's phone, straight to Apple.
//
// One app serves every salon (the owner sees only their own), so the APNs
// credentials belong to the *process*, not to a salon: a salon can no more
// configure these than it can configure the App Store listing. They arrive as
// environment variables and are never settings, never exportable, and never
// shown in any response.
//
// Zero dependencies here too: node:http2 speaks to APNs and node:crypto signs
// the provider token.
import http2 from 'node:http2';
import crypto from 'node:crypto';
import { db } from './db.js';

const env = (k, d = '') => String(process.env[k] || d).trim();

/** Apple's provider host. Overridable so the tests can point at a mock. */
export const apnsOrigin = () => env('KAIRO_APNS_HOST', 'https://api.push.apple.com').replace(/\/+$/, '');
export const bundleId = () => env('KAIRO_APNS_BUNDLE_ID', 'com.kairobookings.kairo');

/**
 * The p8 private key, as downloaded from Apple.
 *
 * Environment variables cannot hold newlines everywhere, so a key given with
 * literal backslash-n is repaired rather than rejected — the alternative is a
 * deployment where push silently never works.
 */
const privateKey = () => env('KAIRO_APNS_KEY').replace(/\\n/g, '\n');

export function pushConfigured() {
  return Boolean(privateKey() && env('KAIRO_APNS_KEY_ID') && env('KAIRO_APNS_TEAM_ID'));
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');

// Apple refuses a provider token regenerated more often than every 20 minutes
// and expires one older than an hour. Fifty minutes sits safely between.
let cached = { token: '', at: 0, kid: '' };
const TOKEN_TTL_MS = 50 * 60 * 1000;

export function providerToken(now = Date.now()) {
  const kid = env('KAIRO_APNS_KEY_ID');
  if (cached.token && cached.kid === kid && now - cached.at < TOKEN_TTL_MS) return cached.token;
  const header = b64u(JSON.stringify({ alg: 'ES256', kid }));
  const payload = b64u(JSON.stringify({ iss: env('KAIRO_APNS_TEAM_ID'), iat: Math.floor(now / 1000) }));
  // APNs wants a JOSE signature (r‖s), not the DER encoding node signs by
  // default. Getting this wrong is a 403 that looks like a bad key.
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), {
    key: privateKey(),
    dsaEncoding: 'ieee-p1363',
  });
  cached = { token: `${header}.${payload}.${b64u(sig)}`, at: now, kid };
  return cached.token;
}

/** Only for the tests, and for a key rotation that must take effect at once. */
export function forgetProviderToken() { cached = { token: '', at: 0, kid: '' }; }

// ---------------------------------------------------------------------------
// The devices themselves
// ---------------------------------------------------------------------------

/**
 * Remember a phone. Upserted on the token, because reinstalling the app on the
 * same phone hands back the same token and must not accumulate rows.
 */
export function registerDevice(userId, token, { platform = 'ios', name = '' } = {}) {
  db.prepare(
    `INSERT INTO devices (user_id, token, platform, name, last_seen_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(token) DO UPDATE SET
       user_id = excluded.user_id,
       platform = excluded.platform,
       name = excluded.name,
       failed_at = '',
       last_seen_at = datetime('now')`
  ).run(userId, token, platform, name);
  return db.prepare('SELECT * FROM devices WHERE token = ?').get(token);
}

/** Sign-out forgets the phone, so a sold or lent phone stops getting the book. */
export function forgetDevice(token) {
  return db.prepare('DELETE FROM devices WHERE token = ?').run(token).changes;
}

export function devicesFor(userId = null) {
  return userId == null
    ? db.prepare("SELECT * FROM devices WHERE failed_at = '' ORDER BY id").all()
    : db.prepare("SELECT * FROM devices WHERE user_id = ? AND failed_at = '' ORDER BY id").all(userId);
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function postToApns(deviceToken, headers, body) {
  return new Promise((resolve) => {
    let session;
    try {
      session = http2.connect(apnsOrigin());
    } catch (e) {
      resolve({ ok: false, status: 0, reason: String(e && e.message || e) });
      return;
    }
    let settled = false;
    const done = (out) => {
      if (settled) return;
      settled = true;
      try { session.close(); } catch { /* already gone */ }
      resolve(out);
    };
    session.on('error', (e) => done({ ok: false, status: 0, reason: String(e && e.message || e) }));

    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken()}`,
      'apns-topic': bundleId(),
      'content-type': 'application/json',
      ...headers,
    });
    let status = 0;
    let text = '';
    req.setTimeout(10_000, () => { try { req.close(); } catch { /* nothing to close */ } done({ ok: false, status: 0, reason: 'timeout' }); });
    req.on('response', (h) => { status = Number(h[':status']) || 0; });
    req.on('data', (c) => { text += c; });
    req.on('error', (e) => done({ ok: false, status: 0, reason: String(e && e.message || e) }));
    req.on('end', () => {
      let reason = '';
      try { reason = String(JSON.parse(text || '{}').reason || ''); } catch { reason = text.slice(0, 200); }
      done({ ok: status === 200, status, reason });
    });
    req.end(body);
  });
}

/**
 * Send one alert to one phone.
 *
 * A token Apple says is dead is struck out here rather than retried forever:
 * 410 Unregistered means the app was deleted, 400 BadDeviceToken means it was
 * never ours. Both are permanent, and both are the salon's business, not a
 * fault to page anybody about.
 */
export async function sendToDevice(device, note) {
  const payload = JSON.stringify({
    aps: {
      alert: { title: note.title, body: note.body },
      sound: note.silent ? undefined : 'default',
      badge: typeof note.badge === 'number' ? note.badge : undefined,
      'thread-id': note.threadId || undefined,
    },
    ...(note.data || {}),
  });
  const headers = {
    'apns-push-type': 'alert',
    'apns-priority': String(note.priority || 10),
    'apns-expiration': String(Math.floor(Date.now() / 1000) + (note.ttlSeconds || 3600)),
  };
  if (note.collapseId) headers['apns-collapse-id'] = String(note.collapseId).slice(0, 64);

  const out = await postToApns(device.token, headers, payload);
  if (out.status === 410 || out.reason === 'BadDeviceToken' || out.reason === 'Unregistered') {
    db.prepare("UPDATE devices SET failed_at = datetime('now'), failed_reason = ? WHERE id = ?")
      .run(out.reason || 'Unregistered', device.id);
    return { ...out, dropped: true };
  }
  if (out.ok) db.prepare("UPDATE devices SET last_push_at = datetime('now') WHERE id = ?").run(device.id);
  return out;
}

/**
 * Tell the owner something happened.
 *
 * Never throws and never blocks the thing that caused it: a customer's booking
 * is confirmed whether or not the owner's phone is reachable.
 */
export async function pushToOwner(note, { userId = null } = {}) {
  if (!pushConfigured()) return { sent: 0, skipped: 'not configured' };
  const devices = devicesFor(userId);
  if (!devices.length) return { sent: 0, skipped: 'no devices' };
  let sent = 0;
  const results = [];
  for (const d of devices) {
    const r = await sendToDevice(d, note).catch((e) => ({ ok: false, status: 0, reason: String(e && e.message || e) }));
    if (r.ok) sent += 1;
    results.push(r);
  }
  return { sent, of: devices.length, results };
}
