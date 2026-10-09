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

Settings → **SMS (text messages)** → **Set up text messages**. The dashboard's
"Text reminders" line opens the same walkthrough directly
(`#/settings?open=sms&setup=texts`), and the welcome email names it.

Written for an owner who is not good with computers, on a phone, between
clients. Texts go through the salon's **own** ClickSend account: they pay
ClickSend directly, a few cents a text, and Kairo adds nothing. Email works
from day one without any of this.

1. **Open a free ClickSend account.** A button, and what happens next (a code
   to their mobile). New accounts come with $2 of trial credit.
2. **Connect it.** "Tap the key icon at the top right; copy Username and API
   Key into the boxes." Checked with ClickSend on the spot. What they paste is
   tidied first: the "API Key:" label, spaces and line breaks that come along
   when copying on a phone are dropped. The usual mistake, the account password
   in the key box, is named in plain words when ClickSend refuses it.
3. **Make sure there is credit.** The balance is read back. Under a dollar, it
   says so, links straight to ClickSend's top-up page, and offers "I've added
   it — check again". It also points them at Auto-recharge.
4. **Choose what to text, and test it.** Reminders and confirmations are
   ticked; receipts and review requests are not. Ticked messages go by **text
   and email** (`chan_<kind>` = `both`). Kairo sends a real test first, and
   **only if ClickSend accepts it** does it switch texts on
   (`sms_notifications_enabled` = 1) and set the channels. So it never leaves a
   half-working setup switched on, and it never leaves a finished setup
   switched off.

Then, optionally, **their own mobile as the sender**, verified by a code
ClickSend texts them. Without it texts come from a shared ClickSend number and
replies land in their ClickSend inbox.

**The bug this replaced:** the old four steps connected ClickSend, verified a
number and sent a test, but never turned texts on. The master switch and the
per-message "Email / SMS / Both" choice sat further down Settings, both off by
default, so an owner who finished every step still sent no texts to clients.

Numbers go to ClickSend in international form: "0412 345 678" becomes
"+61412345678" (`auNumber` in `src/notify.js`), for client texts, the test and
the owner's own number alike.

The raw fields are still there, folded behind **"Or enter the details
yourself"**, for anyone who already knows what they are pasting.

### Worth knowing

The three routes this uses — `/api/sms/connect`, `/api/sms/own-number` and
`/api/sms/own-number/verify` — already existed and **nothing in the interface
called them**. The server could check credentials and verify a sender number,
and no owner could reach either. That is the same failure the in-app account
deletion had before it was wired up: a capability that ships, passes review,
and helps nobody.
