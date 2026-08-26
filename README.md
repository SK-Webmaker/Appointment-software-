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
- **Searchable client picker** in the booking editor — type a name, phone or email to
  filter your client book, pick from the list, or add a brand-new client inline
- **📝 Client notes right on the booking** — whatever you've recorded about someone
  (allergies, colour formula, how they like it) shows on their appointment in the
  calendar, in the day's run on the dashboard, and in the booking editor the moment you
  pick them. An amber marker always appears (even on a short booking) so nothing is
  missed, the note itself shows when the block has room, and the full text is in the
  hover tooltip. Owner-only — customers never see it.
- **🔁 Rebook in X weeks** — open a client's appointment, hit **Rebook**, and tap
  2 / 3 / 4 / 6 / 8 / 12 weeks (or type any number of weeks). Everything is carried
  over — same client, team member, services, duration and time of day — and the dialog
  shows the exact date and time you're about to book before you confirm, plus a warning
  if that day is closed or the slot is already taken. Set the salon's usual gap in
  **Settings → Hours** and that's what it suggests every time.
- **Multi-service appointments with a live "calculated time" total** — add/remove services
  in the editor and the duration auto-sums (even for odd totals like 5h 30m); a summary
  card shows the running total, service count and the exact end time
- **Clean, phone-friendly dropdowns** across the whole editor (styled to match the app,
  large tap targets)
- Double-booking detection with an explicit override; **overlapping appointments stack side-by-side** in the staff column
- Status flow: Booked → Confirmed → Completed (plus Cancelled / No-show)
- "Now" line, online-booking badge, per-staff colours
- **Extended range with shaded off-hours (Fresha-style)**: the grid shows a couple of
  hours before opening and after closing (and expands to include any appointment booked
  outside hours). Those off-hours are greyed but still clickable/draggable, so the owner
  can fit in an early or late walk-in — while the customer booking page stays limited to
  opening hours.
- **Customizable calendar range**: set a preferred start/end time for the day book in
  Settings → Hours (e.g. always show 6 AM → 11 PM) so the owner can scroll to exactly the
  times they want; leave it on **Auto** to follow opening hours.
- **📣 Every booking and every move asks who to tell, and how.** Booking someone
  in, or dragging them to a new time, is a change to *their* day — so Kairo asks
  once, at the moment of saving: **Email them · Text them · Email and text ·
  Don't send anything**. Only the channels that client can actually receive are
  offered (each showing the address or number it would use), it opens on
  whatever *Settings → Notifications* says so the usual answer is one tap, and
  the toast afterwards says what really happened — *"Moved — Amara Osei has been
  told"* or *"Moved — no message sent"*. Backing out cancels the save, not just
  the message. Edits that don't change what the client turns up for — a note, a
  status, a longer slot — save without a dialog.
- **A move sends a "your appointment has moved" message that leads with the old
  time**, so a client skimming it can see something changed rather than reading
  it as a duplicate confirmation. (Fixed in v1.32.0: moving an appointment used
  to tell the client **nothing at all** — only the reminder was quietly
  re-scheduled, so anyone moved without a phone call still had the old time in
  writing.)
- **❌ One way to cancel** — Cancel is the only way a booking comes off the day.
  It frees the slot immediately and keeps the booking on record marked Cancelled
  so the history survives. There is no separate "delete": the two did the same
  job, except delete told nobody and lost the record.
- **You choose whether the client is told.** The confirmation dialog carries a
  tick box, on by default, naming the client and the channel it would actually
  use ("Let Amara Osei know by email"). Turn it off when you're already on the
  phone to them or you'd rather say it in person, and the appointment is
  cancelled quietly. The owner's own alert still goes out either way, and a
  client with no email or phone is never promised a message that can't be sent —
  Kairo counts what was actually queued rather than assuming, so the toast can't
  claim someone was told when there was no way to tell them.
- **The same question on every route out.** Setting Status to **Cancelled** in
  the editor and hitting Save is a cancellation too, so it asks exactly the same
  thing — same wording, same tick box, same undo. One action, one behaviour, no
  matter which control the owner reached for. (Fixed in v1.30.3: that path used
  to skip the cancellation entirely, so nobody — client *or* owner — was told.)
