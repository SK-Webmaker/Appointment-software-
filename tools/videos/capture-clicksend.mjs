import { chromium } from 'playwright-core';
const OUT = new URL('./shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY }, args: ['--disable-quic', '--disable-http2', '--ignore-certificate-errors-spki-list=' + process.env.SPKI] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, locale: 'en-AU', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36' });
const p = await ctx.newPage();
await p.goto('https://dashboard.clicksend.com/signup', { waitUntil: 'networkidle', timeout: 90000 }).catch((e) => console.log('goto', e.message.slice(0, 80)));
await p.waitForTimeout(6000);
// Chat bubble out of the way, like a real first visit before it pops.
const hideChat = () => p.addStyleTag({ content: '#intercom-container, .intercom-lightweight-app, iframe[name^="intercom"], .intercom-launcher { display:none !important }' }).catch(() => {});
await hideChat();
await p.screenshot({ path: `${OUT}cs-signup-0.png` });
const boxes = {};
const fields = await p.$$eval('input', (els) => els.map((e) => ({ name: e.name, ph: e.placeholder, type: e.type, id: e.id })));
console.log(JSON.stringify(fields));
const fill = async (ph, val, key) => {
  const el = p.locator(`input[placeholder="${ph}"]`).first();
  if (!(await el.count())) { console.log('missing', ph); return; }
  const r = await el.boundingBox(); boxes[key] = r;
  await el.click(); await el.pressSequentially(val, { delay: 10 });
};
await fill('Enter your first name', 'Mia', 'first');
await p.screenshot({ path: `${OUT}cs-signup-1.png` });
await fill('Enter your last name', 'Chen', 'last');
await fill('Enter your company name', 'Luxe Hair', 'company');
await p.screenshot({ path: `${OUT}cs-signup-2.png` });
await fill('Use your best contact email', 'mia@luxehair.com.au', 'email');
await fill('Use a mix of letters, numbers and symbols', 'Kairo-demo-2026!', 'password');
await p.locator('body').click({ position: { x: 900, y: 700 } }).catch(() => {});
await p.waitForTimeout(600);
await hideChat();
await p.screenshot({ path: `${OUT}cs-signup-3.png` });
const btn = p.getByRole('button', { name: /start free trial/i }).first();
boxes.start = await btn.boundingBox().catch(() => null);
console.log(JSON.stringify(boxes));
await import('node:fs').then((fs) => fs.writeFileSync(`${OUT}cs-boxes.json`, JSON.stringify(boxes)));
await p.goto('https://dashboard.clicksend.com/login', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
await p.waitForTimeout(5000); await hideChat();
await p.screenshot({ path: `${OUT}cs-login.png` });
await b.close();
