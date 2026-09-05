# Phase 3 — What it costs

*Status: draft for the owner's approval. Prices checked September 2026;
sources at the end. Exchange rate assumed **US$1 = A$1.50**; every AUD figure
is a conversion and moves with the dollar.*

The owner's rule for this phase: *spend as close to nothing as possible;
necessary costs are fine, unnecessary ones are not; if a free tier is
load-bearing, say what happens the day it changes.*

---

## 0. The three numbers that matter

1. **Hosting is the only cost that scales with salons, and it is
   perpetual.** Every other cost is per-signup (paid for by the $400) or
   fixed (small). Because the salon pays once and never again, Kairo carries
   the hosting bill for as long as the salon exists.
2. **On Render as run today, a salon costs about A$130–145 a year to host.
   The $400 covers roughly three years; after that the salon is a loss.** At
   200 salons the fleet costs about **A$28,000 a year**.
3. **On a plain VPS in Sydney, running the `new-business.sh` model that
   already exists in the repo, a salon costs about A$22 a year.** The $400
   covers eighteen years. At 200 salons the fleet costs about **A$4,400 a
   year.** The brief asked whether Render survives; on the arithmetic, not
   past the first few dozen salons.

Everything below is the working.

## 1. One-off costs

| Item | Cost | Notes |
|---|---|---|
| Apple Developer Program | US$99 / year (≈ A$150) | Organisation enrolment; D-U-N-S number is free [1] |
| **A Mac to build and submit the iOS app** | A$0 – A$1,000 | The only way to compile, sign, TestFlight and submit an iOS app is Xcode on macOS. This session runs on Linux and can write every line of Swift but cannot build it. Options: the owner's or a friend's Mac; a Mac mini (~A$1,000); GitHub Actions macOS runners (free tier for private repos ≈ 200 macOS minutes/month — enough for a few builds a month, with signing certificates kept in repository secrets); a rented cloud Mac (~US$50–100/month, not recommended). **This is the forgotten cost in the brief and it needs a decision (D14).** |
| Legal review of the policy set (terms, refunds, privacy, data processing, acceptable use) | A$1,500 – 4,000 (estimate) | One-off; drafts are produced in Phase 4 so the lawyer edits rather than writes |
| Google Play registration (Android, later) | US$25 once | Not in scope until iOS ships |
| `kairobookings.com` renewal | ≈ A$20 / year | Already owned |
| Platform ClickSend prepaid credit for signup verification texts | A$20 initial top-up | Lasts ~300 signups |
| Stripe account for the platform | A$0 | No monthly fee; per-transaction only [2] |
| ABR web services key | A$0 | Free government API [3] |

**One-off total: ≈ A$150 + legal + (Mac or nothing).** Round it to A$2,000
to A$5,000 depending on the lawyer and the Mac.

## 2. Per-signup costs (paid out of the $400)

| Item | Web door | App door (A$399.99) | App door (A$519.99) |
|---|---|---|---|
| Payment processing | Stripe 1.7% + A$0.30 ≈ **A$7.10** [2] | Apple: GST removed, then 15% → proceeds ≈ **A$309**, i.e. ≈ A$91 gone [4][5] | proceeds ≈ **A$402** |
| Phone verification text (platform ClickSend) | ≈ A$0.06 | same | same |
| ABN lookup, email verification, DNS, provisioning API calls | A$0 | A$0 | A$0 |
| First Render deploy | A$0 (no build step) | — | — |
| Dispute / chargeback, if it happens | Stripe dispute fee, reported ~A$25 (verify on the AU pricing page) | Apple handles | Apple handles |
| Refund inside 14 days | Stripe returns its fee on refunds in AU? **No** — Stripe keeps the processing fee, so a refund costs ≈ A$7.10 | Apple refunds; Apple's commission is returned | same |

**Net of the $400 per signup: ≈ A$393 (web), ≈ A$309 (app at A$399.99),
≈ A$402 (app at A$519.99).**

