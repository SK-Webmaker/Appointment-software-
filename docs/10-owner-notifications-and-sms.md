# Phone notifications, and getting SMS switched on

Two things a business owner has to be able to do without help: turn text
messages on, and decide what their phone is allowed to interrupt them for.

## Phone notifications (the app)

Settings → **Phone notifications** (`#/settings?sec=apppush`).

These are free. They cost neither a text nor an email, they arrive instantly,
and they go to every phone signed into the account. They are for the **owner** —
the client's confirmations and reminders are the email and SMS settings further
down the page, and the two are deliberately not the same control.

| Notification | Default | When it fires |
|---|---|---|
| When somebody books | **On** | A booking comes in through the booking page or a booking link |
| When somebody cancels | **On** | A client cancels or moves — never when the owner does it themselves |
| When a booking link says it has been paid | **On** | Only under the `link` payment route with owner confirmation |
| A summary each morning | **Off** | Once a day at the chosen hour: "6 appointments today. First at 9:00." |

**Each one is its own switch.** An owner who can only have all of them or none
picks none, and then the app is a thing they dismiss rather than a thing they
rely on.

**The morning summary is off by default** and has its own hour. A notification
before the salon opens is a decision the owner makes, never one Kairo makes for
them. It is also silent on a day with nothing in it — "0 appointments today" is
the push that teaches people to swipe the app away.

### How the choice is honoured

Every owner push goes through one function, `wantsPush(kind)` in `src/api.js`.
There is no second path. `GET /api/app/config` reports the same flags back to
the phone, so the app's own settings screen shows what will actually happen
rather than keeping a copy that drifts.

Turning a push off is **not** turning the notification off. A booking alert
with push disabled falls back to the owner's email, exactly as it does when no
phone is signed in — they said "not on my phone", not "don't tell me". The
separate `owner_notify_enabled` switch is the one that means silence.

Nothing about the business depends on any of this. A booking is made, the
client is confirmed and the reminder is queued whatever the owner chose; the
alert is a preference and is never allowed to be a precondition.

## Turning on SMS

Settings → **SMS (text messages)** → **Set up ClickSend step by step**.

Kairo sends texts through ClickSend, which the business pays directly — no
markup, no subscription, no monthly number fee. The fields to do it by hand
were always there. The problem was that "ClickSend username" and "ClickSend API
key" mean nothing to a salon owner, there was no way to tell whether what they
pasted was right, and no way to find out whether a text would actually arrive
until a client said they never got a reminder.

So the guided setup is four steps, each of which proves itself:

1. **Create an account** — a link, and what to click when they get there.
2. **Paste the username and API key** — checked against ClickSend on the spot
   via `POST /api/sms/connect`, which reads the account name and credit balance
   back. A typo is caught here rather than by a reminder that silently never
   sends.
3. **Confirm who it comes from** — their own salon number, verified by a code
   ClickSend texts them (`/api/sms/own-number` and `/own-number/verify`). Texts
   then come from the number clients already have, and a reply lands where a
   human reads it.
4. **Send a real text** — to the owner's own phone, through their own setup.

**Step 4 is the point.** Every step above it can look finished and still not
deliver. *Accepted is not delivered* has already bitten this project on
Cloudflare, Resend and ClickSend, and a green tick nobody earned is the kind
that fails at nine o'clock on a Saturday.

A step only goes green on its own check coming back from ClickSend — never
because somebody clicked past it.

The raw fields are still there, folded behind **"Or enter the details
yourself"**, for anyone who already knows what they are pasting.

### Worth knowing

The three routes this uses — `/api/sms/connect`, `/api/sms/own-number` and
`/api/sms/own-number/verify` — already existed and **nothing in the interface
called them**. The server could check credentials and verify a sender number,
and no owner could reach either. That is the same failure the in-app account
deletion had before it was wired up: a capability that ships, passes review,
and helps nobody.
