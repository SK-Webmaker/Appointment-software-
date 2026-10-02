const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.TRIPLE_T_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'triple-t-test-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPositions, walletStats } = require('../src/positions');
const { backtestPositions } = require('../src/backtest');

const T = 'MintA', U = 'MintB';
const trade = (ts, side, token, amount, priceUsd) => ({ ts, side, token, symbol: token, amount, priceUsd, usd: amount * priceUsd, supply: 1e9 });

test('round trip with partial sells closes and books PnL', () => {
  const { positions } = buildPositions([
    trade(100, 'buy', T, 1000, 1),
    trade(200, 'sell', T, 500, 2),
    trade(300, 'sell', T, 500, 3),
  ]);
  assert.equal(positions.length, 1);
  const p = positions[0];
  assert.equal(p.status, 'closed');
  assert.equal(p.costUsd, 1000);
  assert.equal(p.proceedsUsd, 2500);
  assert.equal(p.realizedPnlUsd, 1500);
  assert.equal(p.roi, 1.5);
  assert.equal(p.holdSec, 200);
  assert.equal(p.entryMcapUsd, 1e9);
});

test('sell without a prior buy is an orphan, not a position', () => {
  const { positions, orphanSells } = buildPositions([trade(50, 'sell', T, 10, 1), trade(100, 'buy', U, 10, 1)]);
  assert.equal(orphanSells, 1);
  assert.equal(positions.length, 1);
  assert.equal(positions[0].status, 'open');
});

test('re-entry after a full exit is a new position', () => {
  const { positions } = buildPositions([
    trade(1, 'buy', T, 100, 1), trade(2, 'sell', T, 100, 0.5),
    trade(3, 'buy', T, 100, 1), trade(4, 'sell', T, 100, 2),
  ]);
  assert.equal(positions.length, 2);
  assert.deepEqual(positions.map((p) => p.realizedPnlUsd), [-50, 100]);
  const s = walletStats(positions, { nowTs: 10 });
  assert.equal(s.winRate, 0.5);
  assert.equal(s.profitFactor, 2);
  assert.equal(s.totalRealizedPnlUsd, 50);
  assert.equal(s.bestTradeShareOfProfit, 2); // best trade is 2x the net total
});

test('partial sell of an open position books only the sold part', () => {
  const { positions } = buildPositions([trade(1, 'buy', T, 100, 1), trade(2, 'sell', T, 40, 3)]);
  const p = positions[0];
  assert.equal(p.status, 'partial');
  assert.equal(p.realizedPnlUsd, 120 - 40);
});

test('backtest: wallet fills baseline and delayed copy with costs', async () => {
  const { positions } = buildPositions([
    trade(1000, 'buy', T, 100, 1),
    trade(1100, 'sell', T, 50, 2),
    trade(1200, 'sell', T, 50, 4),
  ]);
  // Fake GMGN: candles priced so that 3s after each wallet trade the price is
  // 10% worse for us than the wallet got.
  const candles = { 1000: 1, 1003: 1.1, 1100: 2, 1103: 1.8, 1200: 4, 1203: 3.6 };
  const g = {
    async get(path) {
      const q = new URLSearchParams(path.split('?')[1]);
      const from = q.get('from') / 1000, to = q.get('to') / 1000;
      const list = Object.entries(candles).filter(([t]) => t >= from && t <= to)
        .map(([t, px]) => ({ time: t * 1000, open: px, high: px, low: px, close: px, volume: 1 }));
      return { list };
    },
  };
  const r = await backtestPositions(g, positions, { sizeUsd: 100, delays: [3], slippage: 0, feePct: 0, fixedFeeUsd: 0 });
  // Wallet fills: buy 100 @1, sell half @2, rest @4 -> 300 back on 100.
  assert.equal(r.walletFills.fixed.pnlUsd, 200);
  // Copy @3s: 100/1.1 tokens, half @1.8, half @3.6.
  const tokens = 100 / 1.1;
  const expected = tokens / 2 * 1.8 + tokens / 2 * 3.6 - 100;
  assert.ok(Math.abs(r.byDelay['3s'].pnlUsd - Math.round(expected * 100) / 100) < 0.011);
  assert.ok(r.byDelay['3s'].edgeRetained < 1 && r.byDelay['3s'].edgeRetained > 0.5);
});

