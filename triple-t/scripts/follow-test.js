// For each finalist: last 7 days of positions, follow at 3s / 10s / 30s with $5 copies
// (GMGN-like fees). Price jump 3s after their buy = crowding / dumping on followers.
const fs = require('fs');
const T = require('path').join(__dirname, '..');
const { Gmgn } = require(T + '/src/gmgn');
const { walletTrades, latestPrice } = require(T + '/src/history');
const { buildPositions } = require(T + '/src/positions');
const { backtestPositions, summarizeTrades } = require(T + '/src/backtest');
const { median } = require(T + '/src/positions');
const list = JSON.parse(process.argv[2]);
const now = Math.floor(Date.now() / 1000), since = now - 7 * 86400;
(async () => {
  const g = await new Gmgn({ tabs: 4, minGapMs: 130 }).open(); const out = [];
  try {
    for (const w of list) {
      try {
        const tr = await walletTrades(g, w.address, { days: 28, maxPages: 50, chain: w.chain, refresh: false });
        const { positions } = buildPositions(tr);
        const recent = positions.filter((p) => p.openTs >= since);
        const marks = {};
        for (const p of recent) if (p.status !== 'closed' && !(p.token in marks)) marks[p.token] = await latestPrice(g, p.token, w.chain);
        const bt = await backtestPositions(g, recent, { chain: w.chain, delays: [3, 10, 30], slippage: 0.01, feePct: 0.01, fixedFeeUsd: 0.06, sizeUsd: 5, minTicketUsd: 0, maxChase: null, minTraderBuyUsd: 20, marks, keepTrades: true });
        const r = { ...w, positions7d: recent.length };
        for (const d of ['3s', '10s', '30s']) { const t = bt.tradesByDelay[d].filter((x) => !x.skipped); const s = summarizeTrades(t); r['roi' + d] = s.roi; r['n' + d] = s.trades; }
        r.jump3 = median(bt.tradesByDelay['3s'].map((x) => x.entryPremium).filter((x) => isFinite(x)));
        r.jump30 = median(bt.tradesByDelay['30s'].map((x) => x.entryPremium).filter((x) => isFinite(x)));
        out.push(r);
        console.log(`${(w.handle ? '@' + w.handle : w.address.slice(0, 8)).padEnd(18)} ${w.chain.padEnd(9)} 7d positions ${recent.length} | follow 3s ${(r.roi3s * 100).toFixed(0)}% 10s ${(r.roi10s * 100).toFixed(0)}% 30s ${(r.roi30s * 100).toFixed(0)}% (n${r.n3s}) | price jump after buy: 3s ${(r.jump3 * 100).toFixed(1)}% 30s ${(r.jump30 * 100).toFixed(1)}%`);
      } catch (e) { console.log(w.address.slice(0, 8), 'error', e.message); }
    }
  } finally { await g.close(); }
  fs.writeFileSync(T + '/data/dumptest.json', JSON.stringify(out));
})();
