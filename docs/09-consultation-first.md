# Consultation-first booking

A second way to take bookings, for a salon that will not let a stranger into
the diary unsupervised.

## Where this came from

A hair salon owner, in a sales meeting. She does not want a public booking
page. Every new client gets a conversation first — in her case an Instagram
DM — and only then does she decide whether, when, and for what to book them.
She wants "book now" on her website to start a conversation, not an
appointment.

She is not asking for less software. She is asking for the opposite ordering:

    Kairo today        stranger → picks a slot → pays → salon finds out
    What she wants     stranger → talks to the salon → salon picks the slot
                                → client pays → booking exists

## What is built

**A setting, not a fork.** `consult_mode` is off everywhere by default and
changes nothing for a salon that does not turn it on. With it on:

- `/book` stops being a slot picker and becomes a "message us" card carrying
  the salon's own channel and handle.
- `POST /api/public/book` is refused. The self-serve path is closed at the
  server, not merely hidden in the page — a saved link or a replayed request
  must not get round it.
- The owner gains **booking invites**.

**A booking invite** is one slot, held, with a link.

The owner picks the client's service, staff, date and time — the things they
just agreed in the DM — and Kairo returns a link. They paste it into the
conversation. The client opens it and sees the salon's branding, the service
by name, the price, the day and time, and who they are seeing. They put in
their name and a way to be reached. They pay. The booking exists, the
confirmation goes out, and reminders run exactly as they do for every other
appointment in Kairo.

## The three payment routes

Set by `invite_pay`:

| Value      | What the client sees            | How Kairo learns it was paid |
|------------|---------------------------------|------------------------------|
| `checkout` | Stripe or Square hosted checkout | The provider is asked. Automatic. |
| `link`     | The salon's own payment link     | The client says so; the owner confirms. |
| `none`     | No payment step                  | Accepting is enough.         |
| | | |

`link` reuses `pos_payment_link`, which already exists for the till — a Stripe
Payment Link, Square Online link or PayPal.me address the salon already has.

**`link` cannot be automatic and the code does not pretend otherwise.** A
generic payment link tells Kairo nothing; there is no webhook, no session, no
receipt. So the client taps "I have paid", the invite moves to `paid`, the
owner is notified on their phone, and the booking is created when the owner
confirms the money arrived. The client's page says exactly that, so nobody
leaves the page thinking they are booked when they are not.

`checkout` is strictly better where the salon has a processor connected, and
the settings screen says so.

## Holding the slot

An open invite holds its slot. The owner has just told somebody "Thursday at
two is yours"; a walk-in taking it half an hour later is the salon's problem,
not the client's.

It is held the honest way — `freeSlotsFor` treats a live invite exactly like a
time block — and it is held with an expiry (`invite_expiry_hours`, default 48).
An invite nobody accepts releases its slot on its own. Nothing is held forever
because somebody stopped replying.

No appointment row exists until the client accepts. An invite is not a
provisional booking with a flag on it: a half-real appointment leaks into
counts, reports, reminders and the diary, and every one of those then needs to
learn to ignore it.

## The lifecycle

    open ──accept──▶ claimed ──pay──▶ paid ──confirm──▶ confirmed
      │                 │                │
      └──expire──▶ expired                └── (checkout: straight to confirmed)
      └──cancel──▶ cancelled

`confirmed` is the only state that has an appointment behind it.

## Where it lives

| Piece | File |
|---|---|
| Lifecycle, slot holding, expiry | `src/invites.js` |
| Table and settings | `src/db.js` (`booking_invites`, `consult_*`, `invite_*`) |
| Owner routes | `src/api.js` — `/api/invites*` |
| Client routes | `src/api.js` — `/api/public/invite*` |
| Client page | `public/invite.html`, `public/js/invite.js` |
| Owner UI | `public/js/pages/invites.js`, button on the Calendar |
| Settings | Settings → **Consultation first** (`#/settings?sec=consult`) |
| The "message us" booking page | `public/js/book.js` → `renderConsultStep()` |
| Tests | `test/invites.test.js` (25), 7 mutations in `test/falsify.mjs` |

## Turning it on

Settings → **Consultation first**:

1. Tick **Take bookings by consultation only**.
2. Choose the channel (Instagram, WhatsApp, Messenger, phone, email) and put
   in the handle. That becomes the button on the booking page.
3. Choose how they pay, and paste the payment link if that is the route.
4. Save.

Then, after each consultation: **Calendar → Booking link → Send a new link**.
Pick the service, stylist, day and time, override the price if the quote
differed, add a note, create. The link is copied to the clipboard ready to
paste into the conversation.

When the client says they have paid, the owner's phone gets a push. Check the
money landed, then **Confirm & book** on the same screen.

## What this does not do

**It cannot see a payment made through a plain payment link.** Not a
limitation of the implementation — there is nothing to see. Stripe Payment
Links, Square Online and PayPal.me send nothing back to Kairo. A salon that
wants the booking to confirm itself connects Stripe or Square and switches the
route to `checkout`; the settings screen says so in as many words.

**A payment-link payment is the owner's word, and is recorded as such.**
Confirming writes the amount onto the appointment so the till does not charge
for it again, with `pay_provider: 'manual'` and an invoice note reading "Paid
on the booking link, confirmed by the salon" rather than claiming a processor
verified it. Under `checkout` the same fields carry the provider's own session
id, because there it really was verified.

**It does not message the client the link.** The owner pastes it into the
conversation they are already having, which is the whole premise. Sending it
from Kairo would mean a second thread the client has to notice, in a channel
they did not choose, at the exact moment they are already talking to the salon.

## Decisions worth knowing about

**The slot is held, and the hold is applied in the query, not by a sweep.**
`heldSlotsFor` filters on `expires_at` directly rather than retiring rows
first. Availability is read once per stylist per page load and a write on that
path would be a cost for nothing — the answer is the same either way.
`expireStale()` still runs wherever a *status* is read, so nothing displays as
open when it is not.

**The public page shows no contact detail the client did not type there.**
When the owner builds an invite against an existing client record, that
client's email and mobile stay on the server. The token is unguessable, but a
link travels — forwarded, screenshotted, pasted into a group chat — and a
salon's client list must not travel with it. Gated on `claimed_at`, not on
whether a name happens to be set.

**A booking link's checkout returns to the invite, never to `/book`.** Every
other payment in Kairo returns to the booking page, so leaving it there was
the easy mistake: the customer pays, lands on a slot picker that has never
heard of their invite, and no booking is made. The money is taken either way,
which is what makes it worth its own test. `createCheckout` now takes an
optional `returnPath`, defaulting to the old behaviour.

**The setup checklist drops "take a test booking" in this mode** and asks for a
first booking link instead. Self-serve booking is refused by design here, so
leaving an item on the list that cannot be completed teaches an owner to
ignore the list.
