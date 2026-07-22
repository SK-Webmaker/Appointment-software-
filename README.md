# ◆ Kairo — Booking OS for modern service businesses

Kairo is a complete appointment-booking, client-management and billing platform you can
run for any appointment-based business — salons, barbershops, clinics, studios, trainers,
consultants. Dark, fast, professional.

**Zero dependencies.** One `node server.js` and the whole product is running — no build
step, no database server, no npm install. All data lives in a single SQLite file that is
trivial to back up.

---

## Quick start

Requirements: **Node.js 22.5+** (uses the built-in `node:sqlite`).

```bash
npm start          # → http://localhost:4820
```

| URL | What it is |
|---|---|
| `http://localhost:4820` | Staff workspace (dashboard, calendar, clients, billing) |
| `http://localhost:4820/book` | **Public booking page** — share this link with customers |

Sign in with the demo account: **`admin@kairo.local` / `admin123`**
(change the password in *Settings → Security* before going live).

The first run seeds a realistic demo business (*Luxe Hair Studio*) — 3 staff, 12 services,
14 clients, ~6 weeks of appointments and invoices — so every screen demos well immediately.
*Settings → Reset to demo data* restores it any time (great before a sales demo).

```bash
npm run reset-demo   # same thing from the terminal
```

## What's inside

### 📅 Calendar (the Fresha-style day book)
- Day view with a column per team member, week view for planning
- Click any empty slot to book; **drag appointments to reschedule**, drag the bottom edge to extend
- **Multi-service appointments** (add/remove services in the editor; duration auto-sums)
- Double-booking detection with an explicit override; **overlapping appointments stack side-by-side** in the staff column
- Status flow: Booked → Confirmed → Completed (plus Cancelled / No-show)
- "Now" line, online-booking badge, per-staff colours

