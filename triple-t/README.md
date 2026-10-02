# Triple T: Trader Tracker

Finds Solana meme coin wallets worth copy trading, scores them against criteria we
agree on, and backtests what *copying* them would actually have earned (with copy
delay, slippage and fees), not what the wallet itself earned.

## Where the wallets come from

| Source | What it gives | Access |
|---|---|---|
| **GMGN** wallet leaderboards | 100 wallets per call with 1d/7d/30d PnL, realized profit, win rate, ROI buckets, avg hold, avg size, follower count, and tags: platform (`axiom`, `fomo`, `photon`, `padre`, `gmgn`, `trojan`, `bullx`) and red flags (`wash_trader`, `sandwich_bot`, `snipe_bot`) | Free. gmgn.ai is behind Cloudflare, so we open it in headless Chromium and call its API from inside the page |
| **GMGN** token top traders | For each meme coin that ran: the top 100 wallets by profit, with entry time, cost, insider/transfer flags and funding wallet | Same |
| **kolscan.io** | Daily / weekly / monthly top 50 KOL wallets with names and X handles | Free, parsed from the server-rendered page |
| **fomo.family** | fomo's own leaderboards and each leader's profile, balances and swaps | Needs a logged-in session: run `scripts/fomo-export.js` in your browser and send the file |
| **Axiom** | No public trader leaderboard; GMGN's `axiom` tag marks wallets that trade through Axiom | n/a |

Per wallet we pull the full buy/sell history (GMGN wallet activity) and, for the
backtest, **1-second price candles** around every trade.

## Pipeline

```
discover  ->  data/universe.json        every wallet from every source, merged by address
prescreen ->  cheap gates on leaderboard stats, picks who gets a deep dive
analyze   ->  history -> positions -> stats -> copy backtest -> final gates -> REPORT.md
```

```bash
cd triple-t && npm install
node src/cli.js discover            # ~2 min
node src/cli.js prescreen           # dry run: who would be analyzed
node src/cli.js analyze             # history + backtest for the shortlist
node src/cli.js analyze --only=<wallet1>,<wallet2>
node src/cli.js fomo-import fomo-export-YYYY-MM-DD.json
```

Everything is cached under `data/cache/`, so changing criteria or delay
assumptions and re-running costs no new API calls.

## The backtest

For each position the wallet opened in the window:

- we buy `sizeUsd` worth **N seconds after their first buy** (N = 1, 3, 10, 30),
  at the 1-second candle price at that moment, plus slippage;
- each time they sell, we sell the **same fraction of our bag**, N seconds later;
- every fill pays slippage, a % platform fee and a fixed priority-fee/tip cost;
- positions they still hold are marked to the latest price (0 if the token has
  not traded for 3 days).

"Wallet fills" runs the same thing on the wallet's own execution prices. **Edge
kept** = copy PnL / wallet-fills PnL: how much of the trader's edge survives copying.

Known limits: our own buy's price impact is only modeled through the slippage
setting; candles exist only for seconds with trades; GMGN activity shows swaps,
not transfers, so a wallet that moves tokens to another wallet and sells there
looks like it never sold.

## Criteria

All thresholds live in `criteria.json`. The current file is **provisional**: it
only removes wallets that cannot be copied at all, so the pipeline can be proven
end to end. It gets replaced with the criteria we agree on.

## Privacy

`data/`, `REPORT.md` and fomo exports are git-ignored. The repo is public, and
publishing the wallets we copy would invite the crowding that kills copy-trade edge.
