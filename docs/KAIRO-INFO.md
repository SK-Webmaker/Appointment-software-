# Information about Kairo

*Reference sheet for building the Kairo portfolio site. Paste this whole file in
as context alongside your design prompt — it carries the description, the
feature hierarchy, and the screenshot manifest.*

---

## 1. What Kairo is

**Kairo is the software a service business runs its whole day on.**

Bookings, the calendar, the client book, payments, retail stock, and every
message that goes to a customer — one system, one login, no add-ons. It replaces
the paper diary, the phone-tag, the spreadsheet of client numbers, and the card
machine that doesn't talk to any of them.

It is sold **white-label**: each business gets its own Kairo, its own booking
page, its own data. Nothing is shared with another business, and nothing is
pooled in one big multi-tenant database.

**Who it is for:** hair and beauty salons, barbers, braiders, nail and lash
techs, tattoo studios, clinics, personal trainers — anyone who sells time.

**The promise, in one line:** *the diary that answers the phone, chases the
money, and never double-books.*

**Live since day one** — Kairo runs a real Melbourne salon's bookings, payments
and customer emails in production, not a demo.

### What makes it different

| | |
|---|---|
| **Zero dependencies** | The entire platform is hand-written — no frameworks, no npm packages, no build step. Nothing to break when a library updates, nothing to patch when one is compromised. |
| **Phone-first, not phone-tolerant** | The owner runs the salon from an apron pocket. Every screen is built for a thumb first and a desktop second. Installs to the home screen, no app store. |
| **Honest by design** | The system never claims something happened that didn't. If a message can't be sent, it says so. If a client was already told, it says so. If the time zone is wrong, it says so. |
| **Built for non-technical owners** | No jargon, no settings the owner doesn't need, plain-English confirmations at the moment a decision is made — not buried in a preferences screen. |

---

## 2. The feature hierarchy

Ordered as a journey — this is the spine a scrolling site should follow.

### ACT I — The owner opens the app
> *"What do I need to know right now?"*
> **Screens: `01`, `02`, `03`**

1. **Today at a glance** — appointments booked, how many are done vs still to
   come, what's actually been taken against what's expected, and how much free
   time is left in the day.
2. **With you now / Next up** — a live card showing who is in the chair and who
   is walking through the door next. It re-derives from the clock every 30
   seconds, so it's never stale.
3. **The run of the day** — the whole day as a timeline: past visits recede,
   the current one is marked, and the **free gaps between bookings** are called
   out so the owner can see exactly where someone could be fitted in.
4. **Client notes right on the day** — allergies, colour formulas, preferences
   surface on the appointment itself, so nothing is missed mid-service.
5. **Money, live** — revenue collected this week, outstanding balances, and
   today's takings against today's expected.
6. **Client growth & retention** — new vs returning visits, a **rebooking rate**
   (how many come back within a month), and a **"worth a nudge" win-back list**:
   clients with 2+ past visits, nothing in eight weeks, and nothing booked.
7. **Booking rhythm & trends** — appointments by hour of day (so the owner knows
   which hours to protect), revenue per day, and the top-selling services.

### ACT II — The day book
> *"The diary, but it can't be double-booked."*
> **Screens: `04`, `05`, `06`**

1. **Day view, a column per team member** — the Fresha-style book, colour-coded
   per stylist, with blocks sized to the real length of each service.
2. **Week view** — seven days at a glance, per stylist or for everyone.
3. **Drag to reschedule** — move a booking to a new time or a different stylist
   by dragging it; drag its bottom edge to make it longer.
4. **Multi-service bookings** — "Root Colour + Blow Dry" is one appointment with
   the combined duration and price, not two bookings jammed together.
5. **Block out time** — lunch, training, a delivery, a whole day off, with a
   **private reason only the owner sees**. Blocked time vanishes from online
   booking immediately.
6. **Booked-online marker** — every appointment shows whether it came from the
   public page or was taken by the salon.
7. **The booking editor** — searchable client picker, add a brand-new client
   inline, multiple services, team member, time, status, and notes.

### ACT III — Changes that don't cost you a customer
> *This is the part competitors get wrong.*
> **Screen: `07`**

1. **Every booking and every move asks who to tell, and how** — a single prompt
   at the moment of saving: **Email them · Text them · Email and text · Don't
   send anything**. Only channels that client can actually receive are offered,
   each showing the real address or number.
