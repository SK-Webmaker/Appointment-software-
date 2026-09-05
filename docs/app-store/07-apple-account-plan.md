# Apple account: individual now, organisation later

*Decision record, 2026-09-05. The owner proposed enrolling as an individual
now and converting to an organisation once Kairo is established. That is
right, with one exception that has to be planned around.*

---

## The answer

**Do it.** Enrol as an individual (US$99, no D-U-N-S, no company), finish
Kairo, ship to TestFlight, get salons paying, and convert later. Apple
supports the conversion: the request is made by the Account Holder from
Membership Details, and **the Apple ID, Team ID, certificates and existing
apps stay intact — only the seller name changes** [1][2]. Once converted,
the company's legal name is the seller name on the App Store [3].

Nothing in Kairo's design depends on being a company today:

| Needs a company? | |
|---|---|
| App Store listing, TestFlight, App Review | no |
| Push notifications, biometrics, widget, camera | no |
| Selling Kairo at A$410 on the website through Stripe | no — a sole trader with an ABN takes card payments fine |
| Hosting, DNS, Resend, ClickSend | no |
| **Tap to Pay on iPhone** | **yes** — see below |

## The exception: Tap to Pay on iPhone

The Tap to Pay entitlement is only granted to **organisation** developer
accounts, requested by the Account Holder; individual accounts cannot get it
[4]. Two entitlements are needed, development and distribution, and the live
one can take several weeks [4].

This is the only capability in the plan that the individual account blocks.
It is already scheduled for version 1.1, not 1.0 (Phase 2 §5), so the order
of work does not change — but the sequence to remember is:

```
individual enrolment → 1.0 ships (push, biometrics, widget, camera, POS by pay-link)
        ↓  Kairo validated, company registered
convert to organisation (D-U-N-S first) → request Tap to Pay entitlements
        ↓  weeks, not days
1.1 ships with Tap to Pay
```

If Tap to Pay turns out to be the feature salons ask for first, that is the
signal to register the company sooner — not a reason to do it now.

## What it costs to defer

| | Individual now | If you registered a company now |
|---|---|---|
| Cost today | US$99 | US$99 + company registration (~A$600 ASIC) + ~A$40 ABN/name + accountant |
| Seller name on the App Store | **your legal name** | the company's name |
| Time before you can submit | days | weeks (D-U-N-S first) |
| Tap to Pay | not until you convert | available from 1.0 |
| Later work | one conversion request, a phone call from Apple, a couple of weeks | none |

The one real trade is the **seller name**: until conversion, the App Store
listing shows your own legal name under the app. For a salon owner deciding
whether to trust A$410 of software, the website, the two live salons and the
policies do that work; the seller line does very little. It is also the thing
that fixes itself on conversion.

## What this changes in the programme

- Phase 3's one-off costs drop the D-U-N-S line for now. Apple stays US$99.
- Phase 7 (launch) gains a step: *convert to organisation once the company
  exists*, then request the Tap to Pay entitlements.
- The policies (`04-policies.md`) currently say "[legal name, ABN]". Until a
  company exists, that is the owner's own name and ABN as a sole trader — the
  terms and privacy policy are still valid; the seller is simply a person.
  When the company is registered, the policies get the company's details and
  the App Store seller name follows.
- Nothing in the build changes. Slices 1–3 are done and unaffected.

## The one thing to check before enrolling

Apple asks an individual enrolee for their legal name as it appears on
government ID, and that name becomes the seller. Enrol with the name you are
comfortable having on a public listing for the next year or so.

---

Sources: [1] PTminder, *How to convert an Individual membership to an
Organization account* — https://help.ptminder.com/en/articles/4001125 ·
[2] Median.co, *From individual to organization* —
https://median.co/blog/how-to-change-your-apple-developer-account-from-individual-to-organization ·
[3] Apple Developer, *Program enrollment* —
https://developer.apple.com/help/account/membership/program-enrollment/ ·
[4] Apple Developer, *Setting up the entitlement for Tap to Pay on iPhone* —
https://developer.apple.com/documentation/ProximityReader/setting-up-the-entitlement-for-tap-to-pay-on-iPhone ;
Adyen and Finix entitlement guides confirm the organisation-account requirement.
