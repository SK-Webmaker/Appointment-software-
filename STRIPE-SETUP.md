# Stripe setup — take card payments at the counter (POS)

This guide takes a salon owner from nothing to live card payments, in order,
with nothing assumed. Money flows **directly into the business's own Stripe
account** and pays out to their bank on Stripe's normal schedule — Kairo never
touches or holds the money.

---

## 1. Create the Stripe account (10 min)

1. Go to **stripe.com** → **Sign up**.
2. Use the **business's email address** (the one from Settings → Business profile).
3. Verify the email (click the link Stripe sends).

## 2. Business verification (10–15 min, once)

Stripe is legally required to verify who's being paid ("Know Your Customer").
In the Stripe dashboard, complete **Activate your account**:

- Business type (sole trader / company), ABN if you have one
- The owner's legal name, date of birth, address
- A phone number

You can explore test mode before this is finished, but **live payments only
work after activation**.

## 3. Connect the bank account (2 min)

Still in the activation flow (or **Settings → Bank accounts and scheduling**):

- Enter the business BSB + account number (Australia) — this is where payouts land.
- Default payout schedule is daily-automatic (first payout takes ~7 days,
  after that money arrives on a rolling basis). Nothing to configure in Kairo —
  **payouts are entirely Stripe → bank**.

## 4. Get the API key and paste it into Kairo (2 min)

1. Stripe dashboard → **Developers → API keys**.
2. Two modes exist, switchable with the **Test mode** toggle (top right):
   - **Test mode** → key starts `sk_test_…` — pretend money, perfect for trying it
   - **Live mode** → key starts `sk_live_…` — real cards, real money
3. Copy the **Secret key** (click *Reveal*).
4. In Kairo: **Settings → Online deposits (Stripe) → Stripe secret key** → paste → Save.
   - The same key powers **both** POS card payments and online booking deposits.
   - The key is write-only: once saved, Kairo never shows it again (green "saved" dot instead).
5. Set **Currency code** to `aud` (same card in Settings).

## 5. Try it in test mode (5 min)

1. Make sure the key you pasted is the **test** one (`sk_test_…`).
2. Open **Point of Sale** → New sale → add a service → **Charge** → **Card / wallet**.
3. On the Stripe payment page use the standard test card:
   - Number: `4242 4242 4242 4242` — any future expiry, any CVC, any name
   - Declined-card test: `4000 0000 0000 0002`
4. Pay → the POS screen flips to **Payment received** by itself (no refresh),
   the invoice is Paid, and the charge appears in the Stripe dashboard
   (test mode → Payments).

## 6. Test a refund (2 min)

1. **Billing** → open the paid invoice → **Refund**.
2. Try a partial amount first, then the remainder.
3. Both appear under the payment in Stripe (test mode → the payment → Refunds),
   and in Kairo's payment history as negative lines.

## 7. Go live (1 min)

1. Flip Stripe's dashboard out of Test mode.
2. Copy the **live** secret key (`sk_live_…`).
3. Paste it over the old one in Kairo Settings → Save. Done — the very next
   POS charge is real.

## 8. How tap / Apple Pay / Google Pay work here

- **On the customer's phone** (recommended): at charge time tap **Share
  payment link** — AirDrop/iMessage it to the customer standing in front of
  you. Their phone opens Stripe's payment page where **Apple Pay / Google Pay
  appear automatically** — one tap and it's paid. The salon screen flips to
  paid by itself.
- **On the salon phone**: tap **Open payment page** and hand the phone over —
  the customer types their card (Stripe's page, PCI-safe; card numbers never
  touch Kairo).
- **True tap-a-card-on-the-phone** (like Fresha's "hold here to pay") requires
  a native iOS/Android app by Apple/Google's rules — a browser cannot access
  the NFC payment hardware. Kairo's server is already built on the same Stripe
  primitives Stripe Terminal uses, so a native wrapper with **Stripe Terminal
  Tap to Pay** can be added later without changing anything you set up today.

## 9. Webhooks — deliberately not required

Many Stripe integrations need you to configure webhooks + signing secrets.
Kairo doesn't: the server **asks Stripe directly** whether each POS session
was paid (authoritative, can't be spoofed, nothing to configure, works even
behind firewalls). If you ever want webhook-driven updates as well, that's an
optional future enhancement — not something a salon owner needs to set up.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Card payments need a Stripe key first" | Paste the secret key in Settings → Online deposits |
| Payment page opens but charge never completes | You're probably mixing test/live: a `sk_test_` key shows test pages that real cards won't pay |
| "Your account cannot currently make live charges" | Finish account activation (step 2) |
| Refund button missing | Only paid invoices with money collected show Refund |
| POS stuck on "Waiting for payment" | The customer hasn't completed Stripe's page; Cancel sale voids it cleanly — nothing was charged |
