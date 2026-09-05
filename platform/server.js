// The platform: the only part of Kairo that knows more than one salon exists.
//
// It sells Kairo, takes the payment, screens the signup, asks the shard for a
// salon, and keeps the short queue of things only a person can decide. It
// never holds a salon's client data and has no route that could return any.
//
// Same house rules as the product: node:http, node:sqlite, no dependencies.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, getSetting, record, openTask } from './db.js';
import * as signup from './signup.js';
import * as stripe from './stripe.js';
import * as shard from './shard.js';
import * as connect from './connect.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PLATFORM_PORT || 4830);
const HOST = process.env.PLATFORM_HOST || '0.0.0.0';
const ORIGIN = () => String(process.env.PLATFORM_ORIGIN || `http://127.0.0.1:${PORT}`).replace(/\/+$/, '');

// ── small helpers ──────────────────────────────────────────────────────────
const json = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
};
function readRaw(req, max = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { req.resume(); reject(Object.assign(new Error('Payload too large'), { status: 413 })); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const raw = await readRaw(req);
  if (!raw) return {};
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON body'), { status: 400 }); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Object.assign(new Error('Expected a JSON object'), { status: 400 });
  return parsed;
}
/** The visitor's address, read the way Kairo reads it: never the leftmost hop. */
function clientIp(req) {
  const cf = String(req.headers['cf-connecting-ip'] || '').trim();
  if (cf) return cf;
  const chain = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (chain.length) return chain[chain.length - 1];
  return req.socket.remoteAddress || 'unknown';
}

// ── rate limiting ──────────────────────────────────────────────────────────
// A signup form on the open internet is a form anybody can post to. Small,
// fixed windows, per address — the same shape as the product's limiter.
const POLICIES = {
  signup: { limit: 6, windowMs: 60 * 60 * 1000 },
  verify: { limit: 30, windowMs: 15 * 60 * 1000 },
  checkout: { limit: 10, windowMs: 15 * 60 * 1000 },
  status: { limit: 600, windowMs: 60 * 1000 },
  operator: { limit: 60, windowMs: 60 * 1000 },
  global: { limit: 900, windowMs: 60 * 1000 },
};
const windows = new Map();
const DISABLED = process.env.PLATFORM_RATELIMIT === 'off';
function hit(bucket, key) {
  if (DISABLED) return null;
  const p = POLICIES[bucket];
  if (!p) return null;
  const now = Date.now();
  if (windows.size > 20000) for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  const id = `${bucket}:${key}`;
  let w = windows.get(id);
  if (!w || w.resetAt <= now) { w = { count: 0, resetAt: now + p.windowMs }; windows.set(id, w); }
  w.count += 1;
  return w.count > p.limit ? { retryAfterSec: Math.ceil((w.resetAt - now) / 1000) } : null;
}

// ── operator session ───────────────────────────────────────────────────────
// One password, one signed cookie. There is exactly one operator and adding
// user accounts here would be building a product nobody asked for.
const OPERATOR_COOKIE = 'kairo_operator';
const operatorPassword = () => String(process.env.PLATFORM_OPERATOR_PASSWORD || '').trim();
function mintOperator() {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const mac = crypto.createHmac('sha256', getSetting('platform_secret')).update(`operator.${exp}`).digest('base64url');
  return `${exp}.${mac}`;
}
function operatorOk(req) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (bearer && operatorPassword()) {
    const a = Buffer.from(bearer); const b = Buffer.from(operatorPassword());
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  const cookie = /kairo_operator=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!cookie) return false;
  const [exp, mac] = decodeURIComponent(cookie).split('.');
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', getSetting('platform_secret')).update(`operator.${exp}`).digest('base64url');
  const a = Buffer.from(mac); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── static ─────────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serveStatic(res, rel) {
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=300' });
    res.end(data);
  });
}

