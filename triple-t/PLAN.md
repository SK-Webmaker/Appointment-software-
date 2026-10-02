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

The rules run on each wallet's latest 14 days of real trades (28 days are
pulled so the older 14 can be used for the proof step). Thresholds live in
`criteria.json`. Version 2 = the videos' rules, your rules, and what the data
showed actually predicts a wallet *still* winning the following week.

| # | Rule | Why | Threshold |
|---|---|---|---|
| | **Who gets looked at** | | |
| 1 | Not a bot, wash trader, sandwich bot, sniper or token creator | Bots can't be followed; creators dump | GMGN tags |
| 2 | Active in the last 3 days, 20+ buys in 30 days | Dead wallets don't trade | |
| 3 | Profitable over 30 days | | |
| 4 | **Niche: 5,000 GMGN followers or fewer** | Your rule: crowded wallets get front-run and dump on followers | |
| | **Can it be copied?** | | |
| 5 | Median hold 1 minute to 2 hours | Under a minute is over before a copy lands; over 2 hours went cold the next week (only 26% stayed positive) | |
| 6 | Half or fewer trades closed inside 60 seconds | Same | |
| 7 | Typical entry $10K to $1M market cap | Below $10K is launch sniping a copy can't match; above $1M went cold the next week (39% positive) | |
| 8 | 25 coins a day or fewer | Pros: "10 to 20 tokens a day, be selective" | |
| 9 | Their typical buy is $50 to $1,000 | Small buys are probes; $50-200 buyers held up best (71% vs 50%) | |
| | **Is the edge real, and does it last?** | | |
| 10 | 20+ closed trades | Enough proof | |
| 11 | **Win rate 45% or more** | Best single predictor of still winning next week: 60%+ win rate, 90% stayed positive; under 30%, 43% | |
| 12 | **Green on 60%+ of trading days** | 65%+ green: 77% stayed positive; under 40%: 44% | |
| 13 | **No single trade is more than half the profit** | Spread-out profit held up (70-100% positive); one-hit wallets were a coin flip | |
| 14 | Profit factor 1.5+ | Winners pay for losers; 5+ was the strongest band | |
| 15 | Trades on 5+ different days; mostly meme coins | Consistency; that's the game | |
| | **Not dumping on followers** (your rule) | | |
| 16 | Price jumps 15% or less between their buy and 3 seconds later | A big jump means bots and followers pile in behind them | median |
| 17 | **Copying them did not lose money**: 1s and 3s late, with the bot's real fees and guards | If they win while copiers lose, followers are their exit | 10+ copies |
| | **The final 10** | | |
| 18 | Ranked by win rate x green days x sample size; at most 2 well-known wallets | Past copy profit did *not* predict future copy profit (correlation -0.06), the traits above did | well-known = 1,000+ GMGN followers, KOL tag, or 10K+ fomo followers |
| 19 | **One wallet per trader** | Some traders run several wallets (or one copies another). Two picks that share most of their coins and keep buying within a minute of each other count as one; only the best is kept, so the 10 are really 10 | 50%+ shared coins and 10+ buys within 60s |

"US wallets" (your note): wallets have no country, so I read this as famous
/ KOL wallets and capped them at 2 of 10 (rule 18). Tell me if you meant
something else.

**Where the data disagrees with the pros.** "Win rate doesn't matter" is true
for *making* money: winners must be bigger than losers. But for *choosing who
to follow*, win rate was the most reliable sign that a trader would keep
winning. And the fastest traders, who hold under a minute and buy under $10K,
had the most persistent edge of all, but it's an edge you can't copy: the
price is already up when your copy lands.

**The proof step.** The same rules are run using only the *older* 14 days of
data. Those picks are then copied over the *newer* 14 days, which the
rules never saw. That's compared with copying last fortnight's biggest
earners, and with copying random wallets. The v2 traits were chosen from week
1 vs week 2 of the older half only, so this test stays honest. Results are at
the top of `PICKS.md`.

## 3. Bot settings

The 10 picks go on **GMGN** (it copies any wallet, up to 10). copyfomo can only
copy fomo traders, and the best fomo trader that passes every rule goes there.

**copyfomo** (no fomo trader qualifies this round; these are the settings for
when one does):

| Setting | Value | Why |
|---|---|---|
| Sizing | Fixed, $5 per copy | Above the $3 minimum, fees stay a % |
| Minimum trade to follow | $50 | Ignore their probe buys (rule 9) |
| Market cap band | Off | Rule 7 already picks traders who buy in the $10K to $1M range; the per-trade filter wasn't tested |
| First buys only | On | The backtest copies their first buy only |
| Max chase | 10% | The single best setting in testing: skips copies that would land after the pump |
| Max impact | Off | |
| Exit style | Mirror | Sell the same share they sell |
| When they sell at a loss | Sell with them | That's what was tested |
| Take profit / stop loss | Off for now | Not tested yet; add later if testing supports it |
| Same coin, two traders | First buy wins | Keeps every position at $5 |
| Max positions | 10 | Caps how much is out at once |

