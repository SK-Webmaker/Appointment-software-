# Criteria menu

Everything below is already measured by the pipeline for every analyzed
wallet. Picking criteria = choosing which of these matter and the threshold
for each. Thresholds go in `criteria.json`.

## 1. Can it be copied at all? (hard gates)

| Metric | Why it matters | Starting point |
|---|---|---|
| Median hold time | Sub-minute flips are gone before a copy bot fills | > 2 min |
| Share of positions held < 60s | Same, as a share | < 30% |
| Copy ROI at 1s / 3s / 10s / 30s delay | The real question: does copying make money | > +10% at 3s |
| Edge kept (copy PnL / wallet PnL) | How much of their edge survives copying | > 40% |
| Median entry market cap | Entries at $4k mcap are launch snipes: price moves ~50% in the same second | > $30k? |
| Positions per day | Too many = bot; too few = no signal | 2 to 40 |
| Median position size | Too small = noise; too big = their buy *is* the pump | $100 to $5k |
| Followers on GMGN | Crowded wallets get front-run by other copiers | lower is better |
| Tags | `wash_trader`, `sandwich_bot`, `snipe_bot`, insider tags | exclude |

## 2. Is the edge real? (quality)

| Metric | Why it matters |
|---|---|
| Closed positions in window | Sample size: 15 trades proves little, 100 proves more |
| Win rate | Meme coins: 35-55% with big winners beats 80% with tiny ones |
| Profit factor (gross wins / gross losses) | Above 1.5 is solid, above 3 is excellent |
| Avg win vs avg loss | Do they cut losers fast? |
| Best trade share of profit | One lucky 100x is not a strategy |
| PnL without best trade | Still profitable without the outlier? |
| ROI buckets (lost >50%, lost 0-50%, up 0-100%, 2-5x, >5x) | Style: many small wins vs a few runners |
| Green-day share | Consistency across days |
| Worst losing streak / max drawdown | What it feels like to follow them |
| Avg buys per position | Scaling in is harder to mirror |
| Launchpad share | Pump.fun / Bonk launches vs older tokens |

## 3. Questions for you

1. **Copy setup**: which bot or platform will you copy with (Axiom, fomo, GMGN,
   Photon, Trojan, BullX...) and what delay does it really get? This sets the
   delay the backtest gates on.
2. **Size**: how much per copied trade? Slippage depends on it.
3. **Style**: quick scalps (minutes), swing holds (hours to days), or both?
4. **Mirror exits** or use your own TP/SL? Both can be backtested.
5. **Window**: the last 14 days (current regime) or 30+ days (more proof)?
6. **Your list**: the specific rules from your videos, transcripts and experience.
