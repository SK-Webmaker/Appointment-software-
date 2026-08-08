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
- ✅ **Searchable client picker** in the booking editor — type name/phone/email to filter, pick, or add a new client inline
- ✅ **Client notes surface on the booking**: an amber marker on every appointment for a client
  with notes, the note text on blocks tall enough to carry it, the full note in the hover title,
  a notes panel in the booking editor the moment a client is picked (with a link to their record),
  a marker beside noted clients in the search list, and the note in the dashboard's run of the day.
  Verified owner-only — the field never reaches the booking page or any public endpoint
- ✅ **Rebook in X weeks** from any appointment: one-tap 2/3/4/6/8/12-week presets or a typed
  number, defaulting to the salon's usual gap (Settings → Hours). Carries the client, team
  member, every service, the duration and the time of day; shows the exact resulting date and
  time before you confirm, flags a closed day or a taken slot first (declining books nothing),
  and jumps the calendar to the new date once booked
- ✅ Multi-service appointments editable in the calendar (add/remove services; duration auto-sums, even for odd totals like 5h 30m)
- ✅ **"Calculated time" summary card** — live total duration, service count and exact end time as you build the booking
- ✅ Clean, phone-friendly styled dropdowns throughout the editor (large tap targets)
- ✅ Status flow: Booked → Confirmed → Completed / Cancelled / No-show
- ✅ "Now" line, per-staff colours, ⚡ badge on online bookings, 💳 badge on deposits
- ✅ **Extended day view (Fresha-style)**: shows a couple of hours before/after opening
  (and any appointment booked outside hours); the off-hours are shaded but still clickable
  so the owner can slot in an early/late walk-in — the public booking page stays limited to opening hours
- ✅ **Every-second-week days** (Settings → Hours → *Your week*): each weekday is closed, weekly, or
  every 2nd/3rd/4th week, with optional hours of its own — so "open every second Sunday, 10 till 3"
  is a two-tap setting. Anchored to a start date the owner picks (snapped onto that weekday server-side),
  alternating correctly forwards and backwards. Verified: off weeks are absent from the booking page's
  dates, a crafted booking on an off week is refused and writes nothing, the calendar shades the day
  end to end and says why, and Rebook flags a target landing on an off week
- ✅ **Customizable day-book range** (Settings → Hours): pin a preferred start/end time so the owner can scroll to exactly the hours they want — or leave on Auto
- ✅ **Block out time** with a private, owner-only reason (lunch, training, day off): shown as a hatched
  band on the calendar, removed from online-booking availability instantly (verified: blocked slots never
  offered, and a public booking attempt inside a block is rejected 409). Per-staff or whole-team, an
  **All day** shortcut, click-to-edit/remove (time reopens), and the owner can still book over it with a
  confirmation. The reason is never exposed publicly — the endpoint requires sign-in (verified 401)
- ✅ **One cancellation path** — Cancel is the only way a booking leaves the day. It frees the
  slot instantly, keeps the record marked Cancelled, and alerts the owner. Delete no longer
  erases: verified that `DELETE` cancels, that the editor offers a single Cancel action, and
  that its confirmation dialog never shows two buttons both reading "Cancel"
- ✅ **Owner chooses whether to notify the client**, per cancellation, from the confirmation
  dialog. On by default; the label names the client and the channel that would really be used.
  Verified: ticked cancels and emails, unticked cancels silently but still frees the slot and
  alerts the owner, the API enforces it (`notify_client`) rather than trusting the dialog, a
  non-boolean is rejected 400, omitting it still notifies, a self-cancelling client always gets
  their confirmation, and a client with no contact details is offered no empty promise
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
- ✅ **Past times are never offered** — slots already gone today are hidden and rejected server-side,
  computed in the business's own time zone (auto-detected) so it's correct even hosted in UTC; optional minimum booking notice
