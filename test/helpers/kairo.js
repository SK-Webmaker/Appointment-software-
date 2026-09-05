// Test harness: boots a real Kairo on a scratch database and talks to it over
// HTTP, exactly as a browser or the app would. No mocks of Kairo itself.
//
// Every suite gets its own process and its own data directory, so suites can
// never see each other's state and can run in parallel.
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const ADMIN = { email: 'admin@kairo.local', password: 'admin123' };

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A test that fails before its `stop()` must not leave a server behind: a
// live child with piped stdio keeps the runner's event loop open forever.
const running = new Set();
process.on('exit', () => { for (const c of running) { try { c.kill('SIGKILL'); } catch { /* gone */ } } });

/**
 * Start a Kairo. Returns a handle with `api`, `login`, `db`, `stop`.
 *   env   — extra environment (e.g. { KAIRO_RATELIMIT: 'on' } to re-enable limits)
 *   dataDir — reuse a directory (to test restarts against the same database)
 */
export async function startKairo({ env = {}, dataDir = null, timeoutMs = 20000 } = {}) {
  const dir = dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-test-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      KAIRO_DATA_DIR: dir,
      KAIRO_RATELIMIT: 'off',      // suites that test the limiter turn it back on
      KAIRO_BREACH_CHECK: 'off',   // never hit the network from a test
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.add(child);
  child.on('exit', () => running.delete(child));
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;

  const deadline = Date.now() + timeoutMs;
  let up = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const r = await fetch(`${base}/api/version`);
      if (r.ok) { up = true; break; }
    } catch { /* not yet */ }
    await sleep(100);
  }
  if (!up) {
    child.kill('SIGKILL');
    throw new Error(`Kairo did not start on ${base}\n${log}`);
  }

  async function api(method, p, { body, cookie, headers = {}, raw = false, host = null } = {}) {
    const h = { ...headers };
    if (body !== undefined && typeof body !== 'string') h['content-type'] = 'application/json';
    if (cookie) h.cookie = cookie;
    // fetch() refuses to set Host, so a request "to" a salon's address goes
    // through node:http with the header set by hand.
    if (host) return rawRequest(method, p, { body, headers: { ...h, host }, raw });
    const res = await fetch(base + p, {
      method,
      headers: h,
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
      redirect: 'manual',
    });
    const buf = Buffer.from(await res.arrayBuffer());
    let json = null;
    const ct = res.headers.get('content-type') || '';
    if (!raw && /json/.test(ct)) {
      try { json = JSON.parse(buf.toString('utf8')); } catch { json = null; }
    }
    return { status: res.status, headers: res.headers, json, text: raw ? '' : buf.toString('utf8'), buffer: buf };
  }

  function rawRequest(method, p, { body, headers, raw }) {
    return new Promise((resolve, reject) => {
      const data = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
      const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { ...headers, ...(data !== undefined ? { 'content-length': Buffer.byteLength(data) } : {}) } }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const ct = res.headers['content-type'] || '';
          let json = null;
          if (!raw && /json/.test(ct)) { try { json = JSON.parse(buf.toString('utf8')); } catch { json = null; } }
          resolve({ status: res.statusCode, headers: new Headers(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v])), json, text: raw ? '' : buf.toString('utf8'), buffer: buf });
        });
      });
      req.on('error', reject);
      if (data !== undefined) req.write(data);
      req.end();
    });
  }

  /** Sign in and return the cookie header value to pass back. */
  async function login(email = ADMIN.email, password = ADMIN.password, { host = null } = {}) {
    const r = await api('POST', '/api/auth/login', { body: { email, password }, host });
    if (r.status !== 200) throw new Error(`login failed: ${r.status} ${r.text}`);
    const sc = r.headers.get('set-cookie') || '';
    const m = /kairo_session=([^;]+)/.exec(sc);
    if (!m) throw new Error(`no session cookie in: ${sc}`);
    return { cookie: `kairo_session=${m[1]}`, setCookie: sc, user: r.json.user };
  }

  /** Direct read of the database file, for assertions the API does not expose. */
  function db() {
    const d = new DatabaseSync(path.join(dir, 'kairo.db'));
    d.exec('PRAGMA busy_timeout = 5000');
    return d;
  }

  async function stop({ keepData = false } = {}) {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      const t = Date.now() + 5000;
      while (child.exitCode === null && Date.now() < t) await sleep(50);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    if (!keepData) fs.rmSync(dir, { recursive: true, force: true });
  }

  return { base, port, dataDir: dir, api, login, db, stop, log: () => log, child };
}

