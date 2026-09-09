# In plain terms: what the owner pays, and how "Business ABC" gets Kairo

*Written 2026-09-05. Corrected 2026-09-09: two decisions went the other way
after this was drafted, and both cost real money if followed — the in-app
purchase door, and the D-U-N-S number. Both are struck out below.*

---

## Part 1 — What you pay

### Once, before launch

| What | How much | Why |
|---|---|---|
| Apple Developer Program | US$99 a year (≈ A$150) | Without it there is no App Store listing. Renews yearly. |
| ~~D-U-N-S number for the company~~ | **not needed** | Only an *organisation* enrolment needs one. You are enrolling as an **individual / sole proprietor** — no D-U-N-S, no company, no ASIC fee, and days rather than weeks. Converting to a company later keeps the same Apple ID, Team ID, certificates and apps. See `07-apple-account-plan.md`. |
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
| Website — the only door | A$410 | ≈ A$402.70 | Stripe (1.7% + 30¢) |
| Every sale | | − 6¢ | the verification text |

~~The App Store door at A$519.99 was removed on 5 September 2026.~~ Selling
through the app would hand Apple 15% and force the price up by A$110 to earn
the same, for a product a salon buys once on a website. The app is free and
sign-in only, and there is no StoreKit code in `ios/`.

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
- Their address works instantly, because a Cloudflare Worker sits in front of
  every `*.kairobookings.com` address and forwards it to the shard, carrying
  the real hostname in a signed header. (The wildcard *custom domain* this
  line once credited never worked on this account — the diagnosis is in
  `MOVE-DAY.md`. The Worker replaced it, and lifted the cap on how many
  salons can exist at all.)
- Sends the welcome email with the booking link, the policies, and *"your
  confirmations start sending once you connect your email — 2 minutes."*

**You do: nothing.** You get a push: *"ABC Hair Studio just joined — A$410."*

### The App Store is not a second door

ABC can find Kairo on the App Store and download it free, but the app only
ever shows **Sign in**. There is no *Create your Kairo* in it, no price, and
no link to the website's purchase — deliberately, and it is what
`ios/Kairo/RootView.swift` does today: three states, and buying is not one
of them.

So an owner who arrives via the App Store first downloads the app, finds they
need an account, and goes to the website to buy one. That is the intended
path, not a gap.

### Their first sign-in

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

1. Enrol in the Apple Developer Program **as an individual** — no D-U-N-S,
   no company. About A$149 and one to two days.
2. Create the app record in App Store Connect and generate the API key for
   the build machines. **No in-app purchase** — the app sells nothing.
3. ~~Point `*.kairobookings.com` at the shared Render service.~~ **Already
   done, and not the way this said.** The wildcard custom domain does not
   work on this account; a Cloudflare Worker forwards every salon address to
   the shard instead. It is deployed and live.
4. Deploy the platform service (`platform/render.yaml`) and give it its
   environment: Stripe key and webhook secret, the shard's control-API key,
   Resend key and sending address, ClickSend username and key, and a
   Cloudflare token scoped to the zone. Miss the sending credentials and
   signups stall at the code screen — the server now says so at boot.
5. Fill in the bracketed bits of the policies (legal name, ABN, support
   email). `node scripts/launch-check.mjs` fails until you do.

Run `node scripts/launch-check.mjs` at any point to see which of these are
still outstanding, rather than trusting this list to stay current.

After that, the only things you ever do are in Part 2's "You" column.