## 3. Ongoing costs — the fleet, at 1, 10, 50 and 200 businesses

### Assumptions

- Each salon: one Kairo process, one 1 GB disk, one custom subdomain, ~2 GB
  outbound traffic a month (the booking page serves brand images from the
  database on every load; a busy salon can be more).
- Fixed platform overhead: the **platform service** and a permanent **demo
  instance** (for Apple review and as the release canary). Both run as one
  more Kairo-sized service each.
- Two live salons already exist and are counted in N.
- Resend, ClickSend, Stripe and Square are the business's own accounts:
  **A$0 to Kairo** by the owner's decision.
- Cloudflare Free plan: DNS, proxy, Email Routing — A$0 [6].
- APNs, App Store Server API, ABR: A$0.

### Track R — Render, as today

Prices from Render's August 2026 plans: Starter instance US$7/month, disk
US$0.25/GB/month, custom domains beyond the plan's allowance US$0.25/month
each, bandwidth overage US$0.15/GB; Hobby workspace is free with a reported
cap of 25 services, 2 included domains and 5 GB included bandwidth; Pro
workspace US$25/month flat with 25 GB included [7][8][9].

| Salons | Instances (salons + 2) | Instance + disk | Workspace | Extra domains | Bandwidth overage | **US$/month** | **A$/month** | **A$/year** |
|---|---|---|---|---|---|---|---|---|
| 1 | 3 | 21.75 | Hobby 0 | 0.25 | ~0.15 | **≈ 22** | ≈ 33 | ≈ 400 |
| 10 | 12 | 87.00 | Hobby 0 | 2.50 | ~2.85 | **≈ 92** | ≈ 138 | ≈ 1,660 |
| 50 | 52 | 377.00 | Pro 25 | ~7 | ~12 | **≈ 421** | ≈ 630 | ≈ 7,580 |
| 200 | 202 | 1,464.50 | Pro 25 | ~44 | ~57 | **≈ 1,590** | ≈ 2,385 | **≈ 28,600** |

Per salon: **≈ US$7.9 / month ≈ A$140 / year.** The Hobby workspace's
25-service cap is hit at salon 23; the workspace must move to Pro then.

### Track V — a VPS fleet, the model `scripts/new-business.sh` already implements

DigitalOcean Sydney (a real Australian region, flat pricing everywhere):
Basic droplets US$6 (1 GB), US$12 (2 GB), US$24 (2 vCPU / 4 GB); weekly
backups +20%; Spaces object storage US$5/month for 250 GB [10]. Hetzner
Singapore is cheaper again (CX32, 8 GB, ≈ €8/month) but no closer to
Melbourne than Render's Singapore [11].

Sizing: a Kairo process idles at roughly 70–100 MB. **25 salons per 4 GB
droplet** leaves headroom for spikes and SQLite page cache; a busier fleet
can go to 40 on 8 GB. One droplet per 25 salons, each with automated
backups, plus nightly database snapshots copied to Spaces (Kairo's own
emailed backups continue as well).

| Salons | Salon droplets | Droplets + backups | Platform droplet (2 GB) + backups | Spaces | **US$/month** | **A$/month** | **A$/year** |
|---|---|---|---|---|---|---|---|
| 1 | 1 × 2 GB | 14.40 | 14.40 | 5 | **≈ 34** | ≈ 51 | ≈ 610 |
| 10 | 1 × 4 GB | 28.80 | 14.40 | 5 | **≈ 48** | ≈ 72 | ≈ 870 |
| 50 | 2 × 4 GB | 57.60 | 14.40 | 5 | **≈ 77** | ≈ 116 | ≈ 1,390 |
| 200 | 8 × 4 GB | 230.40 | 14.40 | 5 | **≈ 250** | ≈ 375 | **≈ 4,500** |