- **↩️ Undo, and the client never knows.** Cancelling the wrong booking is the
  one mistake that can't be walked back with an apology, so the client's message
  is **held for two minutes** and an **Undo** button sits in the confirmation
  toast for fifteen seconds. Tap it and the appointment goes back on the
  calendar with the status it had before, the held message is stopped before it
  sends, and the reminder is re-queued. If the slot was taken in the meantime
  the undo is **refused rather than double-booking**, and if the message did
  manage to go out Kairo says so plainly — *"put back, but she was already told,
  so give her a call"* — instead of pretending nothing happened. The owner's own
  alert is never held; only the client's.
- **🔒 Block out time**: block any period (lunch, training, a dentist appointment, a whole
  day off) with a **private reason only the owner sees** — customers never see it. Blocked
  time is removed from online booking immediately, so nobody can book into it. Block one
  team member or **everyone**, use **All day** for holidays, and click a block to edit or
  remove it (the time reopens for booking straight away). The owner can still book over
  their own block manually after a confirmation.

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
- **Book months ahead** — the date strip shows a fortnight at a time with a
  picker beside it that reaches the whole booking window (default 90 days,
  configurable up to a year), so a client wanting a slot in two months isn't
  stuck scrolling. Dates beyond the window are refused server-side too.
- **Every offered time is real** — the slot list is computed from the same
  availability the calendar uses: opening hours for that specific date, minus
  existing appointments, minus owner-blocked time, minus anything already gone
  today. A time the page never offered is rejected server-side even if crafted
  by hand, and a slot vanishes the moment someone else takes it.
- **Fixed scale, like the workspace** — pinch, double-tap and ⌘-zoom are off, so
  a stray gesture can't leave the booking page zoomed and offset mid-booking.
- New customers are added to your client book automatically; returning ones are matched by email/phone
- Toggle it on/off in Settings; put the link in an Instagram bio / Google Business profile
- **One permanent link, always current.** `/book` is a fixed URL whose contents are read
  live on every visit: add a service, rename one, change a price, archive one, close a
  weekday, switch a day to alternating weeks, rename the business — the link a customer
  bookmarked six months ago shows it on their next load. Nothing is baked in at share
  time, and `/api/public/info` is served `Cache-Control: no-store` so no proxy or browser
  can hand back a stale menu. The owner never re-posts the link. Settings says so on the
  card where the link is copied, so nobody wonders.
