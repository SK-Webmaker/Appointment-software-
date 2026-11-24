# Marketing log

Newest first. One entry per weekly run (see `WEEKLY-RUN.md`).

## 25 November 2026 — preview outreach (first run offering the free trial)

- **Replies:** 0. **New bounces:** 0.
- **Follow-ups:** none sent. The 22 Nov batch reaches 3 days on the next
  run (the 19 Nov batch had theirs on 23 Nov).
- **Checked:** 32 sites in Newcastle, the Gold Coast, the Sunshine Coast,
  Hobart, Canberra and Perth. 7 passed: 2 first group (book by phone,
  email or a form) and 5 second group (already book online).
  - **Skipped:** no published email, no menu with prices, a chain with
    its own booking system, or nothing dated 2025 or later. One studio's
    only "2026" was font code in the page, not a date.
- **Sent:** 7 first emails, each with its picture, and each now ending in
  the free 14-day trial. Mail-tester: 9.9/10.
- **Totals so far:** 23 businesses emailed, 1 hard bounce, 6 follow-ups,
  0 replies, 0 sign-ups (to the 24 Nov sale check).

## 24 November 2026 — preview outreach

- **Replies:** 0. **New bounces:** 0. **Follow-ups:** none due yet (the
  22 Nov batch is due from 25 Nov).
- **Checked:** 29 sites in Geelong, Bendigo, Ballarat, Toowoomba,
  Townsville, Cairns, Launceston, Wollongong and Adelaide. 4 passed, all
  second group (they already book online). The rest had no published
  email, no menu with prices, nothing dated 2025 or later, or were
  walk-in only.
- **Sent:** 4 first emails, each with its picture. Mail-tester: 9.9/10.
- **Totals so far:** 16 businesses emailed, 1 hard bounce, 6 follow-ups,
  0 replies, 0 sign-ups.
- **Planned, not built:** a free 14-day trial was planned on 24 Nov and
  is waiting for the owner's go-ahead. If it ships, the emails' ask
  becomes "try it free for 14 days".

## 23 November 2026 — preview outreach, first follow-ups

- **Follow-ups:** 6 sent, in their threads, to the 19 Nov first emails
  that had no reply. That's every one of them except the bounce below.
- **Bounces (correcting "0 bounces" above):** 2 of the 12 first emails
  never arrived.
  - A Perth brow bar's server refused it after two days of retries. It's
    their only published address, so there's nothing more to send.
  - A Hobart salon's address doesn't exist. Their site lists a second
    address, and the same preview went there once on 23 Nov.
- **Delivered so far:** 11 businesses, 6 follow-ups.
- **Replies:** 0. **Sign-ups** (sale check to 23 Nov): 0.
- **New businesses today:** none. This run was cut off by a session
  restart before step 3. The next weekday run picks it up.

## 23 November 2026 — weekly run

- **Sales:** none. Sign-up log 16–22 Nov: 0 real started, 0 paid. The only
  two lines are the 16 Nov pricing-check tests.
- **Visits 15–22 Nov:** 11 visitors, 12 page views. Direct 8, **google.com
  2** (the first visits from Google search), Instagram 1. Pages: home 9,
  hair salon page 1, `/websites` 1, sub-processors 1. 7 of the 11 were in
  Australia.
- **Site check:** clean. All 29 sitemap pages and `llms.txt` answer 200
  and name no other platform. Checkout offers $400 once or 3 × $150,
  matching the site. All 16 old addresses still answer 301.
- **Positions:** the free web search tool (not set to Australia) doesn't
  show kairobookings.com for "salon software no monthly fee australia".
  Free directories hold those results, which backs the free-listings
  to-do in `SEO-PLAN.md`.
- **Autocomplete (AU):** "how to start a lash business" with "no money",
  "step by step", "from home" and "online"; "best salon software
  australia"; "booking system for hairdressers".
- **Page added:** `/how-to-start-a-lash-business` (top of the backlog).
  - **The checklist:** training, a free ABN, an ASIC business name
    ($47 a year from 1 July 2026), council rules (Victoria registers lash
    premises; a home business may need approval), insurance, patch tests,
    pricing a set from your own time, and bookings and deposits from
    day one.
  - **Also:** a section on starting with very little money.
  - **Kairo claims:** they match the lash page, which was checked against
    the app.
  - **Where it's linked:** in the sitemap and `llms.txt`, and from the
    lash page and the no-show policy page.
  - **Checks:** build, type check and lint passed. Website commit a4cf801,
    published and live with the right title, IndexNow 200.
