# Phase 2b — Architecture decision: how Kairo holds many salons

*Status: decided by the owner's instruction of 2026-09-05 ("figure out what is
best … a fully working system that can hold many, many salons' data securely,
properly, just like Fresha and Square"), written down here so it can be
checked and, if wrong, reversed before anything is built. The brief allowed
the single-tenant rule to be argued against, with reasons. This is that
argument, and it stops short of a shared database.*

---

## 0. The decision

**One Kairo process serves many salons. Every salon keeps its own SQLite
file.** The process is hosted on Render as one web service (per region) with
a wildcard domain `*.kairobookings.com`, a persistent disk holding one folder
per salon, and a small platform service beside it. Provisioning a salon
becomes *creating a folder and a database file*: seconds, no Render API, no
per-salon DNS, no certificate wait, no host driver.

What this keeps from the brief's single-tenant rule, and what it gives up:

| Brief's reason for single-tenant | Kept? | How |
|---|---|---|
| "A bug in a **shared database** is a bug in everybody's business at once" | **Kept** | There is no shared database. Every salon is a separate SQLite file with its own schema copy, its own session secret, its own settings, its own backups. No table has a `tenant_id`. No query can return two salons' rows. |
| "A salon's client list is **theirs**" | **Kept** | It is still one file they can download, export, move to a VPS, or take to a competitor. |
| One salon's crash or runaway is one salon's problem | **Given up, partly** | A process crash restarts every salon on that shard (Render restarts in seconds; the two live salons already share the code and the deploy). Per-tenant rate limits and a per-request time budget keep one salon from starving the rest. |
| Nothing routes between salons | **Changed** | One new thing exists that does not today: the line of code that maps the request's hostname to a salon's file. It is the single place a cross-tenant bug could live, and it is tested accordingly (§4). |

## 1. Why not the other two

**A — a Render service per salon (today).** ≈ A$140 per salon per year,
forever, against $400 once (Phase 3). Unsustainable past a few dozen salons;
provisioning takes minutes and touches three APIs; Render's Hobby tier caps
at 25 services. It is the right shape for two salons and the wrong shape for
two hundred.

**B — a VPS fleet, a process per salon.** ≈ A$21 per salon per year, the
script exists, but it makes the owner a system administrator: OS patching,
Caddy, disk monitoring, SSH keys, a box that takes 25 salons down when it
fails, and the platform driving servers over SSH. It also leaves Render, which
the owner asked to keep if it could be made to work.

**C — one process, many files, on Render.** ≈ A$10 per salon per year at 200
salons (§5), zero operations, instant provisioning, daily disk snapshots
included, and the isolation property that actually matters — separate data
files — intact. This is how Fresha and Square feel to a new signup ("you're
in, immediately") without becoming what they are underneath (one database
with everyone in it).

## 2. What changes in Kairo's code

The product is 13,000 lines that import one module-level `db`. The change is
designed to leave almost all of them untouched.

| Change | Where | Size |
|---|---|---|
| **Tenant context.** `src/tenant.js`: an `AsyncLocalStorage` holding the current salon; `withTenant(slug, fn)`; an LRU of open `DatabaseSync` handles (opened on first request, closed after 30 minutes idle) | new file | ~150 lines |
| **`db` becomes a proxy** to the current tenant's handle. `db.prepare(...)` and friends resolve at call time; every existing statement keeps working unchanged because they all run inside a request or a tenant-scoped tick | `src/db.js` | ~20 lines |
| **Per-tenant module state** moves off module scope: the public-URL warning flag, the automations' "ran today" marker, the origin-lock counters, the scheduler timer becomes one loop over tenants | `db.js`, `automations.js`, `origin.js`, `notify.js` | ~60 lines |
| **Configuration from environment becomes per-tenant.** `KAIRO_PUBLIC_URL`, `KAIRO_ADMIN_EMAIL/PASSWORD` are replaced by a `tenant.json` beside each database (slug, public URL, created-at, plan), written at provisioning. The environment variables still work in single-tenant mode | `db.js`, `server.js` | ~40 lines |
| **Host routing.** `server.js`: `Host` → slug (`<slug>.kairobookings.com`, or an own booking domain from the registry) → `withTenant`. Unknown host → a plain "no salon at this address" page, never another salon's data | `server.js` | ~40 lines |
| **Single-tenant mode preserved.** If `tenants/` does not exist and `kairo.db` does, the server behaves exactly as today. Sha and Hora keep running unchanged until Phase 5 moves them, and the VPS path stays valid | `server.js`, `db.js` | ~15 lines |
| **Registry.** A tiny SQLite on the same disk owned by the platform code: slug, shard, own domains, plan status, created/suspended/deleted. The directory that Phase 0 §11 said does not exist | platform | ~100 lines |
| **Data paths.** Backups, snapshots and the `dbFileBytes()` size read the tenant's folder | `backup.js`, `db.js` | ~15 lines |

