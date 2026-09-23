# Answering Apple's Guideline 2.1 request

Rejected 23 September 2026, status `2.1.0 Performance: App Completeness`.

**This is not a rejection of the app.** Apple's own words: *"This app has been
submitted by a developer account that has a limited App Review history. We need
additional information to better understand the app and complete the review."*
It is the standard questionnaire every new developer account gets. Nothing in
the build has to change.

They asked for six things, to be sent **both** as a reply on the App Review
page **and** pasted into the Notes field so future submissions have it.

---

## The one thing only you can do: the screen recording

Apple requires it captured **on a physical iPhone**, not the simulator, and it
must **start from launching the app**. Screen Recording from Control Centre is
fine. Two to three minutes is plenty.

Record this order, without cuts:

1. **Launch from the home screen.** Show the icon being tapped.
2. **First screen** — "What is your Kairo address?" — type `demo`, continue.
3. **Sign in** — `demo@kairobookings.com` and the password. Let the sign-in be
   visible; this is the flow they say they need.
4. **Calendar** — scroll the week. Tap an empty slot, book an appointment,
   **Book appointment**. Show it appear in the diary.
5. **Clients** — open one, show visit history and totals.
6. **Billing** — **New invoice**, then open it and **Record payment**.
7. **Push permission** — the "Kairo Would Like to Send You Notifications"
   prompt, which appears *after* sign-in, not on first launch.
8. **Account deletion** — **Account** → "Closing your account" → **Close my
   account**. Show the dialog asking for the password and the business name,
   then close it **without completing it**.

> Do **not** complete the deletion. It really works: it takes the booking page
> down, signs everybody out and marks the salon for deletion in seven days — on
> the same demo salon the reviewer is about to use. Showing the flow is what
> 5.1.1(v) asks for, and Apple did not raise 5.1.1 here.
>
> Do **not** run `npm run reset-demo` on the shard either — that script is not
> tenant-scoped and is a local development tool only. The appointment and
> invoice you create on camera can simply stay in the demo.

Full tap-by-tap version: `docs/app-store/RECORD-AND-RESUBMIT.md`.

Upload the file to Google Drive/Dropbox with link sharing on, and put the link
in the reply. Apple accepts a link.

---

## The text — paste this into BOTH the reply and the Notes field

