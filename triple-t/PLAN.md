# Triple T plan

The whole plan on one page: what the pros' videos actually teach, the rules a
wallet must pass before you copy it, the bot settings, the budget, the daily
routine and a simple playbook for your own trades. The wallets themselves are
in `PICKS.md` (kept off GitHub).

## 1. What the four videos teach, fluff removed

Sources: Orangie ($3M+, two videos), a PvE scalper ($1K to $1M), Incentos with
TJR ($10M+).

**The market**
- Meme coins are attention markets. Price goes up only if *more* attention is
  coming than the coin has now. Every decision is "will more people care
  about this tomorrow than today?"
- Trade more when the market is hot (big volume, lots of coins moving), less
  when it is dead. Orangie made as much in one hot month as in the seven slow
  ones before it.

**Finding coins**
- Phone routine (Orangie): FOMO, then Tokens, then Graduated (Solana filter) and
  Trending. Look for the bubbles: coins that traders you follow are holding.
  Read their thesis.
- Sources of attention: TikTok/Reels memes before they spread, real news
  stories, tweets from people who move markets (Elon, Trump, Ansem, Vlad /
  Robinhood), listings (Binance Alpha, Robinhood).
- Skip the slop: beginners trade graduated coins, not brand-new launches.
  Incentos' filters: graduated, above ~$35K market cap, real fees paid (fake
  volume and bundled rugs don't pay fees).

**Deciding to buy** (all five should be "yes")
1. Why now? The story is fresh (hours old) and still spreading.
2. Is attention growing? Views, holders, thesis posts and 5-minute volume going
   up.
3. Is there a catalyst ahead (a celebrity, a listing, an event, a follow-up)?
4. Is it real? Graduated, real socials, mutual followers for project coins,
   not a chart that only goes up with no sellers.
5. Am I chasing? Buying after a vertical move "because everyone is" is how
   they all lost their biggest amounts.

**Size and exits**
- Only put in what you'd accept losing 99% of. Survive to trade tomorrow.
- Take your initial out at about 2x and let the rest ride with a stop at
  break-even. Sell in pieces on the way up. "You never go broke taking profit."
- For event scalps: buy fast, tight stop (-20%), take +50% and move on, never
  re-buy out of FOMO.
- Win rate doesn't matter. Winners must be much bigger than losers.
- Their biggest losses: blindly copying a group-chat call, chasing, going to
  bed in profit and waking up at zero (round-tripping).

**Finding wallets** (Incentos)
- Take the coins that ran today, open their top traders, check each wallet's
  30-day profit, win rate and hold time, and keep the ones that are early on
  runner after runner. Triple T does exactly this, automatically, for
  thousands of wallets.

**Where the pros and copy trading disagree.** All three say never copy
blindly. Two reasons: a copy lands after them (bots on famous wallets buy
first, so you pay more), and some popular traders sell into their own
followers. Triple T only copies wallets that *still made money when copied a
second or three late*, with the bot's real fees, and it rejects wallets whose
price jumps the moment they buy (crowded) or whose followers lose while they
win.

## 2. The rules (what a wallet must show)

All checks run on the wallet's last 28 days of real trades. Thresholds live in
`criteria.json`.

| # | Rule | Why | Threshold |
|---|---|---|---|
| | **Who gets looked at** | | |
| 1 | Not a bot, wash trader, sandwich bot, sniper or token creator | Bots can't be followed; creators dump | GMGN tags |
| 2 | Active in the last 3 days, 20+ buys in 30 days | Dead wallets don't trade | |
| 3 | Profitable over 30 days | | |
| 4 | **Niche: 5,000 GMGN followers or fewer** | Your rule: crowded wallets get front-run and dump on followers | |
| | **Can it be copied?** | | |
| 5 | Median hold 3 minutes or more | Second-flips are over before a copy lands | |
| 6 | 30% or fewer trades closed inside 60 seconds | Same | |
| 7 | Typical entry at $30K+ market cap | Graduated coins, not launch snipes (videos: migrated filter ~$35K) | |
| 8 | 25 coins a day or fewer | Pros: "10 to 20 tokens a day, be selective" | |
| 9 | Their typical buy is $50 to $10K | Small buys are probes; huge buys are their own pump | |
| | **Is the edge real?** | | |
| 10 | 20+ closed trades | Enough proof | |
| 11 | Profit factor 1.5+ (winners pay for losers 1.5 times over) | "Win rate doesn't matter, winners must be bigger" | |
| 12 | Still profitable without their single best trade | One lucky 100x isn't a strategy | |
| 13 | Green on half or more of their trading days | Consistency | |
| 14 | Trades on 5+ different days | "Show up every day" | |
| 15 | Mostly meme coins | That's the game | 50%+ launchpad coins |
| | **Not dumping on followers** (your rule) | | |
| 16 | Price jumps 15% or less between their buy and 3 seconds later | A big jump means bots and followers pile in behind them | median |
| 17 | **Copying them made money**: +5% or better copied 1 second late, still profitable 3 seconds late, with the bot's fees and guards | The test that matters. If they win while copiers lose, followers are their exit | 10+ copies |
| | **The final 10** | | |
| 18 | Best copy results first; at most 2 well-known wallets | Your rule: a few known names are fine, most should be niche | well-known = 1,000+ GMGN followers, KOL tag, or 10K+ fomo followers |

