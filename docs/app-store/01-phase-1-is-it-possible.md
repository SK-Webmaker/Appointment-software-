# Phase 1 — Is it possible at all?

*Status: draft for the owner's decision. Research only; nothing was built and
nothing on the live services was touched.*

Sources are numbered in square brackets and listed at the end. Where a claim
rests on a secondary source rather than the primary document, it says so.
Everything was checked in September 2026; several of these things are moving
(court cases, store rules, the ACMA register), and the dates matter.

---

## 0. The answer

**Go — but not as literally described.** Three parts of the sentence *"opens
the App Store, downloads it, signs up, pays, and comes out the other side fully
set up"* have to change, and each change is forced by a rule rather than a
preference:

1. **The $400 cannot be paid inside the app without giving Apple 15–30% of
   it.** Apple's Guideline 3.1.1 requires in-app purchase for anything that
   unlocks features, and Australia is not a storefront where the external
   purchase link exception applies [1][8][9]. The version that costs 0% is the
   one Fresha and Square actually use: the app is free, the money is taken on
   the web, and the app contains no purchase and no call to buy (Guideline
   3.1.3(f)) [1]. So the path is Instagram → website → pay → provisioned →
   *"now install the app and sign in"*. The App Store is where the owner
   lives every day; it is not where they pay.

2. **One Kairo app, for salon owners, not one app per salon and not a
   customer app first.** Guideline 4.2.6 rejects apps generated per client
   and requires a single binary; 4.3 forbids one bundle per variant [1]. The
   owner is the person who opens the app twenty times a day. Customers book
   every six weeks through a link; they keep the web booking page.

3. **"Each business gets its own Resend and ClickSend account" cannot be
   done by a machine, because neither company offers an API that creates an
   account** [12][13][17]. Only a human can sign up. The choice is *which*
   human: the platform owner (today), or the business itself, guided by the
   app. Everything *after* the account exists — adding the domain, writing
   the DNS, verifying, minting a key — is automatable through Resend's API.
   Section 4 lays out the two honest options and their costs.

Everything else in the brief's list is possible now with public APIs: Render
creates a service with a disk, environment and custom domain [10][11];
Cloudflare writes the DNS (already scripted); Stripe takes the $400 with
fraud screening included and can onboard the salon's own Stripe account
[19][20]; the ABN can be checked for free [22]. The remaining human steps
belong to the *business* (their ACMA sender registration, their Stripe
identity check) and to the owner only for signups the system flags.

The rest of this document is the evidence, item by item, ending with the
decisions the owner has to make before Phase 2.

---

## 1. Apple's cut

### What the rule says

Guideline 3.1.1: *"If you want to unlock features or functionality within your
app … you must use in-app purchase. Apps may not use their own mechanisms to
unlock content or functionality, such as license keys …"* [1]. A $400 unlock
of Kairo, bought in the app, is exactly this.

Commission: 30% standard; **15% under the Small Business Program** for
developers under US$1M in proceeds in the prior year, which a new developer
qualifies for immediately [2][3]. So $60 or $120 of every $400, plus Apple
sets prices from fixed tiers, handles the customer's refunds on its own
terms, and pays out on its schedule.

### The exceptions, and which one Kairo fits

| Guideline | What it allows | Does it fit Kairo? |
|---|---|---|
| 3.1.3(a) Reader apps | Previously purchased *content*: magazines, books, audio, video | No. Kairo is software, not content. |
| 3.1.3(b) Multiplatform | Access features bought on the web, **provided they are also offered as in-app purchase** | Only if the $400 is also sold in-app at 15%. Defeats the purpose. |
| 3.1.3(c) Enterprise | Sold directly to organisations for their employees; *"consumer, single user, or family sales must use IAP"* | Arguable for a salon with staff, but a one-person salon is a single user. Too thin to build on. |
| 3.1.3(e) Goods and services outside the app | Physical goods or services consumed outside the app **must not** use IAP | Yes for the *salon's* money: deposits, POS, Tap to Pay. Apple takes nothing from a haircut. |
| **3.1.3(f) Free stand-alone apps** | *"Free apps acting as a stand-alone companion to a paid web based tool … do not need to use in-app purchase, provided there is no purchasing inside the app, or calls to action for purchase outside of the app."* | **Yes.** This is the route. The app is free; the tool is paid for on the web; the app never mentions buying. |

