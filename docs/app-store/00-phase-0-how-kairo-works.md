# Phase 0 — How Kairo actually works

*Status: draft for the owner's correction. Nothing after this depends on
anything but this document being right, so read it looking for the mistake.*

How this was produced: the whole repo was read (every file in `src/`,
`server.js`, the scripts, the six markdown documents, `render.yaml`); Kairo
v1.52.0 was booted against a scratch database and exercised through the API
(login, public availability, a public booking, a duplicate booking for the same
slot, a request carrying an unknown field, the message log, an invoice from the
appointment, a cash payment, the receipt, the client's cancel link, the setup
wizard, a backup download, the manifest and the security headers); and the two
live services were read — **read only, nothing changed** — through Render's API,
public DNS, and their own public `/api/version` and `/api/public/info`
endpoints.

---

## 1. In one paragraph

Kairo is a single Node process. It serves two static front ends and one JSON
API from the same origin, and keeps one business's entire existence — settings,
secrets, clients, appointments, invoices, payments, messages, health records,
even the logo and photos as base64 — in one SQLite file. Every business runs its
own copy of that process on its own Render web service with its own 1 GB disk,
reachable at `<slug>.kairobookings.com` through Cloudflare. The copies share
nothing but the git branch they auto-deploy from, so one push upgrades every
salon at once. Email leaves through each business's own Resend account, SMS
through its own ClickSend account, card money through its own Stripe account;
Kairo holds the keys in the settings table and never sees the money. Putting a
new business on is a six-step human runbook: DNS, a Render blueprint, a Resend
account and DKIM key, a ClickSend account, and one pass through Settings.

---

## 2. The process (`server.js`, 245 lines)

- `node:http` server on `PORT` (4820 default, 10000 on Render). No framework,
  no build step, no `node_modules` — `package.json` has no dependencies and
  `.gitignore` refuses lockfiles.
- **Boot order:** `scripts/check-node.mjs` (npm `prestart`) refuses Node older
  than 22.5 and proves `node:sqlite` loads → `bootstrap()` opens the database
  and migrates → `startScheduler()` → `listen()`. Boot prints two banners when
  something is wrong: *DATA WILL BE LOST* (database inside the app folder on a
  known ephemeral host) and *booking link is not this business's own address*
  (public URL still on `*.onrender.com`).
- **Routing:** `/api/*` → `handleApi`; `/manifest.webmanifest` → generated
  per business (its name, standalone display); `/book`, `/pay-done`,
  `/review/<token>`, `/cancel/<token>` → the matching static HTML; anything
  else without an extension → `index.html` (the workspace is hash-routed).
  GET/HEAD only for static; path-traversal guarded.
- **Headers on every response:** strict CSP (`script-src 'self'`,
  `connect-src 'self'`, no framing), HSTS two years, nosniff, Referrer-Policy,
  Permissions-Policy denying camera/mic/geo/payment. The one CSP exception is
  Cloudflare Turnstile, on the booking document only, only while enabled.