- **Preview outreach this week:** 12 first emails (7 on 19 Nov, 5 on
  22 Nov), 0 follow-ups (the first are due 23 Nov), 0 replies, 0 bounces.
  Both email versions scored 9.9/10 on mail-tester.

## 22 November 2026 — preview outreach, days 1–3

- **Sent:** 3 more second-group previews (a facial salon, a threading and
  waxing studio, a barber). These were built on 19 Nov but cut off by a
  session restart. Then a catch-up run checked 21 more sites; 2 passed
  (a hair salon, a brow and lash studio), both second group.
  **Total: 12 businesses, each emailed once.**
- **Replies:** 0. **Bounces:** 0. **Sign-ups** (kairo-platform log,
  18–21 Nov): 0. First follow-ups are due from 23 Nov.
- **Scheduled tasks:** the Friday outreach run and the 19–21 Nov sale
  checks all arrived in the session 2–3 days late. A scheduled run waits
  until the session finishes what it's doing, and this one was held busy
  the whole time. The sale checks found no sign-ups. Next outreach run is
  Mon 23 Nov at 9:37am.

## 19 November 2026 — one strategy: "Your booking page, already built"

The owner asked for one researched, free, automated strategy that brings
a sale. The research, the reasoning and the daily playbook are in
[`OUTREACH.md`](OUTREACH.md). In short:
- **Who:** Australian beauty, nail, lash, brow, hair and barber
  businesses that still book by phone, text or DM.
- **What they get:** a picture of their own Kairo booking page, with
  their name, colours and real menu.
- **The ask:** one question, by email.

- **Built:**
  - `preview/make-preview.cjs` makes the picture from a throwaway local
    Kairo.
  - `preview/check-site.mjs` checks a candidate's own site against the
    rules.
  - Pictures are hosted at unguessable addresses under
    `kairobookings.com/p/`. Every crawler is kept out in `robots.txt`.
    Prospect data stays in the private website repo and the Kairo
    Gmail, never in this public repo.
- **Spam check:** mail-tester scored the exact email, picture attached,
  **9.9/10** ("Perfect, you can send").
- **Automated:** the "Kairo preview outreach" scheduled task runs the
  playbook every weekday at 9:37am Melbourne time. It handles replies,
  sends one follow-up and finds new businesses. The owner is notified only
  for a yes, a question it can't answer, a complaint or a sale.
- **First run (tonight, by hand):**
  - 20 candidate sites checked, 3 passed. Most already book online, or
    have no website or email.
  - 3 previews sent (beauty, brows and lashes, hair).
  - A second pass, through the scheduled task fired by hand, checked 15
    more sites and none passed. Almost all book online already, and the
    near misses only have a contact form, not a published email.
  - **Second group added** (see `OUTREACH.md`): businesses that already
    book online. 12 of the 35 failed only on that. They get the same
    picture with a "the booking page, owned outright" email, which
    mail-tester also scored 9.9/10. 4 sent (brows and lashes, threading
    and lashes, beauty, hair). Their app is never named.
  - **Tonight's total: 35 checked, 7 sent** (3 first group, 4 second),
    plus 2 mail-tester checks. 0 replies and 0 bounces so far. Follow-ups
    are due 22–24 Nov.
  - Sign-ups from these carry `from=preview`.

## 17 November 2026 — Search Console report from the owner

The "Why pages aren't indexed" report shows three reasons. This is what
each one was, and what was done:

- **Not found (404), 1 page.** A crawl of every internal link (31 URLs)
  found no broken links. Five old `/compare/*` pages, `/compare` and `/v2`
  had been removed without the 301s the other old addresses got. They now
  redirect (commit be30f37). The owner presses *Validate fix* once it's live.
- **Crawled – currently not indexed, 1 page.** Most likely `/blog`, which
  only said "Nothing here yet" (245 words). It now describes and links all
  ten guides (560 words, commit 9b5bfcc).
- **Discovered – currently not indexed, 7 pages.** Normal for a young site:
  Google knows the address but hasn't spent the crawl yet. Done: links from
  `/blog`, the footer and related pages, and an accurate `<lastmod>` in the
  sitemap for pages changed on 16–17 Nov. For the owner: request indexing
  for the 7 (about 10 a day is allowed), and add the free listings, since
  links from other sites are what raise crawl priority.

## 16 November 2026 (night) — Google SEO push (owner asked)

