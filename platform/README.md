# The Kairo platform

The only part of Kairo that knows more than one salon exists. It sells Kairo,
takes the payment, screens the signup, asks a shard for a salon, and keeps the
short queue of things only a person can decide.

**It holds no salon's client data.** Not a name, not a booking, not a customer's
phone number. Those live in each salon's own SQLite file on the shard. What is
here is the business itself, the money, and the audit trail.

```
platform/
  server.js     http server: the signup API, the Stripe webhook, the operator queue
  signup.js     the state machine — created → verified → paid → screening → ready
  db.js         its own SQLite: owners, businesses, codes, events, tasks
  shard.js      signed calls to the shard's control API
  stripe.js     Checkout, refunds, webhook signature verification
  abr.js        the free ABN check (optional; never refuses a signup on its own)
  notify.js     the two messages the platform itself sends
  public/       the signup page, the operator console, the policies
```

## Running it

```bash
npm run platform
```

| Variable | What it does |
|---|---|
| `PLATFORM_PORT` / `PLATFORM_HOST` / `PLATFORM_ORIGIN` | where it listens and how it addresses itself in links |
| `PLATFORM_DATA_DIR` | its SQLite file (default `data/platform`) |
| `KAIRO_SHARD_URL` | the Kairo that serves the salons |
| `KAIRO_PLATFORM_KEY` | shared with the shard; every control call is HMAC-signed with it |
| `KAIRO_BASE_DOMAIN` | salons live at `<slug>.<domain>` |
| `KAIRO_PRICE_CENTS` | the one price (default 41000 = A$410) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | taking the money and believing it moved |
| `ABR_GUID` | the free ABN Lookup key. Without it the ABN check is skipped, never failed |
| `RESEND_API_KEY` / `PLATFORM_FROM_EMAIL` | the verification and welcome emails |
| `CLICKSEND_USERNAME` / `CLICKSEND_API_KEY` | the verification text (~6¢ per signup) |
| `PLATFORM_OPERATOR_PASSWORD` | opens `/operator` |

The boot banner names anything missing rather than pretending to work.

## The two rules

1. **Nothing is provisioned until Stripe's signed webhook says the money
   moved.** Not the browser's return to the success page, not the client's
   word. The webhook is verified against the raw bytes, is refused if older
   than five minutes, and provisioning is idempotent on the session id — so a
   retry, a replay and a duplicate all produce exactly one salon.
2. **Screening flags, it never refuses.** A mismatched ABN, an unknown one, a
   duplicate business name, a burst of signups from one address: each puts the
   signup in the owner's queue with the reason spelled out, and one tap
   approves or refunds it. A check that could not be made — the register
   unreachable, no key configured — is never a flag.

## What the shard exposes

Six verbs at `/api/platform/*`, all HMAC-signed, all 404 unless the shard has
a `KAIRO_PLATFORM_KEY`: create a salon, read its status, patch its flags
(maintenance, mute, plan, own domains), write its settings through the same
allow-list the owner's own screen uses, reset its owner's password from a
hash, export it, and mark it deleted. There is no verb that reads one salon's
data from another's address, because no such route exists anywhere in Kairo.

## Connecting the salon's email, texts and payments

`/connect?t=…` is the page a signed-in owner reaches from the one line on their
Kairo dashboard. The handle is minted once at provisioning, kept through
retries, and only ever shown inside their own workspace.

**Email** (`connect.js`, `resend.js`, `cloudflare.js`). They paste an API key
from **their own** free Resend account and press one button:

1. create the domain in **their** account (or reuse the one already there);
2. write the DNS records **Resend returns** into Cloudflare — never a hardcoded
   set, and any record that already exists with a *different* value aborts the
   whole thing rather than being overwritten;
3. add one domain-wide `_dmarc` record if it is missing, and only one however
   many salons connect;
4. poll until **Resend itself** says verified — a domain that has not verified
   is never called done;
5. create a sending key scoped to that `domain_id` alone;
6. push the key and From address to the shard over the signed control API;
7. send a real test message;
8. delete the setup key they pasted.

Any failure leaves nothing installed, records the reason, and shows it.

A salon on a domain they already own gets the exact records to add at their own
registrar and a `409` until those records exist. Kairo will not tell anyone
their email works before it does.

**Texts** stay entirely on the business's side: their own ClickSend account,
their own existing mobile as the sender, verified by a code ClickSend texts to
that phone. No number is bought, and the platform pays for nothing.

**Refunds.** `/api/connect/refund` is the business asking for its own. Inside
14 days it is automatic and no reason is asked. After 14 days it opens a task
for the owner rather than refusing, because the consumer guarantees may still
apply and that is a judgement, not a rule.