Per salon at scale: **≈ US$1.15 / month ≈ A$21 / year.** Domains: Caddy
issues certificates itself and Cloudflare's wildcard CNAME costs nothing, so
there is no per-domain fee at all.

### Fixed costs common to both tracks

| Item | US$/month | A$/year |
|---|---|---|
| Apple Developer Program | 8.25 | 150 |
| Domain renewal | ~1.1 | 20 |
| Platform verification texts (at 20 signups/month) | ~0.8 | 15 |
| Monitoring | 0 | 0 — Render health checks / a free uptime checker |

### The comparison, per salon, over five years

| | Render | VPS (DO Sydney) |
|---|---|---|
| Hosting per salon per year | ≈ A$140 | ≈ A$21 |
| Years of hosting one $400 sale buys | **≈ 2.8** | **≈ 19** |
| Fleet of 200, per year | ≈ A$28,600 | ≈ A$4,500 |
| Five-year hosting for a salon sold today | ≈ A$700 | ≈ A$105 |

**Plainly: at $400 once, Render is only affordable while the fleet is small.
The proposition — no monthly fee, ever — is only sustainable on the VPS
model, or on something priced like it.** This is not a reason to change the
price; it is a reason to change the host before it matters.

## 4. What Render buys that a VPS does not, and what it costs to give up

| | Render | VPS fleet |
|---|---|---|
| Isolation | one container per salon; a crash or a runaway takes one salon | one Linux user + one systemd unit per salon on a shared kernel and disk; `new-business.sh` already applies `NoNewPrivileges`, `ProtectSystem`, `PrivateTmp`, a private data folder — but a full box takes 25 salons down at once |
| Provisioning | REST API, a few minutes, certificate handled | the script (exists, dry-run tested) run over SSH by the platform; Caddy issues the certificate on first request in seconds |
| Updates | git push → every service redeploys | `git pull && systemctl restart 'kairo-*'` per box, staged box by box — a better canary story, not a worse one |
| Operations | none | OS patching (unattended-upgrades), disk monitoring, Caddy, backups — a few hours a month once scripted |
| Region | Singapore (or Oregon) | **Sydney**, measurably faster for Melbourne salons |
| Per-salon marginal cost | US$7.25 + fees | ≈ US$1.15 |
| Health checks, restarts | built in | systemd `Restart=always` (in the unit already) |
| Bandwidth | 5 GB / 25 GB included then US$0.15/GB | 4 TB per droplet included |

**Recommendation (D13):** build the provisioner in Phase 6 with a **host
driver** — `render` first, because it is what runs today and what the two
live salons are on, and `vps` second, before the fleet reaches 25. New salons
go to the cheapest healthy driver; nothing about a salon's Kairo changes
between them (same code, same data folder shape, same env vars — the VPS
unit file sets the same variables the blueprint does). Sha and Hora stay
where they are until Phase 5 says otherwise. *This is an amendment to Phase
2 §4 and is recorded there.*

## 5. Free tiers that are load-bearing, and the day each changes

| Free thing | Who depends on it | If it goes | What we do |
|---|---|---|---|
| **Resend Free: 3,000 emails/month, 100/day, 3 domains** [12] | every salon's confirmations and receipts | the salon's email stops at the cap or Resend asks them for US$20/month | `notify.js` already has a provider switch; add a second email provider (SES, Postmark) behind the same `sendEmail()`. The salon chooses; Kairo still pays nothing. A salon over 100 emails/day is a big salon and can afford US$20. |
| **Render Hobby workspace: US$0, 25 services** [8] | the first 23 salons | Pro at US$25/month | absorbed, or the VPS driver takes over new salons |
| **Cloudflare Free: DNS, proxy, Email Routing, Turnstile** [6] | every salon's address; the operator-assist mailbox | Cloudflare has never charged for these; if it did, DNS moves to any registrar's API and the catch-all to any mailbox | one file (`onboard-business.mjs` logic) to change |
| **ABR web services** [3] | ABN check at signup | it is a government service; the check becomes optional | the flag queue still works without it |
| **APNs / App Store Server API** | push, purchase verification | Apple has never charged | — |
| **GitHub Actions macOS minutes** (if chosen for builds) | shipping the app without a Mac | build on a Mac | D14 |
| **ClickSend free alpha-tag registration** [13] | the business's sender ID | ACMA "tentatively" no fee; if one appears it is the business's | stated in the guided step |