The rule text for 3.1.3 adds: *"Developers can send communications outside of
the app to their user base about purchasing methods other than in-app
purchase"* [1] — the email and the website may say anything; the app binary
may not.

### The court cases do not rescue an Australian app

- **United States:** after the contempt finding, Apple takes 0% on linked-out
  purchases on the US storefront and may not block external links there; the
  Ninth Circuit largely upheld this in December 2025 and the Supreme Court
  agreed on 30 June 2026 to hear Apple's appeal [4][5][6]. This applies to
  the **US storefront only** [1].
- **Australia:** on 12 August 2025 the Federal Court found Apple misused its
  market power by restricting alternative payment methods; the ACCC was
  granted leave to intervene on relief in April 2026 and the relief hearing
  resumed on 28 April 2026 [7]. **No relief orders have been published as of
  this writing** that change what an Australian storefront app may do. Apple's
  External Purchase Link entitlement is available in the EU, South Korea and
  a few other regions; Australia is not on the list [8][9].
- **Google:** the Epic settlement cuts Play fees to 20% (10% subscriptions),
  reaching Australia on 30 September 2026 [24]. Still not 0%, and the same
  companion-app logic applies. Play registration is a one-off US$25.

### What this does to the price

| Route | Apple's share of $400 | Who handles the refund | Note |
|---|---|---|---|
| In-app purchase | $120 (30%) or $60 (15%) | Apple | Price would need to be ~$470 to net $400 at 15%. A non-consumable IAP is tied to an Apple ID, not to a salon — restoring it across devices and staff is messy. |
| **Web purchase, free companion app** | **$0** | Kairo, under the ACL | Stripe's fee instead: 1.7% + A$0.30 domestic [20]. About $7. |

**Plainly: if the purchase happens inside the app, the business model changes
by 15–30%. If it happens on the web, it does not change at all.** The web
route is what the two named benchmarks do.

## 2. Guideline 4.2 — what Kairo would have to *be*

4.2: *"Your app should include features, content, and UI that elevate it
beyond a repackaged website."* 4.2.2: not primarily *"web clippings."* 4.2.6:
template-generated apps *"will be rejected unless they are submitted directly
by the provider of the app's content … Another acceptable option … is to
create a single binary to host all client content in an aggregated or
'picker' model."* 4.3(a): *"Don't create multiple Bundle IDs of the same
app."* [1]

Kairo today is a hash-routed website plus a per-business manifest (Phase 0
§5). Wrapped unchanged in a WebView it is the textbook 4.2 rejection [25].
What earns the listing is native capability the website cannot have, and
Kairo already has the server side of each:

| Native capability | Why it is real value, not decoration | What exists today |
|---|---|---|
| **Push notifications** — new online booking, client cancellation, waitlist taken, payment landed | Owner alerts are emails today (`owner_new_booking`); a push on the apron-pocket phone is the feature owners ask for | The message pipeline already produces every event |
| **Tap to Pay on iPhone** via Stripe Terminal | True card-on-phone payment; Australia supported, EFTPOS included, iPhone XS+, needs Apple's entitlement [26]. `STRIPE-SETUP.md` §8 already promises this "later" | POS, invoices, Stripe REST client |
| Camera → before/after photos, consent signature capture | v1.52 treatment records | Photo storage, 400 KB cap |
| Biometric unlock, app lock | Health information on a shared salon phone | Session cookies |
| Today widget / Live Activity: "Next up" | The dashboard card, on the lock screen | `/api/dashboard` |
| Offline read of today's diary | Salons with bad reception | Nothing yet |
| Native share sheet for the booking link, contacts import | Small | Partly |