const CSP = ["default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "img-src 'self' data:", "style-src 'self' 'unsafe-inline'", "script-src 'self'", "connect-src 'self'", "form-action 'self'"].join('; ');

// ── routes ─────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  const ip = clientIp(req);
  if (p.startsWith('/api/')) {
    const over = hit('global', ip);
    if (over) { res.setHeader('Retry-After', String(over.retryAfterSec)); return json(res, 429, { error: 'Too many requests — please wait a moment.' }); }
  }

  try {
    if (p === '/' || p === '/start') { if (url.searchParams.get('cancelled')) res.setHeader('X-Payment-Cancelled', '1'); return serveStatic(res, 'start.html'); }
    if (p === '/done') return serveStatic(res, 'start.html');
    if (p === '/operator') return serveStatic(res, 'operator.html');
    if (p === '/connect') return serveStatic(res, 'connect.html');
    if (p === '/health') return json(res, 200, { ok: true });
    if (!p.startsWith('/api/')) return serveStatic(res, p === '/' ? 'start.html' : p);
    return await api(req, res, url, ip);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('platform:', err);
    if (!res.writableEnded) json(res, status, { error: err.message || 'Server error', ...(err.data ? { data: err.data } : {}) });
  }
  return undefined;
});

async function api(req, res, url, ip) {
  const p = url.pathname;
  const limited = (bucket) => {
    const over = hit(bucket, ip);
    if (over) { res.setHeader('Retry-After', String(over.retryAfterSec)); json(res, 429, { error: `Too many attempts — try again in ${Math.ceil(over.retryAfterSec / 60)} minutes.` }); return true; }
    return false;
  };

  // ── the signup flow ──────────────────────────────────────────────────────
  if (p === '/api/price' && req.method === 'GET') {
    return json(res, 200, { price_cents: signup.PRICE_CENTS(), currency: 'AUD', base_domain: signup.BASE_DOMAIN() });
  }

  if (p === '/api/slug' && req.method === 'GET') {
    const wanted = String(url.searchParams.get('slug') || '').trim().toLowerCase();
    const from = String(url.searchParams.get('from') || '');
    const slug = wanted || signup.slugify(from);
    if (!slug) return json(res, 200, { slug: '', ok: false, reason: 'Type your business name and we will suggest one.' });
    const r = await signup.slugAvailable(slug);
    return json(res, 200, { slug, ...r, url: signup.publicUrlFor(slug) });
  }

  if (p === '/api/signup' && req.method === 'POST') {
    if (limited('signup')) return undefined;
    const out = await signup.startSignup(await readJson(req), { ip });
    return json(res, 200, out);
  }

  if (p === '/api/verify' && req.method === 'POST') {
    if (limited('verify')) return undefined;
    const b = await readJson(req);
    return json(res, 200, signup.verifyCode(b.token, b.kind, b.code));
  }

  if (p === '/api/resend' && req.method === 'POST') {
    if (limited('verify')) return undefined;
    const b = await readJson(req);
    return json(res, 200, await signup.resendCode(b.token, b.kind === 'phone' ? 'phone' : 'email'));
  }

  if (p === '/api/checkout' && req.method === 'POST') {
    if (limited('checkout')) return undefined;
    const b = await readJson(req);
    return json(res, 200, await signup.beginCheckout(b.token, ORIGIN()));
  }

  if (p === '/api/status' && req.method === 'GET') {
    if (limited('status')) return undefined;
    return json(res, 200, signup.statusFor(url.searchParams.get('token')));
  }

  // ── the business, back from its own Kairo ────────────────────────────────
  // Reached by a link only a signed-in owner can see. Everything here is
  // something the salon's own instance deliberately cannot do: it holds no
  // Cloudflare token and no Stripe key, and it should not.
  if (p === '/api/connect/status' && req.method === 'GET') {
    if (limited('status')) return undefined;
    const b = signup.byConnectToken(url.searchParams.get('t'));
    const owner = db.prepare('SELECT email FROM owners WHERE id = ?').get(b.owner_id);
    return json(res, 200, {
      business_name: b.name,
      slug: b.slug,
      url: signup.publicUrlFor(b.slug),
      owner_email: owner.email,
      state: b.state,
      price_cents: b.price_cents,
      paid_at: b.paid_at,
      refund_days_left: signup.refundDaysLeft(b),
      refunded: Boolean(b.refunded_at),
      base_domain: signup.BASE_DOMAIN(),
      suggested_domain: `${b.slug}.${signup.BASE_DOMAIN()}`,
      email: connect.emailStatus(b.id),
    });
  }

  if (p === '/api/connect/email' && req.method === 'POST') {
    if (limited('checkout')) return undefined;
    const body = await readJson(req);
    const b = signup.byConnectToken(body.t);
    const out = await connect.connectEmail(b.id, String(body.resend_key || '').trim(), { domain: String(body.domain || '').trim() });
    return json(res, 200, out);
  }

  if (p === '/api/connect/refund' && req.method === 'POST') {
    if (limited('checkout')) return undefined;
    const body = await readJson(req);
    return json(res, 200, await signup.selfRefund(body.t, String(body.reason || '').slice(0, 300)));
  }

  // ── Stripe ───────────────────────────────────────────────────────────────
  // The only thing that may cause a salon to be provisioned. Verified against
  // the raw bytes, because a re-serialised body has a different signature.
  if (p === '/api/stripe/webhook' && req.method === 'POST') {
    const raw = await readRaw(req);
    const check = stripe.verifyWebhook(raw, req.headers['stripe-signature']);
    if (!check.ok) { record(null, 'webhook:rejected', check.reason); return json(res, 400, { error: `Signature check failed: ${check.reason}` }); }
    let event;
    try { event = JSON.parse(raw); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
    // Answer Stripe immediately; provisioning takes a moment and Stripe should
    // never be kept waiting (it retries on a timeout, which would be harmless
    // but noisy).
    json(res, 200, { received: true });
    if (event.type === 'checkout.session.completed') {
      const s = event.data?.object || {};
      if (s.payment_status === 'paid') {
        try { await signup.onPaid({ sessionId: s.id, paymentIntent: s.payment_intent, amountTotal: s.amount_total }); }
        catch (err) { console.error('provisioning after payment:', err.message); }
      }
    } else if (event.type === 'charge.dispute.created') {
      const biz = db.prepare('SELECT id, slug FROM businesses WHERE stripe_payment_intent = ?').get(event.data?.object?.payment_intent || '');
      if (biz) {
        // A dispute suspends, never deletes: a chargeback and a mistake look
        // the same from here and only one of them should be irreversible.
        try { await shard.patchTenant(biz.slug, { read_only: true }); } catch { /* reported below anyway */ }
        record(biz.id, 'stripe:dispute', 'suspended pending review');
        openTask(biz.id, 'refund_request', 'Card payment disputed — the salon is suspended, its data kept.');
      }
    }
    return undefined;
  }

  // ── the operator's queue ─────────────────────────────────────────────────
  if (p === '/api/operator/login' && req.method === 'POST') {
    if (limited('operator')) return undefined;
    const b = await readJson(req);
    const given = String(b.password || '');
    const want = operatorPassword();
    if (!want) return json(res, 503, { error: 'No operator password is set on this platform.' });
    const x = Buffer.from(given); const y = Buffer.from(want);
    if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return json(res, 401, { error: 'Wrong password' });
    res.setHeader('Set-Cookie', `${OPERATOR_COOKIE}=${encodeURIComponent(mintOperator())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${ORIGIN().startsWith('https') ? '; Secure' : ''}`);
    return json(res, 200, { ok: true });
  }

  if (p.startsWith('/api/operator/')) {
    if (limited('operator')) return undefined;
    if (!operatorOk(req)) return json(res, 401, { error: 'Not signed in' });

    if (p === '/api/operator/queue' && req.method === 'GET') {
      const tasks = db.prepare(
        `SELECT t.*, b.slug, b.name AS business_name, b.state, b.flags, b.price_cents, b.abn, b.abn_name, o.email, o.phone
           FROM tasks t LEFT JOIN businesses b ON b.id = t.business_id LEFT JOIN owners o ON o.id = b.owner_id
          WHERE t.state = 'open' ORDER BY t.id DESC LIMIT 200`
      ).all();
      const recent = db.prepare(
        `SELECT b.id, b.slug, b.name, b.state, b.price_cents, b.created_at, b.ready_at, o.email
           FROM businesses b LEFT JOIN owners o ON o.id = b.owner_id ORDER BY b.id DESC LIMIT 50`
      ).all();
      const totals = db.prepare("SELECT COUNT(*) AS all_n, SUM(state = 'ready') AS ready_n, SUM(state = 'flagged') AS flagged_n FROM businesses").get();
      return json(res, 200, { tasks, recent, totals });
    }

    const m = /^\/api\/operator\/business\/(\d+)\/(approve|refund|retry|export)$/.exec(p);
    if (m && req.method === 'POST') {
      const id = Number(m[1]);
      if (m[2] === 'approve') {
        const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
        if (!b) return json(res, 404, { error: 'No such business' });
        if (b.state !== 'flagged') return json(res, 409, { error: `That signup is ${b.state}, not flagged` });
        record(id, 'operator:approve');
        db.prepare("UPDATE businesses SET state = 'paid' WHERE id = ?").run(id);
        return json(res, 200, await signup.provision(id));
      }
      if (m[2] === 'retry') { record(id, 'operator:retry'); return json(res, 200, await signup.advance(id)); }
      if (m[2] === 'refund') {
        const body = await readJson(req).catch(() => ({}));
        record(id, 'operator:refund', String(body.reason || ''));
        return json(res, 200, await signup.refundBusiness(id, { reason: String(body.reason || ''), by: 'operator' }));
      }
    }

    const ce = /^\/api\/operator\/business\/(\d+)\/connect-email$/.exec(p);
    if (ce && req.method === 'POST') {
      const body = await readJson(req);
      const out = await connect.connectEmail(Number(ce[1]), String(body.resend_key || '').trim(), { domain: String(body.domain || '').trim() });
      return json(res, 200, out);
    }

    const t = /^\/api\/operator\/task\/(\d+)\/done$/.exec(p);
    if (t && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      db.prepare("UPDATE tasks SET state = 'done', done_at = datetime('now'), done_note = ? WHERE id = ?").run(String(body.note || '').slice(0, 500), Number(t[1]));
      return json(res, 200, { ok: true });
    }

    const ev = /^\/api\/operator\/business\/(\d+)$/.exec(p);
    if (ev && req.method === 'GET') {
      const id = Number(ev[1]);
      const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
      if (!b) return json(res, 404, { error: 'No such business' });
      const { pass_hash: _h, salt: _s, ...safe } = b;
      return json(res, 200, {
        business: safe,
        owner: db.prepare('SELECT name, email, phone, email_verified, phone_verified FROM owners WHERE id = ?').get(b.owner_id),
        events: db.prepare('SELECT at, kind, detail FROM events WHERE business_id = ? ORDER BY id DESC LIMIT 200').all(id),
        url: signup.publicUrlFor(b.slug),
      });
    }

    return json(res, 404, { error: 'Not found' });
  }

  return json(res, 404, { error: 'Not found' });
}

// An unpaid address is held for a week, then released. Once an hour is plenty.
setInterval(() => { try { signup.expireStale(); } catch (err) { console.error('expiry:', err.message); } }, 60 * 60 * 1000).unref?.();

server.listen(PORT, HOST, () => {
  const price = (signup.PRICE_CENTS() / 100).toFixed(2);
  console.log('');
  console.log('  ◆ Kairo platform');
  console.log(`    Signup        ${ORIGIN()}/start   (A$${price} once)`);
  console.log(`    Operator      ${ORIGIN()}/operator`);
  console.log(`    Shard         ${shard.SHARD_URL()}`);
  console.log(`    Salons on     *.${signup.BASE_DOMAIN()}`);
  if (!stripe.stripeConfigured()) console.log('    !  STRIPE_SECRET_KEY is not set — nobody can pay');
  if (!process.env.STRIPE_WEBHOOK_SECRET) console.log('    !  STRIPE_WEBHOOK_SECRET is not set — payments cannot be confirmed');
  if (!process.env.KAIRO_PLATFORM_KEY) console.log('    !  KAIRO_PLATFORM_KEY is not set — the shard will refuse every call');
  if (!process.env.CLOUDFLARE_API_TOKEN) console.log('    !  CLOUDFLARE_API_TOKEN is not set — salon email cannot be connected');
  if (!operatorPassword()) console.log('    !  PLATFORM_OPERATOR_PASSWORD is not set — the queue cannot be opened');
  console.log('');
});

export { server };