test('backtest guards: max chase skips, min trader buy and mcap band filter', async () => {
  const { positions } = buildPositions([
    trade(1000, 'buy', T, 100, 1), trade(1100, 'sell', T, 100, 2), // their buy $100
    trade(2000, 'buy', U, 5, 1), trade(2100, 'sell', U, 5, 2), // their buy $5
  ]);
  const candles = { 1000: 1, 1001: 1.5, 1100: 2, 1101: 2, 2000: 1, 2001: 1.05, 2100: 2, 2101: 2 };
  const g = { async get(path) {
    const q = new URLSearchParams(path.split('?')[1]);
    const from = q.get('from') / 1000, to = q.get('to') / 1000;
    return { list: Object.entries(candles).filter(([t]) => t >= from && t <= to).map(([t, px]) => ({ time: t * 1000, open: px, high: px, low: px, close: px, volume: 1 })) };
  } };
  const base = { sizeUsd: 3, delays: [1], slippage: 0, feePct: 0, fixedFeeUsd: 0, minWalletCostUsd: 1 };
  let r = await backtestPositions(g, positions, { ...base, maxChase: 0.25 });
  assert.equal(r.byDelay['1s'].skippedByChase, 1); // T ran 50% before our fill
  assert.equal(r.byDelay['1s'].trades, 1);
  r = await backtestPositions(g, positions, { ...base, minTraderBuyUsd: 20 });
  assert.equal(r.positions, 1); // their $5 probe is ignored
  r = await backtestPositions(g, positions, { ...base, mcapBand: [2e9, null] });
  assert.equal(r.positions, 0); // both entries were at a $1b cap
  r = await backtestPositions(g, positions, { ...base, sizeUsd: 1, minTicketUsd: 3 });
  assert.equal(r.byDelay['1s'].deployedUsd, 6); // two copies, each lifted to $3
});

const { slicePositions } = require('../src/positions');
const { walletFails, copyFails, choose } = require('../src/hunt');

test('slicePositions as of a date hides what happened after it', () => {
  const { positions } = buildPositions([trade(100, 'buy', T, 100, 1), trade(200, 'sell', T, 50, 2), trade(400, 'sell', T, 50, 3)]);
  const [p] = slicePositions(positions, 0, 300, { asOf: 300 });
  assert.equal(p.status, 'partial'); // the second sell came after 300
  assert.equal(p.proceedsUsd, 100);
  assert.equal(p.closeTs, null);
  assert.equal(slicePositions(positions, 150, 300).length, 0); // opened before the window
});

test('rules: wallet and copy gates report what failed', () => {
  const c = { minClosed: 20, minMedianHoldSec: 180, maxShareHeldUnder60s: 0.3, minMedianEntryMcapUsd: 30000, maxPositionsPerDay: 25,
    firstBuyUsd: [50, 10000], minProfitFactor: 1.5, mustProfitWithoutBestTrade: true, minGreenDayShare: 0.5, minTradingDays: 5, minLaunchpadShare: 0.5 };
  const good = { closed: 40, medianHoldSec: 900, shareHeldUnder60s: 0.1, medianEntryMcapUsd: 120000, positionsPerDay: 6, medianFirstBuyUsd: 400,
    profitFactor: 2.2, pnlWithoutBestTradeUsd: 500, greenDayShare: 0.6, tradingDays: 12, launchpadShare: 0.9 };
  assert.deepEqual(walletFails(good, c), []);
  const sniper = { ...good, medianHoldSec: 8, shareHeldUnder60s: 0.95, medianEntryMcapUsd: 4000 };
  assert.deepEqual(walletFails(sniper, c).map((f) => f.name), ['median hold', 'flips under 60s', 'entry market cap']);
  assert.deepEqual(walletFails({ ...good, shareHeldUnder60s: null, profitFactor: Infinity }, c).map((f) => f.name), ['flips under 60s']);
  const cc = { minRoiAt1s: 0.05, minRoiAt3s: 0, minCopies: 10, maxMedianFollowerJump3s: 0.15 };
  const sum = (r1, r3, n, jump) => ({ at1s: { roi: r1, trades: n }, at3s: { roi: r3, trades: n }, followerJump3s: jump });
  assert.deepEqual(copyFails(sum(0.2, 0.1, 30, 0.05), cc), []);
  assert.deepEqual(copyFails(sum(0.2, -0.1, 30, 0.4), cc).map((f) => f.name), ['copy ROI at 3s', 'price jump after their buy']);
});

test('choose caps well-known wallets', () => {
  const xs = [{ score: 5, wellKnown: true }, { score: 4, wellKnown: true }, { score: 3, wellKnown: true }, { score: 2, wellKnown: false }, { score: 1, wellKnown: false }];
  const out = choose(xs, { count: 3, maxWellKnown: 2 });
  assert.deepEqual(out.map((x) => x.score), [5, 4, 2]);
});

