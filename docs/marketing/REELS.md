# Instagram reels: what to post, when, and how

The second channel after search (see `README.md`). Reels reach salon owners
who are not searching yet; the switching pages catch the ones who are.

## Why these reels look the way they do

- **No AI person talking.** Faceless formats that are working right now:
  a fake text thread over moody B-roll ("Where are you" style), type cut on a
  beat, and the 7-second "money can't buy happiness, but…" loop.
- **No competitor is named** (owner's call, 22 Oct 2026). The reels compare
  against "your booking app" and an example bill of $99 a month, and the fine
  print says it is an example, not any particular app's price. Commission and
  per-team-member fees are said as "some apps…", which is true of several.
- **Text styled the way Reels look in late 2026:** lowercase and
  conversational, white with a soft shadow instead of white boxes, one word
  under a yellow highlighter, and one loud word per reel in a condensed font
  (Anton): "RENT.", "$410". Constant all-caps shouting reads as dated now.
- **Instagram ranks on sends, watch time and replays.** Each reel opens on the
  claim in the first frame. Reel 1 is built to be sent to a friend ("pov: your
  salon bestie…"). The loop is short enough to be watched twice.
- **What we can say, and what we can't.** Kairo's terms: "a one-off setup fee
  of $410" and "no monthly subscription"; the website promises "$0/month,
  forever". So: "$410 once", "$0 a month, forever", "no commission". Not
  "special offer" or "limited time" ($410 is the normal price, and calling it a
  special offer would mislead), and not "yours to keep forever" (the terms
  don't promise that).

## The reels

The pages, B-roll and render tools are in `SK-Webmaker/claude-upgrades-`, branch
`claude/gloss-kairo-setup-0ds0mp`, under `reel/` (render: `node tools/render-page.mjs <name>`).
Each comes as `<name>.mp4` (original beat, never muted for copyright) and
`<name>-nomusic.mp4` (sound effects only, for a trending sound).

| Reel | Length | Idea |
|---|---|---|
| `group-chat` | 17.4 s | A text thread: "wait. you still pay for your booking app EVERY month?? 😭" … "Kairo. DM them the word KAIRO" |
| `the-bill` | 16.5 s | "your booking app is charging you RENT." → −$99 every month → $1,188 a year → + FEES → OR. → $410 once |
| `loop` | 7.7 s | "money can't buy happiness" → "but it can buy booking software you only pay for ONCE 🫶" |
| `noshow` | 16.5 s | "she didn't show. AGAIN." → Kairo keeps count on her real record → "2 no-shows? deposit next time." → the polite note she sees → "3 NO-SHOWS?" phone only → regulars never asked → HANDLED. |
| `refill` | 16.5 s | scissors macro, "saturday, 10am. CANCELLED." → the slot empties on the real calendar → the waitlist texts land, word for word → "REBOOKED." with Chloe in the slot → "you were mid-colour the whole time." |
| `booked` | 16.5 s | "11:48PM. you're asleep." → Kairo booking alerts stack on the lock screen → a client books on the real booking page in a floating phone → "you wake up to a full day ☀️" → 24/7 |

The last three show one real Kairo feature each, on screens captured from
Kairo itself (`tools/capture-feature-screens.mjs`, sample data), with every
message in Kairo's own wording.

**Voice-over cuts.** `noshow`, `refill` and `booked` also come as
`<name>-voiceover.mp4`: the same reel played a little slower (22.5 s) with a
narrator over it, voice and sound effects, no music. These are the ones to post.
The narrator is a synthetic Australian woman's voice (designed with ElevenLabs
Voice Design, not a real person's), checked by an accent classifier and by
transcribing every line. "Kairo" is said like "Cairo". The lines follow the
words on screen:

- `noshow`: "She didn't show. … Again. Kairo keeps count. Two no-shows? Deposit
  next time. She's told politely. Never a number. Three? Phone bookings only.
  Your regulars? Never asked. Four-ten, once. Zero a month. DM us 'Kairo'."
- `refill`: "Saturday, ten a.m. … Cancelled. Normally? That's a dead slot. Kairo
  texts your waitlist. Instantly. The first one to book gets it. Booked again.
  And you were mid-colour the whole time. Four-ten, once. Zero a month. DM us 'Kairo'."
- `booked`: "Eleven forty-eight p.m. You're asleep. Your booking page doesn't
  sleep. Clients book themselves. No app. No login. Just booked. You wake up to
  a full day. Four-ten, once. Zero a month. DM us 'Kairo'."

The other three (`group-chat`, `the-bill`, `loop`) have no voice: the joke is
the text and the trending sound.

## Music (add it in Instagram)

Upload the **`-nomusic`** file and add the sound in Instagram's audio picker.
Picks from the week of 19–21 Oct 2026 (Scott Social's list and CreatorDB's
Heat chart), chosen for reach first, then for how the trend's format matches
the reel. Skip the "October"/autumn and Halloween sounds: it's spring in
Melbourne and they don't fit.

Several of the biggest sounds (Taylor Swift, Diana Ross, ADÉLA) are **not
available to Business accounts**. If they don't show in the audio picker,
switch the account to Creator (Settings → Account type and tools → Switch to
creator account; free, keeps Insights) or use the backup, which is marked
for business use.

| Reel | Sound | Why | Line it up | Backup (business-safe) |
|---|---|---|---|---|
| `noshow` | **"9 to 5" — Dolly Parton** (77K) | Salon owner's working day, with attitude | Song start on "AGAIN." (1.0 s) | "Do Not Bother the Botherer" — @veronicaplingau |
| `refill` | **"Upside Down" — Diana Ross** (127K, peaking) | The disco before-and-after reveal; empty slot → full | The reveal beat on "REBOOKED." (8.2 s) | "Beauty and a Beat x Cola (Altégo mix)" — @altego_music |
| `booked` | **"Patient Zero" — Taylor Swift** (#1, rising) | Victory-lap edits: night → a full day | The big closing line on the morning cut (11.1 s) | "Sometimes" — Fleetwood Mac |
| `the-bill` | **"My Reaction to…" — original audio, @brundaepadua** | The trend *is* numbers climbing on screen: $99 → $1,188 | Start of the sound on "RENT." (1.0 s) | "Go Go Juice" — Sabrina Carpenter ("life is so good (I just bought something)") |
| `loop` | **"Money Can't Buy You Happiness" — original audio, @eresdigna** (125K) | It *is* this trend | The switch on the cut at 3.4 s | "sweetly" — jkl |
| `group-chat` | **"Nicole Kidman" — ADÉLA** (#2, #3 on Spotify US) | Main-character energy; salon brands are using it | The hook on the "$410. then $0 a month" message (6.3 s) | "GEEKIN" — Nemzzz_ |

- Reels **without** a voice: sound volume about 40–60%, original audio (the
  pops and dings) at 100%.
- Reels **with** a voice: original audio at 100%, the sound at **10–15%**, so
  the voice stays clear. The reel still counts as using the trending sound.
  The voice-over cuts run slower, so line the sound up on: "AGAIN." at 1.2 s
  (`noshow`), "REBOOKED." at 10.2 s (`refill`), the morning cut at 13.8 s (`booked`).
- Trends last 7–10 days. If a pick has lost its ↗ arrow on the day, use the
  backup or any ↗ sound that fits.
- No sound fits on the day? Upload the normal file: its beat is original.

## Posting plan (Melbourne time)

Owners scroll after close and on their day off. Sounds that are peaking go
first, before they fade. One a day for the first five, then every other day:

| # | When | Reel (file to upload) | Voice? | Sound |
|---|---|---|---|---|
| 1 | Thu 23 Oct, 8 pm | `noshow-voiceover.mp4` | yes | "9 to 5" — Dolly Parton |
| 2 | Fri 24 Oct, 8 pm | `refill-voiceover.mp4` | yes | "Upside Down" — Diana Ross |
| 3 | Sat 25 Oct, 8:30 pm | `booked-voiceover.mp4` | yes | "Patient Zero" — Taylor Swift |
| 4 | Sun 26 Oct, 7:30 pm | `the-bill-nomusic.mp4` | no | "My Reaction to…" — @brundaepadua |
| 5 | Mon 27 Oct, 12:30 pm | `loop-nomusic.mp4` | no | "Money Can't Buy You Happiness" — @eresdigna |
| 6 | Wed 29 Oct, 8 pm | `group-chat-nomusic.mp4` | no | "Nicole Kidman" — ADÉLA |

Already posted `noshow` (no voice) on Wednesday? Skip #1 and keep the rest.
`booked` goes up Saturday night on purpose: "your booking page doesn't sleep",
seen in bed after the busiest day of the week.

Pin `noshow`, `refill` and `booked` to the top of the grid. After that, the
weekly run checks Insights and decides whether to repost the best one or make
another from the same B-roll (0 credits).

### Every time

1. Upload the file from the plan and add the sound from the table above.
   For a reel with a voice, also turn on **Advanced settings → Add AI label**:
   Meta requires it for a realistic AI-generated voice, and a hidden one that
   gets flagged later costs more trust than the label does.
2. Cover: the first frame (the hook is on it).
3. Paste the caption below. Tick **Also share to Facebook**.
4. After posting: share it to your story with a poll ("still paying monthly
   for your booking app?" yes / no).
5. Answer every comment in the first hour. Comments are a ranking signal, and
   a reply is a second chance to say "DM the word KAIRO".

### Captions (ready to paste)

Lowercase, short first line (it's all people see before "more"), one
question to get comments, then the keyword. Three to five hashtags.

**group-chat**
```
send this to the salon bestie who still pays monthly 😭

be honest… how much is your booking app costing you a month? 👇

kairo is $410 once. then $0 a month, forever. no commission.
online booking, deposits, reminders, your client list brought over + an iPhone app.

comment or DM the word KAIRO and we'll send you everything 📩

dramatisation. the $99 a month is an example, not any particular app's price.

#salonowner #hairsalon #salonbusiness #australiansalon #melbournehair
```

**the-bill**
```
do the maths on your booking app 🧾

$99 a month = $1,188 a year. every year.
some apps also take a cut of your new clients, or charge per team member.

kairo: $410 once. then $0 a month, forever. no commission.
at $99 a month, it's paid for itself by month 5.

what's your monthly bill? drop it below 👇
comment or DM KAIRO for the breakdown 📩

the $99 a month is an example, not any particular app's price.

#salonowner #hairsalon #salonbusiness #barbershop #australiansalon
```

**loop**
```
happiness: not for sale.
booking software you pay for once: $410 🫶

$0 a month, forever. no commission.
comment or DM KAIRO 📩

#salonowner #hairsalon #salonlife #australiansalon
```

**noshow**
```
she didn't show. again. 🙃

set it once: 2 no-shows and kairo asks for a deposit next time. 3 and they book by phone. your regulars? never asked.
she's told politely — never a number.

kairo: $410 once. then $0 a month, forever. no commission.

what's your no-show policy right now? 👇
comment or DM the word KAIRO 📩

deposits need your own stripe account (stripe's fees apply). sample data; real kairo screens.

#salonowner #hairsalon #salonbusiness #noshows #australiansalon
```

**refill**
```
a cancellation shouldn't cost you the slot 💸

switch on the waitlist and kairo texts the people waiting the moment a time frees up. first to book gets it, while you're still mid-colour.

kairo: $410 once. then $0 a month, forever. no commission.

how many cancellations did you eat this month? 👇
comment or DM the word KAIRO 📩

waitlist offers are off until you switch them on; texts use your own clicksend account. sample data; real kairo screens.

#salonowner #hairsalon #salonbusiness #barbershop #australiansalon
```

**booked**
```
your booking page doesn't sleep. you should 😴

clients pick a time and book themselves, and your phone tells you the second it happens. no app for them to download, no login.

kairo: $410 once. then $0 a month, forever. no commission.

what time did your last client try to book? 👀
comment or DM the word KAIRO 📩

sample data; real kairo screens. booking alerts come through the free kairo iphone app.

#salonowner #hairsalon #salonbusiness #australiansalon #melbournehair
```

"Comment KAIRO" works once ManyChat's comment trigger is on (below).
Without it, reply to each comment by hand with the DM below.

## Replying to "KAIRO"

Two parts: a short public reply under the comment, then the DM. Links in
Instagram comments aren't clickable, so the comment points to the DM (and the
bio link); the DM carries the links.

**Comment reply.** Rotate these; posting the same line over and over can get
replies hidden as spam:

```
hey! 👋 just sent you a DM with everything 📩
```
```
done! check your DMs 💌 (link's in our bio too)
```
```
sent 🙌 it's all in your inbox, any questions just ask!
```
```
on its way to your DMs now 📩 thanks for asking!
```

**The DM.** Everyone who comments or sends KAIRO gets this. It replies to
someone who wrote first, so it is not outreach.

```
hey! 👋 thanks for asking about kairo

it's booking software made for salons: online booking, deposits, reminders, no-show rules, a waitlist that fills cancellations, and an iPhone app.

$410 once, then $0 a month, forever. no commission.

have a look here 👉 https://kairobookings.com/no-monthly-fee-salon-software

when you're ready to set up: https://start.kairobookings.com/start?from=ig-dm

any questions, just reply here, happy to help 🙂
```

**Bio link:** set it to https://kairobookings.com/no-monthly-fee-salon-software
so "link in bio" lands on the same page.

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