2. **A move sends a "your appointment has moved" message that leads with the
   old time** — so a client skimming it sees a change, not a duplicate booking
   confirmation they'll ignore.
3. **Undo a cancellation** — the client's cancellation message is held back for
   two minutes and an **Undo** sits in the confirmation for fifteen seconds. Tap
   it and the booking goes back exactly as it was, with the message stopped
   before it sends.
4. **It refuses to lie** — if the freed slot was taken in the meantime the undo
   is refused rather than double-booking; if the message did go out it says so
   plainly, so the owner knows to make a phone call.
5. **Cancellations keep the record** — a cancelled booking frees the slot
   instantly but stays on the calendar marked Cancelled, so the history survives.

### ACT IV — The client book
> *"Everything you know about them, wherever you are."*
> **Screens: `08`, `09`**

1. **A profile per client** — upcoming visits, full history, invoices, lifetime
   spend, and notes.
2. **Notes that follow the client** — anything typed on a booking is copied to
   their record as a dated line, so it surfaces at the next visit automatically.
3. **Import from a spreadsheet** — reads real Excel files directly, matches on
   email → phone → name, fills in missing details, and never creates duplicates.
4. **Merge duplicates** — finds clients sharing an email, phone or name and
   merges each set into one, moving appointments, invoices and messages across.
5. **Update contacts in bulk** — a focused flow for verifying phone numbers and
   emails against a fresh export.

### ACT V — Getting paid
> *"From the chair to the bank without a second app."*
> **Screens: `10`, `11`, `12`, `13`**

1. **Point of sale** — bill one of today's appointments or ring up a walk-in in
   a few taps. Services, retail products, custom lines and discounts.
2. **Card, cash, transfer or Stripe** — including a secure pay-link the customer
   can open on their own phone (Apple Pay / Google Pay appear there).
3. **Invoices** — draft, sent and paid, with tax handled and outstanding
   balances tracked.
4. **Receipts sent automatically** the moment a payment lands.
5. **Refunds**, including putting stock back on the shelf.
6. **Retail products** — stock levels, cost vs retail margin, and low-stock
   warnings before the shelf is empty.
7. **Deposits** — take a percentage up front on online bookings, credited
   automatically at checkout.

### ACT VI — Talking to customers, automatically
> *"The single biggest no-show reducer."*
> **Screens: `14`, `15`, `17`**

1. **Booking confirmations** sent the moment a booking is made.
2. **Reminders** a configurable number of hours before the visit.
3. **Email, SMS, or both** — chosen per message type, or per booking.
4. **Review requests** sent automatically after a visit, with the salon's own
   reviews page and the ability to reply.
5. **A complete log** — every message, its channel, its status, and exactly what
   happened to it. Nothing sends silently and nothing fails silently.

### ACT VII — What the customer sees
> *"The shopfront that never closes."*
> **Screens: `19`, `20`, `21`, `22`, `25`**

1. **A public booking page** on the salon's own link, branded to the business.
2. **Pick as many services as you like** — the duration and price add up.
3. **Choose a stylist, or take the first one free.**
4. **Only real openings are offered** — availability is computed from actual
   bookings, blocked time and opening hours, and re-checked at the moment of
   confirming, so a double booking is impossible even if two people tap at once.
5. **The cancellation terms are stated before they commit**, not buried.
6. **A cancel link in every confirmation** — the client can cancel themselves up
   to the notice period, the slot reopens instantly, and the owner is emailed.
7. **The link never goes stale** — it always reflects the current services,
   prices and opening hours.

### ACT VIII — Set up once, then forget it
> **Screens: `16`, `17`, `18`**

1. **Guided setup wizard** on first run — the business, its hours, its team, its
   services.
2. **Opening hours per day**, including days that run only every 2nd, 3rd or 4th
   week, and days with their own hours.
3. **Booking window** — how far ahead customers can book.
4. **Cancellation notice** — the deadline after which the online cancel link
   stops working and the client is asked to call.
5. **The team** — colours, titles, and their own working hours.
6. **The service menu** — categories, durations, and three price types: fixed,
   "from" (varies by hair length), and free (consultations).
7. **Branding** — business name, logo, address, the lot.

### ACT IX — In the hand
> **Screens: `23`, `24`, `25`**

