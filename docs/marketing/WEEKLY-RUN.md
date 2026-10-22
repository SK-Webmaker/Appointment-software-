# The weekly marketing run

A scheduled Claude session does this every Monday. It is written to be
followed by a session that starts with no memory of the work before it — read
[`README.md`](README.md) first for why, then do the steps in order.

**The job:** keep Kairo the best answer for Australian salon and barber owners
looking for a way off a monthly booking bill, and report what sold.

## Where things are

| What | Where |
|---|---|
| Website code (Lovable, TanStack Start) | repo `SK-Webmaker/my-creative-space`, branch `main` |
| Pages about the monthly bill | `my-creative-space/src/routes/{no-monthly-fee-salon-software,commission-free-booking-software,salon-booking-software-australia,hair-salon-software-australia}.tsx` |
| The calculator (visitor types their own bill) | `src/components/seo/BreakEvenCalculator.tsx` |
| Shared parts | `src/components/seo/{PageShell,Hero,FaqBlock,CtaBanner,InternalLinks}.tsx` |
| Old addresses that redirect | `src/server.ts` (`MOVED`) |
| Sitemap / AI summary | `src/routes/sitemap[.]xml.ts`, `public/llms.txt` |
| Lovable project | id `1f3abd6d-0918-48f1-b44f-fc9e97297421` (publish with `deploy_project`) |
| IndexNow key | `44ad6cd6a26d410d8fcebbf5a5e65e07` (file at the site root) |
| Signup service (Render) | `kairo-platform`, `srv-damjobkri2ms73dl0dfg`, workspace `tea-d98ovh3eo5us73fgj8n0` |
| Reels plan | `docs/marketing/REELS.md` (this repo) |
| This log | `Appointment-software-/docs/marketing/LOG.md`, branch `claude/markdown-file-analysis-a5ppnf` |

If a repo is not in the session, add it with the `add_repo` tool and clone it.

## The rules (never broken)

1. **Never name another booking platform** — not on a page, in a title, a
   URL, an FAQ, `llms.txt`, a caption or a reel (owner's decision, 22 Oct
   2026). Compare Kairo with *paying monthly*. Any figure for a monthly plan
   is either a labelled example ("an example $99 a month, not any particular
   app's price") or one the visitor types into the calculator.
2. **Only Kairo's own claims, and only true ones.** "$410 once", "$0 a month,
   forever", "no commission". Never "special offer" or "limited time" ($410 is
   the normal price). Check the Kairo repo before claiming a feature (e.g.
   Kairo has no gift cards, memberships, Xero or marketplace), and say what
   monthly platforms commonly do better.
3. **No outreach.** No cold email, no DMs to people who didn't write first, no
   posting in groups or forums, no comments under other people's posts.
   Resend's policy forbids cold outreach and Kairo's booking emails depend on
   that account.
4. **No money.** Nothing that costs anything: no ads, no paid tools, no
   Higgsfield or Picsart credits.
5. **Git:** never force-push, rebase or amend `my-creative-space` (Lovable
   history). Commit messages end with the Co-Authored-By and Claude-Session
   lines the session gives you; no model names anywhere else.
6. **Never use Lovable `send_message`** (it spends the owner's Lovable
   credits). Edit through git, publish with `deploy_project`.
7. **Never touch the salons** (`hairbysha`, `horahaircutz`) or send anything
   through their accounts.

## The steps

### 1. Check the site is still clean and still true
- Fetch every URL in `https://kairobookings.com/sitemap.xml`, plus `/llms.txt`,
  and search each for the names of other booking platforms (at least: Fresha,
  Timely, Square Appointments, Booksy, Kitomba, Phorest, Shortcuts, Vagaro,
  GlossGenius, Mindbody, Setmore). Any hit: remove it this run.
- The price on the site is still $410 once, matching `KAIRO_PRICE_CENTS` in
  this repo's `platform/` (the live checkout).
- The 9 old addresses in `src/server.ts` still answer 301.