/** YYYY-MM-DD for `days` from today (local), skipping Sundays (the demo salon is closed). */
export function openDateAhead(days = 3) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function gunzip(buf) { return zlib.gunzipSync(buf); }

/** Book the first free slot for a staff member on a date; returns the booking response. */
export async function bookFirstSlot(k, { date, staffId = 1, serviceIds = [9], client }) {
  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=${staffId}&service_ids=${serviceIds.join(',')}`);
  if (av.status !== 200 || !av.json.slots.length) throw new Error(`no availability: ${av.status} ${av.text}`);
  const slot = av.json.slots[0].start_min;
  const r = await k.api('POST', '/api/public/book', {
    body: { service_ids: serviceIds, staff_id: staffId, date, start_min: slot, client },
  });
  return { ...r, slot };
}

/** Run scripts/tenant.mjs against a data directory. Throws on a non-zero exit. */
export function tenantCli(dataDir, args, env = {}) {
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/tenant.mjs', ...args], {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, KAIRO_DATA_DIR: dataDir, KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: env.KAIRO_BASE_DOMAIN || 'kairobookings.test', ...env },
  });
  if (r.status !== 0) throw new Error(`tenant.mjs ${args.join(' ')} failed (${r.status}):\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

/**
 * Start the platform service against a running shard. Returns the same shape
 * as startKairo plus `platformDb()` — the tests read verification codes from
 * the database rather than from a back door in the product.
 */
export async function startPlatform({ shardUrl, platformKey, env = {}, dataDir = null, timeoutMs = 20000 } = {}) {
  const dir = dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-platform-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'platform/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PLATFORM_PORT: String(port),
      PLATFORM_HOST: '127.0.0.1',
      PLATFORM_ORIGIN: `http://127.0.0.1:${port}`,
      PLATFORM_DATA_DIR: dir,
      PLATFORM_RATELIMIT: 'off',
      PLATFORM_OPERATOR_PASSWORD: 'operator-pass-2026!!',
      KAIRO_SHARD_URL: shardUrl,
      KAIRO_PLATFORM_KEY: platformKey,
      KAIRO_BREACH_CHECK: 'off',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.add(child);
  child.on('exit', () => running.delete(child));
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + timeoutMs;
  let up = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try { const r = await fetch(`${base}/health`); if (r.ok) { up = true; break; } } catch { /* not yet */ }
    await sleep(100);
  }
  if (!up) { child.kill('SIGKILL'); throw new Error(`platform did not start on ${base}\n${log}`); }

  async function api(method, p, { body, cookie, headers = {}, raw = false } = {}) {
    const h = { ...headers };
    if (body !== undefined && typeof body !== 'string') h['content-type'] = 'application/json';
    if (cookie) h.cookie = cookie;
    const res = await fetch(base + p, {
      method, headers: h,
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
      redirect: 'manual',
    });
    const buf = Buffer.from(await res.arrayBuffer());
    let json = null;
    if (!raw && /json/.test(res.headers.get('content-type') || '')) {
      try { json = JSON.parse(buf.toString('utf8')); } catch { json = null; }
    }
    return { status: res.status, headers: res.headers, json, text: raw ? '' : buf.toString('utf8'), buffer: buf };
  }

  function platformDb() {
    const d = new DatabaseSync(path.join(dir, 'platform.db'));
    d.exec('PRAGMA busy_timeout = 5000');
    return d;
  }

  /** The code that was just sent, read from the platform's own table. */
  function latestCode(kind) {
    const d = platformDb();
    const row = d.prepare("SELECT code FROM codes WHERE kind = ? AND used = 0 ORDER BY id DESC LIMIT 1").get(kind);
    d.close();
    if (!row) throw new Error(`no unused ${kind} code`);
    return row.code;
  }

  async function stop({ keepData = false } = {}) {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      const t = Date.now() + 5000;
      while (child.exitCode === null && Date.now() < t) await sleep(50);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    if (!keepData) fs.rmSync(dir, { recursive: true, force: true });
  }

  return { base, port, dataDir: dir, api, platformDb, latestCode, stop, log: () => log };
}
