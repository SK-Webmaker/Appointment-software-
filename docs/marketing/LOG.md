# Marketing log

Newest first. One entry per weekly run (see `WEEKLY-RUN.md`).

## 6 November 2026 — between runs

- **Sales:** none.
- **Pages finished:** `/barber-software-australia` and
  `/beauty-salon-software-australia` (backlog #2). Both were placeholders
  hidden from Google. Every claim was checked against the app first.
  - **Barbers:** short services back to back, a column per barber, walk-ins
    at the till, Rebook in 2/3/4 weeks, card through the shop's own Stripe or
    Square, cash, pay links and no-show rules.
  - **Beauty:** patch tests the booking page asks for (a failed test asks
    the client to call, never re-offers a test), consent agreed by typed
    name with the wording kept, a safety record, before/after photos, a list
    of tests expiring in 60 days, and a printable record.
  - **Both** say what a monthly app has that Kairo doesn't: a walk-in queue
    screen, rooms as a resource, courses/packages, memberships, gift cards
    and a marketplace.
  - **Wiring:** noindex dropped; added to the sitemap, `llms.txt` and the
    footer. The beauty page links to the hair page instead of the hidden
    `/features/client-management`.
  - **Live:** published (commit 5aa714a) and checked on the live site. Both
    pages return 200 with the right titles, no noindex, and FAQ schema. Both
    are listed in the live sitemap and `llms.txt`, and footer links reach
    them from every page. IndexNow and Bing both returned 200.

## 2 November 2026 — weekly run (published 4 Nov; delayed by restarts)

- **Sales:** none. Signup log 26 Oct – 4 Nov: 0 started, 0 paid, from any
  source.
- **Site check:** clean. All 21 sitemap pages and `llms.txt` answer 200 and
  name no other platform; the price is $410 everywhere and the live checkout
  charges A$410 (`/api/price` → 41000); the nine old addresses still answer
  301. Fixed one untrue line: the no-monthly-fee page said each team member
  has settings for "what they are allowed to see". There is no such setting
  (one salon login, no per-person permissions), so it now says each person
  has their own hours and colour in the diary.
- **Search:** `site:kairobookings.com` still shows 14 pages (home, support,
  legal), none of the pages about the bill. Not in the top 20 for
  `salon software no monthly fee` or `salon software cost australia`. The
  rest were skipped again: unindexed pages can't rank, and each search costs
  credits.
- **Autocomplete (AU):** `booking app for hairdressers`, `booking system for
  hairdressers`, `appointment app for hairdressers`, `booking software for
  hairdressers`, `best salon software australia`, `beauty salon software
  australia`, `salon software comparison`.
- **Page added:** `/booking-app-for-hairdressers` (backlog #5, picked first
  because autocomplete shows the most demand for it). It covers what the
  free iPhone app does (alerts when clients book or cancel, Face ID, the whole
  workspace), what clients get (no app, no account), what's at the chair,
  what it costs, and where a monthly app can do more (marketplace, gift
  cards, memberships, accounting, an Android app). It's in the sitemap and
  `llms.txt`, linked from the hair salon and cost pages. Published (commit
  6cff543) and live with the right title; IndexNow 200.
- **Visits 26 Oct – 1 Nov:** 5 visitors (down from 15). Direct 2, Google 1,
  Bing 1, Instagram 1. The first visits from search. Pages: home 4,
  support 1.
- **Needs the owner:**
  1. Post the reels: Instagram is still the only channel that brings people,
     and visits fell when posting stopped.
  2. The ticker's "Limited time only offer" (still unanswered).

## 27 October 2026 — weekly run (due 26 Oct; delayed by a restart)

- **Sales:** none. Signup log for 20–27 Oct: 0 started, 0 paid, from any
  source.
- **Site check:** clean. All 20 sitemap pages and `llms.txt` answer 200 and
  name no other platform; the price is $410 once everywhere
  (`PRICE_CENTS` default 41000); the nine old addresses still answer 301.
- **Search:** `kairobookings.com` is not in the top 20 for
  `salon software no monthly fee`, `salon booking software australia` or
  `booking software no commission`. A `site:` search shows 14 pages indexed:
  home, support and the legal pages, but none of the pages about the
  monthly bill yet. The other target searches were skipped: with those pages
  not indexed they can't rank, and each search costs credits.
- **Autocomplete (AU):** `salon software cost`, `cheapest salon software`,
  `salon software comparison`, `best salon software australia`,
  `booking app for hairdressers`. Nothing for `switch salon software`.
- **Page added:** `/salon-software-cost` (backlog #2, picked over #1 because
  people search for it). It covers the ways salon software charges, the
  software bill over 1, 3 and 5 years for labelled example plans against
  $410 once, the calculator, the costs every system has, and where a monthly
  plan is worth it. It is in the sitemap and `llms.txt`, and linked from the
  no-monthly-fee and commission-free pages. Published (commit d9708a2) and
  live with the right title; IndexNow 200.
- **Visits 20–27 Oct:** 15 visitors (about 2 a day). Direct 12, Instagram 2,
  Facebook 1, search 0. Pages: home 10, guide 2, no-monthly-fee 2 (both from
  Instagram/Facebook), legal 1. The Instagram visits started after the
  no-show reel went up on 23 Oct.
- **Needs the owner:**
  1. The home page ticker says "Limited time only offer". `WEEKLY-RUN.md`
     rule 2 says never "limited time" unless it is true. If the $410 price
     isn't ending, it should read "Pay once. $0 a month."
  2. Set the Instagram bio link to `/no-monthly-fee-salon-software` if it
     isn't already.

## 22 October 2026 — website made anonymous

- **Owner's call:** no other platform named on the website either. Removed
  the nine comparison pages (and their price data and calculators). Their
  addresses now 301 to `/no-monthly-fee-salon-software`,
  `/commission-free-booking-software` or `/guide`. Checked live: all nine
  answer 301, and all 26 live pages plus `llms.txt` contain no other
  platform's name.
- Footer, internal links, guide, sitemap and `llms.txt` now point only at the
  anonymous pages; the Website Terms' comparisons clause says the site uses
  labelled examples or the visitor's own figures (updated 22 October 2026).
- IndexNow: the nine old URLs and six changed ones submitted (200).
- `WEEKLY-RUN.md` rewritten: rule 1 is now "never name another platform",
  step 1 checks the live site for names, and the backlog is pages about the
  problem (switching, cost over time, kinds of business).
- **Trade-off:** the brand-name searches ("X alternative") can't be targeted
  any more; search will be slower, so reels matter more.
- **Sales:** none yet.

## 22 October 2026 — reels revised

- **Owner's call:** no competitor named in any reel. The three reels now
  compare against "your booking app" and an example $99 a month (fine print:
  an example, not any particular app's price). Captions and the DM reply
  changed to match; the DM now links `/no-monthly-fee-salon-software`.
- **Restyled** to how Reels text looks now: lowercase, white with a soft
  shadow (no white boxes), one highlighted word, one loud word in Anton.
- **Music picked** for each reel from the week's trending list, only sounds a
  business account can use (`REELS.md` → Music).
- **Sales:** none yet (signup log empty at 23:33 UTC 21 Oct). Reels not posted
  yet.

## 21 October 2026 — reels

- **Made:** three presenter-free Instagram reels (no AI person), each with an
  original beat and a `-nomusic` version for a trending sound: `group-chat`
  (17.4 s, a text thread), `the-bill` (16.5 s, the money, loudly) and `loop`
  (7.7 s). Captions, posting times and the DM reply are in `REELS.md`.
- **Higgsfield:** 820 → 643.75 for the first five B-roll clips. Subscription
  credits are wiped at the renewal on the 26th, so the next 8 clips (barber,
  no-show chair, night notification, paper diary, late-night admin, blow-dry
  reveal, closing up, buzzing phone) were made the same day as a library that
  later reels use for 0 credits. Every spend is in `claude-upgrades-/reel/credits.md`.
- **Tracking:** a DM reply link tagged `?from=ig-dm`. Checked: the start page
  answers 200 with the tag.
- **Needs the owner:** post the reels (Instagram has no posting connector
  here) and save the DM reply as a Saved reply or ManyChat keyword.

## 21 October 2026 — day 1

- **Signups / sales:** none yet (Render log, `signup:`).
- **Visits (Lovable analytics, 20 Sep – 21 Oct):** 62 visitors, 68 page views.
  Sources: direct 44, Instagram 11, Facebook 3, Google 3, Bing 1. No visits to
  the switching pages yet — they are a day old and not yet in Google.
- **Added:** /fresha-marketplace-fee (Fresha's own rules for the 20% new-client
  fee, with a calculator), /fresha-vs-square, /timely-price — all three are
  Australian autocomplete searches. Nine switching pages live in total.
- **Reading:** search sends almost nothing today; that is the gap this fills.
  Instagram is the best source after direct, so links in reel captions to
  /fresha-price help most while search builds.

## 20 October 2026 — launch

- **Prices:** read from fresha.com/pricing and gettimely.com/pricing (AU).
  Fresha Independent A$44.95 + GST, Team A$29.95 + GST per member; Timely
  A$42 / 65 / 79 + GST per staff.
- **Live:** /fresha-alternative, /fresha-price, /cancel-fresha,
  /fresha-vs-timely, /timely-alternative — all 200, prices in the server HTML,
  Start buttons tagged `?from=<page>`.
- **Indexing:** 25 URLs submitted to IndexNow (202) and Bing (200). Before
  launch, Google showed only the home, support and legal pages of
  kairobookings.com; none of the SEO pages yet.
- **Positions:** kairobookings.com not on page 1 for any switching query
  (expected on day 0). Page 1 for "fresha alternative australia" is ten
  competitors, all monthly.
- **Signups / sales by page:** source tracking live with platform 1.85.0. Checked end
  to end on the live site: /fresha-price → Start → the signup form sends
  `source: "fresha-price"` (request intercepted; nothing created).
- **Added the same day:** /square-appointments-alternative (Square's AU plans as
  listed: Free one location, Plus $40, Premium $90 per location). Kitomba and
  Booksy skipped: no published Australian price.
- **Needs the owner:** nothing. Optional: submit the sitemap in Google Search
  Console and request indexing for /fresha-alternative and /fresha-price.
