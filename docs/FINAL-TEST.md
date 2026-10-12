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
3. Enter the code from the email.
   - ✔ It arrives within a minute. No text is sent: the email code is all it asks for.
4. Pay A$5. Apple Pay is fine.
   - ✔ Stripe's page says **Kairo**, with the K mark on dark, and the line by
     the button promises a refund within 14 days.
   - ✔ You come back to start.kairobookings.com, and it says your Kairo is ready.
   - ✔ A **Receipt KRO-…** email arrives: the amount, the card you used, who sold
     it, and a link to Stripe's copy.
5. Open the **"Welcome to Kairo — Final Test Salon is ready"** email.
   - ✔ It greets you by your first name and says how to reach Kairo support.
   - ✔ It says confirmations already go out by email.
   - ✔ It mentions ClickSend for texts.
   - ✔ The booking link and the App Store link both work.

## B. Set it up as the owner (10 min)

6. Go to **login.kairobookings.com** and sign in. The setup journey opens.
   - ✔ A 48-second welcome video starts by itself at the top, silently, with
     captions. Press **Sound on**: it starts again from the top with a
     friendly Australian voice and quiet music. It shows what Kairo does,
     what is already switched on, and that texts come later.
   - ✔ It greets you by your first name, and "Final Test Salon" is already
     filled in.
   - ✔ Pick a business type: it drafts a menu and moves on by itself.
   - ✔ From the second step, your booking page builds up in a phone beside the
     steps (on a phone: under the colour step) as you choose colours, hours,
     services and team.
   - ✔ You are already listed on the team.
   - ✔ The last step says "Building Final Test Salon…", then "Final Test Salon
     is open for bookings", then offers the App Store app.
   - ✔ **Show me around** walks through every page in the menu, then Ask Kai
     and New appointment — 17 stops, with Back and Skip on each. On a phone
     the menu slides open for it and closes after.
7. On the iPhone, install **Kairo** from the App Store and sign in with the
   same email and password. Allow notifications.
   - ✔ It opens straight into Final Test Salon.
8. Texts, as a new owner would: on the dashboard press **Set up texts** (or
   Settings → Messages → **Set up text messages**). Watch the one-minute video
   at the top first, then follow the four steps with your own ClickSend account.
   - ✔ It is narrated, step by step, with the sound on from the first press.
   - ✔ The video plays on the iPhone too, with sound (Settings → Messages, or Help).
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
    - ✔ A receipt reaches the client email: numbered, dated, the service and
      its price, the total, "Paid · Cash", "Paid in full".
    - ✔ With an ABN and GST at 10% in Settings → Payments → Invoices &
      receipts, the next one is titled **Tax invoice** and shows the ABN. Its
      total is the menu price, with "Includes GST (10%)" under it — nothing
      added on top.
    - ✔ If Stripe is connected and deposits are on, Stripe's page shows Final
      Test Salon's name and colours, and the button says **Book**.

## D. Leave (5 min)

13. In Kairo, go to **Account** and press **Refund and delete my Kairo**.
    - ✔ Nothing happens yet: **Before you go** opens with the salon's own
      numbers (clients, appointments still to come, online bookings, messages)
      and what a refund takes away. **Keep my Kairo** closes it and changes
      nothing.
    - Press **Continue to the refund**.
    - ✔ **What a refund does** lists, one line after another: money back,
      booking page off, clients stop hearing (with how many are booked),
      everyone signed out, a copy emailed first, data deleted 7 days later,
      can't be undone. **Email me a code** stays greyed out until you tick
      "I understand".
    - Tick it and press **Email me a code**.
    - ✔ An email "123456 is your Kairo refund code" arrives at the sign-in
      address, saying it refunds A$5 and closes Final Test Salon.
    - Type one digit wrong first and press **Refund $5 and delete**.
    - ✔ It says the code doesn't match, the boxes shake, and nothing changes.
    - Type the right code and press **Refund $5 and delete**.
    - ✔ Each stage ticks off: confirming it's you, emailing your data,
      refunding, closing. Then a green tick draws itself and **Refund
      complete** shows what happened, and signs you out after 30 seconds (or
      when you press **Done**).
    - ✔ A$5 back in Stripe.
    - ✔ An email "Your Final Test Salon data from Kairo" with clients,
      appointments, invoices, payments and services attached (they open in
      Excel or Numbers).
    - ✔ finaltestsalon.kairobookings.com no longer opens a salon.
    - ✔ The app goes back to sign-in.
    - The files are deleted by themselves 7 days later.
14. Go to **start.kairobookings.com/operator**. Final Test Salon shows
    **Refunded**. Press **Remove test record**.
15. **Tell me "test done".** I set the price back to A$410 and check it.

If any ✔ doesn't happen, send me the step number and a screenshot.
