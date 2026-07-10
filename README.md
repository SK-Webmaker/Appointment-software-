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
- Double-booking detection with an explicit override
- Status flow: Booked → Confirmed → Completed (plus Cancelled / No-show)
- "Now" line, online-booking badge, per-staff colours

### ⚡ Online booking page (`/book`)
- Customers pick service → team member (or "any available") → live time slot → done
- Availability is computed in real time from working hours minus existing appointments;
  race-safe (a taken slot is re-checked at confirm time)
- New customers are added to your client book automatically; returning ones are matched by email/phone
- Toggle it on/off in Settings; put the link in an Instagram bio / Google Business profile

### 👥 Clients
- Searchable client book with visit counts, last visit and lifetime billed
- **CSV import wizard**: drop an export from Fresha, Square, Acuity or any spreadsheet —
  columns are auto-matched by name (adjustable), previewed, then imported with
  duplicate detection (by email, or name + phone). CSV export included.
- Client profile: upcoming visits, history, invoices, notes (formulas, allergies, preferences)

### 🏷 Services
- Category-grouped service menu with duration, price and description
- **CSV import/export** — same wizard; understands `90`, `90 min` and `1h 30m` durations,
  `$85` or `85.00` prices
- Archive services without losing appointment history

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

### ⚙️ Settings
- Business profile (shown on invoices + booking page), working hours, slot interval
- Currency symbol, tax rate, invoice numbering/footer
- Password change, demo-data reset

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

## Roadmap ideas (post-pilot)

SMS/email appointment reminders · Stripe deposits on booking · multi-location ·
staff logins with permissions · Google Calendar sync · recurring appointments ·
no-show protection fees.

---

Built to be sold: rebrand it, deploy it per customer, charge monthly. 🚀