- **Research:** see [`SEO-PLAN.md`](SEO-PLAN.md). A young site wins first on
  long, specific searches, then needs a few real links and reviews. City
  clone pages risk Google's scaled-content policy.
- **Keywords:** pulled Google AU autocomplete for 51 seed searches.
- **New pages, live:**
  - `/salon-no-show-policy`: a free template, wording for each kind of
    business, and how deposits, reminders, the cancellation window and
    repeat no-show rules make it stick.
  - `/salon-client-record-app`: digital client cards.
  - Every Kairo feature they describe was checked in the code first.
- **Fixes, live:**
  - The home title now names the niche, and its description fits.
  - Titles on the nail, barber, hair, beauty, cost and contact pages match
    how owners search.
  - `/guide` and the legal pages now have canonical tags.
  - Four links that went to hidden `/features/*` placeholders now go to
    the new pages.
  - The footer, sitemap (29 URLs), `llms.txt` and related pages link the
    new pages.
  - Screenshots went from 6.7 MB to 3.4 MB.
  - Commits b7a6cd8 and 05bcdd2. Published, checked live, IndexNow 200.
- **Speed (throttled phone):** home LCP went from 3.7 s to 2.9 s; the main
  landing page from 3.1 s to 2.7 s and from 709 KB to 526 KB. CLS 0–0.06.
- **Couldn't run:**
  - Google's PageSpeed service was over its free daily limit.
  - Firecrawl has 4 credits until 4 Dec, so no rank check today.
- **Owner to-do:** Search Console sitemap and indexing requests, Bing
  import, App Store marketing URL, free listings (copy is in `SEO-PLAN.md`),
  and reviews from their two salons.

## 16 November 2026 (evening) — owner-directed outreach

The owner asked for this directly. Rule 3 ("No outreach") still applies to
the automated weekly run.

- **Ticker:** "Limited time only offer" removed, as the owner answered.
  "No monthly fees" now leads. Website commit 8d20dfe, published, checked live.
- **Email round 4:** sent 20 emails from the Kairo Gmail to Australian hair,
  beauty and barber businesses whose site is on a free wixsite.com address.
  Each email was checked against the business's own site, and uses the same
  format and "reply no thanks" line as rounds 1–3. None of the 73 addresses
  emailed since 29 Aug had replied or bounced.
- **Instagram follow-ups:** matched 29 of those 73 businesses to their
  Instagram (15 sure, 13 likely, 1 to check). 27 got a ready "did you get my
  email?" DM. 2 were skipped because their bio asks for no DMs. The other 44
  had no match worth trusting.
- **Follow list:** 26 new accounts for the owner to follow tonight, each
  with its first message. 12 of them also got a round 4 email today.
- **Sent to the owner:** everything above went to the Kairo inbox as one
  copy-and-paste pack, with a .txt copy attached.
- **Friday nudge:** not scheduled automatically. The owner says "nudge round
  4" on Fri 20 Nov, and the session checks replies and sends one nudge.

## 16 November 2026 — weekly run, plus the new pricing

- **Sales:** none. Signup log 8–15 Nov: 0 started, 0 paid, from any source.
- **Visits 8–15 Nov:** 16 visitors, 20 page views (14 on `/`, 5 on `/websites`).
  Sources: direct 10, Instagram 3, Facebook 2. Still nothing from search.
- **Site check:** clean. All 26 sitemap pages and `llms.txt` answer 200 and
  name no other platform. The 9 old addresses still answer 301. The ticker
  still says "Limited time only offer". It was added by the owner in Lovable
  on 13 Sep, is still waiting on their answer, and was left in place.
- **Positions (AU):** kairobookings.com isn't in the top 10 for any of the 8
  target searches, or for "lash booking app australia". `site:` shows 13
  kairobookings.com pages (plus start. and a salon subdomain).
- **Autocomplete (AU):** lash booking app, eyelash booking app, lash
  appointment app, lash booking system. Nothing for brow booking.
- **Page added:** `/lash-and-brow-booking-software-australia`. Every claim was
  checked against the app's code:
  - patch tests the booking page asks for (valid 6 months, 48 hours ahead),
    and a reaction stops online booking for that treatment;
  - consent in the studio's own words, kept with the client's typed name and
    the time;
  - a separate safety record for allergies, medication, conditions and
    pregnancy;
  - Rebook in a tap, and "Due back soon" messages from each client's own
    rhythm (off until switched on);
  - up to 8 photos a visit.

  It is linked from the beauty and nail pages, and listed in the sitemap and
  `llms.txt`.
