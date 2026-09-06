// Screenshots of the real product, driven straight over the DevTools Protocol.
// Node 22 has a global WebSocket, so this needs nothing installed.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.argv[2] || './shots';
const BASE = process.env.KAIRO_BASE || 'http://127.0.0.1:4899';
const PORT = 9222;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sessionCookie() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.KAIRO_EMAIL || 'admin@kairo.local',
      password: process.env.KAIRO_PASSWORD || 'admin123',
    }),
  });
  if (!r.ok) throw new Error(`login failed ${r.status}`);
  const m = /kairo_session=([^;]+)/.exec(r.headers.get('set-cookie') || '');
  if (!m) throw new Error('no cookie');
  return m[1];
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.sessions = new Map();
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error(`${method} timed out`)); }, 30000);
    });
  }
}

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--force-color-profile=srgb', '--font-render-hinting=none',
  `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let err = '';
chrome.stderr.on('data', (d) => { err += d; });
process.on('exit', () => chrome.kill('SIGKILL'));

let wsUrl = '';
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    wsUrl = j.webSocketDebuggerUrl;
  } catch { await sleep(250); }
}
if (!wsUrl) throw new Error(`chrome never came up\n${err}`);

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const cdp = new CDP(ws);

const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => cdp.send(m, p, sessionId);

await S('Page.enable');
await S('Runtime.enable');
await S('Network.enable');

const cookie = await sessionCookie();
await S('Network.setCookie', { name: 'kairo_session', value: cookie, domain: '127.0.0.1', path: '/' });

/** Shoot one page at a given logical size and device pixel ratio. */
async function shoot(name, url, { w, h, dpr = 3, wait = 2600, before = null, dark = true } = {}) {
  await S('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: dpr, mobile: true,
    screenOrientation: { angle: 0, type: 'portraitPrimary' },
  });
  await S('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  await S('Page.navigate', { url });
  await sleep(wait);
  if (before) { await S('Runtime.evaluate', { expression: before, awaitPromise: true }); await sleep(1400); }
  const { data } = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, optimizeForSpeed: false });
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`${name}  ${w}x${h}@${dpr}  ${(fs.statSync(file).size / 1024).toFixed(0)}kB`);
}

export { shoot, S, sleep, BASE };

// Driven by a sibling file so the shot list stays readable.
const list = await import(path.resolve(process.argv[3] || './shotlist.mjs'));
await list.default({ shoot, S, sleep, BASE });

ws.close();
chrome.kill('SIGTERM');
