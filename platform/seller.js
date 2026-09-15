// Who sells Kairo.
//
// This is one line of data in its own file for a reason. The seller's name is
// not decoration — it is the party to the contract a customer agrees to when
// they pay A$410, and it is the name that has to be the same in five places
// that are not all in this repository:
//
//   1. platform/public/terms.html   "Who we are"       ← this repo
//   2. platform/public/privacy.html "Who we are"       ← this repo
//   3. the Stripe account's business name              ← shows on the customer's
//                                                        card statement and receipt
//   4. the Apple Developer account / App Store seller  ← shown on the listing
//   5. the marketing site's Terms at /legal/terms      ← a different repository
//
// The day those disagree is the day somebody disputes a charge and produces
// whichever version suits them. So: change it here, run the tests, and work
// docs/app-store/OWNERSHIP.md for the ones outside this repo.
//
// No ABN. Under the Business Names Registration Act a person may trade under
// their own name without registering a business name; "Kairo Bookings" is not
// a registered entity and must not be named as the seller. Kairo is the
// product's name, which is a different thing from the seller's name.
export const SELLER = 'Shamalka Kiridena';

/** Where that person trades. Appears in the same sentence. */
export const SELLER_COUNTRY = 'Australia';

/**
 * Every file in THIS repository that states who sells Kairo. The test and the
 * launch check both read this list, so adding a page that names a seller
 * without adding it here is the one drift this cannot catch — which is why the
 * list is short and lives next to the name.
 */
export const SELLER_NAMED_IN = [
  'platform/public/terms.html',
  'platform/public/privacy.html',
];
