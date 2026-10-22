# Kairo's marketing: one strategy, run automatically

*Researched and launched 20 October 2026; competitor names taken out 22 October 2026. Costs nothing to run.*

## The strategy in one line

**Be the answer when an Australian salon or barber owner goes looking for a
way off a monthly booking bill** — and make the answer "$410 once".

Everything below serves that one line: who we talk to, what we say, where
they find it, and how a sale is counted.

---

## Why this one (the research)

**No other platform is named on the site or in the reels** (owner's decision,
22 Oct 2026). Kairo compares itself with *paying monthly*, never with a
company, and any figure for a monthly plan is a labelled example or one the
visitor types in.

### 1. The monthly bill is the reason to switch

Salon booking platforms in Australia are sold as a monthly subscription,
usually per bookable team member, and some also take a commission on new
clients from their marketplace. A small team pays that every month for as
long as it is in business. Kairo is **$410 once, then $0 a month, forever,
no commission**: against an example $99 a month it costs less from month 5.

### 2. Owners search for the problem, not just for a brand

Searches like *salon software no monthly fee*, *booking app without
commission*, *salon booking software australia* and *hair / barber / beauty
salon software australia* come from owners shopping for a way out of the
bill. Kairo has a page for each, and the weekly run adds one at a time from
what Google's autocomplete shows people typing.

*The trade-off, said plainly:* searches that name a competitor ("X
alternative", "X price") were the highest-intent ones, and without naming
anyone the site can't answer them. Those pages were removed on 22 Oct 2026;
their addresses redirect to the pages below. Reels (`REELS.md`) carry more of
the load as a result.

### 3. "Pay once" is the answer almost nobody else gives

Of the ten salon platforms on Google's first page when this was researched
(20 Oct 2026), every one charged monthly. Kairo's pages lead with the one
thing these owners want: to stop paying every month.

### 4. It is the only free channel that can run without a person *and* without breaking a rule

| Channel | Free? | Automatable? | Allowed? | Verdict |
|---|---|---|---|---|
| Cold email to salons | Yes (Resend/Gmail) | Yes | **No** — Resend's policy bans "cold outreach, purchased lists, or scraped contact data"; Gmail bans unsolicited commercial mail. Kairo's own booking emails run on that Resend account. | Out |
| Automated Instagram/TikTok DMs to people who never wrote | Yes | Only by breaking the platforms' terms | **No** | Out (an auto-*reply* to someone who DMs first is fine: see `REELS.md`) |
| Organic reels | Yes | Making them yes; posting by hand | Yes | The second channel: three made on 21 Oct, plan in `REELS.md` |
| Paid ads | **No** | — | — | Out (not free) |
| **Search: pages about the monthly bill + calculator + indexing** | **Yes** | **Yes, end to end** | **Yes** | **The strategy** |

Australia's Spam Act would allow narrowly relevant B2B email to published
addresses — but the sending services themselves don't, and losing the Resend
account would stop every salon's booking emails. Not worth one sale.

---

## What was built

**On kairobookings.com** (repo `SK-Webmaker/my-creative-space`):

| Page | Answers |
|---|---|
| [/no-monthly-fee-salon-software](https://kairobookings.com/no-monthly-fee-salon-software) | salon software no monthly fee, one-off payment salon software, what a subscription costs over time |
| [/commission-free-booking-software](https://kairobookings.com/commission-free-booking-software) | booking software without commission, no fee per booking |
| [/salon-booking-software-australia](https://kairobookings.com/salon-booking-software-australia) | salon booking software australia |
| [/hair-salon-software-australia](https://kairobookings.com/hair-salon-software-australia) | hair salon software australia |
| [/guide](https://kairobookings.com/guide) | how to set up, how to bring your clients over |

The money pages carry a calculator where the visitor types **their own**
monthly bill and commission, so the only price the site asserts is Kairo's.

- **Removed 22 Oct 2026:** nine pages that named and priced other platforms
  (20–21 Oct). Their addresses 301 to the pages above (`src/server.ts`,
  `MOVED`), and were sent to IndexNow so search engines drop them.
- Sitemap, footer and `llms.txt` (what AI assistants read) list only the
  pages above.
- **IndexNow** key `44ad6cd6a26d410d8fcebbf5a5e65e07` is published at the site
  root. Bing's index feeds ChatGPT search and Copilot answers.
- The Website Terms say the site doesn't name or price other platforms.

**On the signup** (this repo, `platform/`): the signup stores which page sent
the buyer (`businesses.source`), shows it to the operator beside the salon,
and logs `signup: started <slug> from <page>` / `signup: paid <slug> from
<page>` — no personal details — so the weekly run can see which page sold.

## What runs by itself, every week

A scheduled run every Monday at 7:48am Melbourne time (the scheduled task
"Kairo weekly marketing run", firing into the Kairo session, which holds the
Lovable, Render and Firecrawl access the run needs) follows
[`WEEKLY-RUN.md`](WEEKLY-RUN.md):

1. Checks the site still names no other platform and still shows Kairo's
   real price.
2. Checks where Kairo shows on Google and Bing for the target searches.
3. Publishes **one** new page from the backlog (or improves the weakest one).
4. Republishes the site and pings IndexNow.
5. Reads the platform log for signups and sales by page.
6. Writes a line in [`LOG.md`](LOG.md) and tells you what happened.

## Honest expectations

- Search takes weeks, not days. New pages on a young site are usually picked
  up by Bing within days (IndexNow) and by Google within a few weeks. Without
  the brand-name searches it is slower than first planned; reels are the
  faster route to a first sale.
- One sale pays for the whole thing many times: the strategy costs $0.
- Nothing here stops you posting reels or talking to salon owners — those add
  to it. The reels, captions, posting times and the DM reply (with its
  `?from=ig-dm` tag, so an Instagram sale shows in the log) are in
  [`REELS.md`](REELS.md).

## Optional, two minutes each (makes it faster, not required)

- Google Search Console → Sitemaps → submit `https://kairobookings.com/sitemap.xml`
  (the site is already verified), then URL Inspection → *Request indexing* for
  `/no-monthly-fee-salon-software` and `/commission-free-booking-software`.
- Bing Webmaster Tools → *Import from Google Search Console*.