### 2. See where Kairo stands
For each target query run `firecrawl_search` (`location: "Australia"`) and note
whether a `kairobookings.com` URL appears and at what position:
`salon software no monthly fee`, `salon booking software australia`,
`booking software no commission`, `hair salon software australia`,
`barber booking software australia`, `beauty salon booking software australia`,
`salon software one off payment`, `cheap salon booking software australia`,
plus the query of each page added from the backlog. Also `site:kairobookings.com`
(is it indexed?). Check Google autocomplete for new searches about the problem:
`curl "https://suggestqueries.google.com/complete/search?client=firefox&gl=au&hl=en-AU&q=<query>"`
for `salon software`, `salon booking app`, `barber booking app`,
`booking software no`, `salon software australia`, `booking app for hairdressers`.
A search about the bill, commission, switching or a kind of business that has
no page is a backlog candidate. Searches that name a platform are not.

### 3. Add one page (or make the weakest one better)
Take the top unbuilt item from the backlog (or a new one from step 2). One per
run — quality over volume. Copy the structure of
`no-monthly-fee-salon-software.tsx` (its comparison table compares with "a
typical subscription platform", never a named one; the calculator takes the
visitor's own numbers). Then add it to the sitemap `CONTENT_PAGES`, `llms.txt`
(Pages), and the `InternalLinks` of two related pages. A Start button goes to
`https://start.kairobookings.com/start?from=<page-slug>`.

If every backlog item is built, improve the page with the weakest position in
step 2: sharper title/description for the query, a first paragraph that
answers the query in one sentence, more specific FAQ.

### 4. Check, then publish
In `my-creative-space`: `bun run build`, `bunx tsc --noEmit -p .` (two errors in
`src/routes/guide.tsx` were there before and are not yours), and
`bunx eslint <changed files>` (`bunx prettier --write` fixes formatting). Render
the new page locally (`bunx vite dev --host 127.0.0.1`) and read its HTML.
Commit, push to `main`, wait until Lovable's `get_project` shows your commit
as `latest_commit_sha`, then `deploy_project`. Confirm the live URL answers 200
with the right `<title>`.

### 5. Tell the search engines
Submit the changed URLs (or the whole sitemap) to IndexNow:

```bash
KEY=44ad6cd6a26d410d8fcebbf5a5e65e07
curl -X POST https://api.indexnow.org/indexnow -H "Content-Type: application/json; charset=utf-8" \
  -d '{"host":"kairobookings.com","key":"'$KEY'","keyLocation":"https://kairobookings.com/'$KEY'.txt","urlList":["https://kairobookings.com/<page>"]}'
```
202 or 200 is success.

### 6. Count visits and what sold
- **Visits:** Lovable `get_project_analytics` (project above) for the last 7
  days gives visitors, pages and sources (google.com, bing.com, instagram…).
  Note visits to each page and how many came from search or Instagram.
  Baseline before launch: ~2 visitors a day, almost all direct or Instagram.
- **Sales:** Render `list_logs` on `srv-damjobkri2ms73dl0dfg` for the last 7
  days with text `signup:` — lines read `signup: started <slug> from <page>`
  and `signup: paid <slug> from <page>`. `from ig-dm` is the Instagram DM
  reply (`REELS.md`). Count started and paid by source.

### 7. Write it down and say so
Append one entry to `LOG.md` (newest at the top): date, site check (clean or
what was fixed), positions found, page added or improved, signups and sales by
source, anything that needs the owner. Commit and push to
`claude/markdown-file-analysis-a5ppnf`. Finish with a short plain-English
summary — that is what the owner reads. **If there was a sale, say so first.**

## Backlog (top first)

Every page is about the problem or the kind of business, never about another
platform.

1. `/switch-salon-software` — moving your clients and bookings to a new system
   without losing anyone (export a CSV from any system, import, tell clients)
2. `/salon-software-cost` — what salon software costs over 1, 3 and 5 years:
   per-person subscriptions, commission on new clients, text fees, against a
   one-off fee; the calculator with the visitor's own figures
3. Finish `/barber-software-australia` and `/beauty-salon-software-australia`:
   both exist but carry `noindex: true` and are left out of the sitemap. Read
   them, make them complete and true, then drop `noindex` and add them to the
   sitemap
4. `/nail-salon-software-australia`
5. `/lash-and-brow-booking-software-australia`
6. `/booking-app-for-hairdressers` — the iPhone app angle

Done: the four pages listed under "Pages about the monthly bill", and `/guide`.
Removed 22 Oct 2026: nine pages that named other platforms (they redirect).