The same workspace on a phone. Installs to the home screen, no app store, no
download. Pull down to refresh. The whole salon in an apron pocket.

### ACT X — Built differently *(for the technical reader)*

1. **Zero dependencies** — no frameworks, no npm packages, no build step.
2. **One file per business** — the entire business lives in a single database
   file that can be copied, backed up or moved in one move.
3. **Security taken seriously** — parameterised queries throughout, signed
   HttpOnly session cookies (never localStorage), server-side authorisation on
   every route, rate limiting on login and password changes, a password policy
   with breach checking, and public links that verify a token rather than
   trusting an ID in the URL.
4. **Honest about its own state** — it detects a misconfigured time zone, a
   database sitting on a disk that will be wiped, and a default password still
   in use, and says so.

---

## 3. The screenshots

All frames are of the running system with fictional demo data — a made-up salon
called **Luxe Hair Studio** with invented clients. No real business's data
appears in any of them.

**Location:** `docs/screenshots/`
**Desktop frames:** 3200 × 2000 (1600 × 1000 at 2× — retina-sharp)
**Phone frames:** 780 × 1688 (390 × 844 at 2×)
**Booking-page frames:** 3200 wide, cropped to their own content height

Every frame is set on the same Thursday at 11:40am, so the story is consistent
across the whole journey: four visits done, one in the chair, the afternoon
filling up.

| # | File | What it shows |
|---|------|---------------|
| 01 | `01-dashboard.png` | Today at a glance — done vs to-go, taken vs expected, "with you now", the run of the day |
| 02 | `02-dashboard-insights.png` | Revenue, outstanding, client count, rebooking rate, growth split, the win-back list, what's coming up |
| 03 | `03-dashboard-charts.png` | Booking rhythm by hour, revenue per day, top-selling services |
| 04 | `04-calendar-day.png` | The day book — a column per stylist, live "now" line, blocked time, client notes, online markers |
| 05 | `05-calendar-week.png` | A week per stylist |
| 06 | `06-appointment-editor.png` | The booking editor — client, services, team member, time, notes |
| 07 | `07-notify-prompt.png` | **The signature moment:** moving a booking asks who to tell and by what — email, text, both, or nothing |
| 08 | `08-clients.png` | The client book — visits, last visit, total billed, with import and merge tools |
| 09 | `09-client-profile.png` | One client — lifetime spend, upcoming, full history, invoices, notes |
| 10 | `10-services.png` | The service menu — categories, durations, fixed / "from" / free pricing |
| 11 | `11-pos.png` | Point of sale — the visit plus a retail product, tax, one-tap charge |
| 12 | `12-invoices.png` | Billing — paid, sent, draft, and what's owed |
| 13 | `13-products.png` | Retail stock — margins and low-stock warnings |
| 14 | `14-messages.png` | Every confirmation, reminder, receipt and reschedule, with delivery status |
| 15 | `15-reviews.png` | Reviews collected automatically after each visit |
| 16 | `16-settings-hours.png` | Opening hours, booking window, cancellation notice |
| 17 | `17-settings-notifications.png` | Notifications — email, SMS or both, per message type |
| 18 | `18-team.png` | The team, their colours and their hours |
| 19 | `19-booking-services.png` | **Customer view:** the public booking page, choosing services |
| 20 | `20-booking-stylist.png` | **Customer view:** choosing a stylist, or "any available" |
| 21 | `21-booking-time.png` | **Customer view:** real openings only |
| 22 | `22-booking-details.png` | **Customer view:** details, with the cancellation terms in plain sight |
| 23 | `23-phone-dashboard.png` | The workspace on a phone |
| 24 | `24-phone-calendar.png` | The day book on a phone |
| 25 | `25-phone-booking.png` | The booking page on a phone — where most customers actually book |

### Suggested use on the site

- **Hero:** `01` (the dashboard) — it carries the whole promise in one image.
- **The scroll journey:** `01` → `04` → `07` → `09` → `11` → `14` → `19` → `21`
  — owner's day, the diary, changes handled properly, the client, the money,
  the messages, then the customer's side.
- **The "it's on your phone too" beat:** `23`, `24`, `25` as a trio.
- **The proof beat:** `07` deserves its own section. It's the feature no
  competitor screenshots, and it's the one that explains why customers don't get
  lost when plans change.