A single "Kairo" binary that signs into *any* salon's instance satisfies 4.2.6
and 4.3 by construction. Other review items that bite: **5.1.1(v)** account
deletion must be offered in-app [1] (there is no delete-my-business today —
automating offboarding is now a requirement, not a nicety); **2.1** reviewers
need a working demo login (a permanent demo instance); a privacy policy URL
and privacy labels; and the Tap to Pay entitlement is a separate Apple
application [26]. Enrolment as an organisation needs a D-U-N-S number (free)
and is currently reported at one to several weeks [27]; Apple says 90% of
submissions are reviewed within 24 hours, with an appeal path [28].

**Honest risk:** even with native features, a hybrid app whose main screens
are web views can be rejected by a strict reviewer under 4.2. The mitigation
is the feature list above plus a native shell that is visibly an app
(navigation, settings, login, payments native; the calendar and forms web).
Phase 2 decides how much is native. Phase 7 plans for the first rejection.

## 3. Who is the app for?

Two audiences, two different apps, and the rules push hard toward one of them.

| | Owner app | Customer app |
|---|---|---|
| Who opens it | The salon owner, many times a day | A client, every 4–8 weeks |
| What it must do | The whole workspace + push + Tap to Pay | Pick a salon, book, cancel, pay a deposit |
| 4.2.6 / 4.3 | One binary, sign in to any salon: fine | One app *per salon* is exactly what 4.2.6 rejects. A single "Kairo Bookings" app must be a **picker** — a marketplace of salons |
| Does it fit the proposition? | Yes: it *is* the product | It turns Kairo into what Fresha is (a marketplace that owns the customer relationship), which is what the $400/no-commission pitch defines itself against [29] |
| What the customer loses without it | Nothing — the booking link works in Safari, "Add to calendar" and the cancel link already exist | — |

**Recommendation: the owner app, one binary, first and possibly only.** A
customer picker app is a marketplace decision, not an engineering one; it
only makes sense at hundreds of salons and would change the business. It can
be revisited then. **This needs the owner's decision (D1 below).**

## 4. Automating what is manual today

Phase 0 §10 counted five logins to four consoles per business. Here is what
an API can do for each, with the evidence.

### 4.1 Render — fully automatable

`POST /services` creates a web service with `repo`, `branch`, `autoDeploy`,
`envVars`, `region`, `plan`, a `disk {name, mountPath, sizeGB}` and
`healthCheckPath` in one call; `POST /services/{id}/custom-domains` adds the
subdomain and reports `verificationStatus` [10][11]. This is the blueprint,
minus the clicking. Price as of August 2026: starter instance US$7/month,
disk US$0.25/GB/month; custom domains reported as 25 included then
US$0.25/month each [30]. Time from call to serving with a certificate: a few
minutes, pollable.

Two caveats for Phase 2: the service name must be unique in the workspace
(slug uniqueness is already required); and every new service auto-deploys
from the same branch as the live salons unless the API is told a tag — the
"one push, every salon" problem gets worse with every signup, and staging
becomes necessary.

### 4.2 Cloudflare DNS — already automatable

`onboard-business.mjs` does it. The token expired on 26 August; a new one,
scoped to the zone, held server-side by the provisioning service. The
DNS-only-then-proxy sequence is pollable through Render's verification status.

### 4.3 Resend — the account cannot be created; everything else can

- **No account or team creation API.** The REST API covers emails, domains,
  API keys, audiences, broadcasts, webhooks, templates [13]. Signing up is a
  browser action by a human. Resend's *Domain Claim* moves a domain between
  teams and is dashboard-only for now [12].
- **Everything after signup is an API call:** `POST /domains` adds
  `slug.kairobookings.com` and returns the exact DKIM, SPF and MX records;
  `POST /domains/{id}/verify` checks them; `POST /api-keys` mints a key with
  `permission: sending_access` and `domain_id`, i.e. **a key that can only
  send, and only from that one domain** [14][15].