const { walletTrades } = require('../src/history');

test('walletTrades: covered windows are not truncated, page caps are', async () => {
  const now = Math.floor(Date.now() / 1000);
  // A wallet with one trade an hour going back 60 days, served 50 per page.
  const rows = Array.from({ length: 24 * 60 }, (_, i) => ({ timestamp: now - i * 3600, event_type: i % 2 ? 'sell' : 'buy', token: { address: 'M', symbol: 'M', total_supply: '1' }, token_amount: '1', cost_usd: '1', price_usd: '1', tx_hash: `tx${i}` }));
  const fake = (rowsPerWallet) => ({ calls: 0, async walletActivityPage(_w, cursor) {
    this.calls++;
    const at = cursor ? Number(cursor) : 0;
    const page = rowsPerWallet.slice(at, at + 50);
    return { rows: page, next: at + 50 < rowsPerWallet.length ? String(at + 50) : null };
  } });
  let g = fake(rows);
  let out = await walletTrades(g, 'W1', { days: 28, maxPages: 50 });
  assert.equal(out.truncated, false); // 672 trades, reached the window start
  assert.ok(out.length >= 671 && out.length <= 673);
  const calls = g.calls;
  out = await walletTrades(g, 'W1', { days: 28, maxPages: 50 });
  assert.equal(out.truncated, false);
  assert.equal(g.calls - calls, 1); // second run: one page to catch up
  g = fake(rows);
  out = await walletTrades(g, 'W2', { days: 28, maxPages: 5 });
  assert.equal(out.truncated, true); // 250 rows cover ~10 days of 28
  const before = g.calls;
  await walletTrades(g, 'W2', { days: 28, maxPages: 5 });
  assert.equal(g.calls, before); // remembered as too active, no refetch
});

test('v2 rules: win rate, long holds, big caps, one-trade profit', () => {
  const c = { minClosed: 20, minWinRate: 0.45, minMedianHoldSec: 60, maxMedianHoldSec: 7200, maxShareHeldUnder60s: 0.5,
    minMedianEntryMcapUsd: 10000, maxMedianEntryMcapUsd: 1e6, maxPositionsPerDay: 25, firstBuyUsd: [50, 1000],
    minProfitFactor: 1.5, maxBestTradeShareOfProfit: 0.5, minGreenDayShare: 0.6, minTradingDays: 5, minLaunchpadShare: 0.5 };
  const good = { closed: 40, winRate: 0.55, medianHoldSec: 600, shareHeldUnder60s: 0.2, medianEntryMcapUsd: 80000, positionsPerDay: 6,
    medianFirstBuyUsd: 150, profitFactor: 2.5, totalRealizedPnlUsd: 900, bestTradeShareOfProfit: 0.3, greenDayShare: 0.7, tradingDays: 12, launchpadShare: 0.9 };
  assert.deepEqual(walletFails(good, c), []);
  const swing = { ...good, medianHoldSec: 20000, medianEntryMcapUsd: 3e6, winRate: 0.3, bestTradeShareOfProfit: 0.8 };
  assert.deepEqual(walletFails(swing, c).map((f) => f.name), ['holds too long', 'win rate', 'buys big caps', 'one trade is the profit']);
  assert.deepEqual(walletFails({ ...good, totalRealizedPnlUsd: -5, bestTradeShareOfProfit: null }, c).map((f) => f.name), ['one trade is the profit']);
});

const { sameTrader } = require('../src/hunt');

test('choose keeps one wallet per trader', () => {
  const pos = (list) => list.map(([token, openTs]) => ({ token, openTs }));
  const twinA = { positions: pos(Array.from({ length: 20 }, (_, i) => [`T${i}`, 1000 + i * 600])) };
  const twinB = { positions: pos(Array.from({ length: 20 }, (_, i) => [`T${i}`, 1010 + i * 600])) }; // 10s behind A on every coin
  const other = { positions: pos(Array.from({ length: 20 }, (_, i) => [`T${i}`, 50000 + i * 600])) }; // same coins, never together
  const rule = { minSharedCoins: 0.5, minSyncBuys: 10, syncWindowSec: 60 };
  assert.equal(sameTrader(twinA, twinB, rule), true);
  assert.equal(sameTrader(twinA, other, rule), false);
  const out = choose([{ r: twinA, score: 3 }, { r: twinB, score: 2 }, { r: other, score: 1 }], { count: 3, maxWellKnown: 2, oneWalletPerTrader: rule });
  assert.deepEqual(out.map((x) => x.score), [3, 1]);
});
