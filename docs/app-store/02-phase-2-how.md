# Phase 2 — How

*Status: draft for the owner's approval. Design only; nothing built, nothing
on the live services touched. Built on the Phase 1 findings and the owner's
decisions of 2026-09-05 (logged in `README.md`).*

The owner's decisions, restated so the design can be checked against them:

| | Decision |
|---|---|
| D1 | The app is for the salon owner. One app. |
| D2 | Sign up, then pay $400, in the app. |
| D3 | Each business on its **own** Resend account. Kairo pays for none. The business connects it, or the owner does it for them, as automated as possible. |
| D4 | Salon card payments through Stripe and/or Square, **optional**, including simply linking their own payment link. |
| D5 | SMS through the business's **own** ClickSend, guided, ACMA status tracked in-app. Clear that it is theirs and they pay for it. |
| D6 | The owner's residual role: flagged signups and refunds. A refund policy that makes sense; every policy needed to avoid legal trouble. |
| D7 | iOS first; Android after. |

---

## 0. The route in one page

Kairo the product does not change shape. Every salon still gets its own
process, its own SQLite file, its own disk, its own subdomain, its own
provider accounts. What is added sits *around* it:

```
                 Instagram / word of mouth
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
  kairobookings.com/start          "Kairo" iOS app → Create your Kairo
  (web signup, pays by Stripe,     (same form, pays by in-app purchase,
   Apple takes nothing)             Apple takes 15%; see §2)
          └───────────────┬───────────────┘
                          ▼
              ┌──────────────────────┐
              │   Kairo Platform     │  one small zero-dependency Node service,
              │   (new, runs once)   │  its own SQLite file, on the same Render
              │                      │  account. Holds: owner accounts, the
              │  signup · payment ·  │  directory of businesses, payment and
              │  provisioning · the  │  provisioning records, the flag queue,
              │  directory · push    │  device push tokens. Holds NO salon
              │  relay · flag queue  │  client data — ever.
              └──────────┬───────────┘
                         │ Render API · Cloudflare API · instance control API
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   hairbysha.…    horahaircutz.…    <new-salon>.kairobookings.com
   (unchanged)     (unchanged)      one Render service + disk each, exactly
                                    as today, created by the platform in
                                    ~4 minutes instead of by hand in ~2 hours
```

Then, inside the new salon's Kairo, a **setup checklist** replaces the
owner's "one pass through Settings": connect your email (Resend), connect
your texts (ClickSend), connect your payments (Stripe / Square / a link),
register your sender ID (ACMA). Each is guided, each ends in a live test, and
each shows plainly whose account it is and who pays.

Three things are new: the platform service, the iOS app, and a thin
**control API** inside each Kairo instance that only the platform can call
(set settings at birth, set plan status, reset a password, receive an export
or delete order). Everything else is the Kairo that exists.

## 1. What Kairo becomes, what stays, what goes

**Stays (unchanged in kind):** the single-tenant instance, `node:sqlite`,
zero dependencies in the product, the workspace, the booking page, the
message pipeline, per-business Resend / ClickSend / Stripe keys in the
instance's own settings table, Render + persistent disk, Cloudflare in
front, the demo seed, the wizard, the tour, backups.

**Changes inside a Kairo instance (all additive, all behind flags):**