- ✅ Location step (auto-appears with 2+ locations)
- ✅ Card deposit via Stripe Checkout (fixed or % of price), fail-safe if Stripe errors
- ✅ New clients auto-added to the client book; returning clients matched by email/phone
- ✅ Booking reference (BK-xxxxx), "Add to calendar" (.ics) download
- ✅ **Client self-cancellation**: every confirmation and reminder carries a cancel link and
  states the notice period. The client sees what they're cancelling, confirms once, and the slot
  reopens — with a confirmation email to them and an alert to the owner. Inside the notice window
  (default 12h) the link stops working and points them at the phone; enforced server-side (409),
  not just hidden in the page. Verified: link present in email and SMS copy, page states the terms
  before committing, double-cancel is a no-op, reminder is dropped, slot is bookable again
- ✅ **Cancel link security**: 128-bit token, its own rate-limit bucket (30 / 10 min), payload
  carries no contact details, notes, ids or prices, unexpected fields rejected, and SQL-injection /
  enumeration / traversal probes all 404. Owner-side cancel and delete still require a login (401)
- ✅ **Book months ahead**: fortnight strip plus a picker across the whole window (default 90 days,
  settable to a year); verified a real booking 60+ days out and a refusal beyond the horizon
- ✅ **Booking page pinned to one scale** like the workspace — pinch, ⌘-wheel and ⌘+/- blocked,
  one-finger scrolling untouched
- ✅ **Slot accuracy proven**: no offered time collides with an appointment or a block, none starts
  before opening or runs past closing, all follow the slot interval, an offered slot really books
  and then vanishes, and a time never offered is refused server-side
- ✅ On/off switch in Settings

### Clients
- ✅ Searchable book: visits, last visit, lifetime billed
- ✅ CSV **and Excel (.xlsx)** import wizard: auto column-mapping (adjustable), preview, duplicate detection, results summary
- ✅ Reads .xlsx directly (dependency-free) — avoids CSV phone corruption (dropped leading 0 / "4.12E+11")
- ✅ **Smart re-import / enrich**: matches each row to an existing client (email → phone → name, with
  accents/punctuation normalised) and backfills missing phone numbers / emails instead of skipping — so a
  fresh Fresha export with phone numbers fills the gaps. De-dupes within the file, tidies phone formatting,
  and shows a dry-run preview (X new vs Y updated, with phones/emails filled in) before writing anything
