// Picture of a salon's own booking page in Kairo, made before they've heard of
// us: their name, their look, their real menu and prices. This is the "gift"
// the outreach in ../OUTREACH.md sends.
//
//   node docs/marketing/preview/make-preview.cjs <lead.json> <out.jpg>
//
// lead.json:
//   { "business": "Lash Up Sydney", "tagline": "Lash lifts in Lidcombe",
//     "scheme": "blush", "accent": "#c06c84",
//     "services": [{ "name": "Lash lift", "price": 75, "minutes": 60, "category": "Lashes" }],
//     "open_days": "2,3,4,5,6", "open": "09:00", "close": "17:00" }
//
// It runs a private, throwaway Kairo on this machine (scratch database, never
// a real salon), so nothing is published anywhere.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCHEMES = ['midnight', 'noir', 'ocean', 'mocha', 'daylight', 'cream', 'blush'];
// An accent that sits well on each scheme when the salon's own colour isn't known.
const ACCENT = { midnight: '#38bdf8', noir: '#d4a373', ocean: '#2dd4bf', mocha: '#c08457', daylight: '#2563eb', cream: '#a0522d', blush: '#b5476b' };

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toMin = (hhmm, dflt) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : dflt;
};

async function main() {
  const [leadPath, outPath] = process.argv.slice(2);
  if (!leadPath || !outPath) throw new Error('usage: make-preview.cjs <lead.json> <out.jpg>');
  const lead = JSON.parse(fs.readFileSync(leadPath, 'utf8'));
  const services = (lead.services || []).filter((s) => s && s.name).slice(0, 8);
  if (!lead.business || services.length < 2) throw new Error('need a business name and at least 2 services');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-preview-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', KAIRO_DATA_DIR: dir, KAIRO_RATELIMIT: 'off', KAIRO_BREACH_CHECK: 'off', KAIRO_APP_STORE_LOOKUP: 'off' },
    stdio: 'ignore',
  });
  const stop = () => { try { srv.kill('SIGKILL'); } catch { /* gone */ } fs.rmSync(dir, { recursive: true, force: true }); };
  const hard = setTimeout(() => { stop(); console.error('preview: timed out'); process.exit(2); }, 90000);

  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${base}/api/version`)).ok) break; } catch { /* starting */ }
      await sleep(100);
    }
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@kairo.local', password: 'admin123' }) });
    const cookie = (/kairo_session=([^;]+)/.exec(login.headers.get('set-cookie') || '') || [])[0];
    if (!cookie) throw new Error('could not sign in to the scratch Kairo');
    const call = async (method, p, body) => {
      const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${(await r.text()).slice(0, 200)}`);
      return r.json();
    };

    await call('POST', '/api/setup/skip', {});
    await call('PUT', '/api/settings', {
      business_name: String(lead.business).slice(0, 80),
      brand_tagline: String(lead.tagline || '').slice(0, 120),
      brand_scheme: SCHEMES.includes(lead.scheme) ? lead.scheme : 'cream',
      brand_accent: /^#[0-9a-f]{6}$/i.test(lead.accent || '') ? lead.accent : (ACCENT[lead.scheme] || ACCENT.cream),
      business_address: String(lead.address || '').slice(0, 120),
      business_phone: String(lead.phone || '').slice(0, 40),
      business_tz: 'Australia/Melbourne',
      open_days: /^[0-6](,[0-6])*$/.test(lead.open_days || '') ? lead.open_days : '2,3,4,5,6',
      open_min: String(toMin(lead.open, 540)),
      close_min: String(toMin(lead.close, 1020)),
      booking_enabled: '1',
    });
    await call('POST', '/api/staff', { name: String(lead.staff || lead.business).slice(0, 60), title: '' });
    for (const sv of services) {
      await call('POST', '/api/services', {
        name: String(sv.name).slice(0, 80),
        category: String(sv.category || '').slice(0, 40),
        duration_min: Math.max(15, Math.min(480, Math.round((Number(sv.minutes) || 60) / 15) * 15)),
        price_cents: Math.round((Number(sv.price) || 0) * 100),
        price_type: sv.from ? 'from' : 'fixed',
      });
    }

    const br = await chromium.launch();
    try {
      const ctx = await br.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      await p.goto(`${base}/book`, { waitUntil: 'networkidle' });
      await p.evaluate(() => document.fonts?.ready);
      await sleep(900);
      const shot1 = path.join(dir, 'menu.png');
      await p.screenshot({ path: shot1 });

      // The second phone: a service picked and today's free times showing.
      let shot2 = null;
      const first = p.locator('[data-service], .svc, .service-row, button:has-text("' + services[0].name.replace(/"/g, '') + '")').first();
      if (await first.count()) {
        await first.click().catch(() => {});
        await sleep(700);
        const next = p.locator('button:has-text("Continue"), button:has-text("Next"), button:has-text("Choose a time")').first();
        if (await next.count()) { await next.click().catch(() => {}); await sleep(900); }
        // "Who would you like?" → anyone, which lands on the free times.
        const anyone = p.locator('text=Any available').first();
        if (await anyone.count()) { await anyone.click().catch(() => {}); await sleep(1200); }
        // Tomorrow rather than today, so a whole day of free times shows.
        const tomorrow = p.locator('.date-chip').nth(1);
        if (await tomorrow.count()) { await tomorrow.click().catch(() => {}); await sleep(1000); }
        shot2 = path.join(dir, 'times.png');
        await p.screenshot({ path: shot2 });
      }

      // Two phones side by side on a plain card, sized for an email.
      const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
      const card = await br.newPage({ viewport: { width: 1000, height: 880 }, deviceScaleFactor: 1 });
      await card.setContent(`<!doctype html><html><body style="margin:0;background:#f4f1ec;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
        <div style="padding:34px 40px 0;text-align:center;color:#1d1b19">
          <div style="font-size:30px;font-weight:700;letter-spacing:-.01em">${escapeHtml(lead.business)}: your booking page</div>
          <div style="font-size:18px;color:#6b645c;margin-top:8px">Your menu and prices, as your clients would see them</div>
        </div>
        <div style="display:flex;gap:44px;justify-content:center;margin-top:30px">
          ${[shot1, shot2].filter(Boolean).map((f) => `<div style="width:340px;border-radius:38px;overflow:hidden;box-shadow:0 0 0 10px #1d1b19,0 24px 60px rgba(0,0,0,.25)"><img src="${img(f)}" style="display:block;width:100%"></div>`).join('')}
        </div></body></html>`);
      await sleep(300);
      await card.screenshot({ path: outPath, type: 'jpeg', quality: 82 });
    } finally {
      await br.close();
    }
    console.log(`preview: ${outPath} (${Math.round(fs.statSync(outPath).size / 1024)} KB)`);
  } finally {
    clearTimeout(hard);
    stop();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

main().catch((e) => { console.error('preview failed:', e.message); process.exit(1); });