"US wallets" (your note): wallets have no country, so I read this as famous
/ KOL wallets and capped them at 2 of 10 (rule 18). Tell me if you meant
something else.

**The proof step.** The same rules are run using only the *older* 14 days of
data. Those picks are then copied over the *newer* 14 days, which the
rules never saw. That's compared with copying last fortnight's biggest
earners, and with copying random wallets. Results are at the top of
`PICKS.md`.

## 3. Bot settings

**copyfomo** (fomo traders), per trader:

| Setting | Value | Why |
|---|---|---|
| Sizing | Fixed, $5 per copy | Above the $3 minimum, fees stay a % |
| Minimum trade to follow | $50 | Ignore their probe buys (rule 9) |
| Market cap band | Min $30K, max off | Rule 7 |
| First buys only | On | The backtest copies their first buy only |
| Max chase | 10% | The single best setting in testing: skips copies that would land after the pump |
| Max impact | Off | |
| Exit style | Mirror | Sell the same share they sell |
| When they sell at a loss | Sell with them | That's what was tested |
| Take profit / stop loss | Off for now | Not tested yet; add later if testing supports it |
| Same coin, two traders | First buy wins | Keeps every position at $5 |
| Max positions | 10 | Caps how much is out at once |

**GMGN copy trade** (non-fomo wallets), per wallet:

| Setting | Value |
|---|---|
| Buy mode | Fixed buy, ~$20 in SOL |
| Sell mode | Auto follow sell |
| Priority fee | 0.001 SOL (GMGN's suggested 0.002 to 0.006 eats small trades) |
| Anti-MEV | Off; Lightning mode off (it can copy trades that never happened) |
| Min copy amount | Their buy of about $50 or more |
| Market cap min | $30K |
| Single coin position increase times | 0 (first buys only) |

## 4. Daily routine (about 20 minutes, all on your phone)

- **Morning, 5 min.** copyfomo `/copies`: what was copied overnight, PnL per
  trader. FOMO, then Tokens, then Graduated: is the market hot or dead today?
- **Once or twice a day, 10 min.** Your own trades (section 5), only on hot
  days. At most 3 new trades a day.
- **Before bed.** No new manual trades. Any manual position that hasn't had its
  initial taken out: close it, or set a stop. The bot keeps running.
- **Sunday, 30 min.** Say "weekly check": I re-run the hunt, compare your real
  copies with the backtest, drop traders who stopped working, and add new ones.
  Withdraw anything above your starting balance.

## 5. Your own trades on FOMO (the playbook)

1. **Hot days only.** Graduated tab busy, coins moving, big 5-minute volume.
2. **Where to look.** Graduated and Trending. Look for coins where 2+ people you
   follow, or Triple T's picks, are holding. Read their thesis.
3. **The five checks** from section 1 must all be yes.
4. **Size.** $5 a trade (10% of the manual pot), at most 3 open at once.
5. **Exits.**
   - At +100%, sell half (initial out).
   - Keep the rest with a stop at break-even.
   - Hard stop at -30% from your entry.
   - If the story stops spreading, get out.
6. **Event scalps** (the PvE video): a market-moving account acts and volume
   explodes. Buy fast, stop at -20%, sell most at +50%, never re-buy that coin.
7. **Write one line per trade**: why in, why out. We review it on Sunday.

## 6. Budget

Only use money you can afford to lose entirely. The amounts below are the
smallest at which the fees stop eating the edge. Scale up only on proof.

*(Filled in after the hunt, because the split depends on how many of the 10
are fomo traders, who go on copyfomo, versus other wallets, who go on GMGN.)*

**Scale-up rule.** After 2 weeks and 100+ copies: if live results are in line
with the backtest, double the per-copy size. Never add money after a losing
week.

**Stop rule.** If the total is down 30% from where you started, pause
everything (copyfomo kill switch, GMGN pause) and we re-run the hunt before
restarting.

## 7. What I can't verify yet

- copyfomo copies a fomo trader on every chain they use. Most also trade on
  Robinhood chain, but the backtest covers their Solana trades only.
- copyfomo's 2% fee comes from their docs, which hid the fee section on Sept 8.
  Check the fee on the confirmation screen.
- A backtest is the past. Wallets change, and a hot market can go cold. That's
  why there's a weekly check and a stop rule.
