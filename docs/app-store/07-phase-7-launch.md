# Phase 7 — Launch

*The listing, the review notes, and the order things happen in. Written to be
copied field-by-field into App Store Connect.*

Everything here assumes the decisions already made: the app is **free**, it is
**sign-in only**, and Kairo is **bought once on the website** (D2, reversed
and settled on 2026-09-05). Nothing in the listing may say otherwise, and
nothing in the app may link to the purchase — see §6.

---

## 1. The listing

### Name and subtitle

| Field | Value | Limit |
|---|---|---|
| **App Name** | `Kairo — Salon Bookings` | 30 (uses 22) |
| **Subtitle** | `Your book, on your phone` | 30 (uses 25) |

The name leads with the brand and says the category in three words, which is
what a search result has room to show. The subtitle is not a feature list:
the App Store truncates those to nonsense, and the screenshots do that job.

### Promotional text (170, editable without a new build)

```
Reminders that go out on their own, a booking page that never sleeps, and
every client's history in your pocket. Built for small salons — no monthly
fee, no commission on your bookings.
```

### Description

```
Kairo is the appointment book for people who are on their feet all day.

Your whole day on one screen. Every chair, every appointment, colour-coded
by stylist. Drag to reschedule. Tap an empty slot to book someone in while
they're still standing in front of you.

Clients book themselves. Your own booking page, at your own address, open at
eleven at night when somebody decides they need a cut on Saturday. It knows
who is working, how long each service takes, and what is already booked, so
it can't double-book you.

Reminders that go out on their own. Confirmations when they book, a reminder
the day before, a receipt after. Email included; texts from your own account
if you want them.

Everyone you've ever done. Every visit, every service, what they paid, the
colour formula you used last time and the note about their allergy. Search by
name, email or phone.

Invoice and get paid before they leave. Build the invoice from the
appointment, take card, cash or transfer, send the receipt. Deposits on
online bookings if no-shows are hurting you.

Know where the day stands. What's booked, what's done, what's been taken,
how much free time is left, and who is next — the moment you open the app.

It tells you the moment somebody books. A notification, on your phone, with
the name and the time.


WHAT IT COSTS

Kairo is bought once, from kairobookings.com. There is no monthly fee, no
per-booking commission and no cut of your card payments. This app is free;
sign in with the Kairo account you already have.


YOUR DATA IS YOURS

Your salon's data lives in its own database, not pooled with anyone else's.
Export it whenever you like. Delete your account, and everything in it, from
inside the app.

Card payments go straight to your own Stripe or Square account — Kairo never
touches your money. Texts go through your own messaging account, so nobody
is reselling you messages.


BUILT FOR

Hair, barbering, beauty, brows and lashes, nails, massage and any other
business that runs on appointments and repeat clients.
```

### Keywords (100 characters, comma-separated, no spaces)

```
salon,barber,booking,appointment,scheduler,clients,diary,stylist,beauty,nails,invoice,reminders
```

96 characters. Deliberately excludes the words already in the name and
subtitle — Apple indexes those, so repeating them wastes the field. It also
excludes competitor names, which is a rejection under 5.2.

### Category, age rating, and the rest

| Field | Value | Why |
|---|---|---|
| Primary category | **Business** | where salon owners look for tools |
| Secondary category | **Productivity** | |
| Age rating | **4+** | no objectionable content of any kind |
| Price | **Free** | the app is; Kairo is bought on the website |
| Countries | **Australia** at launch | the only market with the ABN, ACMA and consumer-law work done |
| Support URL | `https://kairobookings.com/support` | must resolve before submitting |
| Marketing URL | `https://kairobookings.com` | |
| Privacy Policy URL | `https://kairobookings.com/privacy` | mandatory |
| Copyright | `2026 Kairo` | |

### Screenshots

Five, at 1320 × 2868 (the 6.9" size — Apple accepts this one size for all
current iPhones). They are in [`screenshots/`](screenshots/), and the
untouched captures they were built from are in `screenshots/raw/`.

