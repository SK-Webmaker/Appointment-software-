# From here to an app people download, pay for, and use

*Written 15 September 2026. Everything in the "where you are" section was
checked against the live services on the day, not recalled.*

---

## First, one correction worth more than the rest of this document

You said **subscribe**. Kairo does not have subscriptions. It charges **A$410
once**, forever, no monthly fee and no commission — that is in
`platform/render.yaml` as `KAIRO_PRICE_CENTS`, in the Terms, and it is the
actual pitch. If you want subscriptions, that is a different business decision
with real consequences, and it is covered at the end.

But the reason this goes first is **Apple**.

### The app must stay free, and must never sell anything

Kairo's iPhone app is a shell around the same web app — sign in, see your book,
get a push when somebody books. It has no prices, no "Get Kairo" button and no
sign-up. I checked: there is no purchase surface anywhere in `ios/Kairo/`.

**Keep it that way.** This is the pattern every B2B app uses — Xero, Square,
Shopify. The business buys the service on the web; the app is a free companion
you sign into. Apple accepts that.

What gets an app rejected, or hit for 15–30% of every sale:

- a price shown in the app
- a "buy" or "subscribe" button in the app
- a link from inside the app to the page where you pay
- a paywall in front of the app's own features

Selling a **digital subscription** to consumers inside an app means Apple's
In-App Purchase and Apple's cut. On A$410 that is **A$61–123 per sale**, for
nothing you would otherwise pay for.

> **So: the app signs people in. It never sells.** The sale happens on
> `kairobookings.com`, before the app is ever opened. Somebody who downloads the
> app without an account should be told to visit the website — not handed a
> link that opens a checkout.

If you later want subscriptions, read the last section before changing a price.

---

## Where you actually are

Better than it feels, and worse in one specific place.

| | |
|---|---|
| Two real businesses trading on Kairo | **Hair By Sha** and **Horahaircutz** |
| Both on the shared shard | ✅ since 15 September |
| The software | 255 tests, 115 deliberate breakages all caught |
| The front door | a Cloudflare Worker routing every salon |
| The thing that sells Kairo | **built, never deployed** |
| The iPhone app | **builds, never submitted** |
| Blocking launch | **5 things** — the seller name was settled 15 September |

The five that were invisible: `kairobookings.com/privacy`, `/support`,
`/terms`, `/refunds` and `/start` all **404**. The policies exist at
`/legal/privacy` and friends; they are simply not where the App Store listing
points. Apple opens Privacy and Support during review, so both being 404 is a
rejection rather than a delay. **And no support page exists anywhere** — that
one has to be written, not repointed. (One now exists in
`platform/public/support.html`, ready to publish.)

---

## The critical path

Five phases. The order is not a preference — each one is genuinely blocked by
the one above it.

```
1. Decide who sells Kairo        ── blocks everything with a contract in it
2. Put the policies somewhere    ── blocks the App Store submission
3. Stand up the platform         ── blocks anyone buying at all
4. Apple                         ── blocks the app existing
5. Submit, and sell one          ── the end
```

Phases 1 and 4 can run at the same time. Apple's queue does not care what else
you are doing, so **start it today whatever else happens.**

---

## Phase 1 — Who sells Kairo — **done 15 September**

The seller is **Shamalka Kiridena**, Australia, no ABN. The same name goes on
the Apple Developer account.

The Terms and the Privacy Policy now say so, and the name lives in one file —
`platform/seller.js` — with `npm test` and `launch-check` reading both pages
back against it, so they cannot drift apart. Three mutations prove those checks
can fail. `launch-check` reports nothing blocking in the repo.

If ownership ever changes, four of the five places that name a seller are
outside this repository (Stripe's receipt, the App Store listing, the Apple
Developer account holder, the marketing site). `docs/app-store/OWNERSHIP.md`
lists them with the order to work them in.

**What is still open, and it is live right now:** `kairobookings.com/legal/terms`
says A$410 "including GST". A business not registered for GST cannot represent
a price as including it, and there is no ABN. That page also names no seller at
all. It is in a different repository from this one. (`LEGAL-TODO.md` §1b)

