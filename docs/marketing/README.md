# Kairo's marketing: one strategy, run automatically

*Researched and launched 20 October 2026. Costs nothing to run.*

## The strategy in one line

**Be the answer when an Australian salon or barber owner goes looking for a
way off a monthly booking bill** — and make the answer "$410 once".

Everything below serves that one line: who we talk to, what we say, where
they find it, and how a sale is counted.

---

## Why this one (the research)

### 1. There is a reason to switch, right now

- **Fresha ended its free plan.** Its Australian pricing page lists only paid
  plans: Independent **A$44.95/month + GST** for one bookable person, Team
  **A$29.95/month + GST per bookable team member**, billed on the 1st, plus a
  20% fee (min A$8) on new marketplace clients. A three-person salon pays
  about **A$1,186 a year** before any fee.
  ([fresha.com/pricing](https://www.fresha.com/pricing), read 20 Oct 2026)
- **Timely** is **A$42–79 + GST per staff member, per month**
  ([gettimely.com/pricing](https://www.gettimely.com/pricing/)).
- Kairo is **$410 once**. Against Fresha it is passed in 9 months for one
  person, 5 months for three.

### 2. Owners are already searching for the way out

Google's own autocomplete in Australia (checked 20 Oct 2026) offers:
*fresha alternatives*, *fresha alternatives free*, *how much is fresha a
month*, *fresha fees australia*, *fresha monthly fee*, *fresha cancel
subscription*, *cancel fresha account*, *fresha vs timely*, *apps like
fresha*. Owners also ask in Facebook groups ("I am currently using Fresha, but
the monthly cost will increase next month…") and on Reddit.

People who type those are **already shopping**. Pages that answer "X
alternative" and "X vs Y" convert several times better than general content
in every published SaaS comparison we found (directional, vendor-reported:
3–10% vs 0.5–2%).

### 3. Kairo is the only "pay once" answer on that page

The first page of Google for *fresha alternative australia* is ten competitors
(Bella, OneBook, Azura, Wemu, ValetVault, Dusha…). **Every one of them charges
monthly.** Kairo is the only one that answers what these searchers actually
want — to stop paying every month.

### 4. It is the only free channel that can run without a person *and* without breaking a rule

| Channel | Free? | Automatable? | Allowed? | Verdict |
|---|---|---|---|---|
| Cold email to salons | Yes (Resend/Gmail) | Yes | **No** — Resend's policy bans "cold outreach, purchased lists, or scraped contact data"; Gmail bans unsolicited commercial mail. Kairo's own booking emails run on that Resend account. | Out |
| Automated Instagram/TikTok DMs | Yes | Only by breaking the platforms' terms | **No** | Out |
| Organic reels | Yes | Posting yes, results random | Yes | Keep doing by hand; not the engine |
| Paid ads | **No** | — | — | Out (not free) |
| **Search: switching pages + calculator + indexing** | **Yes** | **Yes, end to end** | **Yes** | **The strategy** |

Australia's Spam Act would allow narrowly relevant B2B email to published
addresses — but the sending services themselves don't, and losing the Resend
account would stop every salon's booking emails. Not worth one sale.

---

## What was built (live 20 October 2026)

**On kairobookings.com** (repo `SK-Webmaker/my-creative-space`):

| Page | Answers |
|---|---|
| [/fresha-alternative](https://kairobookings.com/fresha-alternative) | fresha alternative(s), apps like fresha, fresha alternatives free |
| [/fresha-price](https://kairobookings.com/fresha-price) | how much is fresha a month, fresha fees australia, is fresha free |
| [/cancel-fresha](https://kairobookings.com/cancel-fresha) | fresha cancel subscription, cancel fresha account |
| [/fresha-vs-timely](https://kairobookings.com/fresha-vs-timely) | fresha vs timely |
| [/timely-alternative](https://kairobookings.com/timely-alternative) | timely alternative, timely price |

Each page: the vendor's **published price with GST, the date it was read and
a link to the source**; a calculator for the reader's own team size; an honest
"what they do better"; FAQ and HowTo structured data; and a **Start** button
straight to the self-serve signup, tagged `?from=<page>`.

- All prices live in one file: `src/data/rivals.ts`.
- Sitemap, footer, `llms.txt` (what AI assistants read) and the older SEO pages
  link the new ones.
- **IndexNow** key `44ad6cd6a26d410d8fcebbf5a5e65e07` is published at the site
  root; every URL was submitted to IndexNow and Bing on launch day. Bing's
  index feeds ChatGPT search and Copilot answers.
- Website Terms now state how competitor prices are shown and re-checked.

**On the signup** (this repo, `platform/`): the signup stores which page sent
the buyer (`businesses.source`), shows it to the operator beside the salon,
and logs `signup: started <slug> from <page>` / `signup: paid <slug> from
<page>` — no personal details — so the weekly run can see which page sold.

## What runs by itself, every week

A scheduled Claude session (Monday morning, Melbourne time) follows
[`WEEKLY-RUN.md`](WEEKLY-RUN.md):

1. Re-reads Fresha's and Timely's pricing pages; updates `rivals.ts` and the
   date, or removes a figure it can no longer confirm.
2. Checks which pages Google and Bing show for the target searches.
3. Publishes **one** new page from the backlog (or improves the weakest one).
4. Republishes the site and pings IndexNow.
5. Reads the platform log for signups and sales by page.
6. Writes a line in [`LOG.md`](LOG.md) and tells you what happened.

## Honest expectations

- Search takes weeks, not days. New pages on a young site are usually picked
  up by Bing within days (IndexNow) and by Google within a few weeks. The first
  sale is most likely **2–8 weeks** out, from a salon that searched one of the
  queries above.
- One sale pays for the whole thing many times: the strategy costs $0.
- Nothing here stops you posting reels or talking to salon owners — those add
  to it. A link to `/fresha-price` in a reel caption or a Facebook group answer
  is the strongest thing a person can add.

## Optional, two minutes each (makes it faster, not required)

- Google Search Console → Sitemaps → submit `https://kairobookings.com/sitemap.xml`
  (the site is already verified), then URL Inspection → *Request indexing* for
  `/fresha-alternative` and `/fresha-price`.
- Bing Webmaster Tools → *Import from Google Search Console*.