| # | Screen | Caption |
|---|---|---|
| 1 | Calendar, a full Wednesday across two chairs | *Your whole day, on one screen* |
| 2 | Dashboard, mid-morning, three done and three to go | *Know where you are, the moment you look* |
| 3 | The customer booking page | *They book themselves, day or night* |
| 4 | Clients, with visits and totals | *Every client, every visit, kept* |
| 5 | Invoices | *Invoice and get paid before they leave* |

They are made by [`tools/appstore/`](../../tools/appstore/) from the running
product, so they can be regenerated whenever a screen changes — and they must
be, because a listing showing an old version is a 2.3 rejection.

**Deliberately not in the screenshots:** the price, and any mention of buying.
Apple reads purchase messaging in screenshots as an attempt to route around
in-app purchase, and it is the single easiest way to fail review for an app
in this shape.

### App icon

`ios/Kairo/Assets.xcassets/AppIcon.appiconset/icon-1024.png` — 1024 × 1024,
no alpha channel, no rounded corners of its own (iOS applies its own mask).

---

## 2. Privacy — App Store Connect's questionnaire

Answer for **the app you are shipping**, which holds nothing itself: the
workspace is the salon's own Kairo, and the data is the salon's. Getting this
wrong in either direction is a rejection, so it is spelled out.

| Question | Answer |
|---|---|
| Does the app collect data? | **Yes** — the salon's own data passes through it |
| Contact info (name, email, phone) | Collected · **Not linked to the user** · App Functionality |
| User content (appointments, notes, photos) | Collected · Not linked · App Functionality |
| Identifiers (device token for push) | Collected · Not linked · App Functionality |
| Purchases, financial info | **Not collected** — card details never touch Kairo; Stripe and Square take them directly |
| Health & Fitness | **Not collected** — treatment notes are User Content, not health records; if that ever changes, this answer changes |
| Location, browsing, search history, contacts, diagnostics | **Not collected** |
| Used for tracking? | **No.** There is no analytics SDK, no advertising identifier, and no third-party tracker anywhere in the app |
| Third-party partners | Apple (push), and the salon's own Resend / ClickSend / Stripe accounts |

**Account deletion (5.1.1(v)):** in the app, Settings → Account → *Delete my
account*. It asks for the password and the business name typed out, shuts the
salon immediately, and removes the data after seven days — which is stated on
screen before they confirm. Point the reviewer at it in the notes; they check.

---

## 3. Review notes

Paste into *App Review Information → Notes*:

```
Kairo is appointment-book software for small salons. The app is a free
companion to an account the business already has; there is nothing to buy
inside it and no purchase path in it.

HOW TO SIGN IN
1. On first launch the app asks for the salon's Kairo address.
   Enter:  demo
   (that resolves to demo.kairobookings.com)
2. Sign in with:
   Email:     review@kairobookings.com
   Password:  <filled in at submission>

This is a full working salon with sample data. Nothing you do in it affects a
real business, and it is reset weekly.

WHAT TO LOOK AT
- Calendar: a week of appointments across two stylists. Tap an empty slot to
  book; drag an appointment to move it.
- Clients: visit history and totals.
- Invoices: build one from an appointment and record a payment.
- Settings > Account > Delete my account: account deletion, in the app, as
  required by 5.1.1(v). It asks for the password and the business name. On
  the demo account it is safe to run — the account is recreated weekly.

ABOUT THE PRICE
Kairo is bought once on kairobookings.com and is not a subscription. The app
does not sell it, does not link to it, and does not mention the price. It is
sign-in only, in the same way a business tool bought elsewhere is. We believe
this is squarely within 3.1.3(f). If you read it differently, please tell us
what you need changed rather than rejecting the build — we will change it.

PUSH NOTIFICATIONS
Used for one thing: telling the owner when a client books online. Permission
is asked for after sign-in, never on first launch.

THE BUSINESS'S OWN ACCOUNTS
Email and text reminders go through accounts the salon owns (Resend,
ClickSend) and card payments through their own Stripe or Square. Kairo never
holds the money and never resells messaging.
```

**Before submitting, make sure the demo salon actually works.** A reviewer who
cannot sign in rejects the build the same day, and it is the most common
avoidable rejection there is.

