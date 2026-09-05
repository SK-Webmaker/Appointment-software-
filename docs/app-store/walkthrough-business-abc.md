# In plain terms: what the owner pays, and how "Business ABC" gets Kairo

*Written 2026-09-05 for the owner's confirmation before Phase 5. Everything
here follows from the approved documents; nothing new is decided.*

---

## Part 1 — What you pay

### Once, before launch

| What | How much | Why |
|---|---|---|
| Apple Developer Program | US$99 a year (≈ A$150) | Without it there is no App Store listing. Renews yearly. |
| D-U-N-S number for the company | free | Apple asks for it when a business enrols. Takes a few days. |
| Prepaid credit in *your* ClickSend account | A$20 | Sends the one verification text per new signup (≈ 6¢ each). Lasts ~300 signups. |
| Stripe account | free | Takes the A$410 on the website. |
| Everything else — Cloudflare, ABN lookup, Apple push, GitHub build machines, Codemagic | free | Free tiers, and none of them stop a salon working if they change. |

**Total before launch: about A$170.** No Mac, no lawyer, no new domain.

### Every month

| What | Now (two salons, today's setup) | After launch (any number of salons) |
|---|---|---|
| Render: the one service that runs every salon (2 GB) + a 10 GB disk | — | US$27.50 |
| Render: the small platform service (signup, payments, provisioning) + 1 GB disk | — | US$7.25 |
| Render: Sha's and Hora's own services | US$14.50 | **gone after Phase 5** — they move onto the shared service |
| Render workspace plan | free | free until about 5–10 salons' worth of traffic, then Pro US$25 flat |
| Bandwidth beyond the plan | — | ≈ US$0.15 per GB; roughly US$0.30 per salon per month |
| **Total** | **≈ US$14.50 (A$22)** | **≈ US$35 (A$52) at launch · ≈ US$60 (A$90) at 10 salons · ≈ US$116 (A$175) at 200 salons** |

Not on the list, because they are the salon's own accounts, not yours:
Resend (free tier), ClickSend (they prepay), Stripe or Square (their fees,
their money).

### Every sale

| Door | Customer pays | You receive | Who kept the rest |
|---|---|---|---|
| Website | A$410 | ≈ A$402.70 | Stripe (1.7% + 30¢) |
| App | A$519.99 | ≈ A$401.80 | Apple (GST first, then 15%) |
| Any door | | − 6¢ | the verification text |

A refund inside 14 days returns the customer's money in full; on the web door
Stripe keeps its ≈ A$7 fee, so a refund costs you that.

### Every year

Apple US$99, domain renewal ≈ A$20. That is all.

---

## Part 2 — Business ABC gets Kairo

Say "ABC Hair Studio" in Richmond sees your post. Two doors; both end in the
same place.

### Door 1 — the website

**ABC does** (about 5 minutes):

1. Taps the link in your bio → `kairobookings.com/start`. Reads: A$410 once,
   nothing monthly, what's included, what's theirs (their own email, text and
   card accounts, free or pay-as-you-go).
2. Fills in one form: business name *ABC Hair Studio*, their name, email,
   mobile, ABN, and picks their address — Kairo suggests
   `abchairstudio.kairobookings.com` and shows it is free — plus a password.
   Ticks the box for the Terms, Refund Policy and Privacy Policy.
3. Types the 6-digit code emailed to them, then the 6-digit code texted to
   them.
4. Pays A$410 on Stripe's page — card, Apple Pay or Google Pay.
5. Watches the "setting up your Kairo" screen for a few seconds. It flips to
   **Your Kairo is ready**: their address, a *Sign in* button and *Get the
   app*. The same arrives by email.

**Kairo does, automatically, in those seconds:**

- Confirms the payment from Stripe's own notification (never from the browser).
- Screens the signup: Stripe's fraud score is normal; the ABN is active and
  its registered name matches "ABC"; nobody else has that ABN or that
  address; not the fifth signup from that phone today. All pass.
- Creates ABC's own database file in a folder named `abchairstudio`, with
  ABC's owner login (the password they chose, already hashed), business
  name, phone, ABN, Melbourne time zone, AUD, 10% GST, texts off, backups
  weekly, marketing automations off, no demo data.
- Records ABC in the directory: address, plan *paid in full*, door *web*,
  date.
- Their address works instantly, because `*.kairobookings.com` was pointed at
  the shared service once, months ago, with its certificate already issued.
- Sends the welcome email with the booking link, the policies, and *"your
  confirmations start sending once you connect your email — 2 minutes."*

**You do: nothing.** You get a push: *"ABC Hair Studio just joined — A$410."*

### Door 2 — the App Store

**ABC does:** searches "Kairo" on the App Store, downloads the free app, taps
*Create your Kairo*, fills in the same form, types the same two codes, and
Apple's payment sheet appears: **A$519.99**, Face ID, done. The app signs
them straight in.

**Kairo does:** verifies the purchase with Apple's servers, screens exactly
as above, creates the same folder and file, and the app is live on their
phone.

**You do: nothing.** Same push.

### Their first sign-in (either door)

The existing setup wizard runs: business details and hours, the team, the
service menu, deposits (optional), "put Kairo on your phone". Then the
**Setup checklist** appears at the top of Settings and stays until done:

**Connect your email** — amber, because confirmations cannot send yet.

- ABC taps it. Step 1: *Create a free Resend account* — opens Resend, ABC
  signs up with their own email (3 minutes; it is their account forever).
  Step 2: *In Resend, create an API key called "Kairo setup" and paste it
  here.*
- The moment they paste it, Kairo — using their key — adds
  `abchairstudio.kairobookings.com` as a sending domain in **their** Resend,
  reads back the three DNS records Resend wants, writes those records into
  your Cloudflare zone itself, waits for Resend to confirm verification
  (usually under a minute), creates a second key that can **only send, only
  from that domain**, keeps that one, sets the From address to
  `hello@abchairstudio.kairobookings.com` and replies-to ABC's real inbox,
  sends ABC a test email, then deletes the "Kairo setup" key from their
  account. Green tick. Their account, their free tier, a key that can only do
  one thing.
- If ABC has their own domain (like Hair By Sha): they choose *Use my own
  domain*, Kairo shows the three records to add at their registrar, and
  finishes the same way when they appear.
- If ABC does not want to touch Resend: they tap *Ask Kairo to do it for
  me*. **You** get a queue item with everything prefilled — the alias
  `abchairstudio@kairobookings.com` (which lands in your Gmail through the
  catch-all, as today), the business name, the Resend signup link. You sign
  up, create the "Kairo setup" key, paste it into your operator screen, and
  the platform runs the identical steps. About five minutes of your time,
  only when asked.

**Connect texts (optional)** — grey, marked optional and priced: *"Texts come
from your own ClickSend account. You pay ClickSend, about 6¢ a text; Kairo
adds nothing."* ABC creates the account, pastes username and API key; Kairo
checks the balance live, sends a test text, and asks: a **sender name** like
"ABCHair" (which they must register with ACMA using their ABN — Kairo tracks
it as an open item and labels their texts *unverified sender* until they
confirm) or a **dedicated number** (~A$20/month to ClickSend, works today).

**Take card payments (optional)** — grey. Stripe: paste a restricted key
from their own Stripe (the guide lists the exact permissions) or, later,
*Connect with Stripe* in one click. Square: nothing to connect; they charge
on their reader and tap *Paid*. Or paste any payment link they already have
and the till gets a *Send payment link* button.

**Register your text sender with ACMA** — open until they tick it.

**Put the booking link in your bio** — copy button and QR code.

**Send yourself a test booking** — opens their `/book` page.

**Get the app** — App Store link (if they came through the web).

### From then on

Customers book at `abchairstudio.kairobookings.com/book`. Confirmations and
reminders go out from ABC's Resend, texts from ABC's ClickSend, deposits
into ABC's Stripe. ABC gets a push on their phone for every online booking
and cancellation. Their whole business is one file, backed up to their inbox
weekly, snapshotted daily by Render, copied off-site nightly by the
platform, and downloadable from Settings any time.

### When it goes wrong

| | What happens | You |
|---|---|---|
| ABC pays but the ABN name doesn't match | signup is **flagged**; ABC is told "checking a couple of details, within a few hours"; you get a push with the reasons and two buttons: *Approve* or *Refund* | one tap |
| ABC's card declines | Stripe lets them retry; nothing is created; a reminder email an hour later | nothing |
| ABC abandons before paying | address held 7 days, two nudge emails, then released | nothing |
| ABC wants a refund on day 9 | Account → *Cancel and refund* → full refund issued automatically, their data emailed to them, their Kairo switched off, file kept 30 days then deleted | nothing (a push tells you) |
| ABC wants a refund on day 40 | lands in your queue with the consumer-law note; you decide | one tap |
| ABC never connects email | amber banner in their Kairo; nudges on day 1 and 3; *Ask Kairo* button | only if they ask |
| ABC forgets their password | *Forgot?* → code to their email → new password | nothing |
| ABC leaves | Account → *Delete my business* → full export emailed → 7-day cooling-off → gone | nothing |

---

## Part 3 — What you set up once, before the first ABC

These are one-time, and Phase 6 walks through each with you:

1. Enrol in the Apple Developer Program (D-U-N-S first).
2. Create the app record in App Store Connect and the A$519.99 in-app
   purchase; generate the App Store Connect API key for the build machines.
3. Point `*.kairobookings.com` at the shared Render service and let Render
   issue its certificate. Done once, never again.
4. A Cloudflare API token scoped to the zone (the old one expired), a
   Stripe account with its webhook, your ClickSend account for verification
   texts, an ABN Lookup key, and a free off-site backup bucket — each pasted
   once into the platform's environment.
5. Fill in the bracketed bits of the policies (legal name, ABN, support
   email).

After that, the only things you ever do are in Part 2's "You" column.