- **Pricing (September 2026):** Free — 3,000 emails/month, 100/day, **3
  verified domains**; Pro US$20–35/month — 50–100k emails, 10 domains, +US$20
  per extra 100 domains; Scale US$90+ — 1,000 domains [16].

Two ways to honour "each business on its own free account", and one that
doesn't:

| Option | How it works | Automated? | What it costs | What it changes |
|---|---|---|---|---|
| **A. Business's own Resend account, connected by the app** | During setup the app sends them to Resend to sign up (3 minutes, their email), then asks them to paste a full-access key **once**. Kairo uses it to add the domain, *write the DNS into Cloudflare itself*, verify, mint a domain-scoped sending key, and discard the full key. | Everything except the signup click and one paste — done by the **business**, not the owner | $0 to everyone. Free tier covers a salon. | Keeps the structure exactly. Adds a step where people drop off; needs a "we'll email you when it's ready" fallback. Works for own domains (Hair By Sha's case) with one extra DNS instruction. |
| **B. One Kairo Resend team, one domain and one scoped key per business** | Kairo adds `slug.kairobookings.com` to *its* team, writes DNS, verifies, mints a `sending_access` key restricted to that domain, drops it into the new instance's settings. Email works the moment they pay. | Fully | ~US$20/month total at up to 10 salons, ~US$40 at up to 110. About US$0.20–2 per salon per month, paid by the platform, never by the salon | The **account** and the quota are Kairo's; DKIM and reputation stay per domain. Breaks the letter of "own account", keeps "$0/month for the business". Free tier (3 domains) is not load-bearing here — the $20 tier is. |
| C. Everybody on one domain | Send everything from `mail.kairobookings.com` | Fully | $0–20 | One bad salon's spam complaint hurts every salon's deliverability. **Rejected.** |

**Recommendation: A as the design, with B as the day-one default so email
works before the business has done anything, and A offered in Settings as
"use your own Resend" — which is also how an own-domain business connects.**
The owner asked to be shown the cost before consolidating: it is the
US$20–40/month above and the concentration of sending quota; the
per-business domain keys mean a leaked key sends only as that one salon.
**Owner decision D3.**

### 4.4 ClickSend and the ACMA register — a business step, unavoidably

- ClickSend has a **Subaccounts API** (`POST /subaccounts` with username,
  password, email, and access flags for users, billing, reporting) under a
  parent account, plus a white-label reseller programme [17][18]. Subaccounts
  sit on the parent's billing. Using it would make Kairo the SMS reseller:
  holding the salons' prepaid credit, re-billing usage, and carrying the
  ACMA relationship — a commission business, which the proposition forbids.
