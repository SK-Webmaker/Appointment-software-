# Stripe: what is branded for you, and the ten minutes that need you

## Already done, in Kairo itself — nothing to set

**A salon's clients**, paying a deposit, paying online at booking, or paying at
the counter by card:

- Stripe's payment page shows **the salon's name, its button colour, the
  background of its booking page and its logo** (when the logo is a PNG or JPG
  and the salon has its own web address). The button says **Book** for
  bookings.
- Beside the button, one line saying exactly what the money is for: *"Your
  $50.00 deposit holds Full Colour on Tuesday, October 20 at 10:00 AM. It comes
  off your total on the day."*
- If Stripe ever turns the branding down, the same payment page opens plain.
  A booking is never lost over a colour.
- Afterwards, the client gets an **itemised receipt** from the salon: number,
  date, each service and product, GST, total, what was paid and how, what is
  left. With the salon's ABN in Kairo it is titled **Tax invoice**. Deposits
  get a deposit receipt that says what is left to pay on the day.
- The page they land on after paying at the counter is in the salon's colours.
- Billing → Print / PDF prints the same receipt or tax invoice, with the logo.

**An owner buying Kairo:**

- Stripe's payment page shows **Kairo's name, mark and colours**, and beside
  the button: *"One payment for Luxe Hair. No monthly fee, no commission — and a
  full refund within 14 days if Kairo isn't right for you."*
- The moment Stripe confirms the payment, Kairo emails **a receipt (KRO-00042)**
  with the card used, the date, who sold it (from `platform/seller.js`, the same
  name as the Terms) and a link to Stripe's own copy. The operator dashboard can
  resend it.

## Your Stripe account — once, about ten minutes

At [dashboard.stripe.com](https://dashboard.stripe.com), in live mode.

### 1. Public details

**Settings → Business → Public details**

| Field | Put |
| --- | --- |
| Public business name | `Kairo` |
| Statement descriptor | `KAIRO BOOKINGS` — what a customer sees on their card statement |
| Shortened descriptor | `KAIRO` |
| Support email | `support@kairobookings.com` |
| Website | `https://kairobookings.com` |

The account's legal name stays as it is. It is the seller, and it has to match
the Terms (see `platform/seller.js`).

### 2. Branding

**Settings → Branding**. The files are in this folder.

| Field | Upload or type |
| --- | --- |
| Icon | `kairo-icon.png` |
| Logo | `kairo-logo-dark.png` (Stripe shows it on white) |
| Brand colour | `#2F7FD6` |
| Accent colour | `#0A0E16` |

This dresses Stripe's own emails and refund notices. The payment page is
already branded by Kairo on every payment, so it looks right even before you
do this.

### 3. Customer emails

**Settings → Customer emails**

- **Successful payments: off.** Kairo sends its own receipt, and two receipts
  for one payment look like two charges.
- **Refunds: on.** Stripe's email is the confirmation a bank recognises that
  the money went back.

### 4. Only when they become true

On Render → **kairo-platform** → Environment. Save, then let it redeploy.

- `PLATFORM_ABN` — your ABN, once you have one. It goes on every Kairo
  receipt. Businesses buying from a business expect to see it.
- `PLATFORM_GST=1` — only once you are registered for GST. Receipts then
  become tax invoices showing the GST in the price (A$37.27 of A$410).

## What to tell a salon about its own Stripe

Kairo does the branding for them. Two optional touches, both in their own
Stripe dashboard:

1. **Public details → Statement descriptor**: their salon's name, so clients
   recognise the charge on their statement.
2. **Customer emails → Successful payments: off**, because Kairo already emails
   the receipt with their branding on it.

Then in Kairo: **Settings → Payments → Invoices & receipts → ABN**, if they
have one.