Sessions need no change: each salon's cookie is signed with *its* session
secret, and browsers scope cookies to the host, so a cookie minted on one
salon's subdomain is doubly useless on another's.

Rate limiting: the public buckets become keyed by `slug:ip`, so a scrape of
one salon's booking page cannot exhaust the limits of another; the global
per-IP ceiling stays global, which is what it is for.

## 3. The platform stays separate, and small

The platform service (Phase 2 §0) holds the secrets that must never sit in
the salon-serving process: Stripe, Apple, Cloudflare tokens, the App Store
Connect key. It talks to the shard through the control API (Phase 2 §1) and,
for provisioning, simply asks the shard to create a tenant. A compromised
shard yields salon data — as it would today — but no platform key; a
compromised platform yields the control verbs and the payment records, not a
salon's file.

## 4. The one new risk, and how it is falsified

The hostname-to-file mapping is the only code whose failure could show one
salon another's data. Its tests, written before the code, run two tenants
side by side in every suite and assert:

1. every public endpoint answered for host A contains nothing from tenant B
   (names, services, staff, tokens), across the whole route table, by
   walking it;
2. a session cookie from A is refused on B (401) and a cancel/review/ics
   token from A is 404 on B;
3. an unknown host and a deleted tenant's host return the neutral page;
4. the scheduler tick for A queues messages only in A's file — checked by
   row counts in both files before and after;
5. concurrent requests to A and B (a race harness, as the load test did for
   slots) never cross — asserted by tagging every response with the tenant
   that served it.

Each test is then **broken on purpose** — a deliberately wrong slug in the
router, a leaked handle — and must fail. A test that cannot fail is not a
test; that is the house rule and it applies most of all here.

## 5. Capacity, cost, failure

**Capacity.** A Kairo tenant's open handle costs a few megabytes; a salon's
traffic is a few thousand requests a day. One Render **Standard** instance
(1 CPU, 2 GB, US$25/month) comfortably serves several hundred salons; the
plan is one shard per ~300 salons, a second shard added by the registry when
needed (the wildcard points at shard 1; later shards get per-slug CNAMEs
through the DNS API that already exists). A 10 GB disk (US$2.50/month) holds
well over a thousand salons at single-digit megabytes each.

**Cost at 1 / 10 / 50 / 200 salons** (US$/month; Standard shard + 10 GB disk
+ Starter platform + workspace + bandwidth at 2 GB/salon; Cloudflare caching
of brand images would roughly halve the bandwidth line):

| Salons | Shard + disk | Platform | Workspace | Bandwidth overage | **US$/month** | **A$/year** | **A$/salon/year** |
|---|---|---|---|---|---|---|---|
| 1 | 27.50 | 7.25 | Hobby 0 | 0 | **35** | 630 | 630 |
| 10 | 27.50 | 7.25 | Pro 25 | 0 | **60** | 1,080 | 108 |
| 50 | 27.50 | 7.25 | Pro 25 | 11 | **71** | 1,280 | 26 |
| 200 | 27.50 | 7.25 | Pro 25 | 56 | **116** | 2,090 | **10** |

Against Phase 3: Render-per-salon A$28,600/year at 200; VPS fleet A$4,500;
this A$2,100. The $400 buys forty years of hosting.

**Failure modes, honestly.**

