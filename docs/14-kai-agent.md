# Kai, the agent — talk to the salon and it does the work

Press **Kai** (or ⌘K / Ctrl+K, or `/`) and the whole screen becomes a
conversation. The owner says what they want — *"add a note to Amara: prefers
the window chair"*, *"book Riley for a cut tomorrow at 2 with Maya"*, *"move
that to 3:30"*, *"block out Friday afternoon"*, *"put balayage up to $240"*,
*"how did last week go?"* — and Kai does it, then says what it did.

## Each owner says yes first

Kai sends what the owner asks — and the records it looks up to answer — to
Anthropic. The first time an owner opens Kai they see **Before you start**:
what is shared, with whom, where, that Anthropic doesn't train on it, and two
buttons, **Turn on Kai** and **Not now**. Nothing is sent until they choose
Turn on Kai; the server refuses with 428 until then (`POST /api/kai/consent`),
and **Turn Kai off** under the composer withdraws it (`DELETE
/api/kai/consent`). Per user, not per salon. This is App Review guideline
5.1.2(i) — explicit permission before personal data goes to a third-party AI —
and it is what an owner deserves to be told anyway.

Inside the iPhone app the web microphone button is hidden: the app doesn't ask
for microphone or speech permission, and the iPhone keyboard's own dictation
does the same job.

## What it can do

Anything the owner can do by hand. Kai has no list of abilities of its own: it
is given the owner's API — every route the screens call — and calls it
in-process **as the signed-in owner**. So every rule the screens follow, Kai
follows: the double-booking guard, the field validation, the "this time is
blocked" refusal, the confirmation the client is sent. A route added next month
is in Kai's reference the moment it exists, because the reference is read from
`src/api.js` itself (`src/kai-catalogue.js`).

Today that is 100+ actions: clients and notes, allergies and patch tests and
consents, bookings, moves, cancellations and statuses, time blocks, the team and
their shifts and days off, services and prices, products and stock, invoices,
payments, refunds, the waitlist, campaigns and automations, reviews and replies,
enquiries, the growth plan, opening hours and every non-secret setting, and
read-only questions across all of it (the dashboard, takings, opportunities,
attribution).

## What waits for the owner

Anything that **deletes**, that **reaches a client on its own**, or that
**moves money**: deleting anything, sending a campaign, running an automation
now, retrying a message, sending a test text or email, cancelling or
no-showing an appointment, sending an invite, merging clients, refunds, card
sales and emailing a backup. Kai prepares it and the chat shows a card with
**Confirm** / **Don't**. Nothing runs until Confirm is pressed. Writing
something else instead counts as **Don't**.

Ordinary edits (adding, updating, booking, noting) just happen, and each one is
listed in the chat as a receipt: ✓ what was done, or ✕ and why it was refused.

## What it cannot do at all

- Sign in or out, change passwords or the sign-in email, close or refund the
  Kairo account.
- Read or set any key, secret or password (Stripe, Square, Resend, ClickSend,
  Telnyx, Twilio, Turnstile) — they are never sent to the model either, from any
  route.
- Uploads and downloads (imports, exports, photos, backups).
- Anything on the public booking side.

These routes are refused by the dispatcher even if asked for by path, not just
left out of the prompt. Text inside the business's data — client notes, enquiry
messages, reviews — is treated as data: the prompt tells the model never to
follow instructions found there, and anything destructive still needs the
owner's Confirm.

## Switching it on

Kai uses Claude through the Messages API, with **one key for the platform**
(never a salon setting):

| Variable | Default | Purpose |
|---|---|---|
| `KAIRO_ANTHROPIC_API_KEY` (or `ANTHROPIC_API_KEY`) | unset (off) | Turns the agent on |
| `KAIRO_KAI_MODEL` | `claude-sonnet-5-5` | The model (`claude-opus-5-5` for the most capable, at twice the price) |
| `KAIRO_KAI_EFFORT` | `medium` | `low` … `max`; lower is faster and cheaper |

Render → `kairo-shard-au` → Environment → add `KAIRO_ANTHROPIC_API_KEY` → Save.
The service restarts and the Kai button opens the full-screen chat. Without the
key, the Kai button opens the original rule-based Kai (no network, no cost).

## What it costs

Claude Sonnet 5.5 is $2 per million input tokens and $10 per million output
(cache reads $0.20). The instructions and action reference (~5k tokens) are
cached, so each step of a job re-reads them at the cache price. A typical
request — look someone up, make a change, answer — is about 1–3 US cents;
a salon asking 20 things a day is roughly $8–15 a month. Each conversation records its token use in
`kai_chats.input_tokens` / `output_tokens`. Two limits keep the bill predictable:

- **Per owner:** 20 messages per 10 minutes — faster than anybody runs a
  salon, so it only ever stops a stuck tab or a stolen session.
- **Per salon:** 150 messages a day (`KAIRO_KAI_DAILY_LIMIT`). A busy salon uses
  20–40. At the cap Kai says it's done for the day; everything else in Kairo
  carries on. Answering a Confirm card doesn't count. Today's count is on
  `GET /api/kai/status`.

## Testing

- `test/kai-agent.test.js` — on every commit, against a scripted stand-in for
  the Messages API: the confirm flow, the forbidden routes, secrets, the
  append-only history, a failing or refusing model, every read action in the
  reference executed in-process, and a write in every area of the business
  checked in the database.
- `scripts/kai-backtest.mjs` — the real model, on demand:
  `KAIRO_ANTHROPIC_API_KEY=… node scripts/kai-backtest.mjs`. A fresh demo salon
  in a temporary folder, 22 owner requests (notes, bookings, moves, Confirm and
  Don't, prices, stock, invoices, hours, day off, questions, an ambiguous name,
  a prompt injection in a client note, keys, closing the account), each checked
  against the database. Prints a scorecard and the token cost.

## Also in this release: the ClickSend login

Settings → SMS → **Your ClickSend login**: the email and password the owner
uses to top up credit on ClickSend's own website, for salons without auto
top-up. Kairo never signs in with it. Only an owner can read it back (Show /
Copy); it is not in the settings list, and Kai can neither read nor change it.

## Code

| File | What |
|---|---|
| `src/kai-agent.js` | The conversation loop with Claude, stored chats, the Confirm flow |
| `src/kai-catalogue.js` | The action reference (read from `src/api.js`), what is never offered, what needs Confirm |
| `src/api.js` → *Kai, the agent* | `/api/kai/*`, the in-process dispatcher, secret redaction |
| `public/js/kai-chat.js` | The full-screen chat |
| `src/db.js` | The `kai_chats` table |
