# Kairo — Launch Checklist & Competitive Audit

The CEO-level pass before selling: what's in the product, how it stacks up against the
tools businesses already know, what's verified working, and what to do before onboarding
the first paying business.

---

## 1. Feature audit — everything in the box, everything tested

Every ✅ below was exercised end-to-end in a real browser (18/18 automated checks passing).

### Scheduling
- ✅ Day calendar with a column per staff member (Fresha-style day book)
- ✅ Week view with per-day totals
- ✅ Click an empty slot to book at that time/staff
- ✅ Drag to reschedule (time, staff column, and day in week view); drag bottom edge to extend
- ✅ Double-booking detection with explicit override ("Double-book anyway")
- ✅ Status flow: Booked → Confirmed → Completed / Cancelled / No-show
- ✅ "Now" line, per-staff colours, ⚡ badge on online bookings, 💳 badge on deposits
- ✅ Location filter (appears automatically with 2+ locations)

### Online booking (`/book`)
- ✅ Service → staff ("any available" supported) → live availability → details → confirmed
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
- ✅ Email (Resend) + SMS (Twilio) with test buttons
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
- ✅ Zero dependencies — Node 22 only; runs with one command

---

## 2. Competitive cross-check

How Kairo answers the tools your prospects already use:

| Capability | Fresha | Square Appts | Acuity | **Kairo** |
|---|---|---|---|---|
| Staff-column day calendar | ✅ | ✅ | ✅ | ✅ |
| Drag to reschedule | ✅ | ✅ | ✅ | ✅ |
| Online booking page | ✅ | ✅ | ✅ | ✅ |
| Email/SMS reminders | ✅ | ✅ | ✅ | ✅ (your own Resend/Twilio keys — at-cost, no markup) |
| Deposits / no-show protection | ✅ | ✅ | ✅ | ✅ (Stripe) |
| Invoicing with tax & partial payments | Partial | ✅ | ➖ | ✅ |
| Client import (CSV) | ✅ | ✅ | ✅ | ✅ (+ service import, which most competitors lack) |
| Multi-location | ✅ | ✅ | ➖ | ✅ |
| Owns the customer relationship | ❌ marketplace can advertise competitors next to you | ➖ | ✅ | ✅ **fully white-label, their brand, their data** |
| Monthly cost to the business | "Free" + 20% new-client marketplace fees + paid SMS | $29+/staff | $20+/mo | **Your price** (suggested $29–59/mo flat) |
| Data ownership / exportability | Limited | Limited | Limited | ✅ full CSV export + the SQLite file itself |
| In-person card terminal | ✅ | ✅ | ➖ | ❌ (record card payments taken on any terminal; roadmap) |
| Native mobile apps | ✅ | ✅ | ✅ | ➖ responsive web app (works on phone browsers) |
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
- [ ] Twilio credentials pasted → **Test SMS** button green
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

Automated end-to-end suite (Chromium, real UI): login, dashboard, calendar day/week,
appointment create + conflict handling, client CSV import + dedupe re-import, service CSV
import, invoice payment → Paid flip, public booking → appears on admin calendar, ICS
download, messages queued/logged + test-send reporting, second location → calendar filter +
booking location step, broken-Stripe-key fallback (booking never lost). **18/18 passing.**
