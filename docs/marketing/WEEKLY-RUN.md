# The weekly marketing run

A scheduled Claude session does this every Monday. It is written to be
followed by a session that starts with no memory of the work before it — read
[`README.md`](README.md) first for why, then do the steps in order.

**The job:** keep Kairo the best answer for Australian salon and barber owners
searching for a way off a monthly booking bill, and report what sold.

## Where things are

| What | Where |
|---|---|
| Website code (Lovable, TanStack Start) | repo `SK-Webmaker/my-creative-space`, branch `main` |
| Competitor prices, the only copy | `my-creative-space/src/data/rivals.ts` (`CHECKED_ON`, `FRESHA`, `TIMELY`) |
| Switching pages | `my-creative-space/src/routes/{fresha-alternative,fresha-price,cancel-fresha,fresha-vs-timely,timely-alternative}.tsx` |
| Shared parts | `src/components/seo/{SwitchCalculator,CompareTable,PageShell,Hero,FaqBlock,CtaBanner,InternalLinks}.tsx` |
| Sitemap / AI summary | `src/routes/sitemap[.]xml.ts`, `public/llms.txt` |
| Lovable project | id `1f3abd6d-0918-48f1-b44f-fc9e97297421` (publish with `deploy_project`) |
| IndexNow key | `44ad6cd6a26d410d8fcebbf5a5e65e07` (file at the site root) |
| Signup service (Render) | `kairo-platform`, `srv-damjobkri2ms73dl0dfg`, workspace `tea-d98ovh3eo5us73fgj8n0` |
| This log | `Appointment-software-/docs/marketing/LOG.md`, branch `claude/markdown-file-analysis-a5ppnf` |

If a repo is not in the session, add it with the `add_repo` tool and clone it.

## The rules (never broken)

1. **No made-up numbers.** Every competitor price on the site is read from the
   vendor's own Australian pricing page in this run or a recent one, shown
   with GST added, with the date (`CHECKED_ON`) and a link to the source. If a
   price cannot be confirmed for three runs in a row, replace it with "see
   their pricing page" and a link, and say so in the log.
2. **Honest comparisons.** Every page says what the other product does better.
   No claim about Kairo that the code does not support (check the Kairo repo:
   e.g. Kairo has no gift cards, memberships, Xero or marketplace).
3. **No outreach.** No cold email, no DMs, no posting in groups or forums, no
   comments under other people's posts. Resend's policy forbids cold outreach
   and Kairo's booking emails depend on that account.
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

### 1. Re-check the prices
Scrape `https://www.fresha.com/pricing`, `https://www.gettimely.com/pricing/`
and `https://squareup.com/au/en/appointments/pricing`
with Australian location (`firecrawl_scrape`, `location: {country: "AU"}`,
`maxAge: 0`). Compare every field in `rivals.ts`.
- Same → set `CHECKED_ON` to today.
- Changed → update the numbers and `CHECKED_ON`; read every switching page for
  sentences the change makes wrong (e.g. "passed in 9 months").
- Pages using a vendor added later (the backlog below) get the same check.

### 2. See where Kairo stands
For each target query run `firecrawl_search` (`location: "Australia"`) and note
whether a `kairobookings.com` URL appears and at what position:
`fresha alternative australia`, `fresha alternatives`, `how much is fresha a month`,
`fresha fees australia`, `cancel fresha subscription`, `fresha vs timely`,
`timely alternative`, `salon software no monthly fee`, plus the query of each
page added from the backlog. Also `site:kairobookings.com` (is it indexed?).
Check Google autocomplete for new switching searches:
`curl "https://suggestqueries.google.com/complete/search?client=firefox&gl=au&hl=en-AU&q=<query>"`
for `fresha`, `fresha fees`, `timely`, `booksy`, `square appointments`,
`kitomba`, `salon software`. A new switching search with no page is a backlog
candidate.

### 3. Add one page (or make the weakest one better)
Take the top unbuilt item from the backlog (or a new one from step 2). One per
run — quality over volume. Copy the structure of `fresha-alternative.tsx`:
verified prices in `rivals.ts` first, then the page, then add it to the
sitemap `CONTENT_PAGES`, `llms.txt` (Pages + the comparison facts), and the
`InternalLinks` of two related pages. The Start button is
`startHref("<page-slug>")`.

If every backlog item is built, improve the page with the weakest position in
step 2: sharper title/description for the query, a better first paragraph that
answers the query in one sentence, more specific FAQ.

### 4. Check, then publish
In `my-creative-space`: `bun run build`, `bunx tsc --noEmit -p .` (two errors in
`src/routes/guide.tsx` were there before and are not yours), and
`bunx eslint <changed files>` (`bunx prettier --write` fixes formatting). Render
the new page locally (`bunx vite dev`) and confirm the prices are in the HTML.
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
  Note visits to each switching page and how many came from search. Baseline
  before launch: ~2 visitors a day, almost all direct or Instagram; Google 3
  and Bing 1 in the month to 21 Oct.
- **Sales:** Render `list_logs` on `srv-damjobkri2ms73dl0dfg` for the last 7
  days with text `signup:` — lines read `signup: started <slug> from <page>`
  and `signup: paid <slug> from <page>`. Count started and paid by page.

### 7. Write it down and say so
Append one entry to `LOG.md` (newest at the top): date, prices (same/changed),
positions found, page added or improved, signups and sales by page, anything
that needs the owner. Commit and push to `claude/markdown-file-analysis-a5ppnf`.
Finish with a short plain-English summary — that is what the owner reads.
**If there was a sale, say so first.**

## Backlog (top first)

Verify each vendor's Australian price before writing; drop an item whose
vendor has no published Australian price.

1. `/fresha-vs-square` — both prices side by side, plus Kairo (both verified in `rivals.ts`)
2. `/barber-booking-software-no-monthly-fee` — barbers leaving Fresha (Fresha and Square prices)
3. `/fresha-marketplace-fee` — the 20% new-client fee explained, with a calculator
4. `/timely-price` — "how much is Timely a month in Australia"
5. `/phorest-alternative` — only if Phorest publishes an Australian price
6. `/shortcuts-alternative` — only if Shortcuts publishes an Australian price
7. `/gloss-genius-alternative` — only if GlossGenius is sold in Australia

Done: `/square-appointments-alternative` (20 Oct). Checked and dropped for now:
Kitomba (no published price) and Booksy (no Australian price; its $29.99 is
US). Re-check them every few weeks.