Nothing on this list would stop a salon taking bookings if it disappeared
tomorrow. The two that would cost the owner money are Render Hobby (US$25)
and, indirectly, Resend Free (US$20 to the *salon*).

## 6. What the owner's time costs, honestly

Not money, but the brief asked where the human stays:

| Recurring task | Frequency | Time |
|---|---|---|
| Flagged signups | a few per hundred | 2 minutes each |
| "Do it for me" Resend tasks | whatever share of salons ask | 5 minutes each (signup + paste) |
| Refunds after 14 days | rare | 2 minutes |
| Promote a release (`release` branch) | per release | 1 minute plus watching the canary |
| VPS box patching (Track V) | monthly, scripted | 15 minutes |
| Apple: annual renewal, occasional review replies | yearly / per release | an hour |

## 7. Decisions for the owner before Phase 4

| # | Decision | Recommendation |
|---|---|---|
| D13 | Hosting track | Render now; a VPS driver (DigitalOcean Sydney) before salon 25; new salons to the cheapest healthy host |
| D14 | How the iOS app gets built and submitted | GitHub Actions macOS runners for builds and TestFlight uploads, plus access to *a* Mac for the first setup and for debugging. Say which Mac. |
| D8 (carried) | In-app price | Not yet decided. A$519.99 nets ≈ A$400; A$399.99 nets ≈ A$309. |
| D15 | Legal review budget | Approve up to A$4,000 for one review of the Phase 4 drafts |

---

## Sources

1. Apple, Program enrollment and fees — https://developer.apple.com/help/account/membership/program-enrollment/
2. Stripe, Pricing (Australia) — https://stripe.com/au/pricing
3. ABN Lookup web services — https://abr.business.gov.au/Tools/WebServices
4. Apple, Understanding taxes (GST agency model) — https://developer.apple.com/help/app-store-connect/making-payments-to-apple/understanding-taxes/
5. 42 Advisory, *GST on App Store sales: Apple, Google and Australian SaaS* — https://42advisory.com.au/42-advisory-blog/gst-app-store-sales-australia (secondary)
6. Cloudflare Free plan features (DNS, proxy, Email Routing, Turnstile) — https://www.cloudflare.com/plans/free/
7. Render, *Better pricing for fast-growing teams* — https://render.com/blog/better-pricing-for-fast-growing-teams
8. Render changelog, *Updated plans for Render workspaces* (Pro US$25 flat, US$0.25/extra domain, US$0.15/GB overage, migration 1 Aug 2026) — https://render.com/changelog/updated-plans-for-render-workspaces ; Hobby caps (25 services, 2 domains, 5 GB) via srvrlss — https://www.srvrlss.io/provider/render/ (secondary)
9. Render instance and disk pricing (Starter US$7, disk US$0.25/GB) — https://render.com/pricing
10. DigitalOcean Droplet pricing (US$6/12/24, backups +20%, Sydney region) — https://www.digitalocean.com/pricing/droplets ; docs — https://docs.digitalocean.com/products/droplets/details/pricing/
11. Hetzner Cloud pricing after the 2026 increases — https://northflank.com/blog/hetzner-cloud-server-price-increases (secondary)
12. Resend pricing — https://resend.com/pricing
13. ClickSend Help, ACMA alpha tag registration — https://help.clicksend.com/en/articles/46062-acma-alphanumeric-senderids-alpha-tags-registration-usage
