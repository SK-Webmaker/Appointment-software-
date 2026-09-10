# How every salon gets email and texts

*Written 10 September 2026, as a proposal. Nothing here is built. It replaces
the assumption in `04-phase-4-onboarding-flow.md` that each salon brings its
own Resend and ClickSend accounts.*

---

## The problem, stated plainly

Today a salon pays A$410, their booking page works immediately, and **not one
confirmation, reminder or receipt sends** until somebody sets up a Resend
account. `src/notify.js` is explicit about it:

```js
const key = getSetting('resend_api_key');
const from = String(getSetting('notif_from_email') || '').trim();
if (!key || !from) return { ok: false, skipped: true, ... };
```

Provisioning sets neither. So the product arrives half-dead and stays that way
until a human intervenes.

Two humans could do it, and both are a problem:

**The salon owner.** Create a Resend account, find API Keys, create one with
*Full access*, copy it, paste it. Five steps in a dashboard they have never
seen, and the scary-sounding permission is the one they need. Most will not.

**You.** That is what the current onboarding manual does — about 45 minutes at
a laptop per business, creating their Resend and ClickSend accounts on a
`<slug>@kairobookings.com` forwarding address. It works, and Sha and Hora were
both set up this way. It does not survive a hundred salons, and it stops
entirely the moment you are asleep when someone buys.

And it has already hit a hard wall: **ClickSend required Hora's own phone
number to verify the account.** You cannot create that account for somebody
without something of theirs.

---

## Email and texts are not the same problem

They get bundled together because both are "messaging", but the constraints are
completely different, and the right answer differs.

| | Email | Texts |
|---|---|---|
| Who the recipient sees | a **display name** — "Hair By Sha" — beside whatever address sent it | the **sender ID**, which is the identity itself |
| Can one account serve many salons? | **yes**, cleanly | not without the texts appearing to come from Kairo |
| Where replies go | wherever `Reply-To` says — the salon's own inbox | back to the sending number |
| Needs an ABN? | no | yes, for a business-name sender (ACMA) |
| Needs the salon's phone? | no | yes, to verify their own account |
| Cost shape | flat monthly, huge headroom | per message, prepaid |

Email can be shared. Texts cannot — not without taking the salon's identity
away from them.

---

## Email: one account, every salon, no setup

Kairo already builds the From line with the business name as the display name
(`fromHeader(getSetting('business_name'), from)` in `src/notify.js`). So one
verified domain serves every salon:

```
From:     "Hair By Sha" <bookings@kairobookings.com>
Reply-To: shamalkaskiridena@gmail.com
Subject:  Your appointment on Tuesday
```

The client sees the salon's name. A reply goes to the salon's own inbox. The
salon does nothing at all — confirmations work the moment the wizard finishes.

### Why the old objection no longer applies

The onboarding manual says, correctly for its time:

> One free Resend account per business, not one shared account. The 100/day
> limit is counted per account — share it across five salons and they all stop
> sending by mid-afternoon.

That 100/day cap is a **free-tier** limit. It disappears on Pro. Checked
10 September 2026 at resend.com/pricing:

| Plan | USD/month | Emails/month | Daily cap | Custom domains |
|---|---|---|---|---|
| Free | $0 | 3,000 | **100/day** | 3 |
| **Pro** | **$20** | 50,000 | none | 10 |
| Pro | $35 | 100,000 | none | 10 |
| Scale | $90 | 100,000 | none | **1,000** |

**The binding constraint is domains, not volume.** Ten custom domains on Pro
means ten salons *if each has its own sending domain*. Sending everyone from
one domain removes that ceiling entirely, and the volume ceiling is far away:

> A salon with 100 appointments a month sends roughly 300–400 messages
> (confirmation, reminder, receipt, the occasional review request).
> **50,000 ÷ 400 ≈ 125 salons on a single $20/month plan.**

### What email actually costs you

| Salons | Plan | USD/month | Per salon |
|---|---|---|---|
| 1–7 | Free (3,000/mo) | $0 | $0 |
| 8–125 | Pro | $20 | $2.50 down to $0.16 |
| 126–250 | Pro | $35 | $0.14 |
| 250+ | Scale | $90 | $0.36, with 1,000 domains |

Roughly **A$30 a month, flat, until well past a hundred salons**. Against
A$410 a salon, that is not a number worth optimising.

### The one real risk, and what it is worth

Every salon shares one sending reputation. If one starts blasting marketing,
deliverability suffers for all of them.

Three things hold it down, and they are not new work:

- Kairo composes every message. There is no free-text bulk sender pointed at
  the shared domain.
- Consent is already enforced per salon (the Spam Act work in Phase 2).
- A salon that wants its own reputation can still have it — which is the next
  section.

### Keep the own-domain path as an upgrade

`platform/connect.js` already does the hard, clever part: adds the salon's
domain to *their* Resend account, writes the DNS, waits for verification,
mints a send-only key scoped to that one domain, proves it with a real
message, and deletes the setup key. That work is not wasted — it becomes the
**upgrade**, not the requirement.

- Sha already has this (`mail.hairbyshacamberwell.com`). She keeps it.
- Hora has his own account. He keeps it.
- **No migration.** `sendEmail` reads per-salon settings first; a salon with
  its own key keeps using it. Only salons with *no* key fall back to shared.

That is the whole change: **a fallback, not a replacement.**

