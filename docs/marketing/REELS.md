# Instagram reels: what to post, when, and how

The second channel after search (see `README.md`). Reels reach salon owners
who are not searching yet; the switching pages catch the ones who are.

## Why these reels look the way they do

- **No AI person talking.** Faceless formats that are working right now:
  a fake text thread over moody B-roll ("Where are you" style), big
  word-by-word type cut on a beat, and the 7-second "money can't buy
  happiness, but…" loop. Real-looking footage, phone-native text.
- **Instagram ranks on sends, watch time and replays.** Each reel opens on the
  claim in the first frame. Reel 1 is built to be sent to a friend ("POV: your
  salon bestie…"). The loop is short enough to be watched twice.
- **One selling point that beats everyone: no monthly bill.** $410 once,
  $0 a month and no commission, against Fresha's published prices. Then the
  features owners ask about first: online booking, deposits, reminders, the
  iPhone app, and bringing their client list over (CSV import).
- **Loud but true.** Every number is Fresha's own Australian price (checked
  20 Oct 2026, same as `my-creative-space/src/data/rivals.ts`) or Kairo's
  (`claude-upgrades-/config/brand.json`). The fine print says so, and the chat
  reel is labelled as a dramatisation. Kairo does not pretend to have
  customers' quotes it does not have.

## The three reels

The pages, B-roll and render tools are in `SK-Webmaker/claude-upgrades-`, branch
`claude/gloss-kairo-setup-0ds0mp`, under `reel/` (render: `node tools/render-page.mjs <name>`).
Each comes as `<name>.mp4` (original beat, never muted for copyright) and
`<name>-nomusic.mp4` (sound effects only, for a trending sound).

| Reel | Length | Idea |
|---|---|---|
| `group-chat` | 17.4 s | A text thread: "wait. you still pay fresha EVERY month?? 😭" … "Kairo. DM them the word KAIRO" |
| `the-bill` | 16.5 s | "YOUR BOOKING APP IS CHARGING YOU RENT." → $98.85 a month, every month → $1,186 a year → +20% → OR. → $410 once |
| `loop` | 7.7 s | "money can't buy happiness" → "but it can buy booking software you only pay for ONCE 🫶" |

## Posting plan (Melbourne time)

Owners scroll after close and on their day off, so:

1. **`group-chat`**: Wednesday 22 Oct, about 8 pm.
2. **`the-bill`**: Sunday 26 Oct, about 7:30 pm.
3. **`loop`**: Monday 27 Oct, about 12:30 pm (many salons are closed Mondays).

After that, the weekly run checks Insights and decides whether to repost the
best one or make another from the same B-roll (0 credits).

### Every time

1. Upload the **`-nomusic`** file. In the audio picker, choose a sound marked
   trending (↗) that fits the mood. Keep it low enough that the dings and
   pops still come through. If nothing fits, upload the normal file instead
   (its beat is original).
2. Cover: the first frame (the hook is on it).
3. Paste the caption below. Tick **Also share to Facebook**.
4. After posting: share it to your story with a poll ("Still paying monthly
   for your booking app?" Yes / No). Pin `group-chat` to the top of the grid.
5. Answer every comment in the first hour. Comments are a ranking signal, and
   a reply is a second chance to say "DM the word KAIRO".

### Captions (ready to paste)

**group-chat**
```
send this to the salon bestie who needs to hear it 😭

Kairo is $410 once. $0 a month after that. No commission.
Online booking, deposits, reminders, your client list brought over, and an iPhone app.

DM the word KAIRO and we'll send you everything 📩

Dramatisation. Fresha price: Team plan, 3 team members at A$29.95 + GST each a month, from Fresha's Australian pricing page, 20 Oct 2026.

#salonowner #hairsalon #salonbusiness #australiansalon #melbournehair
```

**the-bill**
```
do the maths on your booking app 👇

Fresha, team of 3: $98.85 a month. That's $1,186 a year, every year.
Plus 20% of a new client's first booking when Fresha's marketplace sends them (min $8).

Kairo: $410 once. Then $0 a month. No commission.
It costs less than that Fresha plan from month 5.

DM the word KAIRO for the full breakdown 📩

Fresha prices from its Australian pricing page, checked 20 Oct 2026. Fresha is a trademark of its owner; Kairo isn't affiliated with Fresha.

#salonowner #hairsalon #salonbusiness #barbershop #australiansalon
```

**loop**
```
happiness: not for sale.
booking software you pay for once: $410 🫶

$0 a month after that. No commission.
DM the word KAIRO 📩

#salonowner #hairsalon #salonlife #australiansalon
```

## The DM reply

Everyone who sends KAIRO gets this. It is a reply to someone who wrote first,
so it is not outreach.

```
Hey! 👋 Kairo is booking, clients and payments for a salon: $410 once, $0 a month, no commission.

You get online booking, deposits, reminders, a client list (import yours from a spreadsheet) and an iPhone app.

How it compares with Fresha: https://kairobookings.com/fresha-price
Start here: https://start.kairobookings.com/start?from=ig-dm

Any questions, just reply here 🙂
```

The `?from=ig-dm` tag makes a signup from Instagram show in the Render log as
`signup: started <slug> from ig-dm` / `signup: paid <slug> from ig-dm`. The
daily sale check and the weekly run pick it up.

**Making it automatic (free):**
- **Quickest:** Instagram settings → Saved replies (under the business tools). Save
  the text above with the shortcut `kk`. Typing `kk` in a DM
  fills it in. That is one tap a reply, not fully automatic.
- **Fully automatic:** ManyChat's free plan (up to 1,000 contacts). Connect
  the Instagram account, add a *Keyword* trigger for `KAIRO` (DMs) that sends
  the message above. You can also add a *Comments* trigger for the same word,
  which DMs the reply to anyone who comments KAIRO. Both only message people
  who wrote first.

## What counts

- **Instagram Insights**, per reel after 48 hours: sends, average watch time,
  and the 3-second hold. Sends are the most important.
- **Profile visits and DMs** with KAIRO.
- **The only number that matters:** `from ig-dm` signups and payments in the
  Render log.