- **Origin lock** (`src/origin.js`) runs before routing: off / monitor /
  enforce a shared `x-kairo-origin` header that a Cloudflare Transform Rule
  stamps. Off on both live businesses today. `/api/version` is never blocked
  (Render's health check hits the origin directly).
- **The scheduler** is one `setInterval` a minute that (a) delivers due rows
  from the `messages` table, (b) sends the emailed backup when due, (c) runs
  the marketing automations' daily pass (guarded to once a day), (d) queues
  the one review chase. There is no cron, no worker, no queue service.

## 3. The data (`src/db.js`, 1,250 lines)

One file, `KAIRO_DATA_DIR/kairo.db` (`/var/data` on Render), opened with
`node:sqlite`'s `DatabaseSync`, WAL mode, foreign keys on, 5 s busy timeout
(the backup and offboard scripts open the same file).

**Tables, grouped by what they are:**

| Group | Tables |
|---|---|
| Config | `settings` (key/value — *everything* configurable, including secrets) |
| Identity | `users` (in practice one row: the owner; `role` exists but there is no staff login) |
| The business | `locations`, `staff`, `staff_shifts` (roster), `services`, `service_requirements`, `products` |
| Clients | `clients` (+ `referral_token`, `unsub_token`, `birthday` MM-DD, `marketing_opt_out`, `booking_rule`) |
| Diary | `appointments`, `appointment_services` (multi-service), `time_blocks`, `waitlist`, `booking_attempts` |
| Money | `invoices`, `invoice_items`, `payments` (integer cents throughout) |
| Messaging | `messages` (the outbound log and queue), `automations`, `automation_sends` (unique index = "once, ever") |
| Feedback | `reviews` |
| Health information | `client_safety`, `patch_tests`, `consents`, `treatment_photos` — deliberately separate tables (v1.52) because they are APP-sensitive |

**`settings` is the configuration system.** ~100 keys seeded from
`DEFAULT_SETTINGS`. Secrets (`resend_api_key`, `stripe_secret_key`,
`clicksend_api_key`, `twilio_token`, `telnyx_api_key`, `cf_origin_secret`,
`turnstile_secret_key`, `session_secret`) are stored in plaintext in this table
but are **write-only to the browser**: `getSettings()` replaces each with a
`<key>_set` flag. The `EDITABLE_SETTINGS` allowlist in `api.js` decides what the
UI may write; the origin-lock keys are excluded and move only through guarded
`/api/edge/*` routes. There is a `plan_*` group (name, price, interval, status,
renewal date) that the Account page shows read-only — a leftover of the
monthly-pricing model in `SELLING.md`, see §11.

**Bootstrap on every start:** if `app_version` in the DB differs from
`package.json`, `VACUUM INTO` a backup beside the live file first (keeps 5);
`CREATE TABLE IF NOT EXISTS` for everything; additive `ALTER TABLE ADD COLUMN`
migrations (never drop, never rewrite); seed missing default settings; mint
`session_secret`; **if there are no users, create the owner from
`KAIRO_ADMIN_EMAIL` / `KAIRO_ADMIN_PASSWORD` — read on the very first boot
only**, falling back to `admin@kairo.local` / `admin123`; if there is no staff,
seed the *Luxe Hair Studio* demo; a brand-new install gets
`setup_complete=''` so the owner meets the wizard.

**What "one file" means in practice:** the business's logo, cover, gallery and
before/after photos are base64 data URIs *inside the database*. Photos are
capped at 400 KB each and the disk at 1 GB. A busy salon is single-digit
megabytes. A backup is a `VACUUM INTO` snapshot, gzipped (~6 MB → ~200 KB),
emailed to the owner weekly by default, or downloaded from Settings.

## 4. The API (`src/api.js`, 4,769 lines)

One request pipeline, in this order: **rate limit** (per-IP global ceiling,
then a per-bucket policy: login 20/10 min, public booking 12/5 min, public
reads 240/min, authed 600/min per user+IP; in-memory fixed windows) → **route
match** (regex table, ids are digits) → **session** (HMAC-signed
`kairo_session` cookie carrying user id + token version + expiry; a password
change bumps the version and retires every cookie) → **handler**, which
validates its body against a schema (`src/validate.js`) that rejects unknown
fields, including nested ones → JSON.

About 190 routes. Everything requires the cookie except: login/logout,
`/api/version`, `/api/auth/verify-email`, and the `/api/public/*` family
(`info`, `availability`, `patch-slots`, `book`, `confirm-deposit`, `ics`,
`logo`, `referral`, `offer`, `waitlist`, `booking-attempt`, `cancel`,
`confirm`, `unsubscribe`, `review`, `review-clicked`). Every public link that
names one booking is **token-scoped, never id-scoped**: cancel and review
tokens are 128-bit random strings stored on the appointment; the `.ics` link
carries an HMAC derived from the session secret.

**There is no password reset, no signup, no multi-user, no admin API and no
operator API.** An owner who is locked out is rescued by whoever runs the
deployment. This is the shape a self-serve flow has to change.

## 5. The two front ends (`public/`, ~11,400 lines of vanilla ES modules)

- **The workspace** (`index.html` → `js/app.js`): hash router over 13 pages
  (dashboard, POS, calendar, clients, services, products, billing, messages,
  reviews, growth, team, settings, account), a first-run wizard (`wizard.js`:
  business, hours, team, services, deposits, "put it on your phone"), a guided
  tour, and *Kai*, a small natural-language query bar over the owner's own
  data. Installable as a home-screen web app: per-business manifest, Apple
  touch icons, pinch-zoom disabled, pull-to-refresh. **It is a website, and
  the README says so as a feature.** Nothing about it is an App Store app.
- **The booking page** (`book.html` → `js/book.js`, 57 KB): services →
  stylist or "any" → date strip / picker → time → details → done, reading
  `/api/public/info` live on every visit (`no-store`). Handles deposits
  (redirect to Stripe Checkout and back), the safety gate (consent text,
  patch-test slot), waitlist, referral and offer tokens, reschedule tokens,
  Turnstile when enabled, and detects being opened inside the owner's
  home-screen app to show a "Back to Kairo" bar.
- `cancel.html`, `review.html`, `paydone.html` are the token pages.

`src/api.js` imports `public/js/hours.js` and `public/js/roster.js` directly,
so the calendar, the booking page and the server compute "is this date open,
between what times, for whom" from the same code.

## 6. A booking, end to end (what was exercised on the scratch instance)

1. `GET /api/public/availability?date&staff_id&service_ids` → 15-minute
   slots = opening hours for that date ∩ the stylist's roster − existing
   appointments − blocked time − anything already past (in the business's
   time zone, `business_tz`).
2. `POST /api/public/book` → Turnstile (if on) → date within the horizon and
   not past → the slot is re-derived server-side and must still be free
   (the second booking for the same slot got a 409) → client matched by
   email, then phone+first-name, else created → booking rules (blocked
   client, deposit required) → safety gate (consent needed / patch test needed
   / recorded reaction → 409 or 403 with the data the page needs) → insert
   `appointments` + `appointment_services` → consents, patch-test appointment,
   Stripe Checkout session (fails open: booking survives a Stripe error) →
   release the old slot if this was a reschedule → queue confirmation,
   reminder, owner alert → `processQueue()` immediately.
3. Confirmation and owner alert were **`skipped`** ("Email not configured")
   because the scratch instance has no Resend key; the reminder sat `queued`
   for the day before. Skipped is a status, not a loss: the Messages page
   shows it and offers retry.
4. `POST /api/invoices/from-appointment` → draft invoice pre-filled with the
   services; `POST /api/invoices/:id/payments` cash for the total → status
   flipped to `paid`, a `receipt` message queued (also skipped, same reason).
5. The client's cancel link (`/cancel/<token>`) showed the booking, then
   cancelled it: status `cancelled`, `cancelled_by=client`, slot free.
6. `POST /api/setup/apply` with `fresh:true` wiped the demo and created a
   one-stylist, one-service business; `/api/public/info` and the manifest
   reflected the new name immediately.
7. `GET /api/backup/download` returned a valid gzip of the database.

## 7. Messages (`src/notify.js`, `automations.js`, `campaigns.js`)

- Every outbound message is a row in `messages` first (`queued` → `sent` /
  `failed` / `skipped`), delivered by the minute tick or immediately after
  queueing. Kinds: confirmation, reminder, reschedule, cancellation, receipt,
  review request (+ one chase), owner alerts, campaign and automation sends,
  waitlist offers, test.
- **Channel choice** per kind (email / sms / both) with fallbacks; SMS is
  behind a master switch that is **off by default** because it costs money.
- **Providers are plain `fetch` calls**, no SDKs: Resend
  (`api.resend.com/emails`, From must be on the domain verified in *that
  business's* Resend account), ClickSend (`rest.clicksend.com`, plus a live
  credit-balance read), Telnyx, Twilio. Keys come from `settings`, i.e. **per
  business, per account** — exactly the structure the owner wants kept.
- Replies: mail is sent from a no-inbox domain, so `reply_to` is the owner's
  real address. Backups ride the same `sendEmail()`.
- **Automations** (7 kinds: due back, lapsed win-back, first visit, abandoned
  booking, birthday, no future booking, patch test expiring) are off by
  default, capped per day (60 global), daylight only, once-ever by unique
  index, honour opt-out and a 14-day cross-campaign cooldown.

**Observed, not changed:** `notify.js` and `automations.js` compute
`send_after` and "daylight hours" from the **server's clock**, not from
`business_tz` (grep confirms neither file reads it). Render runs UTC, so a
"24 hours before" reminder for a 9 am Melbourne appointment is stamped 09:00
UTC the day before = 7 pm Melbourne, i.e. about 14 hours before, and the
automations' 10:00–18:00 window is 20:00–04:00 Melbourne. This is a live-system
observation for the owner to confirm against the Messages page; it is not part
of this programme's scope and nothing has been touched.

## 8. Money (`src/stripe.js`)

Stripe Checkout via REST, per business key, currency from settings.
Deposits at booking (fixed or %), POS pay-links (Apple/Google Pay appear on the
customer's phone), refunds with idempotency keys. **No webhooks:** the server
asks Stripe whether a session was paid (pull model), so there is nothing to
configure per business. Square is "owner charges on their own reader, taps
Paid". Kairo never holds money; payouts are Stripe → the salon's bank.

**There is no billing of the salon by Kairo anywhere in the code.** The $400 is
collected outside the software today.

## 9. Deployment — what is actually running

| | Hair By Sha | Horahaircutz |
|---|---|---|
| Render service | `hairbysha-booking`, created 2026-07-11 | `horahaircutz-booking`, created 2026-09-02 |
| Region | **Oregon** | Singapore |
| Plan | starter | starter (`0.5c-512mb`) |
| Disk | 1 GB at `/var/data` | 1 GB at `/var/data` |
| Build command | `yarn install` (stale, known; `.yarnrc` `ignore-engines` is the workaround) | `echo "no build step"` |
| Health check path | **none set** | `/api/version` |
| Branch, auto-deploy | `claude/appointment-booking-software-xqoy4f`, on commit | same |
| Version live | 1.52.0 | 1.52.0 |
| DNS | proxied through Cloudflare (A → 104.21.x / 172.67.x) | same |
| Sends email from | **`mail.hairbyshacamberwell.com`** (their own domain; no Resend records exist under `hairbysha.kairobookings.com`) | `horahaircutz.kairobookings.com` (DKIM, SPF, MX present) |
| Raw `*.onrender.com` | answers (origin lock off) | answers (origin lock off) |
| Staff / services | 1 / 15 | 3 / 13 |
| Business phone set | yes | **no** (the cancel email cannot tell clients who to ring) |

Zone `kairobookings.com` is on Cloudflare (nameservers `jacob`/`journey`),
one domain-wide `_dmarc` record with `p=none`. Both services deploy from the
same branch on every commit, at the same moment — **there is no staging step
between a push and both live salons**. `UPDATING.md` suggests pinning a tagged
commit per service to stage; that is not how it is set up today.

Environment variables the platform relies on: `KAIRO_DATA_DIR`,
`KAIRO_PUBLIC_URL` (wins over the settings field; every link in every message
is built from it), `KAIRO_ADMIN_EMAIL` / `KAIRO_ADMIN_PASSWORD` (first boot
only), `KAIRO_SECURE_COOKIES`, `NODE_VERSION=22.22.2`; optional
`KAIRO_ORIGIN_LOCK`, `KAIRO_OPERATOR`, `KAIRO_RATELIMIT`, `KAIRO_TRUST_PROXY`,
`KAIRO_BEHIND_CLOUDFLARE`, `KAIRO_DB_PATH`, `STRIPE_API_BASE` (tests).

A second, unrelated deployment path exists and is documented:
`scripts/new-business.sh` stands a business up on a VPS with systemd + Caddy,
one port per business, one code checkout. Nobody is on it.

## 10. Onboarding today — where the human is

From `ONBOARDING.md` and the scripts, the touchpoints a person performs, in
order, with what is scripted marked:

| # | Step | Scripted? | Whose console |
|---|---|---|---|
| 1 | Choose the slug; the business's `slug@kairobookings.com` mailbox exists via a Cloudflare Email Routing catch-all to the owner's Gmail | n/a | — |
| 2 | Four DNS records (CNAME grey-cloud; MX, SPF, DKIM for Resend); `_dmarc` once ever | **yes** — `onboard-business.mjs --apply`, but needs the DKIM value from step 4 first, and a Cloudflare API token (expired 26 Aug) | Cloudflare |
| 3 | Render service from the blueprint, unique name, region, `KAIRO_ADMIN_EMAIL/PASSWORD` typed at Apply; add the custom domain; wait for the certificate; then flip the Cloudflare proxy on | partly — `--render` prints the filled-in YAML; Apply, domain, tick and proxy flip are clicks | Render, then Cloudflare |
| 4 | Sign up for Resend as `slug@kairobookings.com`, add the domain, copy the DKIM value, later press Verify, create an API key | no | Resend |
| 5 | Sign up for ClickSend as `slug@kairobookings.com`, choose alpha tag (needs ABN, ACMA) or a number, or lend the platform's starter number | no | ClickSend |
| 6 | Log in once as the owner: paste Resend key, From address, reply-to, ClickSend username/key/sender, business email and phone; send test email and SMS; take one backup; log out | no (the API could take it — `new-business.sh` does exactly this for the VPS path) | Kairo |
| — | Verify: `verify-business.mjs` checks DNS, the app, the public URL, DKIM/SPF/MX, headers, raw-host exposure | **yes** | — |
| — | Handover: owner signs in, meets the wizard, changes the handover password | owner | Kairo |

Roughly **five logins to four different consoles** per business, two of them
to accounts created in the business's name with the platform's catch-all
address. The two things that make this genuinely hard to remove are steps 4
and 5: creating a *separate* Resend and ClickSend account per business, and
getting a DKIM value out of Resend into Cloudflare. Both are the subject of
Phase 1.

## 11. What the single-tenant boundary buys and costs

**Buys.** No cross-tenant query to get wrong (a `WHERE tenant_id = ?` that is
forgotten once is a data breach; here there is no such clause anywhere). A
salon's file is theirs to download, move, or take with them. A bug or an
outage is one business's. A business can be pinned to an older version. The
health records (v1.52) never sit in the same file as another salon's. Cost of
compute is a flat ~$7 per business.

**Costs.** Every business is a separate Render service, disk, custom domain,
certificate and set of environment variables — provisioning is *infrastructure*
provisioning, not a row insert. One push deploys to all of them with no
canary. In-memory rate limits and scheduler state are per instance (fine).
There is nowhere for a platform-level thing to live: no signup, no account of
accounts, no billing, no "list every business", no operator dashboard — the
ledger of who exists is `businesses.tsv` on the VPS path and nothing at all on
Render. Any self-serve flow needs a *new* component that exists exactly once,
above the salons, and that component is by definition multi-tenant.

## 12. Things found that the brief did not say (corrections and gaps)

1. **The test suite is not in the repository.** The brief says 1,738 checks
   across 56 suites, all passing. No test file exists in the tree, none has
   ever been committed in this repo's history, and `package.json` has no test
   script. `.gitignore` excludes `audit/` and `scratchpad/`, which is
   presumably where they lived in previous sessions. `SECURITY.md` and
   `LAUNCH-CHECKLIST.md` describe them (Chromium end-to-end suites, a load
   test, a Cloudflare suite) but the code is gone with those sessions.
   **"Test the way this repo tests" cannot be done as instructed until a
   harness exists in the repo.** This should be the first thing built in
   Phase 6, and committed.
2. The repository's history starts at v1.21.1 (2026-07-29); everything before
   was squashed or never pushed. 50 commits, one per release.
3. `SELLING.md`, the README footer ("charge monthly"), and the `plan_*`
   settings shown on the Account page all describe a **monthly** micro-SaaS
   model ($29–79/month). The proposition in the brief is **$400 once, no
   monthly fee**. The code does not enforce either; the docs disagree with the
   brief and will need reconciling in Phase 2.
4. Hair By Sha does not follow the `ONBOARDING.md` pattern: it emails from its
   **own** domain and has no Resend records on the platform subdomain. Any
   automation must treat "own domain" as a supported case, not an exception.
5. Hair By Sha's Render service has **no health check path** (Hora has
   `/api/version`), sits in Oregon, and keeps the stale `yarn install`. Hora
   has no business phone in Settings. Neither is part of this programme; both
   are noted so Phase 5 does not trip over them.
6. Reminder and automation timing use the server clock, not `business_tz`
   (§7). Unrelated to this programme, flagged for the owner.
7. Both salons deploy from the same commit at the same time. The branch this
   work is on (`claude/markdown-file-analysis-a5ppnf`) is currently identical
   to the deploy branch; **nothing pushed here deploys anywhere**, which is
   the right place to be for the research phases.
8. A stale branch `claude/fix-blueprint-branch` exists on the remote, dozens
   of versions old. It should be ignored, not merged.
9. Kairo already has the raw material for a customer-facing app and for an
   owner app in one codebase, but they are two documents sharing one origin,
   one session model (owner only) and one manifest. Guideline 4.2 will be
   judged against what is on the phone, not on the server — Phase 1 material.

## 13. Questions for the owner before Phase 1

1. Is there a copy of the test harness anywhere (a previous session's
   `audit/` folder, a zip)? If not, Phase 6 starts by writing one.
2. Is Hair By Sha's own-domain email deliberate and to be kept?
3. Confirm the reminder timing observation (§7) against Sha's Messages page —
   do reminders show as sent around 7 pm rather than the morning before?
4. Nothing else in this document is a question. Everything else is a claim,
   and it is the claims that need checking.