---

## Phase 2 — Make the policy URLs resolve

**Blocks the App Store submission. Nothing else.**

Two routes. Pick one:

**A. Give the platform the apex.** It already serves `/privacy`, `/terms`,
`/refunds`, `/support` and `/start` — that is what `platform/public/` is. This
**replaces the marketing site**, so read the warning at the top of
`platform/render.yaml` first, and do it in the order that file gives.

**B. Keep the marketing site, add the pages.** Put privacy, terms, refunds and
support at the paths the listing uses, and sell from `get.kairobookings.com`.
The support page is written — `platform/public/support.html` — and can be
lifted straight across.

Either works. Neither can be skipped.

**`support@kairobookings.com` — probably already works, confirm it.** On
15 September a real message sent to it came back **delivered**, not bounced.
Cloudflare Email Routing rejects a recipient it has no rule for, so a rule
almost certainly exists. What that does not prove is that it lands in an inbox
somebody reads — only opening the inbox proves that, and Apple emails this
address during review. If it is not there: Cloudflare → Email Routing →
Destination addresses (verify one), then Routing rules → support → send to it,
and set the catch-all while you are there.

---

## Phase 3 — Stand up the thing that sells Kairo

**Blocked on Phase 1 and 2. This is what turns Kairo from software two friends
use into something a stranger can buy at 11pm.**