```
Thank you. Answers to each point below.

1. SCREEN RECORDING
<paste your link here>
Recorded on a physical iPhone running the current iOS. It begins at app launch
and shows: entering the salon address, signing in, the calendar, booking an
appointment into an empty slot, a client record with visit history, building an
invoice and taking a payment, the push-notification permission prompt, and the
in-app account deletion flow (Account > Close my account), shown as far as its
confirmation dialog, which asks for the password and the business name typed
out. We stop at the final button only because completing it takes this same
demo salon offline for you. Ask us and we will supply a second account to
delete on camera.

There is no in-app purchase, no paid content and no purchase path in the app,
so there is nothing of that kind to show. There is no public or shared
user-generated content, so there is no reporting or blocking mechanism: the
only content is the business's own private appointment book, visible to that
business alone.

2. PURPOSE AND TARGET AUDIENCE
Kairo is an appointment book for small salons and barbershops - typically one
to five staff. The problem it solves is that this kind of business runs its day
on paper diaries or on marketplace software that lists them alongside
competitors and takes a commission on their own regular clients.

Kairo gives them their own booking page on their own address, an appointment
book that matches how salon work actually runs (four-hour colours, prices that
start "from" an amount, part-time staff), client records including service
history, and invoicing. It is bought once on kairobookings.com for a one-off
fee. There is no subscription and no commission on bookings or payments.

This app is the phone companion to that account. It is free, it sells nothing,
and it is sign-in only.

The audience is any salon, barber, beauty, nail or massage business that takes
appointments. It is sold publicly to anyone who wants it, not to a specific
company or a closed group of employees, so it belongs on the public App Store
rather than in a custom or organisation-only distribution.

3. SETTING UP AND ACCESSING THE MAIN FEATURES
Full working demo credentials are in the App Review Information section.

  Salon address: demo        (resolves to demo.kairobookings.com)
  Email:         demo@kairobookings.com
  Password:      <the demo password>

On first launch the app asks for the salon's Kairo address. Enter "demo", then
sign in with the details above. No sample files are needed.

The demo salon is fully populated: three stylists, thirteen services, fourteen
example clients and a year of appointment history, so every screen has real
content. It is all sample data - no real business's records and no real
client's details appear anywhere in it.

  Calendar   - a week of appointments across three stylists. Tap an empty slot
               to book; drag an appointment to move it.
  Clients    - visit history, totals and notes.
  Billing    - build an invoice from an appointment and record a payment.
  Settings   - business details, services, team, notifications.
  Account    - "Closing your account" > Close my account: account deletion, in
               the app, per 5.1.1(v), confirmed with the password and the
               business name typed out.

4. EXTERNAL SERVICES USED
  Hosting and database   Render (servers and per-business databases, Australia)
  Push notifications     Apple Push Notification service
  Email delivery         Resend
  SMS delivery           ClickSend (a business may instead connect Twilio or
                         Telnyx; the app never resells messaging)
  Card payments          Stripe, or Square, connected to the BUSINESS's own
                         account. Card details never reach Kairo's servers and
                         Kairo never holds or routes the money.
  Bot protection         Cloudflare Turnstile, on the public booking page only
  DNS and email routing  Cloudflare
  Password safety        Have I Been Pwned range API, to refuse passwords known
                         to be breached. Only a hash prefix is sent; the
                         password never leaves the server.

There are no analytics, no advertising SDKs, no crash-reporting SDKs, no data
brokers and no AI services of any kind in this app.

5. REGIONAL DIFFERENCES
There are none. The app behaves identically in every region. It is offered in
English, prices display in the business's own configured currency, and no
feature is enabled or disabled by country.

6. REGULATED INDUSTRY / PROTECTED MATERIAL
Kairo is not a regulated industry app and is not a medical device. It does not
diagnose, treat or monitor anything, and makes no health claims.

For completeness, because "Health" is declared in App Privacy: a salon can type
free-text notes against a client, and in practice those sometimes record an
allergy or a patch-test result before a colour service. That is information the
business collects from its own client in the ordinary course of hairdressing.
Under Australia's Privacy Act it counts as health information, so we declared
it rather than leave it out. Kairo stores it on the business's behalf, never
reads it for its own purposes and never shares it. This is set out in our
Privacy Policy at https://kairobookings.com/legal/privacy and in the Data
Processing Addendum at https://kairobookings.com/legal/dpa.

The app contains no third-party copyrighted material. All content is the
business's own data plus our own interface.

Support: support@kairobookings.com
```

---

## Also fix before resubmitting: two wrong App Privacy declarations

The published App Privacy lists **10** data types, and two of them are not true:

- **Precise Location** - the app never asks for or uses location. There is no
  CoreLocation import and no NSLocationWhenInUseUsageDescription in the
  Info.plist, so this contradicts the binary.
- **Contacts** - the app never reads the iPhone address book. Client records
  are typed into the app or come from the booking page; the Contacts framework
  is not used.

Leaving these in is worse than a tidy-up. A reviewer already asking questions
can compare the declaration against the binary, and an over-declaration that
does not match is exactly the kind of inconsistency that turns one round of
questions into two. Precise Location is also a category Apple scrutinises
closely.

Remove both. The other eight are accurate and stay.

---

## Order of operations

1. Remove Precise Location and Contacts from App Privacy, then **Publish**.
2. Record the video on a physical iPhone. Reset the demo data afterwards.
3. Paste the text above into **App Review Information > Notes**, with the demo
   password and the video link filled in. Save.
4. Reply to Apple on the **App Review** page with the same text.
5. **Resubmit to App Review**.

Apple usually answers a 2.1 reply within 24-48 hours. Nothing in the build
changes, so no new upload is needed - build 1.0.0 (17) stays.