| Change | Why |
|---|---|
| `KAIRO_ADMIN_PASSWORD_HASH` accepted at first boot beside the plaintext variable | The platform computes the scrypt hash from the password the owner typed at signup and never stores or transmits the plaintext. Today's `new-business.sh` path keeps working. |
| `/api/platform/*` control endpoints, authenticated by HMAC with a per-instance `KAIRO_PLATFORM_KEY` set at creation | Set settings and plan at birth; set plan status; issue a password reset; trigger export; order deletion; register the push relay. No user session, no password, one key that exists in two places. If the platform is compromised, the attacker gets these six verbs and nothing else; there is still no cross-tenant query. |
| Password reset (there is none today) | Self-serve signup makes "I forgot" certain. Platform-mediated: the platform verifies the owner's email, then calls the instance with a signed one-time reset. |
| Native-client mode: `X-Kairo-Client: ios` header hides every purchase surface and prices in the web views | Guideline 3.1.1: the app may not contain calls to buy outside IAP. The same server renders for Safari and the app; the app must see a shop-free version. |
| Event webhook: booking, cancellation, waitlist taken, payment, backup failed → `POST` to the platform, HMAC-signed | Push notifications. The instance already produces every event; it gains one outbound post per event. |
| Plan enforcement from the existing `plan_*` settings: `active` / `pending_payment` / `suspended` / `deleted` | The platform sets the status; the instance shows the state. One-off licence semantics replace the monthly ones in `SELLING.md`. |
| Account deletion in the Account page → export first, then a platform delete order | Apple 5.1.1(v), Privacy Act, and honest offboarding. Today the offboard script deletes DNS only. |
| **Setup checklist** with four guided connectors (§3) | Replaces the owner's pass through Settings. |
| Policy links (terms, privacy, refunds) in the login screen footer and Account | §6. |

**Thrown away or rewritten:** `ONBOARDING.md` becomes the description of what
the platform does, plus the operator-assist steps that remain;
`SELLING.md`'s monthly tiers; the README footer; the catch-all-mailbox trick
survives only as the operator-assist path for Resend (§3.1); the
`scripts/onboard-business.mjs` DNS logic moves into the platform (the script
stays as the manual fallback).

## 2. The purchase — two doors, and what each costs

Phase 1 established the rule; the owner decided the app must prompt for the
$400 at signup. Guideline 3.1.3(b) makes the two-door design compliant:
features bought on the web may be used in the app **provided they are also
offered as in-app purchase**, and the app may never point at the web price.

| Door | Mechanism | Apple's share | Owner's proceeds on A$400 | Refunds handled by | Fraud handled by |
|---|---|---|---|---|---|
| **Website** `kairobookings.com/start` | Stripe Checkout, one payment, A$400 | none | ≈ A$393 (Stripe 1.7% + A$0.30). GST is the owner's if registered. | Kairo, under its refund policy and the ACL | Stripe Radar + the platform's gates (§4) |
| **iOS app** "Create your Kairo" | StoreKit 2 non-consumable, verified server-side with the App Store Server API | 15% (Small Business Program) | **≈ A$309** at a A$399.99 price: Apple deducts 10% GST first, then 15%. To net A$400 the in-app price must be about **A$519.99**. | Apple, on Apple's terms; the owner cannot refuse or grant | Apple |

The in-app door is the literal ask and it is compliant. **Its cost is ~A$91
on every sale at A$399.99, or a visibly higher price than the website's.**
Both prices for the same thing is allowed; the app just may not say so.

**Recommendation:** build both doors, put the website door first in every
piece of marketing (the Instagram link goes to `/start`, not the App Store),
and price the in-app purchase so it nets $400 (A$519.99) with the App Store
listing text saying "$400 on kairobookings.com" — that text is *outside* the
app and permitted. **Decision D8 for the owner: A$399.99 in-app (net ≈ $309)
or A$519.99 in-app (net ≈ $400).**

Mechanics, both doors: the platform creates the owner account and the
"pending" business record *before* payment, so an abandoned payment is a
known state with a follow-up email and a 7-day expiry, not a ghost. Payment
confirmation arrives by webhook (Stripe `checkout.session.completed`, signed
with HMAC; App Store Server Notifications v2, signed JWS) — never from the
client. Provisioning starts only on that webhook.

## 3. The four connectors — whose account, who pays, how automated

The principle the owner set: **every provider account is the business's
own; Kairo pays for none.** The friction that principle costs is placed on
the business, in a guided flow, with an "ask Kairo to do it" escape that
routes to the owner's queue. The table, then each in detail.

| Connector | Account | Business does | Kairo automates | Owner does |
|---|---|---|---|---|
| Email (Resend) | theirs, free tier | signs up at Resend (3 min), pastes **one** key **once** | domain, DNS, verify, scoped key, From/reply-to, test, key cleanup | nothing — unless they press "do it for me" |
| Texts (ClickSend) | theirs, prepaid | signs up, pastes username + key, picks alpha tag or number, registers with ACMA | balance check, test text, sender settings, ACMA tracker | nothing |
| Payments | theirs | Stripe: pastes a *restricted* key, or connects via Stripe OAuth · Square: nothing (mark paid) · or pastes a payment link | test mode check, currency, receipts | nothing |
| Web address | Kairo's zone | nothing | CNAME, Render custom domain, certificate wait, proxy on | nothing |