| Step | |
|---|---|
| **Kairo's own Resend account** | ✅ **Done, and proven.** `kairobookings.com` is verified in its own Resend team, separate from Sha's — DKIM and both return-path records all verified, Tokyo region. Two test sends on 15 September, one as the platform and one as a salon, both **delivered**. |
| **Two sending-only keys** | Create them in the Resend dashboard, **Sending access**, scoped to `kairobookings.com` — never a full-access key on a server, which is the same rule `platform/resend.js` already follows for salons' own accounts. One becomes `RESEND_API_KEY` on the platform, the other `KAIRO_SHARED_RESEND_KEY` on the shard. Separate keys so revoking one does not take down the other. |
| **Two addresses** | `PLATFORM_FROM_EMAIL` takes a display name: `Kairo <support@kairobookings.com>`. `KAIRO_SHARED_FROM` must be a **bare address** — `bookings@kairobookings.com` — because the code puts the *salon's* name in front of it and sets `reply_to` to the salon's own inbox. Sha and Hora are unaffected either way: the code prefers a salon's own account, and `test/shared-sender.test.js` fails if that stops being true. |
| **Resend Pro — not yet** | Free is 100 emails a day, and this workspace has sent 11 in its life. Pro is needed **before the second salon on shared sending**, not before the first sale: one busy salon's confirmations and reminders can use 100 a day by itself. |
| **Stripe live keys** | `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the platform. Without the webhook secret a customer pays and Kairo never hears — charged A$410, nothing built. |
| **Deploy** | Render → New → Blueprint → `platform/render.yaml`. Test on its own `onrender.com` address first. |
| **Buy it yourself** | With a real card. The whole path: signup, email code, SMS code, A$410, the wait, "your Kairo is ready", first login. Then refund yourself. |

That last row is the most valuable hour in this document. Every dead end found
in that funnel so far was found by reading the code — a code box that said
"sent" when nothing sent, a 10% GST nobody chose. A real card finds the ones
reading cannot.

---

## Phase 4 — Apple

**Start today. Everything iOS waits behind a queue you do not control.**

1. **Enrol** — developer.apple.com/programs/enroll, **A$149**, 1–2 days.
   Choose **Individual / Sole Proprietor**. Enrolling through the Apple
   Developer app on your iPhone often clears same-day, because it verifies you
   through the device instead of by document review.
   **Not Company/Organization** — that needs a D-U-N-S number, takes weeks, and
   adds roughly A$600 in ASIC fees. The only thing it unlocks is Tap to Pay,
   which is a version 1.1 plan, and converting later keeps everything.
2. **Register the app id** — `com.kairobookings.kairo`, with Push Notifications
   and Associated Domains ticked.
3. **Four GitHub secrets** — `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`,
   `ASC_KEY_P8`. Until all four exist the release job skips itself quietly
   rather than failing, so nothing breaks while you are part-way through.
4. **Push key on the shard** — `KAIRO_APNS_KEY`, `KAIRO_APNS_KEY_ID`,
   `KAIRO_APNS_TEAM_ID`, `KAIRO_APPLE_APP_ID`. Until the last one is set,
   tapping a booking link opens Safari instead of the app. That is the correct
   safe default, not a bug.

Both `.p8` downloads are **one chance only**. Save them somewhere you will
still have in a year.

---

## Phase 5 — Submit

You will need screenshots, a description, the privacy questionnaire, and the
two URLs from Phase 2.

**What Apple actually pushes back on, for an app like this:**

- **"What does the reviewer log into?"** They cannot buy a salon. Give them a
  demo account in App Review notes — `demo.kairobookings.com` already exists
  and is exactly what it is for. Without it, rejection is near-certain.
- **Guideline 4.2, "minimum functionality".** A web view in a wrapper gets
  rejected unless it does things a website cannot. Kairo's does: push
  notifications, Face ID, booking links opening in the app. **Say so in the
  notes.** Do not make the reviewer find it.
- **Privacy questionnaire.** Kairo holds client names, emails, phone numbers
  and appointment history on behalf of the business. Answer it as data
  collected and linked to the user, and do not guess — a wrong answer here is
  worse than a slow one.

Review is typically a few days. **First submissions are rejected more often
than not**, usually over metadata rather than the app. Treat the first attempt
as part of the process, not as a failure.

---

## What it costs to get there

| | |
|---|---|
| Apple Developer Program | **A$149/year** |
| Resend Pro | **US$20/month** |
| Render — shard | already running |
| Render — platform | one more small instance |
| Cloudflare | free |
| **Per sale** | Stripe's fee, roughly **A$12** on A$410 |

---

## If you actually do want subscriptions

You asked about subscribing, so here is the honest version.

Kairo's whole pitch is **one price, no monthly fee, no commission** — that is
what makes it different from Fresha and Square, and it is written into the
Terms and the marketing site. Changing it is a repositioning, not a setting.

If you do:

- **Never sell the subscription inside the iPhone app.** Consumer digital
  subscriptions sold in-app require Apple's In-App Purchase and Apple's cut:
  **30% in year one, 15% after**. On a A$40/month plan that is A$144 of the
  first year, per customer, forever.
- Sold **on the web**, Stripe takes about 1.75% + 30c and Apple takes nothing.
  The app stays a free companion that signs people in — exactly what it is now.
- Existing customers bought a **perpetual licence**. Sha and Hora paid once for
  "as long as we operate the service". You cannot move them onto a subscription
  without their agreement, and trying would be the fastest way to lose both
  references.

**My recommendation: do not.** One-off pricing is the reason a salon owner
picks Kairo over a competitor taking a cut of every booking. If you want
recurring revenue, sell something recurring *alongside* it — SMS credit, a
managed setup, a second location — rather than converting the thing that makes
the pitch work.

---

## The shortest honest version

1. **Today:** start Apple enrolment (queue) in the name Shamalka Kiridena, and
   point `support@` at an inbox (2 min). ~~Decide the seller name~~ — done.
2. **This week:** settle what serves the apex, publish the four policy pages.
3. **Then:** Resend account, Stripe keys, deploy the platform, buy Kairo
   yourself with a real card.
4. **When Apple approves:** bundle id, four secrets, push key.
5. **Submit**, with a demo login and a note saying what the app does that a
   website cannot.

Everything in 1 can be done today, and 1 is the only step that is currently
stopping the rest. Separately and not blocking anything: the live marketing
Terms say the price includes GST, which is not true and is public.
