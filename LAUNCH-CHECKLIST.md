# Kairo — Launch Checklist & Competitive Audit

The CEO-level pass before selling: what's in the product, how it stacks up against the
tools businesses already know, what's verified working, and what to do before onboarding
the first paying business.

---

## 1. Feature audit — everything in the box, everything tested

Every ✅ below was exercised end-to-end in a real browser (66/66 automated checks passing).

### Scheduling
- ✅ Day calendar with a column per staff member (Fresha-style day book)
- ✅ Week view with per-day totals
- ✅ Click an empty slot to book at that time/staff
- ✅ Drag to reschedule (time, staff column, and day in week view); drag bottom edge to extend
- ✅ Double-booking detection with explicit override; overlapping appointments **stack side-by-side** in the column (Fresha-style)
- ✅ Multi-service appointments editable in the calendar (add/remove services; duration auto-sums)
- ✅ Status flow: Booked → Confirmed → Completed / Cancelled / No-show
- ✅ "Now" line, per-staff colours, ⚡ badge on online bookings, 💳 badge on deposits
- ✅ Location filter (appears automatically with 2+ locations)

### Point of Sale (v1.8)
- ✅ Bill Customer from today's appointments (services pre-loaded) or walk-in
- ✅ Services + products + custom lines, qty, discounts, GST, server-side pricing
- ✅ **Choose Stripe or Square** for card payments (Settings → In-person card payments):
  Stripe = Kairo pay-link, auto-confirmed; Square = charge on the owner's own reader,
  then one-tap "Paid" — the bill/receipt/stock are tracked in Kairo either way
- ✅ Card/wallet via Stripe Checkout (salon phone or customer's phone via shared
  link — Apple Pay/Google Pay), cash, other; live paid-flip with no refresh
- ✅ Idempotent end-to-end: double-taps, poll races and retries can never
  double-charge or double-record (verified by test)
- ✅ Refunds full/partial → Stripe + payment history + optional restock
- ✅ Product management with stock tracking + low-stock warnings

### Online booking (`/book`)
- ✅ **Multi-service booking** — customers add several services to one visit (Colour + Blow Dry); availability and the appointment span the summed duration, and the confirmation/receipt list every service
- ✅ Service(s) → staff ("any available" supported) → live availability → details → confirmed
- ✅ Availability = working hours − existing appointments, in real time; taken slots re-checked at confirm (race-safe)
- ✅ Location step (auto-appears with 2+ locations)
- ✅ Card deposit via Stripe Checkout (fixed or % of price), fail-safe if Stripe errors
- ✅ New clients auto-added to the client book; returning clients matched by email/phone
- ✅ Booking reference (BK-xxxxx), "Add to calendar" (.ics) download
- ✅ On/off switch in Settings

### Clients
- ✅ Searchable book: visits, last visit, lifetime billed
- ✅ CSV import wizard: auto column-mapping (adjustable), preview, duplicate detection, results summary
- ✅ Duplicate-safe re-import (verified: same file twice → 0 duplicates created)
- ✅ **Merge duplicates**: auto-detects clients sharing an email/phone/name and merges
  each set into one — history (appointments, invoices, messages, reviews) is reassigned,
  missing fields filled, duplicates removed (transactional; owner picks which to keep, or
  **Merge all** to clear every set at once)
- ✅ CSV export · client profile with history, upcoming, invoices, notes

### Services
- ✅ Category-grouped menu, duration + price + description
- ✅ CSV import (tolerates "90", "90 min", "1h 30m", "$85") and export
- ✅ Archive without losing history

### Billing
- ✅ One-click invoice from an appointment (Checkout button)
- ✅ Line items, qty, tax, discounts — integer-cent math (no float drift)
- ✅ Payments: card/cash/transfer, partial payments, auto-Paid when balance = 0
- ✅ Online deposits auto-credited to the invoice at checkout
- ✅ Print / save-as-PDF invoice · mark sent · void · outstanding + collected tiles