- ✅ **Update contacts from a spreadsheet**: focused "verify phone numbers" flow — fills in / corrects
  numbers and emails on existing clients from an authoritative Excel/CSV (source-of-truth), only touches
  people already in the book by default, and lists any unmatched rows (verified: name-match backfills
  phones even when the sheet has accents the book doesn't)
- ✅ Duplicate-safe re-import (verified: same file twice → 0 duplicates, phone-less client backfilled)
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
- ✅ **Today at a glance**: appointment count, done vs to-go, taken vs expected, free time left
- ✅ **Next up** card (flips to a live "With you now" during an appointment)
- ✅ **Run of the day** timeline with the **free gaps between appointments** marked, so the
  owner can see at a glance where they could fit someone in
- ✅ **Client growth & retention**: new vs returning split (30d), rebooking rate, and a
  "worth a nudge" win-back list (2+ visits, nothing in 8 weeks, nothing booked)
- ✅ Revenue (7d), outstanding, client count, rebooking rate tiles
- ✅ Booking-rhythm chart + automatic busiest-window insight
- ✅ Revenue trend, top services, upcoming list
- ✅ Quick actions on landing: Take payment · Block time · New appointment

### Account & billing readiness
- ✅ **Account page** separate from Settings: profile, plan, usage, security and workspace status,
  reached from the sidebar or the avatar
- ✅ **Plan card driven per deployment** — name, price, interval, status, start/next-payment dates,
  billing contact and note are settings you control, so each business sees the terms it was sold
- ✅ **Usage counters** (clients, team, services, products, 30-day appointments and online bookings,
  messages and money collected this month) — real numbers, ready to underpin metered pricing
- ✅ Profile edits validated: malformed email rejected, duplicate email 409, `role` cannot be
  self-assigned, and changing the sign-in email clears verification
- ✅ Both account endpoints require a session (verified 401) and never return the password hash,
  salt, session epoch or verification token
- ✅ Password and email verification live in exactly one place; Settings links across rather than
  duplicating the forms

### Interface finish
- ✅ **No gradient anywhere in the interface** — buttons, page backgrounds, cards, the login
  screen, the boot splash and the booking page all use flat colour. Verified by walking every
  screen and reading computed styles: zero decorative gradients painted. The hatched patterns on
  blocked/off-hours time are kept, because there the texture carries meaning
- ✅ Filled controls use one solid accent with a neutral shadow; a disabled primary drops the
  fill rather than dimming the brand colour
- ✅ Interface copy reads as plain sentences rather than dash-joined clauses

### Brand & first impression
- ✅ **Kairo mark**: abstract "K" whose arm sweeps toward a separated dot — *kairos*, the
  opportune moment. Legible from 16px up, works on light and dark
- ✅ App icon / favicon tile regenerated at 180 / 192 / 512 px; favicon + booking &
  review pages updated to match
- ✅ **Boot splash on every open and refresh** — painted straight from `index.html` before
  any JS runs, so the app never flashes blank; held until the workspace is really loaded,
  then faded out (respects `prefers-reduced-motion`)
- ✅ Post-login cinematic intro redrawn around the new mark (strokes draw in sequence)

### Platform
- ✅ Login (scrypt-hashed passwords), HttpOnly signed session cookies, login rate limiting
- ✅ Parameterized SQL everywhere, HTML-escaped rendering, path-traversal-safe static serving
- ✅ Single-file SQLite database (one-file backup/restore), demo seed + one-click reset
- ✅ **Phone-first responsive UI** — full-width pages, slide-out labelled nav, thumb-sized controls, no clipped values; verified across every screen at iPhone width
- ✅ **Fixed scale, like a native app**: pinch-zoom and double-tap zoom are off in the workspace, so a
  stray gesture can't leave the UI zoomed and offset on the home-screen install. Pinch is cancelled in
  JS (iOS ignores `user-scalable=no`), double-tap by `touch-action: manipulation` — no tap is ever
  cancelled by our code, so nothing can be swallowed. Scrolling (page, modal, sideways calendar) and
  typing are untouched. **The public booking page stays zoomable** for customer accessibility
- ✅ **One control scale on phones**: 44px inputs/buttons, 40px icon buttons, 38px segmented and
  colour controls, shared `.chk` checkbox and `.color-dot` swatch — so every screen reads as one system
- ✅ **No horizontal overflow anywhere** — audited at 320/360/390/402/430px, both in Chromium and with
  WebKit's select-sizing behaviour simulated (Safari widens a `<select>` to its longest option, which is
  what pushed the appointment editor off-screen). Guarded with `min-width:0` on grid/flex children and
  `max-width:100%` on every control
- ✅ `-webkit-text-size-adjust: 100%` — stops iOS silently inflating text and throwing label/value
  proportions out
- ✅ Modal footers wrap: the confirming action takes its own full-width row, so a third button
  (Delete · Checkout · Save) can never be cut off
- ✅ Date fields render left-aligned like every other field (iOS styles them right-aligned by default)
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

**Deploy (one command per client)**
- [ ] DNS: their hostname resolves to the server (a wildcard `*` record on your own domain
      removes this step for anyone not using their own domain)
- [ ] Their Resend account created **in the business's name** and an `re_…` key copied
      (free tier: 100/day, 3,000/month — counted **per account**, so one account each)
- [ ] ClickSend subaccount added, if they want texts (`Modify users` off, `Hide pricing` on)
- [ ] `sudo scripts/new-business.sh --name … --host … --email … --resend-key …` run
      — it does the folder, service, HTTPS, login and settings, and prints the admin password **once**
- [ ] Generated password saved somewhere you'll have it in the room
- [ ] Both pages checked: workspace loads with a padlock, `/book` shows the demo salon
- [ ] **Setup wizard NOT run** — that happens with the owner watching, and it's what clears the demo data
- [ ] Nightly backup of `/srv/kairo/data/` configured (a daily copy is enough)

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
      (Settings → **Share** puts it straight into Instagram from their phone)
- [ ] Owner knows that link is permanent: every service, price and opening-days change
      they make later shows on it by itself, so it never needs re-posting
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
