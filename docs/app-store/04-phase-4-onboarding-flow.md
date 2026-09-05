# Phase 4 — The onboarding flow, end to end

*Status: draft for the owner's approval. Assumes the Phase 2b architecture
(one shard, one file per salon). Every step says who does it: **auto**,
**business**, or **owner**.*

---

## 0. The whole journey on one page

```
 1  Sees the post ─► 2 Lands (web or App Store) ─► 3 Creates account ─► 4 Verifies email + phone
                                                                              │
 8  Sets up ◄─ 7 "Your Kairo is ready" ◄─ 6 Provisioned (seconds) ◄─ 5 Pays $400 (Stripe or IAP) + screening
    │
 9  Connects email · texts · payments (each optional, each theirs) ─► 10 Shares the booking link ─► taking bookings
```

Steps 1–8 are **auto**. Step 9 is the **business**, guided, with "ask Kairo"
routing to the **owner**. The owner otherwise appears only when screening
raises a flag (§5) or a refund is requested after day 14 (§6).

## 1. Seeing the post → landing

Two doors, one product (Phase 2 §2).

- **Web:** the Instagram link is `kairobookings.com/start`. The page says
  what Kairo is, the price (**A$410 once, nothing monthly, ever**), what is
  included (hosting, updates, backups, the app), what is *not* (their own
  Resend, ClickSend and Stripe accounts, which are free or pay-as-you-go and
  theirs), and a live demo link. One button: *Create your Kairo*.
- **App Store:** the listing describes the same product. The app is free to
  download; opening it shows *Sign in* and *Create your Kairo*. Nothing in
  the app mentions the website's price.

## 2–3. Creating the account (auto)

One form, both doors, posting to the platform:

| Field | Validation | Why |
|---|---|---|
| Business name | 2–80 chars | the salon |
| Your name | required | the owner user's name |
| Email | format; not already an owner | sign-in identity; verification |
| Mobile number | AU format | verification; ACMA-ready |
| ABN | 11 digits, checksum; live ABR lookup: active, entity name shown back | screening (§5); the business's legal identity for policies |
| Web address | `<slug>.kairobookings.com`, suggested from the business name, editable, checked live for availability and reserved words | their address; unique by construction |
| Password | Kairo's existing rules (`src/password.js`: 10+ chars, breach check) | the same rules the workspace enforces |
| Tick: *I agree to the Terms, Refund Policy and Privacy Policy* (links) | required | §6 |

The platform creates the owner account and a business record in state
`created`. Nothing is provisioned yet; nothing is charged.

## 4. Verification (auto)

- **Email:** a 6-digit code (not a link — links break inside the app), valid
  10 minutes, 5 attempts. Resend after 60 s.
- **Phone:** a 6-digit code by SMS from the platform's ClickSend (the one
  text Kairo pays for, ≈ 6¢). Same limits.

Both must pass before payment is offered. State → `verified`.

## 5. Payment and screening (auto; owner on flag)

**Web door:** Stripe Checkout, A$410, card or Apple Pay / Google Pay in the
browser, 3-D Secure when Stripe asks. Receipt from Stripe. The platform acts
only on the `checkout.session.completed` webhook (signed), never on the
browser's return.

**App door:** StoreKit 2 purchase of the non-consumable "Kairo — one salon,
for good" at A$519.99. The app sends the signed transaction to the platform,
which verifies it with the App Store Server API and also listens to App
Store Server Notifications for refunds. Apple emails the receipt.

**Screening, immediately after payment confirms** — all automatic, each
producing a pass or a flag, never a refusal:

| Check | Pass | Flag |
|---|---|---|
| Payment risk | Stripe Radar normal / Apple verified | Radar "elevated" or "highest" |
| ABN | active; entity name shares a word with the business name, or the trading name matches | cancelled ABN, or no overlap at all |
| Duplicates | no other business with this ABN | same ABN already has a Kairo; same business name in the same suburb |
| Velocity | first signup from this IP/device today | third or more |
| Slug | not a brand or reserved word | matches a well-known salon chain or a protected term |

Pass → provision now. Flag → state `flagged`; the buyer sees *"We're just
checking a couple of details — you'll have an email within a few hours"*;
the **owner** gets a push and a queue item with every reason and two
buttons: *Approve* (provisions) or *Refund* (refunds in full, emails a
plain-language note). Two flagged signups a month is the expected volume.

## 6. Provisioning (auto, seconds)