---

## 4. What it will cost you

Nothing here is a subscription except the first line.

| What | When | Cost |
|---|---|---|
| Apple Developer Program | now, then yearly | **A$149/year** |
| GitHub Actions macOS runners | every build | **A$0** — the repository is public, so they are free. On a private repository the same build bills at ten times the Linux rate |
| Domain `kairobookings.com` | yearly | ~A$20 |
| Render (one service per region, many salons) | monthly | ~A$10 per salon per year at the sizes in Phase 3 |
| Stripe, on each A$410 sale | per sale | 1.75% + A$0.30 ≈ **A$7.48**, so you net ≈ A$402 |
| Resend, ClickSend | never | **A$0** — each salon uses its own account |

The only thing standing between here and a TestFlight build is the A$149.

---

## 5. The order things happen in

Each step is finishable in a sitting, and nothing after step 3 can be started
without the one before it.

1. **Enrol with Apple, as an individual.** ~A$149, one to two days to verify.
   The conversion to an organisation comes later and keeps the Apple ID, the
   Team ID, the certificates and the apps — see
   [`07-apple-account-plan.md`](07-apple-account-plan.md). Tap to Pay is the
   one feature that needs the organisation account, and it is already in 1.1.
2. **Register the bundle id** `com.kairobookings.kairo`, with Push
   Notifications and Associated Domains switched on.
3. **Create the four secrets** in GitHub → Settings → Secrets → Actions:
   `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`. The last
   three come from App Store Connect → Users and Access → Integrations, with
   the **App Manager** role.
4. **Create the APNs auth key** (.p8) and put it on the shard as
   `KAIRO_APNS_KEY`, `KAIRO_APNS_KEY_ID`, `KAIRO_APNS_TEAM_ID`. Also set
   `KAIRO_APPLE_APP_ID` to `TEAMID.com.kairobookings.kairo`, or no
   app-site-association file is served at all — which is the right behaviour,
   but it means universal links will not work until you do.
5. **Publish a GitHub release.** The `testflight` job archives, signs and
   uploads. Until step 3 exists it skips itself silently, so this can be
   rehearsed at any time.
6. **Install from TestFlight and use it for a week** on the demo salon — not
   on Sha's or Hora's. Push, Face ID, a real booking, a real invoice.
7. **Create the demo review account** and check the review notes above sign in
   exactly as written.
8. **Fill the listing** from §1, upload the screenshots from
   `docs/app-store/screenshots/`, answer the privacy questionnaire from §2.
9. **Submit.** Australia only. Expect one to three days, and expect the first
   answer to be a question about 3.1.3(f) — §3 is written to pre-empt it.
10. **Then, and only then, Phase 5.** Moving Hora and Sha is a separate day's
    work with its own runbook, and doing it in the same week as an App Store
    submission means two things going wrong at once.

---

## 6. The three ways this gets rejected, and what is already done about each

**3.1.1 / 3.1.3(f) — "you are selling outside the app."** Kairo is business
software bought by a business, and the app unlocks nothing. What matters is
that the app never mentions the price and never links to the purchase: no
"buy" button, no upgrade prompt, no pricing screen, and the sign-in screen
says only *"You sign in on the next screen, the same way you do on a
computer."* If a reviewer still objects, the answer is not to argue but to
ask what they want removed — §3 says so in as many words.

**2.1 — "we could not sign in."** The demo salon must be live and the
credentials in the review notes must be right, on the day. Check it the
morning you submit.

**5.1.1(v) — "no way to delete an account."** Built, tested and pointed at in
the review notes.

Two more worth knowing about: **4.2** (minimum functionality) is not a real
risk here — this is a full working product, not a web page in a wrapper, and
the screenshots show it. **2.3** (accurate metadata) is why the screenshots
are generated from the running app and must be regenerated when a screen
changes.

---

## 7. What is not in 1.0

Named so nobody goes looking for them: Android (D7 — after iOS), Tap to Pay
on iPhone (needs the organisation account), an iPad-specific layout, offline
mode, and a home-screen widget. None of them blocks a salon from running its
book, which is the bar for 1.0.