### 3.1 Email — Resend, the business's own account

In Settings → **Email**, three routes to the same end:

1. **"I'll set it up" (default).** Step 1: *Create a free Resend account* —
   opens `resend.com/signup` in Safari (from the app: `SFSafariViewController`;
   this is not a purchase, it is a third-party service they own). Step 2:
   *Create an API key named "Kairo setup" with Full access and paste it here.*
   Then Kairo, using that key: `POST /domains` for `slug.kairobookings.com`
   (region `ap-northeast-1`, `custom_return_path: send`) → receives DKIM, SPF
   and MX records → asks the **platform** to write them into Cloudflare (the
   instance never holds the Cloudflare token) → polls
   `POST /domains/{id}/verify` → `POST /api-keys` with
   `permission: sending_access, domain_id` → stores *that* key as
   `resend_api_key`, sets `notif_from_email` to `hello@slug.kairobookings.com`
   and `notif_reply_to` to the owner's address → sends the test email to the
   owner → lists API keys, finds "Kairo setup", deletes it. The full-access
   key lives in memory for about a minute and is never written to disk.
   Result: their account, their domain, a key that can only send as them.

2. **"Use my own domain"** (Hair By Sha's case). Same, with their domain:
   Kairo shows the three records to add at their registrar, polls verify,
   finishes the same way. A first-class path, not an exception.

3. **"Ask Kairo to do it for me."** Creates a task in the owner's queue with
   everything prefilled: the alias `slug@kairobookings.com` (Cloudflare Email
   Routing catch-all, as today), the business name, the link. The owner signs
   up at Resend, pastes the "Kairo setup" key into the operator console, and
   the platform runs the identical automation against that instance. One
   signup and one paste per business — the same two actions the business
   would have done, and the only ones that cannot be scripted. The owner
   later hands the account over by changing its email in Resend.

Until email is connected, the instance shows an amber "confirmations aren't
being sent yet" on the dashboard and the checklist; messages queue as
`skipped` exactly as today, so nothing is lost and nothing is faked.

**What this does not solve, said plainly:** a signup that drops off between
paying and connecting email has a Kairo that takes bookings but sends
nothing. The follow-up email on day 1 and day 3, and the amber banner, are
the mitigation. The alternative that removes the gap costs the owner a
Resend plan; the owner has declined it, and the design respects that.

### 3.2 Texts — ClickSend, the business's own account, clearly

Settings → **Texts**: *"Texts are sent from your own ClickSend account. You
pay ClickSend directly, about 6¢ a message; Kairo adds nothing."* Steps:
create the account (link), paste username and API key → Kairo calls
`/v3/account` for the live balance (the code exists) → choose the sender:
**an alpha tag** ("HairBySha" — must be registered with ACMA by you: needs
your ABN and the ABR contact to verify at ACMA; we'll show it as
*unregistered* until you confirm) or **a dedicated number** (~A$20/month,
works today, no register). A test text to the owner's phone. The ACMA item
stays open on the checklist, with the ClickSend help link, until the owner
ticks "registered", and the Messages page labels sends as *Unverified sender*
while it is open.

### 3.3 Payments — optional, three ways

Settings → **Payments**: *"Optional. Card money goes straight to your own
account; Kairo never touches it."*

- **Stripe** — two ways in. *Paste a restricted key* (the guided text lists
  the exact permissions: Checkout Sessions write, PaymentIntents read,
  Refunds write) — restricted keys are the safe version of what the two live
  salons do today. Or *Connect with Stripe* (OAuth for Standard accounts,
  still supported and $0 platform fees in Australia): one click, Stripe's
  hosted onboarding, and Kairo receives a per-account token — their account,
  their payouts, no key to paste. Recommend shipping paste-a-key first (it
  exists) and OAuth as a follow-on.
- **Square** — as today: charge on their Square reader, tap Paid.
- **A payment link** — a new field: their Stripe Payment Link, Square Online
  checkout, or PayPal.me. The POS shows a "Send payment link" button that
  shares it. Lowest possible effort for a salon that already has one.
- **Tap to Pay on iPhone** — in the app, later (§5); needs a Stripe key or
  connection and Apple's entitlement.

### 3.4 The web address

Fully automatic in provisioning (§4). Own-domain booking addresses (a salon
that wants `book.theirsalon.com`) stay a manual owner task for now: it needs
their registrar. Listed in the checklist as "ask Kairo".

## 4. Provisioning — the state machine the platform runs

```
signup_started ─► email_verified ─► payment_pending ─► paid ─► screening
   │                                     │ 7 days             │
   └─ abandoned (email nudge, expire)    └─ expired           ├─ flagged ─► owner approves / refunds
                                                             ▼
                                                        dns_created  (Cloudflare: CNAME slug → svc.onrender.com, DNS-only)
                                                             ▼
                                                        service_created (Render POST /services: node, starter,
                                                             │           region by owner's state, disk 1 GB /var/data,
                                                             │           branch `release`, health /api/version,
                                                             │           env: KAIRO_DATA_DIR, KAIRO_PUBLIC_URL,
                                                             │           KAIRO_ADMIN_EMAIL, KAIRO_ADMIN_PASSWORD_HASH,
                                                             │           KAIRO_PLATFORM_KEY, KAIRO_SECURE_COOKIES, NODE_VERSION)
                                                             ▼
                                                        deployed        (poll deploys until live; /api/version answers)
                                                             ▼
                                                        domain_added    (Render POST custom-domains; poll verificationStatus)
                                                             ▼
                                                        certificate_ok  (then Cloudflare: proxy ON)
                                                             ▼
                                                        bootstrapped    (instance /api/platform/setup: business name,
                                                             │           phone, address, tz, owner email, plan=active,
                                                             │           plan_price 40000, interval once)
                                                             ▼
                                                        verified        (the checks in verify-business.mjs, in-process)
                                                             ▼
                                                        ready  ─► email "Your Kairo is ready" + app deep link
```

Every step is idempotent and re-runnable (names are deterministic; each
provider call checks for the existing object first, as the DNS script does
today). A step that fails three times parks the job in the owner's queue
with the error and a "retry" button. Expected wall time: 3–5 minutes,
dominated by Render's first deploy and certificate issuance; the signup page
shows the steps ticking.

**Screening** (Phase 1 §5), in order: payment confirmed by webhook; Radar
risk not elevated (web door) or App Store transaction verified (app door);
ABN resolves as active via the ABR JSON service and its entity name shares a
word with the business name; email verified; phone verified by a one-time
code sent through the *platform's* ClickSend (the one SMS the platform ever
pays for, ~6¢ per signup); slug free and not reserved. Any miss → `flagged`,
not refused, and the owner sees it in the queue with the reasons. New
instances carry a 7-day outbound cap (200 messages/day) set through the
control API.

