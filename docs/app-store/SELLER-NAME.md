# Showing "Kairo" instead of your name on the App Store

Right now the App Store shows the seller as **SHAMALKA L D KIRIDENA**. That's
because the developer account was opened as an **individual**, and Apple always
shows an individual's legal name. You can't type in a trading name, and Apple
does not accept business names, trade names or "doing business as" names for
this.

**The only way to change it is to have a company.** Apple shows the company's
registered name as the seller. Everything else (the app's name, its icon, the
copyright "2026 Kairo") already says Kairo.

If you'd rather not set up a company yet, that's fine. Plenty of
well-run apps show a person's name, and nothing about Kairo works differently.

## What it takes (Australia)

1. **Register a company** with ASIC, e.g. **Kairo Bookings Pty Ltd**.
   - Done online through ASIC or an accountant, usually same day.
   - The government fee is roughly A$600, plus whatever an accountant charges.
   - A company also has its own ABN, its own bank account and its own tax return.
     Ask your accountant whether it suits you; it's a bigger decision than the
     App Store name.
2. **Get a D-U-N-S Number** for the company. It's free.
   - Use Apple's D-U-N-S lookup on developer.apple.com and follow the link to
     request one.
   - It can take up to about two weeks to arrive.
3. **Move the app to the company.** There are two ways:
   - **A. Convert your account (simplest to ask for).**
     - Contact Apple Developer Support (developer.apple.com → Contact us →
       Membership and account) and ask to change your membership from
       individual to organisation. Give them the company name and D-U-N-S
       Number.
     - Some developers report that the seller name on the existing app didn't
       update by itself afterwards. If that happens, ask the same support case
       to update it.
   - **B. Open a new organisation account and transfer the app to it.**
     - The organisation account costs US$99 a year.
     - Transfer the app from App Store Connect (App Information → Transfer App).
     - The app keeps its ratings, reviews and App Store link, and existing users
       keep getting updates.
     - Afterwards the seller is the company.

## If you do option B, tell me first

Push notifications are signed with a key that belongs to the developer account.
After a transfer, the salon server needs a new key from the new account:

- `KAIRO_APNS_KEY`
- `KAIRO_APNS_KEY_ID`
- `KAIRO_APNS_TEAM_ID`

Otherwise new-booking notifications stop until the key is swapped. It takes
five minutes, but it has to be done the same day.

## Sources

- Apple: [Enrolling in the Apple Developer Program](https://developer.apple.com/programs/enroll/)
  says an individual's name is displayed as the seller, an organisation's name is
  displayed for an organisation, and DBAs and trade names are not accepted.
- Apple: [Overview of app transfer](https://developer.apple.com/help/app-store-connect/transfer-an-app/overview-of-app-transfer)
  says an app keeps its reviews and ratings through a transfer.
- Apple Developer Forums: [Seller name still shows my personal name after
  converting account to Organization](https://developer.apple.com/forums/thread/813734).