- **The ACMA SMS Sender ID Register became mandatory on 1 July 2026** [31]
  (the brief's date is right, and it has now passed). An alphanumeric sender
  must be registered by the business itself: ClickSend collects the ABN,
  legal name, address and an authorised contact who then verifies through
  ACMA's own portal; the register is dashboard-only, no API [21]. Unregistered
  alpha tags are labelled "Unverified" or blocked [21][31][32]. Numeric
  senders (a dedicated number, ~A$20/month) are not the register's target
  [32]. **Both live salons are currently sending unregistered.**

**Recommendation: SMS stays "bring your own ClickSend".** The app deep-links
the business to ClickSend signup, takes username and API key in a guided
step with a live test message, offers the choice *alpha tag (register with
ACMA, we track it) or dedicated number (works today)*, and shows the ACMA
status as an unfinished item until it is done. It is a human step, but it is
the business's human, it is optional, it costs them money anyway, and the
regulatory identity has to be theirs. **Owner decision D4.**

### 4.5 Stripe for the salon — automatable either way

Today the salon pastes a live secret key (Phase 0 §8). **Stripe Connect
Standard** lets Kairo create the salon's own Stripe account and send them an
Account Link for Stripe's hosted identity check; the money and payouts remain
theirs; under "Stripe handles pricing" the platform pays **no fees** in
Australia [19]. It also removes a live secret key from Kairo's settings table.
Tap to Pay on iPhone works on Standard connected accounts [26]. The paste-key
path keeps working for anyone who prefers it. Phase 2 detail; **owner
decision D5.**

### 4.6 What remains human, and whose human

| Step | Today | After | Whose hands |
|---|---|---|---|
| Slug, DNS, Render service, disk, domain, certificate, proxy | Owner, 3 consoles | API | none |
| First-boot admin account, `KAIRO_PUBLIC_URL`, Settings pass | Owner, 1 login | API (`new-business.sh` already does this via the API) | none |
| Email working | Owner creates Resend account, copies DKIM | Option B: none. Option A: business signs up, pastes once | business (optional) |
| SMS | Owner creates ClickSend account | Business signs up, pastes once, registers with ACMA | **business** |
| Card payments | Business pastes key with owner on a call | Connect onboarding link | business |
| Verifying the signup is a real business | Conversation | Payment + ABN check + email/phone verification; flagged cases queued | **owner, flagged cases only** |
| Refund, dispute, data handover, offboarding | Owner | Automated where safe (see §5), owner approves refunds | owner, rarely |

## 5. Payment, verification and fraud

**Taking $400 from a stranger:** Stripe Checkout on the web, 1.7% + A$0.30
domestic [20]; Radar fraud screening is included at no extra charge on
standard pricing [23]; disputes carry a fixed fee per case (secondary sources
report US$15–A$25 — confirm on Stripe's AU pricing before Phase 3). Stripe
Tax can add GST if Kairo is registered (ATO threshold A$75,000 turnover).
Stripe Identity exists at about US$1.50 per verification if a document check
is ever wanted [23]; probably not needed for $400.

**What an attacker actually gets** for a stolen $400 card: a hosted instance
on a `kairobookings.com` subdomain that can send email, plus whatever SMS
keys they add themselves. The damage is reputational and lands on the shared
zone (one DMARC record for everyone). So provisioning must be gated:

1. Provision only after Stripe reports `payment_status=paid` and Radar risk
   is not elevated; a card that fails 3-D Secure never provisions.
2. **ABN check** through the ABR's free JSON web service [22]: the ABN must
   resolve, be active, and its entity name must plausibly match the business
   name. Not a fraud-proof step, but it stops throwaway signups and is what
   Square asks for [33].
3. Email verification (exists) and SMS one-time code to the owner's phone.
4. **Sending caps on new instances** for the first 7 days (a per-instance
   daily message ceiling, already the shape of the automations' cap).
5. Slugs: first come first served, reserved words refused, ABN mismatch or
   a slug matching an existing business name → **flagged**, not refused.
6. Flagged signups go to a queue the owner clears from their phone. This is
   the one place the owner stays in the loop, and only for the exceptions.
7. Chargeback → suspend the service (Render API) and keep the disk 90 days;
   never delete on a dispute. Refund within the policy → export their data,
   suspend, delete after the retention period, remove DNS
   (`offboard-business.mjs` already refuses to touch anything but theirs).

**Two people claim the same salon name:** the slug is unique and the ABN is
recorded. Kairo does not adjudicate trademarks; the second claimant gets a
different slug and both are flagged for the owner.

## 6. Australian obligations

**Privacy Act 1988.** The A$3M small-business exemption is lost by any
organisation that *"provides a health service and holds health information,
even if … providing a health service is not their primary activity"*; the
OAIC's examples include gyms, weight-loss clinics and massage therapists
[34][35]. A salon that records patch tests, allergies, medications or
pregnancy in Kairo v1.52 is recording a person's physical health to assess
whether a treatment is safe — that is inside the statutory definition of a
health service. **Treat every salon using treatment records as bound by the
APPs**, and treat Kairo (as the party with root on the disk) as needing
contractual terms about access, breach notification and deletion. The
statutory tort for serious invasions of privacy (from 10 June 2025) applies
to everyone regardless of the exemption [36]. Tranche 2 (exposure draft 31
August 2026) keeps the exemption [36]. What this requires of the product: a
privacy policy (Apple demands the URL anyway), in-app account and data
deletion (Apple 5.1.1(v) demands it anyway), export (exists), and a written
breach process. None of it is a blocker.

**Australian Consumer Law.** Consumer guarantees apply to software and
digital products, to business buyers under the A$100,000 threshold, and
cannot be excluded; blanket "no refunds" is misleading conduct [37]. A $400
one-off needs a refund policy that says what a major failure is and how
unused service is refunded. Standard-form contracts with small businesses
fall under the unfair-contract-terms regime. Ordinary terms work; Phase 4
drafts them.

**Spam Act 2003.** Confirmations, reminders and receipts about a booking the
client made are factual, not commercial. The marketing automations and
campaigns are commercial electronic messages: consent (inferred from the
existing relationship), sender identification and a working unsubscribe are
required [38]. Kairo already has per-client unsubscribe tokens, opt-out that
no campaign overrides, and identification in every message. Structurally
compliant; the owner's own copy is the remaining variable.

**ACMA SMS Sender ID Register.** Mandatory since 1 July 2026; see §4.4. Not
automatable; a per-business obligation the app can only track.

**Apple.** Developer Program US$99/year; organisation enrolment needs a
D-U-N-S number [27]. GST on Apple's fee is immaterial. Tap to Pay needs a
separate entitlement [26].

## 7. Go / no-go, item by item

| Item | Verdict | If no-go, the nearest thing that is |
|---|---|---|
| A Kairo app listed on the App Store | **Go** — as a free owner app with native push, Tap to Pay, camera, biometrics; one binary for all salons | — |
| Paying the $400 inside the app at $400 net | **No-go** — 3.1.1 makes it 15–30% | Pay on the web; the app is a 3.1.3(f) companion with no purchase and no call to action |
| One app per salon | **No-go** — 4.2.6, 4.3 | One binary, sign in to any salon |
| A customer app | **Not now** — only viable as a marketplace picker, which changes the business | The web booking page, which already works and which Apple takes nothing from |
| Provisioning a Render service, disk, domain, DNS, admin account, settings without a human | **Go** — public APIs cover all of it | — |
| Creating a Resend account per business without a human | **No-go** — no API | A: business signs up and pastes once, Kairo does the rest. B: Kairo's team, one domain + one domain-scoped key per business, ~US$20–40/month platform-side |
| Creating a ClickSend account per business without a human | **No-go** — no API; and ACMA registration is the business's | Business connects their own account in a guided step; Kairo tracks ACMA status |
| Salon's Stripe without a human | **Go** — Connect Standard onboarding link, $0 platform fees in AU | — |
| Taking $400 from a stranger safely | **Go** — Stripe Checkout + Radar + ABN check + verification + provisioning gates + flag queue | — |
| Privacy, ACL, Spam Act, ACMA | **Go, with work** — policy, deletion, refund terms, register tracking | — |
| The owner doing nothing | **Nearly** — zero for the ordinary signup; the owner clears a flag queue and approves refunds | — |

## 8. Things in the brief worth pushing back on

- **"Opens the App Store, downloads it, signs up, pays."** The most expensive
  possible order. Make it *sees the post → website → pays → gets the app*.
  The store listing still does its job: credibility on the profile, and the
  owner's daily tool.
- **"Each business has its own Resend account."** Keep it as the *design*
  (option A) but accept option B as the default that makes email work at the
  moment of payment, at a stated cost to the platform of tens of dollars a
  month, not to any salon. Insisting on A-only means every signup has a
  three-minute detour to a third-party site before their confirmations work.
- **Vercel and Supabase (brief §6).** Neither answers anything here. Vercel
  is a serverless front-end host with no persistent disk; Kairo is one
  long-running process with a SQLite file. Supabase is a shared Postgres —
  the multi-tenant database the owner has reasons not to want. The only new
  component this programme needs is a small *platform* service (signup,
  payment, provisioning, flag queue) that exists once. It can be written in
  the same zero-dependency style and run on the same Render account.
- **Timing.** ACMA's date has passed. Both live salons should register their
  sender IDs regardless of this programme.

## 9. Decisions needed before Phase 2

| # | Decision | Recommendation |
|---|---|---|
| D1 | Who is the app for? | The owner. One binary. Customers keep the web booking page. |
| D2 | Where is the $400 paid? | On the web, before the app. The app is free and silent about money. |
| D3 | Email accounts | Kairo's Resend team with one domain and one domain-scoped key per business by default; "connect your own Resend" in Settings (also the own-domain path). Accept ~US$20–40/month platform cost. |
| D4 | SMS accounts | Business's own ClickSend, connected in a guided step; alpha tag or number is their choice; ACMA status tracked in-app. |
| D5 | Salon card payments | Stripe Connect Standard onboarding link; paste-key stays as fallback. |
| D6 | The owner's residual role | Flagged signups and refunds only, from a queue on their phone. |
| D7 | Android | Not in the brief. Same companion-app logic; US$25 once; Play fees irrelevant if nothing is sold in-app. Recommend: after iOS ships. |

---

## Sources

1. Apple, *App Store Review Guidelines* §§3.1.1, 3.1.3(a)–(f), 4.2, 4.2.6, 4.3, 5.1.1(v) — https://developer.apple.com/app-store/review/guidelines/ (fetched 2026-09-05)
2. Apple, *App Store Small Business Program* — https://developer.apple.com/app-store/small-business-program/
3. Adapty, *App Store Small Business Program: everything developers need to know in 2026* — https://adapty.io/blog/app-store-small-business-program/ (secondary)
4. Ninth Circuit, *Epic Games v. Apple*, No. 25-2935 (Dec 11, 2025) — https://law.justia.com/cases/federal/appellate-courts/ca9/25-2935/25-2935-2025-12-11.html
5. RevenueCat, *Apple must allow external payment links* — https://www.revenuecat.com/blog/growth/apple-anti-steering-ruling-monetization-strategy (secondary)
6. MacDailyNews, *U.S. Supreme Court clears path for App Store commission showdown* (Aug 14, 2026) — https://macdailynews.com/2026/08/14/u-s-supreme-court-clears-path-for-app-store-commission-showdown-as-apple-must-defend-its-rates-in-lower-court/ (secondary)
7. ACCC, *ACCC granted leave to intervene in Epic v Apple proceedings* — https://www.accc.gov.au/media-release/accc-granted-leave-to-intervene-in-epic-v-apple-proceedings ; Gilbert + Tobin, *Epic wins cases against Apple and Google in Australia* — https://www.gtlaw.com.au/insights/epic-wins-cases-against-apple-and-google-in-australia
8. Apple, entitlement `com.apple.developer.storekit.custom-purchase-link.allowed-regions` — https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.storekit.custom-purchase-link.allowed-regions
9. Adapty, *Alternative payments in the App Store* — https://adapty.io/blog/alternative-payments-in-the-app-store/ (secondary; region list)
10. Render API, *Create service* — https://api-docs.render.com/reference/create-service
11. Render API, *Add custom domain* — https://api-docs.render.com/reference/create-custom-domain
12. Resend changelog, *Domain Claim* — https://resend.com/changelog/domain-claim
13. Resend, *API reference* — https://resend.com/docs/api-reference/introduction
14. Resend, *Create domain* — https://resend.com/docs/api-reference/domains/create-domain
15. Resend, *Create API key* (`sending_access`, `domain_id`) — https://resend.com/docs/api-reference/api-keys/create-api-key
16. Resend, *Pricing* — https://resend.com/pricing ; changelog *More domains on the free tier* — https://resend.com/changelog/three-domains-on-the-free-tier
17. ClickSend PHP SDK docs, *SubaccountApi* — https://github.com/ClickSend/clicksend-php/blob/master/docs/Api/SubaccountApi.md
18. ClickSend, *Partners and resellers* — https://www.clicksend.com/us/partners-and-resellers/ ; *Managing subaccounts* — https://help.clicksend.com/en/articles/42263-managing-subaccounts
19. Stripe, *Connect pricing (Australia)* — https://stripe.com/au/connect/pricing
20. Stripe, *Pricing (Australia)* — https://stripe.com/au/pricing
21. ClickSend Help, *ACMA alphanumeric SenderIDs registration & usage* — https://help.clicksend.com/en/articles/46062-acma-alphanumeric-senderids-alpha-tags-registration-usage
22. ABN Lookup, *Web services* — https://abr.business.gov.au/Tools/WebServices ; registration — https://abr.business.gov.au/Documentation/WebServiceRegistration
23. Stripe, *Radar pricing* — https://stripe.com/radar/pricing ; *Identity* — https://stripe.com/au/identity
24. Yahoo Finance, *Google settles with Epic Games, drops its Play Store commissions to 20%* — https://finance.yahoo.com/news/google-settles-epic-games-drops-200512326.html ; Stora, *Google Play fee overhaul* — https://stora.sh/blog/2026-03-31-google-play-fee-overhaul-epic-settlement-developer-guide (secondary)
25. MobiLoud, *Will your WebView app be rejected?* — https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper (secondary)
26. Stripe, *Tap to Pay* (iOS) — https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay ; *Tap to Pay on iPhone* — https://stripe.com/terminal/tap-to-pay-on-iphone
27. Apple, *Program enrollment* — https://developer.apple.com/help/account/membership/program-enrollment/ ; Apple Developer Forums, enrolment delays — https://developer.apple.com/forums/thread/822540
28. Apple, *App Review* ("90% of submissions are reviewed in less than 24 hours") — https://developer.apple.com/distribute/app-review/
29. Square, *Square vs Fresha* — https://squareup.com/au/en/compare/square-vs-fresha ; Pabau, *Fresha alternatives* (20% new-client fee) — https://pabau.com/blog/fresha-alternatives/ (secondary)
30. Render, *Better pricing for fast-growing teams* — https://render.com/blog/better-pricing-for-fast-growing-teams ; srvrlss, *Render pricing 2026* — https://www.srvrlss.io/provider/render/ (secondary for the domain allowance)
31. MEF, *ACMA's SMS Sender ID rules come into effect on July 1st* — https://mobileecosystemforum.com/2026/05/20/acmas-sms-sender-id-rules-come-into-effect-on-july-1st/ ; ACMA, *SMS Sender ID Register* — https://www.acma.gov.au/sms-sender-id-register (returned 503 when fetched; cited for the record)
32. Twilio, *What you should know about Australia's new SMS Sender ID Register* — https://www.twilio.com/en-us/blog/insights/australia-sender-id-register
33. Square Support AU, *Required documentation for sign up* — https://squareup.com/help/au/en/article/7442-required-documentation-for-sign-up
34. OAIC, *What is a health service provider?* — https://www.oaic.gov.au/privacy/your-privacy-rights/health-information/what-is-a-health-service-provider
35. OAIC, *Rights and responsibilities* — https://www.oaic.gov.au/privacy/privacy-legislation/the-privacy-act/rights-and-responsibilities
36. Aitken, *Privacy reform 2026: what the draft Bill means* — https://www.aitken.com.au/news/privacy-act-reforms-tranche2 ; Astris Law, *Australia's new statutory privacy tort* — https://www.astrislaw.com/article/privacy-tort-australia (secondary)
37. ACCC, *Consumer rights and guarantees* — https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees ; Bespoke Law, *ACCC cracks down on misleading return policies* — https://bespokelaw.com/accc-cracks-down-on-misleading-return-policies-what-you-need-to-know/
38. ACMA, *Avoid sending spam* — https://www.acma.gov.au/avoid-sending-spam
