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
