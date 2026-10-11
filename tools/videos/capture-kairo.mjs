// Real Kairo screens for the SMS video, against a stand-in ClickSend (nothing real is sent).
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { chromium } from 'playwright-core';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
const USER = 'mia@luxehair.com.au', KEY = '8F3C2A71-4D9E-B6A0-55E2-C91D7F04AB36';
let balance = 2.0;
const cs = http.createServer((req, res) => {
  let raw = ''; req.on('data', (c) => { raw += c; }); req.on('end', () => {
    const send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const creds = Buffer.from(String(req.headers.authorization || '').replace(/^Basic\s+/, ''), 'base64').toString();
    if (creds !== `${USER}:${KEY}`) return send(401, { response_msg: 'Invalid credentials' });
    if (req.url === '/account') return send(200, { data: { balance, account_name: 'Luxe Hair', currency: { currency_name_short: 'AUD', currency_prefix_d: '$' } } });
    if (req.url === '/sms/send') return send(200, { response_code: 'SUCCESS', data: { total_price: 0.077, messages: [{ status: 'SUCCESS' }] } });
    send(404, {});
  });
});
await new Promise((r) => cs.listen(0, '127.0.0.1', r));
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'vid-')); const port = 4795;
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: new URL('../../', import.meta.url).pathname,
  env: { ...process.env, PORT: String(port), KAIRO_DATA_DIR: data, KAIRO_RATELIMIT: 'off', KAIRO_BREACH_CHECK: 'off', KAIRO_APP_STORE_LOOKUP: 'off',
    CLICKSEND_API_BASE: `http://127.0.0.1:${cs.address().port}` }, stdio: 'ignore' });
process.on('exit', () => srv.kill());
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${base}/api/version`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@kairo.local', password: 'admin123' }) });
const cookie = login.headers.get('set-cookie').split(';')[0];
const H = { 'content-type': 'application/json', cookie, origin: base };
await fetch(`${base}/api/setup/skip`, { method: 'POST', headers: H, body: JSON.stringify({ keep_samples: true }) });
await fetch(`${base}/api/settings`, { method: 'PUT', headers: H, body: JSON.stringify({ business_phone: '0412 345 678', business_name: 'Luxe Hair' }) });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const [k, v] = cookie.split('='); await ctx.addCookies([{ name: k, value: v, url: base }]);
await ctx.addInitScript(() => { try { localStorage.setItem('kairo_tour_done', '1'); } catch {} ; document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.security-banner{display:none!important}'; document.head.appendChild(st); }); });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const shot = async (name) => { await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
await p.addStyleTag({ content: '' }).catch(() => {});
await p.goto(`${base}/#/dashboard`); await p.waitForSelector('.setup-card', { timeout: 20000 });
await p.evaluate(() => document.querySelector('.setup-item a.btn[href*="open=sms"]')?.scrollIntoView({ block: 'center' }));
await shot('k-dashboard');
const btnBox = await p.evaluate(() => { const r = document.querySelector('.setup-item a.btn[href*="open=sms"]')?.getBoundingClientRect(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; });
// Settings → Messages, with the button.
await p.goto(`${base}/#/settings`); await p.waitForSelector('.set-tab[data-group="messages"]');
await p.click('.set-tab[data-group="messages"]');
await p.evaluate(() => document.querySelector('#sms-guided')?.scrollIntoView({ block: 'center' }));
await shot('k-settings');
const setBox = await p.evaluate(() => { const r = document.querySelector('#sms-guided').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await p.click('#sms-guided'); await p.waitForSelector('#ss-creds');
await p.addStyleTag({ content: '.ss-video{display:none!important}' });
await shot('k-modal-1');
const box = async (sel) => p.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
const m1 = { open: await box('.ss-step[data-step="1"] a.btn') };
await p.evaluate(() => document.querySelector('.ss-step[data-step="2"]').scrollIntoView({ block: 'center' }));
await shot('k-modal-2');
const m2 = { user: await box('#ss-creds input[name=username]'), key: await box('#ss-creds input[name=api_key]'), connect: await box('#ss-creds button[type=submit]'), where: await box('.ss-step[data-step="2"] a.btn') };
await p.fill('#ss-creds input[name=username]', USER);
await shot('k-modal-2u');
await p.fill('#ss-creds input[name=api_key]', KEY);
await shot('k-modal-2k');
await p.click('#ss-creds button[type=submit]'); await p.waitForSelector('#ss-creds-ok:not([hidden])'); await p.waitForTimeout(900);
await p.evaluate(() => document.querySelector('.ss-step[data-step="2"]').scrollIntoView({ block: 'start' }));
await p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
await shot('k-modal-3');
const m3 = { ok: await box('#ss-creds-ok'), credit: await box('#ss-credit-ok') };
await p.evaluate(() => document.querySelector('.ss-step[data-step="4"]').scrollIntoView({ block: 'center' }));
await shot('k-modal-4');
const m4 = { test: await box('#ss-test'), kinds: await box('#ss-kinds'), to: await box('#ss-test-to') };
await p.click('#ss-test'); await p.waitForSelector('#ss-test-ok:not([hidden])', { timeout: 10000 }); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
await p.evaluate(() => document.querySelector('#ss-test-ok').scrollIntoView({ block: 'center' }));
await shot('k-modal-5');
const m5 = { ok: await box('#ss-test-ok') };
fs.writeFileSync(`${OUT}/boxes.json`, JSON.stringify({ dash: btnBox, set: setBox, m1, m2, m3, m4, m5 }, null, 1));
const st = await (await fetch(`${base}/api/settings`, { headers: { cookie } })).json();
console.log('sms on:', st.sms_notifications_enabled, '| errors:', errs.length ? errs : 'none');
await b.close(); cs.close(); process.exit(0);