- **Open in browser / Share** beside the link: hands it to Safari or Chrome (with the
  phone's share sheet where there is one) rather than opening it inside Kairo

### 👥 Clients
- Searchable client book with visit counts, last visit and lifetime billed
- **Smart CSV / Excel import & re-import**: drop an export from Fresha, Square, Acuity or
  any spreadsheet — **`.csv` or `.xlsx`** — and columns are auto-matched by name
  (adjustable). Reading the real Excel file directly avoids the phone-number corruption a
  CSV round-trip through Excel causes (a dropped leading `0`, or `0412…` becoming
  `4.12E+11`). Each row is matched to an existing client by **email → phone → name**
  (accents and punctuation are normalised, so "Dubé" = "Dube" and "O'Neill" = "ONeill"),
  and instead of just skipping people you already have, it **fills in the details they're
  missing**. No duplicates created, duplicates *within* the file collapse too, phone numbers
  are tidied to a consistent format, and a **preview** shows exactly how many will be added
  vs. updated before anything is written. CSV export included.
- **Update contacts from a spreadsheet** (📱 button): a focused "verify phone numbers" flow —
  upload the authoritative Excel/CSV and it matches each row to a client you already have and
  **fills in or corrects their phone number and email** (treating the sheet as the source of
  truth). By default it only touches existing clients and clearly lists anyone in the file it
  couldn't match, so contact details — which are vital — end up complete and correct.
- **Merge duplicates**: finds clients that share an email, phone or name, and merges
  each set into one — the duplicate's appointments, invoices, messages and reviews move
  to the record you keep, missing details (email/phone/notes) are filled in, then the
  duplicates are removed. Runs in one transaction; you pick which record survives, and a
  **Merge all** button clears every detected set at once.
- Client profile: upcoming visits, history, invoices, notes (formulas, allergies, preferences)
- **📌 Notes written on a booking follow the client.** Anything typed in the notes
  box on an appointment ("wants to go shorter next time", "allergic to the blue
  toner") is copied onto that client's record as a **dated line**, so it comes up
  the next time they're in — no separate step to remember. Re-saving the same
  booking never duplicates it, a second note is **appended not swapped in**,
  anything the owner typed on the client themselves is never overwritten, and a
  walk-in with no client record is simply skipped.

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
    moment Stripe confirms, no refresh. The wait stops the instant the owner
    leaves the till, and gives up after 15 minutes, so a sale nobody finishes
    can't leave the phone quietly talking to the server all day (v1.33.1)
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

### 📱 Runs as an app from the home screen
- Add the workspace to an iPhone/Android home screen and it opens full-screen with
  your business's own name and icon (web manifest + Apple touch icons).
- **Fixed scale, like a native app** — pinch-zoom and double-tap zoom are disabled in
  the workspace, so a stray gesture can't leave the interface zoomed and offset
  mid-service. Scrolling, sideways swiping on the calendar and typing all behave
  normally. (iOS deliberately ignores `user-scalable=no`, so the pinch gesture is
  cancelled in code; double-tap is handled by `touch-action`.)
- **The booking link leaves the app.** Every route into `/book` — the sidebar shortcut,
  the Settings preview, the Account card, the **Open in browser** button — is a
  `target="_blank"` hand-off, so the phone opens it in Safari or Chrome and the owner
  keeps their place in Kairo. That also gives them an address bar and a share button,
  which a home-screen app has neither of. Where a phone insists on keeping it in the
  app window anyway, the booking page notices it is running standalone and adds a
  **← Back to Kairo** bar; customers, who have no manifest, never see it.

### 📊 Dashboard
- **Today at a glance** — the operational view the owner opens on: how many
  appointments, how many are done vs still to come, what's actually been taken
  against what's expected, and how much free time is left. A **Next up** card
  (which switches to a live "With you now" while an appointment is running) plus
  the **whole run of the day** as a timeline, with the **free gaps between
  appointments** called out so you can see where someone could be fitted in.
- **It stays true as the day passes.** The dashboard is the page left open on the
  back bench all morning, so it can't be a snapshot: the card, the done/to-go
  count and the free time left all re-derive from the clock every 30 seconds, and
  the run of the day ages with it — a visit that's been and gone recedes, the one
  happening now is marked, and a free window that's passed stops being offered.
  So a client whose appointment finished at 10am is never still sitting there as
  "Next up" at 2pm. Coming back to the tab, crossing midnight, or waking a slept
  phone refetches rather than guessing — **once**, and at most every ten seconds.
  (Fixed in v1.33.1: that wake-up refresh registered a *new* listener on every
  render, and the listener re-renders — so each unlock of the phone doubled the
  listeners and the requests: 1, 2, 4, 8, 16… By the eleventh unlock a single
  phone fired over a thousand requests in one burst and the rate limiter locked
  the owner out of their own salon with "Too many requests". Measured, fixed,
  and covered by a test that fails if it ever grows again.)
- **The dashboard and the calendar are never a day apart.** Both draw the day the
  owner's device is standing in, and the panel asks the server for that exact
  date and minute — so "Today at a glance" is, by construction, the same day the
  day book shows. (Fixed in v1.31.0: the dashboard used to take its *date* from
  the server's own calendar while taking its *clock* from the business's zone.
  On a hosted box running UTC that meant every morning until mid-morning it drew
  **yesterday's** run against today's time — so "Next up" was a client who had
  been in the day before. The same raw server date was stamping payments, which
  filed a 9am sale under yesterday's takings.)
- **It catches a wrong time zone instead of quietly lying.** The business's own
  zone is checked against the device on every load. If they disagree by more than
  10 minutes, or land on different dates, the zone is misconfigured — the classic
  case being a hosted box falling back to UTC. The panel and the calendar still
  read correctly because they follow the device, but the owner is told plainly
  that the zone needs fixing **and that the booking page and reminders are still
  using the wrong one** — because those genuinely are wrong until it's set. A
  time zone the server can't resolve is rejected on save rather than stored, so
  the "looks configured but silently falls back to UTC" state can't be created.
- **📲 Pull down to refresh.** On a phone, pull down at the top of any page and it
  reloads — settings, team, services, then the page itself. A home-screen app has
  no address bar and so no reload button, which left "is this still right?" with
  no answer short of closing the app. The gesture is ignored mid-page, inside a
  dialog, and inside anything that scrolls on its own, so it only ever fires when
  it's genuinely meant.
- **Client growth & retention** — new vs returning visits over 30 days, a
  **rebooking rate** (how many clients come back within a month), and a
  **"worth a nudge"** list of lapsed regulars: 2+ past visits, nothing in 8 weeks
  and nothing booked, so it's a real win-back list rather than noise.
- Revenue collected (7 days), outstanding balance, client count, rebooking rate
- **Booking rhythm** chart (busiest hours, last 30 days) with an automatic insight
  ("You're busiest between 9–11 AM")
- Revenue trend, top services, upcoming appointments
- Quick actions right where you land: **Take payment · Block time · New appointment**

### ❌ Cancellations that handle themselves
- Every confirmation and reminder carries a **cancel link** and states the
  notice period, so the terms are wherever the client looks — and the same
  line appears on the booking page **before** they commit.
- The client taps it, sees exactly what they're cancelling, and confirms. The
  slot reopens instantly, **the owner is emailed**, and **the client gets a
  confirmation** so nobody is left guessing.
- **Inside the notice window the link stops working** and the client is asked
  to call instead — the owner always gets enough warning to fill the gap.
  Enforced server-side, not just hidden in the page.
- Set it in *Settings → Hours & booking*: any time before, 2/6/12/24 hours,
  2 days, or no online cancelling at all. Default is **12 hours**.
- When the **owner** cancels, the same thing happens in reverse: the client is
  emailed, the slot reopens, the record stays — except the client's email waits
  two minutes, so the **Undo** in the toast can catch it if the wrong booking
  was tapped. The owner is always asked first and can **turn the client's
  message off** for that one cancellation; their own alert goes either way.
- **A client cancelling their own booking is never silenced.** The "don't tell
  them" choice belongs to the owner alone — the public cancel link refuses the
  flag outright, so a client always gets their confirmation.

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

- **📶 Your SMS credit, live in the system.** Texting is prepaid: when the balance
  runs out the reminders simply stop going out, and nothing in the salon says why.
  Kairo reads the **live balance straight from ClickSend** and shows it on
  *Settings → Notifications* and on the **Messages** page — as money *and* as
  roughly how many texts that buys, worked out from what the salon's last text
  actually cost. It goes **amber under ~50 texts** and **red at zero**, with a
  **Top up** link straight to ClickSend. The estimate only appears once a text
  has really been sent (that's when the true per-message rate for that account
  and country is known) and is always rounded **down**, so it never promises more
  than is there. Wrong keys, an unreachable provider or a different SMS provider
  each say so in plain words rather than showing a blank or a stale number.

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

### 🗓 The team roster — who works when (v1.34.0)
- ***Team → Scheduled shifts*** is a week grid: one row per person, one cell per
  day, showing **"11 AM – 5 PM"** or **"Not working"**. Page through the weeks,
  tap any cell to change that one day.
- **A usual week per person** — tick the days they work and set the hours. That
  pattern then applies to every week without being re-entered.
- **One-off changes without touching the pattern** — a late start next Thursday,
  or a day off, is set on the day itself. "Back to usual" removes it again.
- **The booking page follows it, automatically.** A customer is only offered a
  time when the person they picked is rostered on **and** the salon is open. Pick
  a stylist who does Tuesdays and Wednesdays and the date strip shows only
  Tuesdays and Wednesdays — no more tapping a day to find it empty.
- **"Any available" pools only who is actually on**, so two stylists working
  opposite days cover the whole week between them without either being offered
  on a day they're off.
- **Both have to hold.** A shift running to 7 can't take a 6pm booking in a salon
  that shuts at 5, and a salon open at 9 won't offer 9am with someone who starts
  at 11 — whichever is tighter wins.
- **Nobody is constrained until you say so.** A team member with no week set
  simply follows the salon's opening hours, and the grid says exactly that
  ("follows salon hours"). A one-person salon that never opens this screen keeps
  working precisely as before.
- **The calendar shows it** — the hours a person isn't rostered are shaded in
  their column, so "Maya isn't in until 11" reads at a glance. The owner can
  still book into it; it's information, not a wall.
- **It won't strand a client quietly.** Rostering away a time someone is already
  booked into says so, by name, instead of leaving it to be discovered when they
  turn up.
- **Deliberately not included:** timesheets (clocking in to evidence hours) and
  pay runs (wages, tips, commission). Both are payroll — neither changes what a
  customer can book, and this is a booking system.

### 📆 Working days — including every-second-week days
- *Settings → Hours & booking → **Your week*** gives each weekday its own line:
  **Closed**, **Every week**, or **every 2nd / 3rd / 4th week** — plus an
  optional **"Own hours"** for that day. So "we open every second Sunday, 10
  till 3" is two taps, and a late-night Thursday is one.
- A repeating day is anchored to a **start date you pick**, and alternates on and
  off from there (in both directions, so past weeks read correctly too). Pick any
  date and Kairo snaps it onto that weekday.
- Off weeks behave exactly like closed days: they **never appear** on the customer
  booking page's date picker, and the server refuses those bookings even from a
  crafted request. On the calendar an off week is shaded end to end with a line
  saying *why* — "Sundays only run every 2nd week, 10 AM–3 PM — this is an off
  week" — so it never reads as a fault.
- Staff can still add walk-ins on a closed day or an off week from the calendar
  (one-off openings)
- Because the offered dates can now skip a week, the booking page's date strip
  **names the month** whenever the dates it shows cross one.

### 🎛 Interface
- **Flat, solid colour throughout.** No gradient buttons, no coloured glow
  behind controls, no decorative wash on page backgrounds. Filled controls take
  one solid accent with a neutral shadow, the way working software does; the
  only gradients left are the hatched textures that mark blocked and off-hours
  time, where the pattern carries meaning.
- A disabled primary button drops its fill entirely rather than dimming the
  brand colour, so an inert control reads as inert.

### ✉️ Branded HTML emails
- Confirmations, reminders, receipts and review requests go out as **polished,
  mobile-friendly HTML emails** carrying the **business's own logo** in the
  header, in their brand colour, with a details
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

### 📋 Waitlist & automatic filling (v1.39.0 — off by default)
Settings → **Waitlist & automatic filling**. Two switches, both off on every
install:

- **Let customers join a waitlist** — when the day they wanted is full, the
  booking page offers *"Let me know if this day frees up"* instead of "try
  another date". The list just builds; nothing is sent.
- **Offer a cancelled slot automatically** — the one thing Kairo does without
  asking first, because a Saturday that frees up at 8pm on Thursday is worth far
  more than the same slot offered on Friday lunchtime, and the owner will be
  cutting hair. Matched on the service, the stylist and the days that client
  actually said suited them, capped at however many people you choose, first to
  book gets it.

It obeys the same fortnight cooldown as every other message, so somebody who
got a rebooking nudge this morning is not also texted tonight. And it can never
be the reason a cancellation fails — if the waitlist errors, the appointment
still cancels and the error is logged.

### 🧭 A walk round the place (v1.39.0)
After setup, Kairo offers a short guided tour of the screens that matter —
pointing at the real thing on the real page. **Skip is on every step**, it runs
once, and Settings can bring it back for an owner who skipped it on day one and
wants it in week two. A step whose target isn't on screen is dropped rather than
highlighting empty space, so it shortens itself on a phone instead of breaking.

### 📱 Getting Kairo onto a phone (v1.39.0)
The last step of setup explains it, per platform, because Kairo is a website
rather than an App Store app — which is a feature (nothing to update, nothing to
approve) but means nobody finds it on their home screen unless they're told how.
An owner who runs their salon from an icon opens it twenty times a day; one who
has to remember a URL opens it twice.

### ⚡ Opportunities — what the diary is quietly costing (v1.37.0)
At the bottom of the dashboard, below the day's work, because it's what you read
when you have a minute rather than a client waiting. A revenue figure is a
report — it tells an owner what already happened. This looks for the money that
*didn't*, and could still be recovered:

- **Empty time** — gaps between existing bookings in the next few days, valued
  at what could fill them
- **Cancelled slots nobody took** — already-earned money handed back, and the
  most recoverable thing on the list
- **Regulars who are late coming back** — judged against **their own** rhythm,
  not one number for everybody: someone who genuinely comes quarterly isn't
  chased at 8 weeks, and someone who came fortnightly and vanished is caught
- **The weekly dead spot** — the weekday-and-hours block that's consistently
  emptiest
- **The few clients behind most no-shows** — so the owner can deal with three
  people instead of putting a deposit on everyone

Three rules keep it trustworthy, because a panel like this is believed or
ignored and there's no middle:

1. **It never guesses.** Not enough history means the finding is withheld, not
   softened. A three-week-old salon is told nothing about its Tuesdays.
2. **It values low.** A gap is worth the *cheapest* service that fits, and only
   between real bookings — a nine-hour hole is a rostering question, not lost
   revenue. Money already lost (no-shows) is shown but deliberately **excluded**
   from the headline, because it isn't on the table this week.
3. **It shows the working.** Every finding carries the rows that produced it.

Each finding also says **what to do about it** — and where a message is the
answer, drafts it.

### 📣 Acting on it — one button, one preview (v1.38.0)
**Draft a message** on a finding opens a preview that has to be got past before
anything leaves:

- **Who it goes to, and why each of them.** "5 visits · usually every 4 wks ·
  last in 10 wks ago" beside every name, so the one that looks wrong can be
  unticked. An owner who can't see the reasoning won't trust the software with
  their client list, and they'd be right not to.
- **Email, SMS or both** — and what it costs *before* sending. SMS is priced by
  real 160-character segments, so a long message is shown as two texts rather
  than one, and email says **Free** in green.
- **The words, editable.** Kairo drafts them; the owner has the last say.
  `{first_name}` becomes each person's name. **Kairo never invents a discount** —
  software that quietly cuts a business's margins isn't on their side.

**The cooldown.** No client is sent a campaign message twice within 14 days
(configurable) — **across all campaign kinds**, not per kind. Somebody who is
both overdue *and* free at tomorrow's gap is one person with one phone. It's
re-checked on the server at the moment of sending, so a preview left open while
another campaign went out can't message anyone twice.

Nothing sends by itself. Every send is one person pressing one button having
seen the list.

### ✉️ Replies that reach a human (v1.36.0)
Settings → Notifications → **Replies go to**. Messages are *sent* from a domain
that exists only to send and has no inbox behind it. Without a reply-to, a client
who hits Reply on their confirmation — and plenty do, "can I move to 3?" — gets a
bounce, and the salon never learns the message existed. That's a lost client, and
nothing anywhere reports it.

Falls back to the business email if the field is left blank, and the hint under
it always states the address replies will *actually* land on, so a typo shows as
a typo instead of quietly sending them nowhere.

### 📵 The starter-sender reminder (v1.36.0)
When a business is set up with a lent SMS sender so its texts work on day one,
Settings → SMS says so until they put their own in. Kairo has no access to their
ClickSend account and can't make the swap for them — all it can do is keep
asking. The reminder is derived by comparing the current sender against the
lent one, so it retires itself the moment they change it: no flag to clear, and
no way for it to claim it's resolved when it isn't.

### 💾 Backups that prove themselves (v1.35.0)
Settings → **Backups**. The whole business — every client, appointment, invoice
and payment — is one file. If the machine it sits on is ever lost, this is what
gets it back, which is why the copy is **emailed off the machine** rather than
kept next to the original.

- A consistent snapshot (`VACUUM INTO`, safe to take while people are booking),
  gzipped — a 6.4 MB database goes out as about 190 KB.
- Daily, weekly or fortnightly, or **Send one now** to watch the whole path work
  before trusting it. **Download a copy** saves it straight to the owner's
  machine.
- A status line saying when the last one actually arrived and how big it was —
  the point of the panel, because a backup that quietly stopped working months
  ago is worse than none, since it is believed.

### 🛡 Cloudflare protection — optional, off by default (v1.35.0)
Settings → **Cloudflare protection**. For businesses whose booking link runs
through Cloudflare. Both switches ship off and nothing changes until an owner
turns them on. Full detail in [SECURITY.md §6b](SECURITY.md).

- **Only accept traffic through Cloudflare.** Cloudflare filters bad traffic,
  but the host underneath stays reachable — on Render its `*.onrender.com`
  address can't even be turned off — so anyone who finds it walks past all of
  it. Kairo can refuse anything that didn't arrive through Cloudflare.
  **Watch-only** mode counts what's arriving directly so the owner can see it's
  safe *before* enforcing, and the app **won't let them enforce** from a
  browser that isn't already coming through — the mistake that would otherwise
  lock them out of their own Settings. `KAIRO_ORIGIN_LOCK=off` in the host's
  environment is the way back in regardless.
- **"I'm not a robot" check on the booking page.** The booking page has no login
  by design, so anything that finds it can create appointments. Cloudflare
  Turnstile (free, unlimited) verifies visitors server-side before a booking is
  taken; most customers never touch it. Paste the two keys and tick the box. If
  Cloudflare is ever unreachable it **lets the booking through** — a lost client
  costs more than the spam.

### 🗓 Extra touches
- "Add to calendar" (.ics) button on the customer confirmation screen
- Online bookings marked ⚡ on the calendar

### 👤 Account (the owner's own page)
- Separate from Settings, which configures the *business*. Account answers a
  different question: **who am I signed in as, what am I on, and what am I
  getting for it.** Reached from the sidebar or by tapping your avatar.
- **Profile** — your name and sign-in email. Changing the email restarts
  verification, because a tick earned by one inbox shouldn't transfer to another.
- **Your plan** — name, price, interval, status (Active / Free trial / Pilot /
  Payment due / Cancelled), start and next-payment dates, who to ask about the
  bill, and a free-text note. All set per deployment in Settings, so **you
  decide what each business sees and is charged**; the owner reads it.
- **What you're using** — clients, team, services, products, appointments and
  online bookings (30 days), messages sent and money collected this month. Real
  counts, which is also the honest basis for metered pricing later.
- **Security** — password, email verification, and a warning if the instance is
  still on the default password.
- **Your workspace** — booking-page status, whether email and SMS are set up,
  the size of your database, the version, and a one-click client export.

### ⚙️ Settings
- Business profile (shown on invoices + booking page), usual hours, **your week**
  (per-day: closed / weekly / every 2nd–4th week, each with optional own hours),
  slot interval, **how far ahead customers can book**, **cancellation notice**,
  **usual rebooking gap**
- Currency symbol, tax rate, invoice numbering/footer
- Notification providers, deposit rules, locations
- Plan and billing terms shown to the business owner (name, price, status,
  dates, billing contact, note)
- Demo-data reset and the guided setup wizard; personal profile, password and
  email verification live on the **Account** page

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

**Render (no terminal needed).** Use the Blueprint in this repo: Render → New →
Blueprint → pick the repo → name it after the business → fill in
`KAIRO_ADMIN_EMAIL` and `KAIRO_ADMIN_PASSWORD` → Apply. `render.yaml` declares the
**1 GB persistent disk** and `KAIRO_DATA_DIR`, which is the setting that decides
whether the business's data survives the next deploy. One Render account holds one
service per business; a single `git push` updates all of them.

> Kairo checks its own storage at boot. On Render, Railway, Fly or Heroku with the
> database inside the app folder — i.e. no disk attached — it prints a
> **DATA WILL BE LOST** banner. Never leave a paying customer in that state.

**Or one command per business**, on a box with Node 22 and Caddy:

```bash
sudo scripts/new-business.sh \
  --name "Hair by Sha" \
  --host book.hairbysha.com.au \
  --email sha@hairbysha.com.au \
  --resend-key re_xxx --from "Hair by Sha <hello@hairbysha.com.au>"
```

It picks a free port, creates that business's own data folder, writes and starts a
systemd unit, writes the Caddy site so HTTPS appears by itself, waits for the instance
to answer, signs in to prove the login works, saves their name/address/keys, and prints
a generated admin password once. `--dry-run` shows every file and command without
touching anything; it refuses to touch a business that already exists. `--help` lists
the flags.

- **One code checkout, one data folder per business.** Updating everyone is
  `git pull && systemctl restart 'kairo-*'`
- One Kairo instance = one business (single-tenant by design), so they share nothing but
  the files in this repo
- Each database is one file under `/srv/kairo/data/<slug>/` — back the folder up nightly
- `/srv/kairo/businesses.tsv` records every business, host, port and service
- Environment overrides: `PORT`, `HOST`, `KAIRO_DATA_DIR`, `KAIRO_ADMIN_EMAIL`,
  `KAIRO_ADMIN_PASSWORD` (first-run only); the script sets all of these for you
- Doing it by hand instead: `PORT=80 node --disable-warning=ExperimentalWarning server.js`
  behind nginx/Caddy works the same way

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

### Onboarding a business — the whole runbook

**[ONBOARDING.md](ONBOARDING.md)** is the six-step process for putting a new
business on the platform: their address on your domain, DNS, the Render service,
Resend, ClickSend, and the one pass you make through the app before handover.

Every business gets `<business>.kairobookings.com` — the booking page customers
see and the domain its email is sent from — plus its own Render service, its own
database, and its own provider accounts. Nothing is shared between businesses.

```bash
export CLOUDFLARE_API_TOKEN=...

# Look first. This changes nothing.
node scripts/onboard-business.mjs --business glowbar --service glowbar-booking

# Then, with the DKIM value Resend gives you:
node scripts/onboard-business.mjs --business glowbar --service glowbar-booking \
  --dkim "p=MIGfMA0GCS..." --apply

# And the blueprint for this one business, ready to paste:
node scripts/onboard-business.mjs --business glowbar --render
```

It creates four records, skips any that already exist, refuses a truncated DKIM
key, and **never adds a second `_dmarc`** — two DMARC records on one domain make
mail receivers treat it as having none, for every business on it.

### Optional: put the domain behind Cloudflare

Only if the business has its own domain on a Cloudflare account. Everything in
this step is optional and Kairo works exactly the same without it.

```bash
export CLOUDFLARE_API_TOKEN=...          # scoped to this one zone, with a TTL

# Look first. This changes nothing.
node scripts/cloudflare-setup.mjs --domain example.com

# Then, with the secret from Settings → Cloudflare protection:
node scripts/cloudflare-setup.mjs --domain example.com \
  --origin-secret XXXX --turnstile --rate-limit --apply
```

It checks the three things that are easy to get wrong by hand — that the DNS
record is actually **proxied** (unproxied means Cloudflare never sees the
traffic and none of its filtering applies), that the encryption mode is **Full
(strict)** rather than Flexible, and that a Transform Rule stamps the shared
secret on every forwarded request — and reports each one before touching
anything. `--turnstile` creates the widget and prints both keys; `--rate-limit`
adds the single rule a Free plan allows, set as a volumetric ceiling well above
anything a real person does.

The token needs, limited to this one zone: **Zone → Zone → Read**, **DNS →
Edit**, **Zone Settings → Edit**, **SSL and Certificates → Edit**, **Transform
Rules → Edit**, **Firewall Services → Edit**; plus **Account → Rulesets → Read**
(Transform Rules require it) and **Account → Turnstile → Edit** for
`--turnstile`. Set a TTL when you create it, and revoke it when you're done.

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
