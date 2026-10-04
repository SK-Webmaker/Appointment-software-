// Refresh 28-day histories for (A) the Solana wallets that passed the consistency
// bar and (B) FOMO traders with an X handle (Solana + Robinhood chain), then score.
const fs = require('fs');
const T = require('path').join(__dirname, '..');
const { Gmgn } = require(T + '/src/gmgn');
const { walletTrades } = require(T + '/src/history');
const { consistency } = require('./consistency');
const now = Math.floor(Date.now() / 1000);
const prev = JSON.parse(fs.readFileSync(T + '/data/consistency28.json', 'utf8'));
const bad = ['wash_trader', 'sandwich_bot', 'snipe_bot', 'bundler_bot', 'top_dev'];
const passA = prev.filter((r) => !r.tags.some((t) => bad.includes(t)) && r.total > 0 && r.activeDays >= 16 && r.greenShare >= 0.7 && r.weeksUp >= 4 && r.bestDayShare <= 0.3 && r.closed >= 60 && (r.pf === Infinity || r.pf >= 1.5) && r.hold >= 60 && r.followers <= 5000);
const fr = JSON.parse(fs.readFileSync(T + '/data/fomo-rank.json', 'utf8'));
const f = (x) => Number(x) || 0;
const seen = new Set();
const jobs = passA.map((r) => ({ chain: 'sol', address: r.address, handle: r.twitter, followers: r.followers, tags: r.tags, src: 'consistent' }));
for (const r of fr) {
  const a = r.wallet_address || r.address; const k = r.chain + a;
  if (!r.twitter_username || seen.has(k)) continue; seen.add(k);
  const tags = r.tags || [];
  if (tags.some((t) => bad.includes(t))) continue;
  if (!(f(r.realized_profit_30d) > 0) || f(r.buy_30d) < 30 || f(r.buy_30d) > 2500 || now - f(r.last_active) > 72 * 3600) continue;
  jobs.push({ chain: r.chain, address: a, handle: r.twitter_username, followers: f(r.follow_count), tags, src: 'fomo' });
}
console.error(jobs.length, 'wallets to refresh', jobs.filter((j) => j.src === 'fomo').length, 'fomo');
(async () => {
  const g = await new Gmgn({ tabs: 4, minGapMs: 150 }).open();
  const out = []; let i = 0, done = 0;
  try {
    await Promise.all([0, 1, 2, 3].map(async () => {
      while (i < jobs.length) {
        const j = jobs[i++];
        try {
          const tr = await walletTrades(g, j.address, { days: 28, maxPages: 50, chain: j.chain });
          if (tr.truncated) { out.push({ ...j, truncated: true }); }
          else out.push({ ...j, ...consistency(tr, now) });
        } catch (e) { out.push({ ...j, error: e.message }); }
        if (++done % 10 === 0) console.error('  ', done, '/', jobs.length);
      }
    }));
  } finally { await g.close(); }
  fs.writeFileSync(T + '/data/consistency-run.json', JSON.stringify(out));
  console.error('done');
})();
