// copyfomo.com publishes a profile page per well-known fomo trader: handle,
// fomo followers, 30d pnl, median swap, and the wallet addresses truncated
// (first 6 + last 4 characters). We read those public pages and match the
// truncated Solana address against wallets we already found on-chain. Full
// addresses for anyone else come from copyfomo's own /find in Telegram.
const https = require('https');
const { loadUniverse, saveUniverse, walletEntry, resetSource } = require('./discover');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => (res.statusCode === 200 ? resolve(body) : reject(new Error(`copyfomo HTTP ${res.statusCode} ${url}`))));
    }).on('error', reject);
  });
}

const text = (html) => html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\n\s*\n+/g, '\n');

function parseProfile(slug, html) {
  const t = text(html);
  const grab = (re) => { const m = t.match(re); return m ? m[1].trim() : null; };
  const num = (s) => (s ? Number(s.replace(/[^0-9.]/g, '')) : null);
  return {
    slug,
    handle: grab(/\n@([A-Za-z0-9_]+)\n/),
    fomoFollowers: num(grab(/\n([\d,]+)\nfollowers on fomo/)),
    pnl30d: grab(/\n([+−\-–]?\$[\d,.]+[km]?)\n30d pnl/),
    medianSwapUsd: num(grab(/\n\$([\d,.]+)\nmedian swap/)),
    tradesPerWeek: num(grab(/around ([\d,]+) trades a week/)),
    solanaTrunc: grab(/\nsolana\n([1-9A-HJ-NP-Za-km-z]{4,8}…[1-9A-HJ-NP-Za-km-z]{3,6})/),
    robinhoodTrunc: grab(/\nrobinhood chain\n(0x[0-9a-fA-F]{3,6}…[0-9a-fA-F]{3,6})/),
  };
}

async function copyfomoTraders({ log = console.error } = {}) {
  const list = await get('https://www.copyfomo.com/traders');
  const slugs = [...new Set([...list.matchAll(/\/traders\/([a-z0-9_]+)"/g)].map((m) => m[1]))];
  const out = [];
  for (const slug of slugs) {
    try { out.push(parseProfile(slug, await get(`https://www.copyfomo.com/traders/${slug}`))); } catch (e) { log(`  copyfomo ${slug}: ${e.message}`); }
    await new Promise((r) => setTimeout(r, 400));
  }
  return out;
}

// Match profiles to known wallets and record them as fomo traders.
async function importCopyfomo({ log = console.error } = {}) {
  const profiles = await copyfomoTraders({ log });
  const u = loadUniverse();
  resetSource(u, 'copyfomo');
  const addrs = Object.keys(u.wallets);
  let matched = 0;
  for (const p of profiles) {
    if (!p.solanaTrunc) continue;
    const [head, tail] = p.solanaTrunc.split('…');
    const hits = addrs.filter((a) => a.startsWith(head) && a.endsWith(tail));
    if (hits.length !== 1) continue;
    matched++;
    const w = walletEntry(u, hits[0]);
    w.sources.copyfomo = [{ handle: p.handle, fomoFollowers: p.fomoFollowers, pnl30d: p.pnl30d }];
    w.fomo = { ...(w.fomo || {}), handle: p.handle, fomoFollowers: p.fomoFollowers, robinhoodTrunc: p.robinhoodTrunc };
  }
  saveUniverse(u);
  log(`  copyfomo: ${profiles.length} profiles, ${matched} matched to known wallets`);
  return { profiles: profiles.length, matched, unmatched: profiles.filter((p) => p.solanaTrunc).length - matched };
}

module.exports = { importCopyfomo, copyfomoTraders, parseProfile };
