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

## 1. Who sells Kairo — SETTLED 15 September 2026

**The seller is `Shamalka Kiridena`, Australia. No ABN.** Decided by the owner
on 15 September; the same name goes on the Apple Developer account.

`platform/public/terms.html` and `platform/public/privacy.html` now say so, and
the name lives in **`platform/seller.js`** so that the two pages cannot drift
apart from each other. `npm test` and `node scripts/launch-check.mjs` both read
the pages back against that constant, and three mutations in `test/falsify.mjs`
prove those checks can fail.

`launch-check` no longer reports a blocker.

**What the decision rules out.** "Kairo Bookings" is a trading name with no ABN
behind it, so ASIC has not registered it and it is not an entity that can sell
anything — naming it in a contract names nobody, which is exactly as weak as
the blank was. Kairo is the name of the *product*. The seller is the *person*.
A test enforces the distinction. (A sole trader may trade under their own name
without registering anything, which is what is happening here.)

**If ownership ever changes**, four of the five places that name a seller are
outside this repository — Stripe's business name on the receipt, the App Store
listing, the Apple Developer account holder, and the marketing site's Terms.
They are listed with the order to work them in **`OWNERSHIP.md`**.

---

## 1b. The live site already says the price includes GST — and two Terms exist

*Found 15 September by running `launch-check --origin https://kairobookings.com`
for the first time, instead of against the repo alone.*

**The public Terms at `kairobookings.com/legal/terms` say:**

> "A one-off setup fee of AUD $410 **including GST**, payable before we set you
> up."

`platform/stripe.js` adds no GST, and §3 below records why that is right for
someone not registered. So the page a customer reads today states the price is
GST-inclusive while the checkout treats it as GST-free.

A business that is not registered for GST **cannot represent a price as
including GST** — there is no GST in it to include. This is the one item on
this page that is live and public right now rather than waiting on a decision,
and it is **worth an accountant's ten minutes** before the next sale, not
before the first stranger's.

Three ways out, and they are the same three as §2: register for GST and mean
it; change the wording to drop "including GST"; or decide the price is
GST-inclusive *because* you are registering. They are not interchangeable —
the middle one is a wording fix, the other two are decisions about the
business.

**There are also two different Terms documents.**

| | |
|---|---|
| `kairobookings.com/legal/terms` | "Customer Terms", live, last updated 21 August. Names **no seller**. |
| `platform/public/terms.html` | What the platform serves at `/terms` when it is deployed. Names `[legal name, ABN]` — §1. |

Both describe the agreement between Kairo and the business buying it. Only one
can be the contract. Whichever it is, the other should point at it rather than
restate it differently, because the day that matters is the day somebody
disputes a charge and produces the version that suits them.

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

1. ~~Decide the seller name~~ — **done 15 September**: Shamalka Kiridena (§1).
   `launch-check` reports nothing blocking in the repo.
2. **Fix the live marketing Terms** (§1b) — they say A$410 "including GST",
   which a business not registered for GST cannot represent, and they name no
   seller at all. This is the only item on this page that is **live and public
   right now**, and it is in a different repository.
3. Decide whether to get an **ABN** now or later (§2), and if now, handle the
   GST-on-A$410 consequence on the same day (§3).
4. Before the first non-friend salon, spend ten minutes on **privacy** (§6).

`node scripts/launch-check.mjs` covers §1 and will keep covering it. Nothing
checks §1b automatically, because the page is not in this repository.