---

## Texts: do not share the account

The instinct is to do for SMS what we just did for email. It does not work, and
it is worth being precise about why.

On one shared ClickSend account, every salon's texts must come from **one
sender identity**. That means either:

- **An alphanumeric sender** — which must be ACMA-registered against an ABN.
  You do not have one, and even with one, the texts would read as coming from
  *Kairo*, not from the salon. A client who gets "Reminder: Tuesday 2pm" from
  KAIRO has no idea who that is.
- **A shared phone number** — and then every client's reply lands in one
  inbox that belongs to nobody. Replies are the main reason salons want texts.

Either way the salon loses the thing they are paying for: the message looking
like it came from them.

### So texts stay the salon's own — and stay optional

This is already how Kairo works, and already correct:

- `sms_notifications_enabled` is **0** on a new salon. Nothing texts by default.
- The setup checklist marks texts *optional*, in grey.
- Email carries confirmations, reminders and receipts on its own.

A salon that wants texts creates their own ClickSend account. It needs their
phone to verify — which is fine, because it is **their** phone and **their**
account, and they are present. The thing that blocked you setting it up for
Hora is not a problem when the owner does it for themselves.

### The starter-sender bridge already exists

`clicksend_starter_from` is already in the schema. Lend a salon your number so
their texts work on day one, record it, and Kairo shows a banner asking them to
put their own in — which disappears by itself the moment they do. That is the
gentlest version of this and it is already built.

### If you ever do want to sell texts

The honest shape, for later, not for launch:

**Buy each salon a dedicated virtual number on your ClickSend account.**
Replies route back per number, so they reach the right salon. The salon's
identity is a real number that is theirs. It costs a monthly fee per number,
which means texts become a **paid add-on** — and that collides with "one
payment, no monthly fee, ever". Do not do this quietly; it is a pricing change.

---

## Metering: how anyone would know what a salon has used

You asked how each business would know what it has left, and how Kairo would
know what each has used on one big account. The measurement problem is already
solved, and the answer is worth knowing even though the recommendation above
means you do not need it yet.

**Every salon's own database already logs every message it sends.**

```sql
CREATE TABLE messages (
  channel  TEXT NOT NULL DEFAULT 'email',   -- email|sms
  status   TEXT NOT NULL DEFAULT 'queued',  -- queued|sent|failed|skipped
  body     TEXT NOT NULL DEFAULT '',
  sent_at  TEXT NOT NULL DEFAULT '',
  ...
);
```

`src/api.js:303` already computes `messages_this_month` from it. So:

- **What a salon used** — count rows where `channel='sms'` and `status='sent'`.
  Cost is per 160-character segment, and `body` is right there, so segments are
  computable without storing anything new.
- **What every salon used** — the control API already reaches every tenant.
  A monthly roll-up is a loop over `listTenantSlugs()`.
- **What a salon has left** — only meaningful if Kairo *sells* credit, which
  means Kairo holds their money for future service. That is a real change of
  business: prepaid credit is a liability on your books, it has consumer-law
  implications if you stop trading, and it makes you a reseller for tax.

**That last point is the reason not to do it at launch.** The metering is easy.
Becoming a company that holds other people's prepaid balances is not.

---

## What this costs, all in

Sending only. Hosting, domain and Apple are in `03-phase-3-what-it-costs.md`.

| | 1 salon | 10 salons | 50 salons | 200 salons |
|---|---|---|---|---|
| Email (shared, Resend) | $0 free tier | $20 | $20 | $35 |
| Signup verification texts | ~6¢ each, one per signup | ~60¢ | ~$3 | ~$12 |
| Salon texts | salon's own account — **$0 to you** | $0 | $0 | $0 |
| **Your monthly** | **$0** | **~$20** | **~$20** | **~$35** |

Against A$410 per salon, one-off. At fifty salons that is A$20,500 taken and
about A$30 a month going out for sending.

*The ~6¢ per text is from your own onboarding manual. ClickSend does not
publish AU per-message rates — the pricing page shows only volume-discount
tiers from a $500 top-up. Worth confirming against an actual invoice before
this number goes in front of anyone.*

---

## What to build, in order

Nothing here is started. In rough effort order:

1. **Shared email fallback.** When a salon has no `resend_api_key`, send
   through the platform's own account, with the salon's name as display name
   and their email as `Reply-To`. Perhaps thirty lines in `src/notify.js` plus
   the settings to carry the platform key to a tenant. Tests: a new salon
   sends without configuring anything; a salon *with* its own key still uses
   it; the reply-to is the salon's, never Kairo's.
2. **Provision with it on.** New salons get sending settings at creation, so
   there is no window where a paid salon cannot send.
3. **Drop `email_setup` from the operator queue.** It opens for every salon
   today. Once sending works out of the box it is noise, and the connect flow
   becomes something a salon chooses rather than something you chase.
4. **Reword the checklist.** "Connect your email" stops being an amber blocker
   and becomes "Send from your own address" — an optional upgrade, in grey,
   beside texts.
5. **Later, only if asked for:** dedicated numbers and sold SMS credit, as a
   priced add-on, with the metering above.

Steps 1–4 remove the largest remaining piece of per-customer work and the
only thing that makes a paid Kairo not work on arrival.

---

## The recommendation in one line

**Share email, never share texts, and do not sell credit until somebody asks
twice.**