On the shard: create `tenants/<slug>/`, open a new `kairo.db` (the existing
`bootstrap()` builds the schema and defaults), write `tenant.json` (slug,
public URL, plan `active`, price paid, door, created-at), create the owner
user with the password hash the platform already holds, apply the business
name, phone, ABN, time zone (from the phone's region or the browser),
currency `AUD`, tax rate 10%, and the operator-only defaults (SMS off, backups
weekly, automations off). **Skip the demo seed**: a real business starts
empty and meets the wizard, exactly as the existing "start fresh" path does.
Insert the registry row. State → `ready`.

The wildcard domain already resolves, the certificate already exists; the
address works the moment the folder does.

## 7. "Your Kairo is ready" (auto)

- **Web door:** the page flips to a done screen with their address, a *Sign
  in* button, and *Get the app* (App Store link). Email with the same.
- **App door:** the app signs them straight in.
- The email also carries: the booking link, the policies, and *what happens
  next* — the setup checklist, and a plain line: *"Confirmations and
  reminders start sending once you connect your email (2 minutes)."*

## 8. First sign-in: the wizard, then the checklist (auto → business)

The existing wizard (business, hours, team, services, deposits, phone
install) runs as today. It ends on the new **Setup checklist**, which also
lives permanently at the top of Settings until complete:

| Item | Status shown | Whose | Detail |
|---|---|---|---|
| ☐ Connect your email so confirmations send | amber until done | business (or *ask Kairo*) | Phase 2 §3.1, three routes |
| ☐ Connect texts (optional, ~6¢ each, your own ClickSend) | grey "optional" | business | Phase 2 §3.2 |
| ☐ Register your text sender name with ACMA (if you chose a name) | open until ticked | business | tracked, with the help link; sends labelled *Unverified sender* meanwhile |
| ☐ Take card payments (optional): Stripe key, Square, or paste a payment link | grey "optional" | business | Phase 2 §3.3 |
| ☐ Put the booking link in your Instagram bio and Google profile | — | business | copy button, QR code (exists) |
| ☐ Send yourself a test booking | — | business | opens `/book` |
| ☐ Install Kairo on your phone / get the app | — | business | App Store link; home-screen instructions stay for the web |

Each connector ends in a live test the business can see (a real email, a
real text, a A$0.50 test charge refunded), because a green tick that was not
earned is the kind that fails at 9 pm on a Saturday.

## 9. Taking bookings

Nothing new: `/book` on their address, the ⚡ on the calendar, the owner's
push (new) and email (existing) on every online booking.

## 10. The unhappy paths

| What happens | What the system does | Human? |
|---|---|---|
| **Abandons before paying** | state stays `verified`; email at +1 h (*"your address is held for 7 days"*) and +3 d; slug released at day 7 | no |
| **Payment fails** (declined, 3DS abandoned) | Stripe's own retry UI; state unchanged; the +1 h email links back to pay | no |
| **Pays, then app/browser closes before "ready"** | provisioning runs off the webhook, not the client; the email arrives regardless | no |
| **Verification fails** (wrong number, no SMS) | 5 attempts then a 15-minute lock; *change number* allowed once before payment; email fallback to a magic code sent to the verified email if SMS never arrives twice | no |
| **Flagged** | §5 queue; buyer told within the hour by email what to expect | **owner** |
| **Two people, one salon name** | slug uniqueness makes the second choose another; a same-ABN or same-name-same-suburb second signup is flagged | owner if flagged |
| **Refund inside 14 days** | Account → *Cancel and refund* → confirm → export generated and emailed → Stripe refund issued automatically (web) / *"ask Apple: here's how"* (app) → tenant suspended → deleted at day 30 | no |
| **Refund after 14 days** | request lands in the owner's queue with the ACL note; owner decides | **owner** |
| **Chargeback / Apple refund notification** | suspend the tenant (booking page shows *"this salon isn't taking online bookings right now"*, owner login shows why); keep the file 90 days; never delete on a dispute | owner informed |
| **Wants their data out** | Settings → Backups → *Download a copy* (whole database) and Clients → *Export CSV* (exist today); on deletion the export is emailed first | no |
| **Wants to leave** | Account → *Delete my business* → export → 7-day cooling-off → tenant deleted, registry row marked, address released after 90 days | no |
| **Forgot password** | *Forgot?* on the login → platform verifies the email code → control API issues a one-time reset on that tenant | no |
| **Email never connected** | amber banner; day-1 and day-3 nudges; the *ask Kairo* button on the banner | owner if asked |
| **Resend refuses their domain / DKIM never verifies** | the connector shows the exact record and Resend's status, polls for 24 h, then offers *ask Kairo* | owner if asked |
| **Signup from outside Australia** | allowed; ABN optional for non-AU with a flag; currency and tax from country; SMS via their own ClickSend still works | owner if flagged |
| **Apple reviewer testing** | a permanent demo tenant with reviewer credentials, IAP in sandbox | no |

## 11. Where the owner is, in total

1. Flagged signups (approve / refund).
2. Refund requests after day 14.
3. "Ask Kairo" email tasks (signup at Resend + one paste), and rare own-domain
   booking addresses.
4. Promoting a release.

Each is a push notification and a queue item in the same iOS app, on an
operator tab that only the owner's account sees.

## 12. Policies

Brief statements, drafted in [`04-policies.md`](04-policies.md), linked from
the signup form, the App Store listing, the login footer and the Account
page. They are written to be read by a hairdresser in two minutes.

---

## Amendments, 2026-09-05

- **One price, web only** (pending confirmation; see `02b` amendment): the
  "App Store door" in §1 and §5 is removed. The app is free and sign-in only.
  Everything else in this document is unchanged; §7's "app door" lines and
  the App Store refund rows in §10 fall away.
- **Texts:** every business has **its own dedicated number on its own
  ClickSend account**, bought inside Kairo (see `04b` §2). No shared or lent
  numbers, ever. The number costs the business about A$20 a month, paid to
  ClickSend.