**Two people, one salon name:** slugs are first come, first served; a second
signup whose ABN or business name collides is flagged. Kairo never
adjudicates.

**Release branch.** New instances deploy from a `release` branch that the
owner fast-forwards to a tested commit, not from the development branch.
The two live salons move to it in Phase 5. This ends "one push, every salon,
no canary": the order becomes development branch → the demo instance and the
owner's own → `release` → everybody. This is the single most important
operational change in the programme and it costs nothing.

## 5. The iOS app

**Shape:** a native Swift/SwiftUI shell around the workspace, not a WebView
with an icon. Native: launch, create-your-Kairo flow, in-app purchase
(StoreKit 2), sign-in (email → the platform resolves the instance → the
instance's own cookie session), tab bar, push notifications (APNs), biometric
lock (LocalAuthentication), a lock-screen widget for "Next up" (WidgetKit,
reading a new summary endpoint), camera and photo picker feeding the
treatment-record upload, share sheet for the booking link, and later Tap to
Pay. Web (WKWebView, native-client mode): the calendar, clients, POS,
settings — the screens that took eighteen months to get right and that
Apple does not require to be rewritten, provided the app is demonstrably an
app around them.

**Dependencies, honestly:** Apple's frameworks, and **one** third-party SDK
— Stripe Terminal for Tap to Pay. That is the only foreign code in the
programme. It is optional per business and can ship in 1.1 if the Apple
entitlement is slow; it is also the strongest 4.2 argument, so the
entitlement application goes in on day one of Phase 6.

**Guideline mapping:**

| Guideline | How the design meets it |
|---|---|
| 3.1.1 / 3.1.3(b) | $400 offered as IAP in-app; web purchase honoured; no in-app steering |
| 4.2 minimum functionality | push, Tap to Pay, biometrics, widget, camera, offline today-view |
| 4.2.6 / 4.3 | one binary, any salon signs in |
| 5.1.1(v) | in-app account deletion via the control API, after export |
| 2.1 completeness | a permanent demo instance with reviewer credentials, IAP in sandbox |
| 5.1.1 privacy | privacy policy URL, nutrition labels: contact info, health data (the salon's clients' — declared honestly) |

**Sign-in and sessions:** the app never sees the platform's secrets. It
holds the instance URL and the instance's session cookie (in the Keychain).
Push tokens are registered with the platform together with a short-lived
proof minted by the instance, so a device can only subscribe to a salon it
is signed into.

**Push path:** instance event → platform (HMAC) → APNs over HTTP/2 with a
token-signed JWT (Node's `http2` and `crypto` cover it; no library).

## 6. Policies and the refund

The owner asked for a refund policy that makes sense and every policy needed
to stay out of trouble. The set, and where it lives:

| Document | Who it binds | Key terms (draft intent; a lawyer reviews in Phase 4) |
|---|---|---|
| **Terms of Service** | Kairo ↔ the business | one-off licence to run one Kairo for one business; hosting, updates and backups included; no monthly fee; the business's data is theirs and exportable at any time; Kairo may suspend for non-payment disputes or abuse; Australian law |
| **Refund Policy** | Kairo ↔ the business | **30 days, full refund, no reason required**, if requested from the Account page; the instance is then exported to them and deleted after 30 days. After 30 days: refunds only where the ACL requires one (major failure), never for change of mind. App Store purchases are refunded by Apple under Apple's policy — stated plainly, because it is true. |
| **Privacy Policy** (platform) | Kairo ↔ owners and visitors | what the platform holds (owner name, email, phone, ABN, payment references, provisioning records, device tokens), why, for how long, breach notification, how to delete |
| **Data Processing Terms** | Kairo ↔ the business, about *their* clients | Kairo hosts the business's client data, including health information, on infrastructure the business does not control; access only to operate the service; APP-aligned obligations; deletion on request; the business remains the responsible party to its clients |
| **Privacy notice template** for the salon's booking page | the business ↔ its clients | a fill-in-the-blanks notice the salon can publish; the treatment-record consent wording already exists in v1.52 |
| **Acceptable Use** | Kairo ↔ the business | no spam, no unlawful messaging, the Spam Act and ACMA rules are theirs to follow; what triggers suspension |

Refund mechanics: Account → "Cancel and refund" → confirmation → export
generated and emailed → platform issues the Stripe refund (web door) or tells
the owner to direct the buyer to Apple (app door) → instance suspended →
deleted at day 30 with DNS removed. The owner approves refunds after day 30
from the queue; inside 30 days it is automatic, because a policy that says
"no questions" and then asks questions is the kind the ACCC objects to.

## 7. What is added to the stack, and what each addition earns

Measured against a product with no dependencies today.

| Addition | Kind | Earns | Costs / trade-off |
|---|---|---|---|
| Kairo Platform service | new code, same zero-dependency Node + `node:sqlite` style, ~the size of `notify.js` + `api.js`'s public half | the whole self-serve path; the directory that does not exist today; push relay; flag queue | a second thing to run and back up; it is multi-tenant by nature but holds no client data; a compromise reaches six control verbs per instance |
| Instance control API (`/api/platform/*`) | ~300 lines in the product | settings at birth, password reset, plan, deletion, push events | one more secret per instance; the same HMAC pattern as the origin lock |
| iOS app | Swift, Apple frameworks | the listing, push, biometrics, widget, camera | a second codebase, an Xcode toolchain, an annual fee, review cycles; Apple's rules forever |
| Stripe Terminal iOS SDK | the only third-party dependency | Tap to Pay on iPhone | SDK updates twice a year or so; optional per business |
| Render API, Cloudflare API, Resend API, ABR API, App Store Server API, APNs | plain HTTPS from the platform, no SDKs | provisioning, DNS, email connect, ABN check, purchase verification, push | each is a free-tier or per-use API; each can change; each is wrapped in one file with one test |
| `release` branch | process | a canary between a commit and every live salon | the owner (or a script) promotes releases |

Not added: Vercel, Supabase, a framework, a queue, a second database, an
ORM, a container runtime. The Phase 1 reasoning stands.

## 8. Trade-offs accepted

- **Email may be unconnected for a while after purchase.** Chosen over a
  platform-paid Resend plan. Mitigated by nudges and the banner; the owner's
  "do it for me" task is the backstop.
- **Two prices for one product**, or a A$91 haircut on every in-app sale.
  Chosen because the owner wants the in-app prompt; the marketing sends
  people to the web door first.
- **A hybrid app.** Chosen over a full native rewrite of 11,000 lines of UI
  that works. The 4.2 risk is real and is answered with genuine native
  capability; a rejection is planned for in Phase 7, and a fallback is more
  native screens, not a different architecture.
- **The platform is a new single point of failure for signup and push** —
  but not for any salon's bookings. If the platform is down, every Kairo
  keeps working; nobody new can sign up and nobody gets a push until it is
  back. That is the right way round.
- **Apple owns refunds for app-door purchases.** Stated in the policy.
- **The owner remains a human in the loop** for flagged signups, late
  refunds, "do it for me" email tasks, and own-domain booking addresses.
  Each is a queue item on a phone, not a console session.

## 9. Order of work (preview of Phase 6; each slice ships alone)

1. Test harness rebuilt and committed (nothing else moves without it).
2. Instance: `KAIRO_ADMIN_PASSWORD_HASH`, control API, plan states, event
   webhook, native-client mode, account deletion. All inert without env vars.
3. `release` branch; the two live salons moved to it (Phase 5).
4. Platform: directory, provisioning state machine against a *scratch*
   Render workspace, web signup with Stripe Checkout, flag queue, operator
   console.
5. Setup checklist and the three connectors, starting with Resend.
6. Policies published; refund flow.
7. iOS app 1.0: sign-in, tabs, web views, push, biometrics, IAP, deletion,
   demo account. TestFlight → submission.
8. Widget, camera, Tap to Pay (1.1). Android (Phase 7+).

## 10. Decisions for the owner before Phase 3

| # | Decision | Recommendation |
|---|---|---|
| D8 | In-app price | A$519.99 (nets ≈ A$400) rather than A$399.99 (nets ≈ A$309). Website stays A$400. |
| D9 | Refund window | 30 days, no reason, automatic; after that ACL only. |
| D10 | Phone verification at signup via the platform's own ClickSend | Yes: the one SMS Kairo pays for, ~6¢ per signup. |
| D11 | Stripe connector order | Paste-a-restricted-key first (exists), OAuth second. |
| D12 | The `release` branch | Adopt; it is the safety the two live salons do not have today. |

---

## Amendments

- **2026-09-05, from Phase 3.** The provisioner gets a **host driver**
  interface: `render` (as designed above) and `vps` (DigitalOcean Sydney,
  running the `new-business.sh` model over SSH from the platform). Reason:
  on Render a salon costs ≈ A$140/year to host against a one-off $400; on a
  VPS ≈ A$21. See `03-phase-3-what-it-costs.md` §3–4 and decision D13.
- **2026-09-05, owner's decisions on Phase 2.** The app is free to download;
  the $400 is an order placed inside the app for access (as §2's app door).
  Refund window is **14 days**, no reason, automatic (not 30). D10 accepted.
  A platform Stripe account will exist. D8 (in-app price) and D12 (`release`
  branch) were not addressed and are carried as open, with D12 assumed
  adopted unless the owner objects.
