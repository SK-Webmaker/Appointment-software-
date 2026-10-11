// Real Kairo screens, with the sample salon, for the welcome video.
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { chromium } from 'playwright-core';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'wel-')); const port = 4796;
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: new URL('../../', import.meta.url).pathname,
  env: { ...process.env, PORT: String(port), KAIRO_DATA_DIR: data, KAIRO_RATELIMIT: 'off', KAIRO_BREACH_CHECK: 'off', KAIRO_APP_STORE_LOOKUP: 'off' }, stdio: 'ignore' });
process.on('exit', () => srv.kill());
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${base}/api/version`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@kairo.local', password: 'admin123' }) });
const cookie = login.headers.get('set-cookie').split(';')[0];
const H = { 'content-type': 'application/json', cookie, origin: base };
await fetch(`${base}/api/setup/skip`, { method: 'POST', headers: H, body: JSON.stringify({ keep_samples: true }) });
await fetch(`${base}/api/settings`, { method: 'PUT', headers: H, body: JSON.stringify({ business_name: 'Luxe Hair', business_phone: '0412 345 678' }) });
const hide = '.security-banner,#setup-checklist,.sample-banner,.cl-samples{display:none!important}';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const [k, v] = cookie.split('='); await ctx.addCookies([{ name: k, value: v, url: base }]);
await ctx.addInitScript((css) => { try { localStorage.setItem('kairo_tour_done', '1'); } catch {} ; document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }); }, hide);
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const shot = async (name, ms = 900) => { await p.waitForTimeout(ms); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
await p.goto(`${base}/#/calendar`); await p.waitForSelector('#block-time');
await p.click('[data-view="week"]').catch(() => {}); await shot('w-calendar', 1400);
await p.goto(`${base}/#/clients`); await p.waitForTimeout(900);
await p.evaluate(() => { for (const b of document.querySelectorAll('b')) if (/examples, not real people/.test(b.textContent)) { let n = b; while (n.parentElement && !n.parentElement.matches('.page, #page')) { if (n.parentElement.children.length > 1 && n.parentElement.querySelector('table')) break; n = n.parentElement; } n.style.display = 'none'; } });
await shot('w-clients', 400);
await p.goto(`${base}/#/dashboard`); await p.waitForTimeout(1400);
await p.evaluate(() => { const card = [...document.querySelectorAll('.st-label')].find((n) => /Revenue collected/.test(n.textContent)); const sc = document.querySelector('.content'); if (card && sc) sc.scrollTop += card.getBoundingClientRect().top - 110; });
await shot('w-dashboard', 600);
// The booking page, on a phone, as a client sees it.
const ph = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const q = await ph.newPage(); q.on('pageerror', (e) => errs.push('book: ' + e.message));
await q.goto(`${base}/book`); await q.waitForTimeout(2000); await q.screenshot({ path: `${OUT}/w-book-1.png` }); console.log('shot w-book-1');
// pick the first service, if the page offers one
const svc = q.locator('.svc-pick').nth(3);
if (await svc.count()) {
  await svc.click(); await q.waitForTimeout(700); await q.screenshot({ path: `${OUT}/w-book-2.png` }); console.log('shot w-book-2');
  const next = q.locator('button:has-text("Continue"), button:has-text("Next"), .bk-next').first();
  if (await next.count()) { await next.click().catch(() => {}); await q.waitForTimeout(1500); await q.screenshot({ path: `${OUT}/w-book-3.png` }); console.log('shot w-book-3'); }
  // a day with times
  const day = q.locator('.day:not(.off):not([disabled]), .bk-day:not(.off)').nth(1);
  if (await day.count()) { await day.click().catch(() => {}); await q.waitForTimeout(1500); }
  await q.screenshot({ path: `${OUT}/w-book-4.png` }); console.log('shot w-book-4');
}
console.log('errors:', errs.length ? errs : 'none');
await b.close(); process.exit(0);