### ⚡ Online booking page (`/book`)
- Customers pick **one or more services** (Colour + Blow Dry) → team member (or "any
  available") → live time slot → done; the appointment and availability span the summed
  duration, and the receipt/confirmation list every service
- Availability is computed in real time from working hours minus existing appointments;
  race-safe (a taken slot is re-checked at confirm time)
- **Only upcoming times are ever offered** — a slot that has already passed today is never
  shown or bookable, computed in the **business's own time zone** (auto-detected from the
  owner's device) so it stays correct even when the server runs in UTC. An optional
  **minimum booking notice** (e.g. 1 hour ahead) is configurable in Settings.
- New customers are added to your client book automatically; returning ones are matched by email/phone
- Toggle it on/off in Settings; put the link in an Instagram bio / Google Business profile

### 👥 Clients
- Searchable client book with visit counts, last visit and lifetime billed
- **CSV import wizard**: drop an export from Fresha, Square, Acuity or any spreadsheet —
  columns are auto-matched by name (adjustable), previewed, then imported with
  duplicate detection (by email, or name + phone). CSV export included.
- **Merge duplicates**: finds clients that share an email, phone or name, and merges
  each set into one — the duplicate's appointments, invoices, messages and reviews move
  to the record you keep, missing details (email/phone/notes) are filled in, then the
  duplicates are removed. Runs in one transaction; you pick which record survives, and a
  **Merge all** button clears every detected set at once.
- Client profile: upcoming visits, history, invoices, notes (formulas, allergies, preferences)

### 🏷 Services
- Category-grouped service menu with duration, price and description
- **Three price types, same as Fresha's service menu:**
  - **Fixed** — one set price (a haircut, a manicure)
  - **From** — a starting price for services that vary by client (hair length/thickness,
    treatment area). Shows as **"From $150"** on the booking page and menu; staff enter
    the real amount when they check the client out — the invoice always starts pre-filled
    with the "from" amount and is fully editable
  - **Free** — no charge (consultations, patch tests) — no price field shown at all
- **CSV import/export** — same wizard; understands `90`, `90 min` and `1h 30m` durations,
  `$85` or `85.00` prices, and a `From $150` / `Free` price cell or a separate
  "Price Type" column
- Archive services without losing appointment history

### 💳 Point of Sale (`#/pos`)
- **Bill Customer in a few taps**, designed phone-first: pick one of today's
  appointments (services pre-loaded) or start a walk-in sale
- Add services, retail **products**, custom lines; qty steppers, discounts,
  "From $X" final pricing, GST calculated automatically
- **Take payment — Stripe *or* Square** (owner picks in Settings → In-person
  card payments):
  - **Stripe**: Kairo generates a secure pay-link (salon phone or the customer's
    own phone — Apple Pay/Google Pay appear there); it flips to **Paid** the
    moment Stripe confirms, no refresh
  - **Square**: the owner charges on their own Square reader/app the way they
    already do, then taps **Paid** — Kairo records it, no keys or Square login
  - Plus cash / other recorded instantly
- Either way the itemised bill, receipt email and stock update are tracked in
  Kairo; the sale becomes a Paid invoice in Billing
- **Refunds** (full/partial) from the invoice — pushed to Stripe automatically,
  with optional product restock. Duplicate-charge protection end to end
  (server-side pricing, idempotency keys, dedup on Stripe's payment intent)
- See [STRIPE-SETUP.md](STRIPE-SETUP.md) for the owner's onboarding guide

### 🛍 Products & inventory
- Product manager: image, SKU, barcode, category, supplier, retail + cost
  price, GST flag, **stock on hand with low-stock warnings**
- Selling at the POS reduces stock automatically; refunds can restock
- Products sold on ever-kept history: deleted products archive instead of vanish

### 🧾 Billing
- One-click **Checkout / bill** from any appointment → invoice pre-filled with the service
- Line items, quantities, tax rate, discounts; totals computed in integer cents (no float drift)
- Record payments (card / cash / transfer), partial payments supported — the invoice flips
  to **Paid** automatically when the balance hits zero
- Print / save-as-PDF invoice, mark sent, void, delete
- Outstanding-balance and collected-this-month tiles

### 📊 Dashboard
- Today's bookings, revenue collected (7 days), outstanding balance, client growth
- **Booking rhythm** chart (busiest hours, last 30 days) with an automatic insight
  ("You're busiest between 9–11 AM")
- Revenue trend, top services, upcoming appointments

### 💬 Confirmations, reminders, receipts & review requests (email + SMS)
- Booking confirmations sent immediately; reminders sent N hours before the visit
  (default 24h, configurable) — the single biggest no-show reducer
- **Payment receipts** sent automatically the moment a payment or online deposit is
  recorded — itemized amount, method, and remaining balance if any
- **Review requests** sent automatically after a visit is marked Completed (configurable
  delay). Clients tap a link, leave 1-5★ and an optional comment on a page branded like
  your booking page; 4-5★ ratings get a one-tap prompt to also post on Google if you've
  set a review link. See them all — with reply — on the new **Reviews** page
- **Per-type channel choice**: for each notification (confirmation, reminder, receipt,
  review request) pick **Email**, **SMS**, or **both** in *Settings → Notifications*, so
  each business sends exactly how it wants. SMS stays gated behind a master switch (off by
  default) so nothing is billed by accident; a type set to SMS falls back to email until
  SMS is turned on
- Email via **Resend**; SMS via a provider you choose in *Settings → Notifications* —
  **ClickSend** (simplest, best for Australia), **Telnyx** (cheapest per text), or
  **Twilio**. Paste that provider's keys and it goes live; test buttons included
- A **Messages** page logs every message (queued / sent / failed / skipped) with retry,
  so nothing ever disappears silently. Rescheduling re-queues the reminder;
  cancelling withdraws it.

**What it actually costs** (pay the provider directly — no markup, no plan tiers). Email
and SMS are priced very differently, so they're broken out separately:

| | Email (Resend) | SMS — pick a provider |
|---|---|---|
| Per message | **Free** up to 3,000/mo (100/day cap), then ~$0.001 | **ClickSend** ~6¢ AUD · **Telnyx** ~2–4¢ · **Twilio** ~8¢ + monthly number |
| Sending number / ID | — | ClickSend & Telnyx: business-name sender, **no number rental** · Twilio: ~$1–6/mo number |
| One-time setup | none | ClickSend registers your sender with ACMA for you; Telnyx needs KYC; Twilio needs number + registration |
| Recurring platform fee | $0 | $0 for ClickSend/Telnyx (pay-as-you-go); Twilio number rental |

There is **no genuinely free SMS** (Apple blocks the phone-gateway trick that works on
Android, and every cloud SMS API charges per message) — so **SMS defaults OFF in Kairo**
(`Settings → Notifications → SMS`) and a new deployment never risks a bill without the
owner opting in. Email alone (confirmations, reminders, receipts, review requests) costs
**$0/month** and needs zero setup. When you do want SMS, pick the provider that fits:
**ClickSend** for the simplest Australian setup, **Telnyx** for the lowest per-text price,
or **Twilio**. At a salon's ~40 texts/month the price difference is about a dollar — so
setup simplicity usually matters more than the per-message rate.

For comparison, Fresha bundles messaging into its plan ($14.95–19.95/mo) with a free
per-month SMS allowance, then $0.05–0.15 per text after that — Kairo's SMS, once
registered, runs roughly 3-5x cheaper per message with no plan fee, but the registration
step is a real, mandatory cost Fresha's plan pricing absorbs for you.

### 💳 Online deposits (Stripe)
- Take a card deposit at online booking — fixed amount or % of the service price
- Stripe Checkout handles the card page (no card data ever touches Kairo)
- Paid deposits show on the calendar (💳) and are **auto-credited** when you bill the visit
- Fail-safe: if Stripe is down or misconfigured, the booking still goes through without
  a deposit — you never lose a customer to a config problem

### 📍 Multi-location
- Add locations in Settings; assign each team member to one
- The calendar gets a location filter and the booking page gets a location step —
  both appear automatically once a second location exists

### 🎨 Booking-page branding (per business)
- Each business styles the customer booking page in *Settings → Booking page appearance*:
  a full **colour scheme** (8 curated palettes — Midnight, Noir, Deep Ocean, Mocha,
  Daylight, Cream, Blush, Sage — the *whole page* takes the scheme: background,
  cards, text), a brand **colour**, a **font personality** (modern / classic
  serif / rounded), a **logo**, a wide **cover photo**, a **gallery** of up to 4 work
  photos, and a welcome line — so the page looks like *their* brand, not Kairo's
- All images are stored in the business's own database as size-capped data URIs;
  nothing is uploaded to a third party

### 📆 Working days
- Pick the days the business is open (*Settings → Hours & booking* or the setup
  wizard) — closed days **never appear** on the customer booking page's date
  picker, and the server refuses closed-day bookings even from crafted requests
- Staff can still add walk-ins on a closed day from the calendar (one-off openings)

### ✉️ Branded HTML emails
- Confirmations, reminders, receipts and review requests go out as **polished,
  mobile-friendly HTML emails** in the business's brand colour, with a details
  card (service, time, amount paid, balance) and the business's name and address
  in the footer — plus a plain-text fallback for old mail apps

### 🔒 Security (see [SECURITY.md](SECURITY.md))
- One private instance + database per business — the strongest data isolation
- API keys (Stripe, Resend, and your SMS provider — ClickSend/Telnyx/Twilio) are
  **write-only** and never sent to the browser
- **Rate limiting on every endpoint** — per-IP for public traffic, per-user+IP for
  staff; graceful `429` + `Retry-After`, tight on login/booking/review abuse
- **Schema-based input validation** on every write: type checks, length limits,
  numeric ranges, and **unexpected fields rejected** (even nested ones)
- **Owner email verification** — the business verifies its account email with a
  single-use, expiring link (Settings → Security)
- scrypt password hashing, HMAC-signed HttpOnly cookies, parameterized SQL,
  escaped output, path-traversal-safe static serving

### 🗓 Extra touches
- "Add to calendar" (.ics) button on the customer confirmation screen
- Online bookings marked ⚡ on the calendar

### ⚙️ Settings
- Business profile (shown on invoices + booking page), working hours, **working
  days**, slot interval
- Currency symbol, tax rate, invoice numbering/footer
- Notification providers, deposit rules, locations
- Password change, **email verification**, demo-data reset

## Running a pilot with a real business

A suggested two-week test script:

1. **Set up (15 min).** `Settings` → enter their business name, phone, address, hours,
   tax rate. `Team` → add their staff. Change the admin password.
2. **Migrate their data (10 min).** Export clients & services from their current tool
   (or spreadsheet) and use *Clients → Import CSV* and *Services → Import CSV*.
   Sample files to rehearse with are in [`samples/`](samples/).
3. **Reset the ledger.** *Settings → Reset to demo data* wipes everything, so do the reset
   **before** step 1 if you demoed first, not after.
4. **Go live at the front desk.** Take every walk-in/phone booking on the Calendar for a
   week. Bill each finished visit with the appointment's *Checkout* button.
5. **Turn on online booking.** Put `https://<their-domain>/book` in their Instagram bio and
   Google profile; watch bookings arrive with the ⚡ badge.
6. **Review with the owner.** Dashboard → show booking rhythm, revenue collected and
   outstanding balance. That conversation is your sales pitch for the next business.

### Deploying for a customer

Any box that runs Node 22 works (a $5 VPS is plenty):

```bash
PORT=80 node --disable-warning=ExperimentalWarning server.js
```

- One Kairo instance = one business (single-tenant by design; run one instance per customer)
- Data lives in `data/kairo.db` — back it up with a nightly `cp`/object-storage upload
- Put nginx/Caddy in front for HTTPS and a real domain
- Environment overrides: `PORT`, `HOST`, `KAIRO_DATA_DIR`, `KAIRO_ADMIN_EMAIL`,
  `KAIRO_ADMIN_PASSWORD` (first-run only)

## CSV formats

Header names are matched fuzzily — these are just the canonical shapes
(see [`samples/clients-sample.csv`](samples/clients-sample.csv) and
[`samples/services-sample.csv`](samples/services-sample.csv)):

```csv
First Name,Last Name,Email,Phone,Notes
Aaliyah,Thompson,aaliyah.t@example.com,(555) 201-4432,Prefers mornings
```

```csv
Service,Category,Duration (min),Price,Description
Balayage,Colour,150,220.00,Full balayage with toner
```

A single "Name" column is split into first/last automatically. Duplicates are skipped,
never overwritten.

## Architecture

```
server.js            HTTP server: static assets + /api router
src/db.js            node:sqlite schema, defaults, demo seed
src/api.js           REST API (auth, clients, services, staff,
                     appointments, invoices, payments, dashboard, public booking)
src/auth.js          scrypt password hashing + HMAC-signed session cookies
public/              SPA workspace (vanilla ES modules, no framework)
public/book.html     customer-facing booking flow
samples/             CSV files for import testing
data/kairo.db        the whole business (gitignored)
```

Security: scrypt-hashed passwords, HttpOnly SameSite session cookies, parameterized SQL
everywhere, HTML-escaped rendering, login rate limiting, path-traversal-safe static serving.

## Going live: the three optional accounts

Everything works with zero accounts. These unlock delivery/payments when you're ready:

| Feature | Provider | Cost | Where the key goes |
|---|---|---|---|
| Email confirmations/reminders | [resend.com](https://resend.com) | Free (3,000/mo) | Settings → Notifications |
| SMS confirmations/reminders | [twilio.com](https://www.twilio.com) | ~$0.01/SMS + $1/mo number | Settings → Notifications |
| Card deposits on booking | [stripe.com](https://stripe.com) | 2.9% + 30¢ per deposit | Settings → Online deposits |

Use Stripe **test keys** (`sk_test_…`) to rehearse the deposit flow with the card
number `4242 4242 4242 4242` before going live.

## Updating a deployed instance

Updates are quick and safe — see **[UPDATING.md](UPDATING.md)**. In short: on
Render/Railway/Fly a push auto-deploys; on a VPS it's `npm run update` + restart.
Kairo has no dependencies to install and **automatically backs up the database
before applying migrations on startup**, so upgrades never lose data and can be
rolled back. The running version shows in the sidebar, the startup log, and at
`GET /api/version`.

## Selling Kairo

See **[SELLING.md](SELLING.md)** for the full go-to-market playbook (pricing, pitch,
demo script, client onboarding runbook, deployment) and
**[LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)** for the pre-launch audit and
feature comparison against Fresha / Square Appointments / Acuity.

## Roadmap ideas (post-pilot)

Staff logins with permissions · Google Calendar 2-way sync · recurring appointments ·
waitlists · packages & memberships · gift cards · marketing campaigns · reports export.

---

Built to be sold: rebrand it, deploy it per customer, charge monthly. 🚀