- **New pricing (owner, 16 Nov):** $400 once, or three monthly payments of
  $150 ($450 in all, the first at signup), then nothing, with the 14-day
  refund on both. Built end to end:
  - the signup's plan chooser;
  - Stripe's one payment or 3-payment subscription, which cancels itself
    after the third;
  - refunds that stop the plan and return every payment;
  - every price on the site, and the Terms.

  Rule 2 above is updated to the new prices.
- **Checked live (16 Nov, 08:00 UTC):**
  - 542 of 542 app tests pass.
  - `start.kairobookings.com/api/price` offers both plans. The signup page
    preselects the plan the site's buttons pass.
  - One live signup per plan (`kairopricingcheck1` once, `kairopricingcheck2`
    monthly, Kairo inbox, source `pricing-check`). Each code arrived and was
    accepted, and Stripe's page opened. The once page reads "One payment… no
    monthly fee". The monthly page is a subscription, "3 monthly payments,
    billed monthly". Neither was paid.
  - Stripe showed US$281.12 and US$105.42 to this non-Australian test
    machine. That is A$400 and A$150 at the same rate.
  - The two unpaid test signups expire by themselves in 7 days. Their
    "signup: started … from pricing-check" lines are not real interest.
- **Published:** website deployed with the new prices and the lash page. All 27
  sitemap pages answer 200, and none still says $410. All 27 were sent to
  IndexNow (200).
- **Instagram image for the new pricing:** `kairo-pricing/kairo-pricing.jpg`,
  caption in `kairo-pricing/CAPTION.md`, for the owner to post.

## 9 November 2026 — weekly run (finished 10 Nov; a restart interrupted the publish)

- **Sales:** none. Signup log 2–9 Nov: 0 started, 0 paid, from any source.
- **Site check:** clean. All 25 sitemap pages and `llms.txt` answer 200 and
  name no other platform. The price is $410 everywhere and the checkout
  says 41000 cents. The 9 old addresses still answer 301. One thing for the
  owner: the site-wide ticker still says "Limited time only offer", which
  rule 2 doesn't allow unless it's true. It's still waiting on the owner's
  answer, so it was left in place.
- **Search:** `site:kairobookings.com` now shows 16 pages, including the
  first page about the bill: `/salon-booking-software-australia`. Not in the
  top 20 for `booking app for hairdressers australia`. Other position
  searches were skipped (credits; most pages are still unindexed).
- **Autocomplete (AU):** nail salon booking/scheduling/management software,
  best nail salon software; lash booking app, eyelash booking app, lash
  booking system; best/hair/beauty salon software australia; website for
  hair salon / beauty salon. Nothing for "switch salon software".
- **Page added:** `/nail-salon-software-australia`, moved ahead of the
  switching page because people search for it. Every claim was checked
  against the app:
  - real set lengths, and add-ons in one booking;
  - Rebook in two or three weeks, and a column per tech;
  - before/after photos, and retail stock at the till;
  - deposits through Stripe, reminders by email or ClickSend, cards through
    Stripe or Square.

  It says what monthly apps have that Kairo doesn't: a marketplace, gift
  cards, memberships, loyalty points and packages. It's in the sitemap,
  `llms.txt` and the footer, and linked from the beauty and salon booking
  pages. Published (commit 7251c03), live with the right title, IndexNow 200.
- **Visits 2–8 Nov:** 10 visitors, 13 page views. Direct 6, Facebook 3 (the
  first visits from Facebook), Google 1. Pages: home 10, `/websites` 2.
- **Needs the owner:** only the ticker question above. Posting is parked
  until the next outreach brainstorm, as the owner asked.

## 8 November 2026 — websites page, motion fixed, owner's instructions

- **New page:** `/websites` sells the website service (A$350 once, or
  A$550 + A$24.99 a month managed, free demo first). It opens from a
  "Need a website?" tab on the home page. It is live and in the sitemap
  and footer.
- **Motion fixed:** the owner saw nothing move on their device. That
  device has the Reduce motion accessibility setting on, and the site
  switched every animation off for it (0 running animations against 28).
  The site now plays its motion for every visitor (`src/lib/motion.ts`
  in the website repo). Checked live with the setting on and off.
- **Owner's instructions:** sales are checked once a day only, and
  Instagram/TikTok posting is parked until the next outreach
  brainstorm. Both are written into `WEEKLY-RUN.md` step 7.

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
