// GMGN client. gmgn.ai sits behind a Cloudflare check that plain HTTP clients
// fail, so we open the site once in headless Chromium and make every API call
// from inside that page with fetch(). The page carries the clearance cookie.
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://gmgn.ai';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function chromiumPath() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return undefined;
  const dir = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const exe = dir && `${root}/${dir}/chrome-linux/chrome`;
  return exe && fs.existsSync(exe) ? exe : undefined;
}

class Gmgn {
  // tabs: parallel pages sharing one clearance cookie. minGapMs is the global
  // gap between request starts across all tabs.
  constructor({ minGapMs = 250, tabs = 4, verbose = false } = {}) {
    this.minGapMs = minGapMs;
    this.tabs = tabs;
    this.verbose = verbose;
    this.next = 0;
    this.calls = 0;
    this.free = [];
    this.waiters = [];
  }

  async open() {
    const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
    this.browser = await chromium.launch({
      headless: true,
      executablePath: chromiumPath(),
      proxy,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const ctx = await this.browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1366, height: 850 } });
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
    this.page = await ctx.newPage();
    await this.page.goto(`${BASE}/?chain=sol`, { timeout: 60000 }).catch(() => {});
    let cleared = false;
    for (let i = 0; i < 12 && !cleared; i++) {
      const title = await this.page.title();
      cleared = !!title && !/moment|attention/i.test(title);
      if (!cleared) await this.page.waitForTimeout(2500);
    }
    if (!cleared) throw new Error('GMGN: Cloudflare check did not clear');
    this.free.push(this.page);
    // Extra tabs reuse the clearance cookie; a blank same-origin page is enough to fetch from.
    for (let i = 1; i < this.tabs; i++) {
      const p = await ctx.newPage();
      await p.goto(`${BASE}/robots.txt`, { timeout: 60000 }).catch(() => {});
      this.free.push(p);
    }
    return this;
  }

  async acquire() {
    if (this.free.length) return this.free.pop();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release(page) {
    const w = this.waiters.shift();
    if (w) w(page); else this.free.push(page);
  }

  async throttle() {
    const slot = Math.max(Date.now(), this.next);
    this.next = slot + this.minGapMs;
    const wait = slot - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  async close() {
    if (this.browser) await this.browser.close();
  }

  // GET a GMGN API path ("/defi/..."), returning parsed JSON `data`.
  async get(path, { retries = 4 } = {}) {
    let last = '';
    for (let attempt = 0; attempt <= retries; attempt++) {
      await this.throttle();
      this.calls++;
      const page = await this.acquire();
      const res = await page.evaluate(async (p) => {
        try {
          const r = await fetch(p, { credentials: 'include' });
          return { status: r.status, text: await r.text() };
        } catch (e) {
          return { status: 0, text: String(e) };
        }
      }, path).finally(() => this.release(page));
      if (this.verbose) console.error(`[gmgn] ${res.status} ${path.slice(0, 120)}`);
      last = `${res.status} ${res.text.slice(0, 60).replace(/\s+/g, ' ')}`;
      if (res.status === 200) {
        let body;
        try { body = JSON.parse(res.text); } catch { body = null; }
        if (body && body.code === 0) return body.data;
        if (body && body.code !== 0 && attempt === retries) throw new Error(`GMGN ${path}: code ${body.code} ${body.msg || ''}`);
      }
      if (res.status === 404) throw new Error(`GMGN 404 ${path}`);
      // 403 means the clearance expired: reload the site to get a fresh one.
      if (res.status === 403) await this.page.reload({ timeout: 60000 }).catch(() => {});
      if (res.status === 429) this.next = Date.now() + 5000; // back off every tab
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
    throw new Error(`GMGN ${path}: gave up after ${retries + 1} attempts (last: ${last})`);
  }

  // Wallet leaderboard. period: 1d|7d|30d. Returns up to `limit` rows.
  async rankWallets({ period = '7d', orderby = `pnl_${period}`, direction = 'desc', tag = null, limit = 100 } = {}) {
    const q = new URLSearchParams({ orderby, direction, limit: String(limit) });
    if (tag) q.set('tag', tag);
    const data = await this.get(`/defi/quotation/v1/rank/sol/wallets/${period}?${q}`);
    return data.rank || [];
  }

  // One page of a wallet's buys/sells, newest first. Pass the returned `next`
  // cursor to continue. Each row is one swap with USD cost and price.
  async walletActivityPage(wallet, cursor = null, limit = 50, chain = 'sol') {
    const q = new URLSearchParams({ wallet, limit: String(limit) });
    q.append('type', 'buy');
    q.append('type', 'sell');
    if (cursor) q.set('cursor', cursor);
    const data = await this.get(`/vas/api/v1/wallet_activity/${chain}?${q}`);
    return { rows: data.activities || [], next: data.next || null };
  }

  // Walk activity back until `sinceTs` (unix seconds) or `maxPages`.
  async walletActivity(wallet, { sinceTs = 0, maxPages = 40 } = {}) {
    const out = [];
    let cursor = null;
    for (let page = 0; page < maxPages; page++) {
      const { rows, next } = await this.walletActivityPage(wallet, cursor);
      out.push(...rows);
      const oldest = rows.length ? rows[rows.length - 1].timestamp : 0;
      if (!next || !rows.length || oldest < sinceTs) break;
      cursor = next;
    }
    return out.filter((r) => r.timestamp >= sinceTs);
  }
}

module.exports = { Gmgn };
