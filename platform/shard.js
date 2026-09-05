// Talking to the shard — the Kairo that serves the salons.
//
// Every call is signed with the shared key (KAIRO_PLATFORM_KEY). Nothing here
// knows anything about a salon's contents; it asks for a salon to exist, or
// for a flag to change, and reads back counts.
import http from 'node:http';
import https from 'node:https';
import { sign as hmac } from '../src/platform-sign.js';

const key = () => String(process.env.KAIRO_PLATFORM_KEY || '').trim();
const sign = (t, method, path, raw) => hmac(t, method, path, raw, key());

export const SHARD_URL = () => String(process.env.KAIRO_SHARD_URL || 'http://127.0.0.1:4820').replace(/\/+$/, '');

/**
 * fetch() cannot set a Host header and the shard routes by Host, so this uses
 * node:http directly. It also lets a call be addressed to the shard itself
 * (the control API) rather than to any salon.
 */
function request(method, path, { body, host = '', headers = {}, timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(SHARD_URL() + path);
    const lib = u.protocol === 'https:' ? https : http;
    const raw = body === undefined ? '' : JSON.stringify(body);
    const t = Date.now();
    const req = lib.request({
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: {
        'x-kairo-signature': `t=${t},v1=${sign(t, method, u.pathname, raw)}`,
        ...(raw ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } : {}),
        ...(host ? { host } : {}),
        ...headers,
      },
      servername: host || u.hostname,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        if (/json/.test(res.headers['content-type'] || '')) { try { json = JSON.parse(buf.toString('utf8')); } catch { /* not json */ } }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json, buffer: buf });
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`shard did not answer within ${timeoutMs}ms`)); });
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

const unwrap = (r, what) => {
  if (!r.ok) throw Object.assign(new Error(`shard ${what}: ${r.status} ${r.json?.error || r.buffer.toString('utf8').slice(0, 200)}`), { status: r.status });
  return r.json;
};

export const health = async () => unwrap(await request('GET', '/api/platform/health'), 'health');
export const listTenants = async () => unwrap(await request('GET', '/api/platform/tenants'), 'list');
export const getTenant = async (slug) => {
  const r = await request('GET', `/api/platform/tenants/${slug}`);
  if (r.status === 404) return null;
  return unwrap(r, 'get');
};
export const createTenant = async (payload) => unwrap(await request('POST', '/api/platform/tenants', { body: payload }), 'create');
export const patchTenant = async (slug, patch) => unwrap(await request('PATCH', `/api/platform/tenants/${slug}`, { body: patch }), 'patch');
export const putSettings = async (slug, settings) => unwrap(await request('PUT', `/api/platform/tenants/${slug}/settings`, { body: settings }), 'settings');
export const setPassword = async (slug, payload) => unwrap(await request('POST', `/api/platform/tenants/${slug}/password`, { body: payload }), 'password');
export const deleteTenant = async (slug) => unwrap(await request('DELETE', `/api/platform/tenants/${slug}`), 'delete');
export const exportTenant = async (slug) => {
  const r = await request('GET', `/api/platform/tenants/${slug}/export`, { timeoutMs: 60000 });
  if (!r.ok) throw new Error(`shard export: ${r.status}`);
  return r.buffer;
};

/** Does the salon's own address actually serve its booking page yet? */
export async function servesBookingPage(slug, host) {
  const u = new URL(SHARD_URL());
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    const req = lib.request({
      method: 'GET', hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: '/api/public/info', headers: { host }, servername: host,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve({ ok: res.statusCode === 200, info: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
        catch { resolve({ ok: false, info: null }); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve({ ok: false, info: null }));
    req.end();
  });
}
