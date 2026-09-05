# Phase 4b — Email and texts, made easy for a non-technical owner

*Amends Phase 2 §3 and Phase 4 §8 after the owner's direction of 2026-09-05:
the API-key steps for Resend and ClickSend are confusing for most salon
owners; done wrong, they mean no emails and no texts; the ABN must be
optional; ease must be prominent.*

---

## 0. The principle

**The business never has to understand what an API key is.** The default
path for email is *Kairo sets it up for you*. Where the business has to be
involved (paying ClickSend), Kairo asks for exactly one thing, checks it live
the moment it is pasted, and does everything else through the provider's
API — including choosing and buying the phone number. Nothing goes green
until a real email or a real text has actually arrived.

## 1. Email — default: Kairo sets it up

What the business sees, on the checklist and the dashboard, the moment their
Kairo is ready:

> **Your emails** · ● *Kairo is setting this up for you — usually within a
> few hours. You don't need to do anything.* &nbsp; [*I'd rather do it myself*]

What happens behind it:

1. The platform opens a task in **the owner's queue**: *Email for ABC Hair
   Studio.* One card, three lines, every value prefilled with a copy button:
   - the account email `abchairstudio@kairobookings.com` (your catch-all,
     as today) and a strong generated password (stored by the platform);
   - **Open Resend → Sign up** with those;
   - the verification email lands in your Gmail through the catch-all — click
     it — then **API keys → Create → name it "Kairo setup", Full access →
     paste here:** `[ … ]`.
2. The moment you paste, the platform (not you) does the rest against that
   account: adds the sending domain, writes the DNS into Cloudflare, waits for
   Resend to verify, mints a **send-only key restricted to that one domain**,
   installs it into ABC's Kairo, sets From and reply-to, deletes the setup
   key, and **sends ABC a real test email**. The business's tile turns green
   only when Resend reports that email delivered.
3. ABC gets a push and an email: *"Your confirmations and reminders are on."*

Your part is about **three minutes of copy-and-paste per business**, with
nothing to decide and nothing that can be typed wrong: the only free-text
field is the pasted key, and it is checked live (`GET /domains` with it)
before anything else runs. At 20 signups a month that is an hour a month.