**GMGN copy trade** (the 10 picks), per wallet:

| Setting | Value |
|---|---|
| Buy mode | Fixed buy, $5 in SOL (about 0.042 SOL) |
| Sell mode | Auto follow sell |
| Priority fee | 0.0005 SOL. This one matters: in testing, the same wallets made about twice as much per copy at 0.0005 as at 0.001 (+8.5% vs +4%). At GMGN's suggested 0.002 to 0.006, the fee alone wipes out the edge on $5 copies |
| Anti-MEV | Off; Lightning mode off (it can copy trades that never happened) |
| Min copy amount | 0.4 SOL (their buy of about $50 or more) |
| Market cap limit | Off (not tested; rule 7 covers it) |
| Single coin position increase times | 0 (first buys only) |

## 4. Daily routine (about 20 minutes, all on your phone)

- **Morning, 5 min.** GMGN, Copy Trade tab: what was copied overnight, PnL per
  wallet, and any failed copies (a paused task means low SOL). FOMO, then Tokens,
  then Graduated: is the market hot or dead today?
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

Only use money you can afford to lose entirely. These are the smallest amounts
at which fees stop eating the edge and the bots don't run dry. (GMGN pauses a
copy task after 3 failed copies, for example when there isn't enough SOL.) The
bankroll figures are measured: the lowest the cash balance would have gone
while copying the picks over the last 28 days.

| Pot | Recommended | Lean start | How it's used |
|---|---|---|---|
| **GMGN copy bot** | **$500** (about 4.2 SOL): all 10 picks at $5 per copy | **$200**: the top 5 picks at $5 per copy | Measured need: $325 to $515 for 10 picks, $165 to $190 for 5. 55 to 90 copies a day for 10, 19 to 37 for 5 |
| **copyfomo** | $0 this round | $0 | No fomo trader passes every rule right now. The weekly check re-tests; if one qualifies, give it $50 at $5 per copy |
| **Your own trades on FOMO** | $50 | $50 | $5 a trade, at most 3 open (section 5) |
| **Total** | **$550** | **$250** | |

The forward test covered groups of 10. The 5-wallet lean start is less spread
out, so expect bigger swings.

**Scale-up rule.** After 2 weeks and 300+ copies: if live results are near the
backtest, raise the copy size from $5 to $10 (bankroll doubles too). Never add
money after a losing week.

**Stop rule.** If the total is down 30% from where you started, pause
everything and we re-run the hunt before restarting. A single wallet that is
down 25% over its last 30+ copies gets swapped out at the weekly check.

**Take profit on the pot.** At the weekly check, withdraw anything above your
starting balance. Nothing is realized until it's realized.

## 7. What the testing showed

Every number below is copy results after the bot's fees, copying 1 second
behind, in a 14-day period the rules never saw.

| Picked by | Copy result over the next 14 days |
|---|---|
| Triple T final rules ($5 copies, 0.0005 SOL fee, one wallet per trader) | **+5.5% per copy** (90% range -1.2% to +13.7%), 4 of 9 wallets in profit |
| Same rules, $20 copies | +11% per copy (90% range +4% to +19%), 7 of 10 wallets in profit |
| First version of the rules (videos + your rules only) | +6% per copy, 5 of 10 |
| Random wallets from the same pool | -5% to -6% |
| Last fortnight's biggest earners | -3% to +7% (they trade rarely, so this jumps around) |

What that means:

- **The rules beat random wallets by roughly 10 to 17 points in every run.** That
  gap is the edge.
- **Individual wallets are close to a coin flip.** About half the picks lost in
  their next fortnight; the group still made money. That's why it's 10 wallets at a
  small size, not 2 wallets at a big one, and why there's a weekly swap.
- **A wallet's past copy profit did not predict its next fortnight** (correlation
  -0.06). Win rate, green days and spread-out profit did, so the ranking uses
  those.
- **Expect less live.** The pool only contains wallets that are active and
  profitable today, which flatters every group in the test. Real copies also
  fail sometimes and can land later than 1 to 3 seconds.

## 8. What I can't verify yet

- copyfomo copies a fomo trader on every chain they use. Most also trade on
  Robinhood chain, but the backtest covers their Solana trades only. That
  matters only if a fomo trader becomes a pick.
- Half of the current picks are new wallets (1 to 2 weeks old). Traders switch
  wallets, sometimes to shake off copiers. The weekly check catches a wallet
  that goes quiet.
- Most of each wallet's copy profit comes from a few big winners, with many
  small losses in between. Switching the bot off on a bad day risks missing the
  trades that pay for everything.
- copyfomo's 2% fee comes from their docs, which hid the fee section on Sept 8.
  Check the fee on the confirmation screen.
- A backtest is the past. Wallets change, and a hot market can go cold. That's
  why there's a weekly check and a stop rule.