| Failure | Blast radius | Recovery |
|---|---|---|
| Shard process crash | every salon on the shard, for the seconds Render takes to restart | automatic; health check on `/api/version` |
| Bad deploy | every salon on the shard | the `release` branch and the demo tenant are the canary; Render rollback is one click |
| Disk lost | every salon on the shard | Render's daily disk snapshot (7 days) [1]; each salon's own emailed backup (weekly by default, exists); a nightly platform copy of every tenant file to off-site object storage (Cloudflare R2's free 10 GB covers ~1,000 salons) |
| One salon's traffic spike | that salon, then the shard | per-tenant rate limits; Render vertical scale |
| Cross-tenant routing bug | catastrophic | §4 — this is the risk the whole design pays attention to |

## 6. What this changes elsewhere in the programme

- **Phase 2 §4 provisioning** collapses from a nine-state machine over three
  APIs to: create the tenant folder and database, write `tenant.json`, insert
  the registry row, create the owner user, apply settings, done. Seconds.
  The wildcard domain and its certificate are set up once, by hand, in Phase
  6 — the only DNS step that remains, ever. Own booking domains (a salon that
  wants `book.theirsalon.com`) go through Render's custom-domain API on the
  shard plus the salon's own CNAME — an owner task, rare.
- **Phase 2's host driver amendment** is withdrawn: no drivers.
- **Phase 3** gains Track C (this table) and its recommendation changes to C.
- **Phase 5:** Sha and Hora move by copying one file each into a tenant
  folder on the Singapore shard, then switching one DNS record. Rollback is
  switching it back — their old services keep running untouched until the
  move is proven.

## 7. The iOS build without a Mac (D14, decided)

The owner is right. GitHub's hosted macOS runners are real Macs with Xcode;
the workflow checks out the Swift project, installs a distribution
certificate and provisioning profile from repository secrets, runs
`xcodebuild archive` and `-exportArchive`, and uploads the signed build to
App Store Connect with an API key — no Mac is touched [2][3]. The
distribution certificate is created from a certificate-signing request that
`openssl` generates on Linux; the App Store Connect API key is a `.p8` file
downloaded from the web. Free allowances: GitHub Actions gives private
repositories 2,000 minutes a month with macOS counted at 10×, so about 200
macOS minutes (~12 builds); Codemagic gives 500 macOS minutes a month free
and publishes to TestFlight natively [4][5]. Plan: GitHub Actions as the
primary because the code already lives there; Codemagic as overflow. Testing
happens on the owner's iPhone through TestFlight. The only thing a Mac would
add is Xcode's debugger, and the workflow substitutes simulator screenshots
and logs from the runner.

## 8. Price (D8, decided: the owner nets $400)

Apple removes 10% GST and then takes 15%; Stripe takes 1.7% + A$0.30.

| Door | List price | Owner's proceeds |
|---|---|---|
| Website (Stripe) | **A$410** | ≈ A$402.70 |
| App (in-app purchase) | **A$519.99** | ≈ A$401.80 |

If the owner is GST-registered, the website takings include GST to remit
(A$410 → A$372.73 ex-GST); Apple has already handled GST on the app door.
That is a bookkeeping fact, not a design one, and the owner's accountant
decides it.

## 9. Policies (D15, decided: brief statements, no external review)

Drafted in `04-policies.md` as short, plain statements. They are not legal
advice, and the document says so where a reader would need to know.

---

Sources: [1] Render, *Persistent disks* — https://render.com/docs/disks ·
[2] Maclessdev, *How to build and ship an iOS app without a Mac* —
https://dev.to/maclessdev/how-to-build-and-ship-an-ios-app-without-a-mac-17o5 ·
[3] Developers Digest, *Building and shipping iOS and Mac apps without opening Xcode* —
https://www.developersdigest.tech/blog/build-ship-ios-mac-apps-without-xcode ·
[4] GitHub Docs, *Billing and usage* (macOS 10× multiplier) —
https://docs.github.com/en/actions/concepts/billing-and-usage ·
[5] Codemagic, *App Store Connect publishing* — https://docs.codemagic.io/yaml-publishing/app-store-connect/ ·
Render wildcard custom domains — https://render.com/docs/custom-domains ·
Render instance pricing (Standard US$25) — https://render.com/pricing

## Amendment, 2026-09-05 — one price (supersedes §8 and Phase 2 §2)

The owner is right that two prices for one thing is not acceptable. The two
prices exist only because Apple takes 15% (after GST) of anything bought
inside the app and nothing of anything bought on the web. There are exactly
three ways to have one price:

| Option | Where the $ is paid | Price | Owner nets | What it costs |
|---|---|---|---|---|
| **A — web only (recommended)** | website only; the app is free and **sign-in only**, no purchase and no mention of buying (Apple 3.1.3(f)) | **A$410** | **≈ A$402 on every sale** | someone who finds the app first sees "Sign in" and must find the website themselves; the Instagram funnel already points at the website. No in-app-purchase code to build, test or defend in review; Apple's refund rules never apply. |
| B — one price, both doors | website (Stripe) and in-app (IAP) | A$410 | ≈ A$402 web, ≈ **A$317** in-app | the owner absorbs ≈ A$85 on every app-door sale |
| C — one price, both doors, set high | both | A$519.99 | ≈ A$510 web, ≈ A$402 in-app | every customer pays A$110 more than the product needs |

**Recommendation: A.** One price, the owner's full $400 on every sale, less
code, less review risk. The app's first screen says *Sign in*, and below it a
plain line — *"Kairo is set up for a salon by its owner. Use the sign-in
details from your Kairo."* — with no link and no price, which is what Apple's
rule requires outside the United States. This reverses decision D2 (pay in
the app), for the reason the owner identified. **Awaiting the owner's
confirmation.**
