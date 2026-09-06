// Compose App Store screenshots: a caption, and the real screen in a device
// frame, at exactly the 6.9" size Apple asks for (1320 x 2868).
//
// The screen inside every frame is an untouched capture of the running product.
// The only things added are the caption and the frame, which is what every
// App Store listing does and what Apple's own guidelines expect.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.argv[2];
const OUT = process.argv[3];
const W = 1320, H = 2868;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PANELS = [
  { file: 'calendar',     line1: 'Your whole day,',   line2: 'on one screen' },
  { file: 'dashboard',    line1: 'Know where you are,', line2: 'the moment you look' },
  { file: 'booking-page', line1: 'They book themselves,', line2: 'day or night' },
  { file: 'clients',      line1: 'Every client,',     line2: 'every visit, kept' },
  { file: 'invoices',     line1: 'Invoice and get paid', line2: 'before they leave' },
];

const page = (p) => {
  const b64 = fs.readFileSync(path.join(SHOTS, `${p.file}.png`)).toString('base64');
  return `<!doctype html><meta charset="utf-8"><style>
  @font-face { font-family: 'x'; src: local('Helvetica'); }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${W}px; height:${H}px; }
  body {
    /* Kairo's own ground, lifted by the brand blue so the frame reads as a
       product shot rather than a screenshot somebody pasted on black. */
    background:
      radial-gradient(120% 70% at 50% -8%, #1c4f96 0%, #10294f 34%, #0a1426 62%, #070a10 100%);
    font-family: -apple-system, 'Helvetica Neue', Helvetica, 'DejaVu Sans', Arial, sans-serif;
    color: #f2f6fc; overflow: hidden; position: relative;
  }
  /* A soft key light behind the phone. */
  /* A soft key light behind the phone. */
  .glow { position:absolute; left:50%; top:1100px; width:1700px; height:1700px;
    transform:translateX(-50%); border-radius:50%;
    background: radial-gradient(circle, rgba(64,150,250,.38) 0%, rgba(56,140,240,.14) 40%, rgba(0,0,0,0) 66%);
    filter: blur(12px); }
  .cap { position:absolute; left:0; right:0; top:172px; text-align:center; padding:0 80px; }
  .cap h1 { font-size:100px; line-height:1.08; font-weight:700; letter-spacing:-3px;
    text-shadow: 0 4px 40px rgba(0,0,0,.45); }
  .cap h1 .b { color:#7cc3ff; display:block; }
  /* The device. Its screen is sized to the capture's exact aspect ratio
     (1320 x 2868), so nothing inside is squashed or cropped. */
  .phone { position:absolute; left:50%; top:626px; transform:translateX(-50%);
    width:1000px; height:2135px; border-radius:106px; padding:16px;
    background: linear-gradient(155deg, #5b6675 0%, #1b222d 26%, #0c1017 60%, #434d5b 100%);
    box-shadow: 0 70px 150px rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,.06) inset; }
  .screen { width:968px; height:2103px; border-radius:92px; overflow:hidden; background:#070a10;
    position:relative; }
  .screen img { width:968px; height:2103px; display:block; }
  .screen::after { content:''; position:absolute; inset:0; border-radius:92px;
    box-shadow: 0 0 0 3px rgba(0,0,0,.6) inset; pointer-events:none; }
</style>
<div class="glow"></div>
<div class="cap"><h1>${p.line1}<span class="b">${p.line2}</span></h1></div>
<div class="phone"><div class="screen"><img src="data:image/png;base64,${b64}"></div></div>`;
};

// --- drive chrome ---------------------------------------------------------
const chrome = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars',
  '--force-color-profile=srgb','--remote-debugging-port=9333','--remote-allow-origins=*','about:blank'],
  { stdio:['ignore','ignore','pipe'] });
process.on('exit', () => chrome.kill('SIGKILL'));
let wsUrl='';
for (let i=0;i<60 && !wsUrl;i++){ try { wsUrl=(await (await fetch('http://127.0.0.1:9333/json/version')).json()).webSocketDebuggerUrl; } catch { await sleep(250); } }
const ws = new WebSocket(wsUrl);
await new Promise((r,j)=>{ ws.addEventListener('open',r); ws.addEventListener('error',j); });
let id=0; const pending=new Map();
ws.addEventListener('message',(e)=>{ const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){ const {res,rej}=pending.get(m.id); pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);} });
const send=(method,params={},sessionId)=>new Promise((res,rej)=>{ const i=++id; pending.set(i,{res,rej}); ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})})); setTimeout(()=>{ if(pending.delete(i)) rej(new Error(method+' timeout')); },30000); });

const { targetId } = await send('Target.createTarget', { url:'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten:true });
const S=(m,p)=>send(m,p,sessionId);
await S('Page.enable');
await S('Emulation.setDeviceMetricsOverride',{ width:W, height:H, deviceScaleFactor:1, mobile:false });

for (const [i,p] of PANELS.entries()) {
  const file = path.join(SHOTS, `_frame-${p.file}.html`);
  fs.writeFileSync(file, page(p));
  await S('Page.navigate',{ url:'file://'+file });
  await sleep(1400);
  const { data } = await S('Page.captureScreenshot',{ format:'png', captureBeyondViewport:false });
  const out = path.join(OUT, `${String(i+1).padStart(2,'0')}-${p.file}.png`);
  fs.writeFileSync(out, Buffer.from(data,'base64'));
  console.log(`${path.basename(out)}  ${(fs.statSync(out).size/1024).toFixed(0)}kB`);
}
ws.close(); chrome.kill('SIGTERM');