### Communications
- ✅ Booking confirmations (instant) + reminders (N hours before, default 24)
- ✅ Payment receipts, auto-sent on any payment or online deposit
- ✅ Post-visit review requests, auto-sent after checkout (configurable delay)
- ✅ Branded public review page (1-5★ + comment); 4-5★ → one-tap Google review hand-off
- ✅ Reviews page: average rating, list, owner replies
- ✅ Email (Resend) + SMS (**choose ClickSend / Telnyx / Twilio** in Settings) with test
  buttons; **SMS defaults off** (real per-text cost — opt-in only, never billed by accident)
- ✅ **Per-type delivery channel**: each notification (confirmation / reminder / receipt /
  review request) can be set to Email, SMS, or both — SMS still gated by the master switch,
  with email fallback so a message is never dropped
- ✅ Messages log: queued / sent / failed / skipped with reasons + retry
- ✅ Reschedule re-queues the reminder; cancel withdraws it

### Dashboard & insights
- ✅ Today's bookings, revenue (7d), outstanding, client growth
- ✅ Booking-rhythm chart + automatic busiest-window insight
- ✅ Revenue trend, top services, upcoming list

### Platform
- ✅ Login (scrypt-hashed passwords), HttpOnly signed session cookies, login rate limiting
- ✅ Parameterized SQL everywhere, HTML-escaped rendering, path-traversal-safe static serving
- ✅ Single-file SQLite database (one-file backup/restore), demo seed + one-click reset
- ✅ **Phone-first responsive UI** — full-width pages, slide-out labelled nav, thumb-sized controls, no clipped values; verified across every screen at iPhone width
- ✅ **Installable ("Add to Home Screen")** — web-app manifest + branded icons open Kairo full-screen like a native app, titled with the business's own name
- ✅ Zero dependencies — Node 22 only; runs with one command

---

## 2. Competitive cross-check

How Kairo answers the tools your prospects already use:

| Capability | Fresha | Square Appts | Acuity | **Kairo** |
|---|---|---|---|---|
| Staff-column day calendar | ✅ | ✅ | ✅ | ✅ |
| Drag to reschedule | ✅ | ✅ | ✅ | ✅ |
| Online booking page | ✅ | ✅ | ✅ | ✅ |
| Email/SMS reminders | ✅ | ✅ | ✅ | ✅ (your own Resend + ClickSend/Telnyx/Twilio keys — at-cost, no markup) |
| Payment receipts | ✅ | ✅ | ➖ | ✅ (auto-sent on payment or deposit) |
| Post-visit review requests | ✅ | ➖ | ➖ | ✅ (own branded review page + Google hand-off) |
| Deposits / no-show protection | ✅ | ✅ | ✅ | ✅ (Stripe) |
| Invoicing with tax & partial payments | Partial | ✅ | ➖ | ✅ |
| "From $X" variable pricing on services | ✅ | ➖ | ➖ | ✅ (Fixed / From / Free — matches Fresha's service menu) |
| Client import (CSV) | ✅ | ✅ | ✅ | ✅ (+ service import, which most competitors lack) |
| Multi-location | ✅ | ✅ | ➖ | ✅ |
| Owns the customer relationship | ❌ marketplace can advertise competitors next to you | ➖ | ✅ | ✅ **fully white-label, their brand, their data** |
| Monthly cost to the business | "Free" + 20% new-client marketplace fees + paid SMS | $29+/staff | $20+/mo | **Your price** (suggested $29–59/mo flat) |
| Data ownership / exportability | Limited | Limited | Limited | ✅ full CSV export + the SQLite file itself |
| In-person card terminal | ✅ | ✅ | ➖ | ✅ *works with the business's own reader* — charge on their Square (or any terminal), one-tap "Paid" in Kairo; or Stripe pay-link |
| Native mobile apps | ✅ | ✅ | ✅ | ➖ installable web app — "Add to Home Screen" gives a full-screen, branded phone app (no App Store, no $99/yr fee) |
| Google Calendar sync / recurring appts | ✅ | ✅ | ✅ | ❌ roadmap |

**The pitch angle this table gives you:** Kairo is the *anti-marketplace*. Fresha's free
plan takes ~20% of new-client revenue and shows clients competing salons; Square locks
businesses into its payments. Kairo is flat-priced, fully branded to the business, and the
data is theirs. For a 2–5 chair salon, that's the story that wins.

**Known gaps (be straight about them):** no in-person card terminal, no native app (the
web app works fine on phones), no Google Calendar sync yet, one staff login per business
(the owner's) in v1. None of these block a front-desk pilot.

---

## 3. Pre-onboarding checklist (do these before the pilot business touches it)

**Deploy (once per client)**
- [ ] Server running (Render/VPS — see SELLING.md § Deployment) with HTTPS + their subdomain
- [ ] `KAIRO_ADMIN_EMAIL` / `KAIRO_ADMIN_PASSWORD` env vars set (or password changed on first login)
- [ ] Reset demo data (*Settings → Reset to demo data*) **before** entering real info
- [ ] Nightly backup of `data/kairo.db` configured (a daily copy is enough)

**Configure (15 minutes, with the owner)**
- [ ] Business name / phone / address / email
- [ ] Working hours + slot interval
- [ ] Tax rate, currency, invoice footer
- [ ] Team members added with colours (+ locations if applicable)
- [ ] Services entered or imported via CSV
- [ ] Clients imported via CSV (export from their old tool or spreadsheet)

**Communications & payments (optional but recommended)**
- [ ] Resend key + from-address pasted → **Test email** button green
- [ ] SMS provider chosen (ClickSend / Telnyx / Twilio) + keys pasted → **Test SMS** button green
- [ ] Stripe: test key first → book a test appointment with card `4242 4242 4242 4242` → then live key
- [ ] Reminder timing agreed with the owner (24h default)

**Go-live**
- [ ] Book + reschedule + cancel a test appointment at the front desk
- [ ] Bill it, record a payment, print the invoice
- [ ] Make one online booking from the owner's phone
- [ ] Booking link in Instagram bio / Google Business profile / WhatsApp auto-reply
- [ ] Owner knows the Messages page = proof of what was sent

**Week-2 review (your sales moment)**
- [ ] Dashboard walkthrough: rhythm chart, revenue collected, outstanding
- [ ] Count online bookings (⚡) — that's revenue they didn't have to answer the phone for
- [ ] Ask for the testimonial + referral to 2 similar businesses

---

## 4. Verified-by-test summary

Automated end-to-end suite (Chromium, real UI), across four suites:

- **Core (22 checks):** login, setup wizard, dashboard, calendar day/week, appointment
  create + conflict handling, client CSV import + dedupe re-import, service CSV import,
  invoice payment → Paid flip, **multi-service** public booking → appears on admin calendar,
  ICS download, messages queued/logged + test-send reporting, second location → calendar
  filter + booking location step, broken-Stripe-key fallback (booking never lost), secret
  masking, full booking-page branding.
- **Pricing (7 checks):** Fixed/From/Free editor round-trip, CSV import/export of price
  types (incl. "From $85" written straight into a price cell), public booking page display,
  checkout floor price.
- **Receipts & reviews (10 checks):** SMS defaults off, Settings shows real cost figures,
  a payment auto-queues a Receipt, completing a visit auto-queues a Review request, the
  branded public review page accepts a rating and is idempotent on reuse, the review shows
  on the staff Reviews page, and an owner reply saves.
- **Security (27 checks, v1.5–v1.6):** schema validation rejects unknown fields (top-level
  and nested), oversized strings, wrong types, out-of-range values and non-editable settings
  keys; rate limits fire gracefully (429 + Retry-After) on public reads, login brute-force
  and booking spam while other IPs stay unaffected; owner email verification is
  single-use with friendly pages for bad/expired links; closed working days offer zero slots
  and refuse direct booking POSTs; **strict CSP + HSTS + Permissions-Policy headers are
  present; the session cookie is Secure over HTTPS; a forged token is rejected; changing
  the password revokes old sessions; and the default-password warning is surfaced**.

**66/66 passing**, plus a load test: 0 HTTP errors at 2,000+ req/s on the public booking
surface (rate limiter active), worst p95 ≈ 115 ms, and a 40-way race for the same slot
won by exactly one booking. Multi-service booking, the invoice-per-service billing, the
drag-preserves-services behaviour, and side-by-side overlap rendering were additionally
verified directly against the API and in the browser.
