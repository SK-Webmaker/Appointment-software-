# The final test: buying Kairo as a customer would

About 35 minutes. You play a salon owner who has never heard of Kairo
before, from the website to a refund, with real money (A$5).

## Before you start

- **Tell me "start the test".** I set the price to A$5, check the signup page
  shows it, and tell you to go. (Or set it yourself: Render → kairo-platform →
  Environment → `KAIRO_PRICE_CENTS` = `500` → Save.)
- Have ready:
  - an email address never used for Kairo; a Gmail alias works, e.g.
    `you+final@gmail.com`
  - a second email to play the client, e.g. `you+client@gmail.com`
  - your mobile, a card, and your iPhone
- Wait until I've told you Kairo is on the App Store, so step 7 can be done
  the real way.

## A. Buy it (10 min)

1. Go to **kairobookings.com** and press **Sign up**.
   - ✔ You land on **start.kairobookings.com**, and it says **A$5**.
2. Fill in your name, business name `Final Test Salon`, the new email, your
   mobile and a password. Leave the ABN blank. Address: `finaltestsalon`.
   - ✔ The address says it's available.
3. Enter the code from the email and the code from the text.
   - ✔ Both arrive within a minute.
4. Pay A$5. Apple Pay is fine.
   - ✔ You come back to start.kairobookings.com, and it says your Kairo is ready.
5. Open the **"Final Test Salon is ready on Kairo"** email.
   - ✔ It says confirmations already go out by email.
   - ✔ It mentions ClickSend for texts.
   - ✔ The booking link and the App Store link both work.

## B. Set it up as the owner (10 min)

6. Go to **login.kairobookings.com** and sign in. Go through the setup steps:
   - business type
   - details and hours
   - brand
   - services and team
   - reminders

   ✔ The last step offers the App Store app.
7. On the iPhone, install **Kairo** from the App Store and sign in with the
   same email and password. Allow notifications.
   - ✔ It opens straight into Final Test Salon.
8. Texts, as a new owner would: on the dashboard press **Set up texts** (or
   Settings → SMS → **Set up text messages**). Follow it with your own
   ClickSend account.
   - ✔ It says "Connected" and shows your credit.
   - ✔ The last step sends a real text to your phone and says texts are on.
   - ✔ In step 9 the client's mobile gets the booking confirmation by text too.

## C. Be a client (10 min)

9. In a private browser window, go to **finaltestsalon.kairobookings.com/book**.
   Book a service for tomorrow with the second email and a mobile number
   (yours is fine).
   - ✔ The client email gets a confirmation from "Final Test Salon".
   - ✔ The iPhone pings with the new booking.
   - ✔ The booking is in the calendar.
10. Reply to that confirmation email.
    - ✔ The reply arrives in the owner's email.
11. Press the cancel link in the confirmation and cancel.
    - ✔ The iPhone pings.
    - ✔ The slot is free again.
12. Book once more. In Kairo, open the appointment, mark it done and take
    payment (cash).
    - ✔ A receipt reaches the client email.

## D. Leave (5 min)

13. In Kairo, go to **Account** and press **Refund and close my Kairo**.
    - ✔ A$5 back in Stripe.
    - ✔ An email with your data.
    - ✔ finaltestsalon.kairobookings.com no longer opens a salon.
    - ✔ The app goes back to sign-in.
14. Go to **start.kairobookings.com/operator**. Final Test Salon shows
    **Refunded**. Press **Remove test record**.
15. **Tell me "test done".** I set the price back to A$410 and check it.

If any ✔ doesn't happen, send me the step number and a screenshot.
