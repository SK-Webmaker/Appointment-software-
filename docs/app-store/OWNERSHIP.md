# If who owns Kairo ever changes

*Written 15 September 2026, when the seller was settled as **Shamalka Kiridena**,
sole trader, no ABN.*

The seller's name is not a label. It is the party to the contract a customer
agrees to when they pay A$410, and it appears in five places that are not all
in this repository. The failure to avoid is not a blank — a blank is obvious.
It is **two documents naming two different sellers**, which looks like nothing
at all until somebody disputes a charge and produces whichever version suits
them.

## The one file to change

`platform/seller.js`. One line:

```js
export const SELLER = 'Shamalka Kiridena';
```

Change it, then run `npm test`. The Terms and the Privacy Policy are read back
against that constant, so they will **fail until they agree** — which is the
whole point of the constant existing. Fix the two pages, and the test goes
green. `node scripts/launch-check.mjs` checks the same thing.

Three mutations in `test/falsify.mjs` prove those tests can actually fail:
`terms-names-a-different-seller`, `terms-names-an-unregistered-entity`, and
`privacy-stops-saying-who-holds-the-data`.

## The four places outside this repository

Nothing in the code can check these. They have to be worked by hand, and the
order matters — a customer who pays during the gap sees one name on the
contract and a different one on their bank statement.

| Where | What it is | What happens if it is missed |
|---|---|---|
| **Stripe** → Settings → Business | The name on the card statement and the emailed receipt | The customer's bank shows a name they do not recognise. This is the single most common cause of a chargeback. |
| **Apple** → App Store Connect → the seller shown on the listing | What the App Store says under the app's name | Apple's listing contradicts the Terms it links to. |
| **Apple Developer Program** → the account holder | Who the certificates and the app belong to | Transferring an app between Apple accounts is a separate, slow process. Do this one **first**, not last. |
| **The marketing site** → `kairobookings.com/legal/terms` | A different repository, currently naming no seller at all | The public Terms and the platform's Terms disagree, and the public one is the one a customer reads first. |

## The order

1. **Apple Developer Program account holder** — slowest, and everything iOS
   depends on it. Start it before anything else.
2. **`platform/seller.js`**, then the two pages the failing test names.
3. **Stripe's business name**, so the receipt matches the contract.
4. **App Store Connect**, so the listing matches both.
5. **The marketing site's Terms.**

Then: `node scripts/launch-check.mjs` and `npm test`, and open
`kairobookings.com/legal/terms` and the platform's `/terms` side by side and
read the "Who we are" line on each out loud. If they are not the same sentence,
it is not done.

## Two things that are true today and worth not losing

**There is no ABN, and none is needed to sell.** A sole trader may trade under
their own name without one. What no ABN means is that **"Kairo Bookings" cannot
be named as the seller** — a business name must be registered with ASIC, ASIC
requires an ABN, and naming an unregistered entity in a contract names nobody.
Kairo is the name of the product. The seller is the person. A test enforces
that distinction.

**If an ABN is ever registered, GST follows on the same day.** See
`LEGAL-TODO.md` §3: once registered, the A$410 is deemed GST-inclusive whether
or not any was added, which is roughly **A$37 a sale** owed on money already
banked. That is a decision to make deliberately, not to discover at tax time.