**"I'd rather do it myself"** shows the same three lines to the business with
*their* email in place of the alias, and the identical automation runs on
paste. **"Use my own domain"** (Sha's case) is inside that path.

**Handing the account over later**, if a business ever asks: in Resend,
change the account email to theirs. A one-line instruction in Settings.

Why this is safe to promise: everything after the paste is an API call that
either succeeds and is verified by a delivered email, or fails visibly with
the exact reason on your card. There is no "looks set up but isn't".

## 2. Texts — optional, their own money, no ABN needed

What the business sees:

> **Texts (optional)** · *Reminders by text cut no-shows. Texts come from
> your own ClickSend account — you pay ClickSend about 6¢ a message and about
> A$20 a month for your number; Kairo adds nothing.* &nbsp; [*Set up texts*]

The flow, four screens, each with a picture of exactly where to click:

1. **Create a ClickSend account** — a button opens ClickSend's signup. The
   account has to be theirs because *they* pay: their card goes on it, and
   the credit is theirs.
2. **Add A$20–50 of credit** in ClickSend (their card).
3. **Paste your API key** — one field, with a picture of the dashboard page
   it is on (it is on ClickSend's front page under *API credentials*). The
   instant they paste, Kairo calls ClickSend and shows: *"Connected — ABC Hair
   Studio, balance A$30.00."* A wrong paste says so in plain words, not later.
4. **Pick your number.** Kairo lists available Australian mobile numbers from
   ClickSend's API (`/v3/numbers/search/AU`), with the monthly price, and
   **buys the one they tap** (`/v3/numbers/buy/{number}`) using their key
   [1]. Registration details ClickSend needs for the number (business name,
   address, contact) are filled from what ABC already gave Kairo. Then a
   **real test text to the owner's phone**. Green only when it arrives.

**No ABN, no ACMA.** A dedicated number is not an alphanumeric sender ID and
is not what the Sender ID Register regulates [2]. The register only bites if
a salon wants their *name* to show instead of a number. That option is on a
separate, clearly marked *Advanced* line — *"Show your salon's name instead
of a number (needs your ABN and a registration with ACMA)"* — and is off
unless they ask for it. Most salons will never open it.

**The starter-sender trick goes away.** Today the owner lends a number so
texts work on day one. With the number bought in-app in step 4, nothing is
lent and nothing has to be swapped back later.

## 3. Payments — unchanged, already optional and clear

Stripe (paste a restricted key, with the exact permissions pictured), Square
(tap Paid), or paste any payment link. All three optional. The only change:
the Stripe screen also checks the pasted key live and names the account it
belongs to.

## 4. ABN at signup — optional

The signup form asks for an ABN with *"optional — speeds up approval"*. When
given, it is checked against the ABR and used for screening. When absent,
nothing is flagged for its absence alone; screening relies on the payment
risk score, the two verification codes and the duplicate and velocity
checks. The ABN is asked for again only if the business later turns on the
*Advanced* alphanumeric sender, because ACMA requires it there.

## 5. Where the owner is now, in total

| Task | Frequency | Time |
|---|---|---|
| **Email setup for a new business** (default path) | every signup, unless they chose *myself* | ≈ 3 minutes, copy and paste, prefilled |
| Flagged signups | a few per hundred | one tap |
| Refunds after 14 days | rare | one tap |
| Promote a release | per release | a minute |

The email task is a deliberate trade the owner chose: three minutes of the
owner's time against a step most salon owners would get wrong.

## 6. Tested before any business sees it

The owner's condition is *no failures*. What that means in practice for
these two connectors, and for the whole flow (Phase 6 details the harness):

- **Every connector step has an automated test against the real provider's
  test surface**: Resend's API with a test domain on the platform's own
  account (Resend's `delivered@resend.dev` addresses confirm delivery without
  a real inbox); ClickSend's account and number endpoints against a Kairo
  test account with a real dedicated number bought once for the purpose;
  Stripe in test mode; Apple's sandbox for the purchase.
- **Every unhappy path in Phase 4 §10 is a test**, including a wrong key, a
  truncated key, a domain that never verifies, a number purchase that fails
  for insufficient credit, a Stripe webhook that arrives twice, a purchase
  the App Store later refunds.
- **Every test is broken on purpose once** and must fail (the house rule).
- **Nothing is live until the whole flow has run end to end in CI against a
  scratch shard** — a new tenant created, paid for in test mode, email
  connected on a test Resend account, a booking made on its booking page, a
  confirmation delivered, a refund issued — on every commit.
- **Releases go to the demo tenant first**, then the owner's own, then the
  `release` branch. No live salon is ever the first to run new code.

---

Sources: [1] ClickSend API — purchase a dedicated number:
https://developers.clicksend.com/docs/messaging/sender_ids/numbers/other/purchase-dedicated-number ;
numbers overview: https://developers.clicksend.com/docs/messaging/sender_ids/numbers ·
[2] Twilio, *Australia's SMS Sender ID Register* (alphanumeric IDs only):
https://www.twilio.com/en-us/blog/insights/australia-sender-id-register

---

## Amendment, 2026-09-05 — the salon's own existing number

The owner clarified: the business does not buy a number. It uses **the
mobile number it already has** — the salon's own phone — as the sender.
ClickSend supports exactly this ("Own Numbers"): the number is verified by a
one-time code sent to that handset, then texts go out showing that number and
**replies land on the salon's own phone**, which is better than a rented
number nobody answers [1][2].

**The flow inside Kairo** (no dashboard, all through ClickSend's API with the
key they pasted):

1. *"Which number should your texts come from?"* — prefilled with the
   business phone they gave at signup; editable.
2. Kairo calls `POST /v3/own-numbers/verifications` for that number.
   ClickSend texts a 6-character code to the salon's phone.
3. *"Type the code we just sent to 04xx xxx xxx"* — Kairo submits it with
   `POST /v3/own-numbers/verifications/{id}`. Status `APPROVED`.
4. Kairo sets it as the sender and sends **a real test text** to the same
   phone. Green when it arrives.

**Three facts, stated on the screen because they matter:**

- **It must be a mobile.** A landline cannot receive the code. If the
  salon's business number is a landline, Kairo says so and offers the
  owner's mobile or, as the fallback, a dedicated number bought in-app
  (§2 above, ~A$20/month). Nothing is bought unless they choose it.
- **Re-verify once a year.** ClickSend requires it; Kairo shows a reminder a
  month before, and the re-verify is the same two taps.
- **Replies go to the salon's phone.** *"Can I move to 3?"* arrives where a
  human reads it. Kairo never reads their texts.

No ABN, no ACMA registration, no monthly number fee. The only cost is the
per-text price on their own prepaid ClickSend balance. Everything §2 says
about the account being theirs, the key checked live, and the tile going
green only on a delivered text, still holds.

Sources: [1] ClickSend Help, *Verify your own mobile number for sending
messages* — https://help.clicksend.com/article/0hhs6ba7dt-verify-your-own-mobile-number-for-sending-messages ;
*Guide to own numbers* — https://help.clicksend.com/en/articles/44194-guide-to-own-numbers ·
[2] ClickSend API, Own Numbers — https://developers.clicksend.com/docs/messaging/sender_ids/own-numbers/other/request-own-number-verification-otp
