# Legal decisions still open

*Parked 9 September 2026 at the owner's request. Nothing here is urgent this
week; all of it is needed before the first stranger pays for Kairo.*

Nothing in this list blocks the two live salons, Sha's move, or any
engineering work. It blocks **selling to the public**, and one item blocks the
App Store submission.

This is a practical list from reading the code and the policies, not legal
advice. The items marked **worth an accountant's ten minutes** are cheap to
get right and awkward to unwind.

---

## 1. Who sells Kairo — the one launch blocker

`platform/public/terms.html` currently reads:

> Kairo is booking, payments and client-management software sold by
> **[legal name, ABN]**, Australia.

`node scripts/launch-check.mjs` fails until that is filled in, and it is the
only thing it still fails on.

**The situation as it stands.** You have no ABN and do not need one yet. A
business name cannot be registered with ASIC without one, so **"Kairo
Bookings" is not a legal entity** — it is a trading name with nothing behind
it. A contract naming it as the seller names nobody, which weakens the whole
document including the liability cap in it.

**The three ways out:**

| Option | Reads as | Notes |
|---|---|---|
| Your legal name, trading as Kairo Bookings | *"…sold by Jane Smith, trading as Kairo Bookings, Australia."* | What most Australian sole traders do before registering. Legally accurate and still shows the brand the customer bought from. |
| Your legal name only | *"…sold by Jane Smith, Australia."* | Most conservative. A customer who bought from "Kairo" then sees an unfamiliar name on the contract, which can read as a scam signal. |
| Kairo Bookings only | *"…sold by Kairo Bookings, Australia."* | Names an entity that does not exist. Avoid. |

**One spelling check before this is written down anywhere.** The product is
**Kairo** — the domain, the code, the app, the App Store listing. On
9 September the owner wrote "Kario Bookings". If the intended trading name is
genuinely *Kario* and not *Kairo*, that is a brand decision with consequences
well beyond this file, and it needs settling first.

---

## 2. Do you need an ABN yet?

**Not to sell Kairo, no.** You can trade as a sole trader without one. What
you cannot do without an ABN:

- register a business name with ASIC (so "Kairo Bookings" stays informal)
- register for GST, and therefore
- charge GST, or claim GST credits on Render, Cloudflare, Apple or Stripe fees

**When it starts to matter.** GST registration is compulsory once turnover
passes **$75,000** in a 12-month period. At A$410 a sale that is about **183
salons**. Well before that, an ABN also becomes the thing that makes the
business look real to people spending A$410 on software.

An ABN is free and takes about fifteen minutes at abr.gov.au. There is no
downside to having one early beyond a little paperwork — **worth an
accountant's ten minutes** if you are unsure whether it triggers anything else
for your circumstances.

---

## 3. GST on the A$410 — currently correct, and worth keeping correct

The platform charges a flat **A$410 with no GST added** (`platform/stripe.js`
sets no tax). That is right for someone not registered for GST.

**If you ever register for GST, this must change on the same day.** Once
registered, the A$410 is deemed to include GST whether or not you added it —
so you would be handing the ATO roughly **A$37 out of every sale** you had
already banked. The fix is either to raise the price to A$451 or to accept the
lower margin, and it is a decision to make deliberately rather than discover
at tax time.

Not urgent while there is no ABN. Put it on the same page as the ABN decision
so the two move together.

---

## 4. Your customers' GST — fixed today, noted here

Until 9 September, every salon Kairo provisioned was set to charge **10% GST**
on its invoices. Most small salons Kairo targets are sole traders under the
$75k threshold and are **not registered to collect it** — so Kairo was putting
GST on invoices its customers could not legally charge, from a default they
never chose and would have had no reason to question.

Now provisioned at **0**, matching Kairo's own default, with the setup wizard
asking. Nothing needs deciding; recorded because it is the sort of thing that
gets asked about later.

---

## 5. Consumer law and refunds — already in reasonable shape

The Australian Consumer Law applies whether or not there is an ABN, whether or
not the Terms mention it, and cannot be contracted out of. The policies are
already written to sit with it rather than against it:

- 14 days, no reason needed, full refund — better than the law requires
- the liability cap explicitly preserves ACL rights
- consumer guarantees survive the cap

**One thing to know:** the 14-day promise is *yours*, offered voluntarily. The
ACL's guarantees run separately and for longer — software that never works as
described is refundable well after day 14, regardless of what the policy says.
That is the intended behaviour and the refund flow already handles a
post-window request by sending it to a person.

---

## 6. Privacy — check the threshold, then decide

The Privacy Act's APPs bind businesses over **$3m turnover**, so they do not
bind you yet. Kairo holds other businesses' client data, which makes this
worth being deliberate about rather than technically exempt about:

- the Privacy Policy already describes what is held, by whom and for how long
- each salon's data is in its own file, and the platform holds none of it
- the Notifiable Data Breaches scheme follows the same $3m threshold

**Worth an accountant's or a lawyer's ten minutes** before the first salon
that is not a friend signs up: a salon's *clients'* details are involved, and
your customers may be asked by their own clients what happens to them.

---

## 7. Sending texts — ACMA, already handled in the product

Each salon uses **its own** ClickSend account and its own sender ID, and the
setup checklist tracks ACMA registration for a chosen sender name. The one
text Kairo itself sends is the signup verification code, from Kairo's account.

Nothing to decide. Listed so it is visibly not forgotten.

---

## What to do, in order

1. **Decide the seller name** (§1) — the only launch blocker, and needed
   before the App Store submission because the Terms are linked from the
   listing.
2. Confirm the **Kairo / Kario** spelling if there is any doubt (§1).
3. Decide whether to get an **ABN** now or later (§2), and if now, handle the
   GST-on-A$410 consequence at the same time (§3).
4. Before the first non-friend salon, spend ten minutes on **privacy** (§6).

Re-run `node scripts/launch-check.mjs` after §1 — it should then report
nothing blocking.
