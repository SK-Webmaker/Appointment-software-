# The screen recording, and resubmitting to Apple

Everything Apple asked for, in the order you do it. Nothing here changes the
app or the build — build **1.0.0 (17)** stays exactly as it is.

---

## The links you need

| What | Link |
|---|---|
| Demo salon, in a browser | https://demo.kairobookings.com |
| Demo salon, in the app | type `demo` at the address screen |
| Where buyers sign up and pay | https://kairo-platform.onrender.com/start |
| App Store Connect | https://appstoreconnect.apple.com |

**Demo sign-in**

```
Salon address: demo
Email:         demo@kairobookings.com
Password:      Sachi123456
Business name: Luxe Hair Studio
```

Checked at the time of writing: the address answers, that email and password
sign in as "Demo Owner", and the salon loads as **Luxe Hair Studio** with a
populated calendar, 14 clients, 13 services and 3 stylists. That is the same
check Apple's reviewer will do first.

> The business name matters — the account-closing screen asks you to type it
> exactly, and it is "Luxe Hair Studio", not "Demo".

---

## Part A — getting Kairo onto your iPhone

Kairo is not on the App Store yet — that is the whole point of this exercise —
so you cannot install it the normal way. It comes through **TestFlight**,
Apple's free app for testing builds before release.

### A1. Make sure you are a tester

On a computer, in App Store Connect:

1. https://appstoreconnect.apple.com → **Apps** → Kairo → **TestFlight** tab
2. Check build **1.0.0 (17)** is listed and its status is **Ready to Test**.
   If it says *Processing*, wait — it takes 10–30 minutes after an upload.
3. Left side → **Internal Testing** → the **App Store Connect Users** group →
   **+** → tick your own Apple ID → **Add**

   You are the account holder, so you can add yourself. Internal testers need
   no Beta App Review and no waiting.

4. You will get an email from TestFlight with a redeem code or an invite link.

### A2. Install it

1. On the iPhone, open the **App Store** and install **TestFlight** (free,
   made by Apple).
2. Open TestFlight and sign in with **the same Apple ID** you added as a
   tester. A different Apple ID will show an empty TestFlight.
3. Kairo appears in the list. Tap it → **Install**.
4. Kairo now has its **own icon on your home screen**, like any other app.

### A3. Do a dry run first

Open Kairo from the home screen and walk through every step in Part B once,
**without recording**. This is worth the five minutes: you learn where the taps
are, and the recording you keep is the confident one rather than the one where
you hunt for a menu.

TestFlight may show a one-time beta sheet the first time a build opens. Dismiss
it. If it reappears in the real recording that is fine — Apple's reviewers see
TestFlight builds every day and expect it.

### A4. Reset for the real take

1. **Delete Kairo from the phone.** Press and hold the icon → Remove App →
   Delete App.
2. **Reinstall it from TestFlight** (it stays in your TestFlight list).

   This is not optional. The two screens Apple specifically asked to see — the
   "What is your Kairo address?" prompt and the notifications permission
   dialog — only appear on a fresh install. On a phone that has already run the
   app you will film neither of them.

3. **Do not open it.** The recording starts from the closed app.
4. Turn on **Do Not Disturb** (Control Centre → crescent moon). A message
   banner sliding over the recording means filming it again.

### You record the Kairo app, not TestFlight

TestFlight is only the delivery van. Once Kairo is on the home screen you never
open TestFlight again — step 1 of the recording is tapping the **Kairo** icon.

---

## Part B — the recording, tap by tap

**It must be a screen recording from the iPhone itself, not a video of a phone
filmed on another phone.** Apple rejects hand-held footage of a screen.

**Starting it:** swipe down from the top-right corner → tap the ⏺ record
button → wait for the 3-2-1 → swipe the Control Centre away. If the record
button is not there: Settings → Control Centre → add **Screen Recording**.

Then, slowly. Give each screen two or three seconds before you tap. A reviewer
is watching to understand, not to be impressed by speed.

| # | What you do | What Apple sees |
|---|---|---|
| 1 | Tap the Kairo icon on the home screen | The app launching cold |
| 2 | The screen says **"What is your Kairo address?"** — type `demo` | Setup step 1 |
| 3 | Tap **Continue** | |
| 4 | The Kairo sign-in loads. Email `demo@kairobookings.com`, password, **Sign in** | Setup step 2 |
| 5 | iOS asks **"Kairo Would Like to Send You Notifications"** — tap **Allow** | The push permission prompt they asked about |
| 6 | You land on the **Dashboard**. Pause here 3 seconds | The app has real content |
| 7 | Open the menu and tap **Calendar**. Scroll the week sideways once | The core feature, populated |
| 8 | Tap an **empty slot** in the grid | "New appointment" opens |
| 9 | Pick a client, pick a service, tap **Book appointment** | A booking being made |
| 10 | Show the new appointment sitting in the grid | It worked |
| 11 | Menu → **Clients**. Tap any client | A client record: visit history, totals, notes |
| 12 | Menu → **Billing**. Tap **New invoice**, add a line, tap **Create invoice** | Invoicing |
| 13 | Open that invoice, tap **Record payment**, enter an amount, **Record payment** | Taking a payment |
| 14 | Menu → **Account**. Scroll to the bottom, to **"Closing your account"** | Account deletion exists |
| 15 | Tap **Close my account**. The dialog opens asking for your password and your business name | The deletion flow, per 5.1.1(v) |
| 16 | **STOP. Do not fill it in. Do not tap "Close the account."** Tap outside the dialog to close it | |
| 17 | Stop the recording (red pill at the top → Stop) | |

### Why you stop at step 16

Tapping **Close the account** actually works. It takes the booking page down,
signs everybody out and marks the salon for deletion in seven days — on the
**same demo salon Apple's reviewer is about to sign into**. Undoing it needs
shell access to the server, mid-review, which is exactly the wrong time.

Showing that the deletion exists and is reachable is what Guideline 5.1.1(v)
requires, and Apple did **not** raise 5.1.1 in this rejection anyway. The notes
text says plainly that you stopped and why, and offers them a second account if
they want to see it completed. That is an honest answer, and it is the version
that cannot break the review.

### After you stop

Watch it back once, the whole way through. Check:

- no notification banners slid over the top
- the password is not readable anywhere (iOS shows dots, but check)
- it is under about 3 minutes
- every tap is visible and nothing is cut off

If anything is wrong, delete the app and film it again. It is ten minutes.

---

## Part C — getting a link Apple can open

Apple cannot open a file from your phone. They need a URL.

**Google Drive (easiest):**

1. Photos → your recording → Share → Save to Files, or upload straight from
   the Google Drive app.
2. In Drive, long-press the file → **Share** → **Anyone with the link**.
3. Set it to **Viewer**.
4. Tap **Copy link**.

**Test the link before you use it.** Open a private/incognito browser window,
paste it, and confirm the video plays without asking you to sign in. A link
that only works while you are logged in is the single most common way this
round goes wrong.

Keep the link short. A Google Drive link is about 85 characters and fits. If
you use something longer, the notes field may tip over the 4000-character
limit.

---

## Part D — the two places the reply goes

### D1. The App Review reply (the conversation)

1. https://appstoreconnect.apple.com → **Apps** → Kairo
2. Left sidebar → **App Review** (or the message icon on the rejected version)
3. Open the message from App Review
4. Paste the **long** version — the whole of `docs/app-store/APPLE-2.1-REPLY.md`
5. Replace `<VIDEO LINK>` with your link and `<DEMO PASSWORD>` with `Sachi123456`
6. **Reply**

This field has no tight character limit, so use the full text here.

### D2. The Notes field (attached to the build)

1. Same app → the version that was rejected → scroll to **App Review Information**
2. The **Notes** box
3. Delete whatever is in there
4. Paste the **short** version — all of `docs/app-store/APPLE-2.1-NOTES-4000.txt`
5. Replace `<VIDEO LINK>` and `<DEMO PASSWORD>` the same way
6. Fill in the fields beside it, if they are not already:
   - Sign-in required: **Yes**
   - User name: `demo@kairobookings.com`
   - Password: `Sachi123456`
   - Contact email / phone: yours
7. **Save**

The short version is 3832 characters as written, and stays under 4000 with a
link of up to about 100 characters substituted in.

---

## Part E — the App Privacy fix, then submit

Still outstanding from the last check, and it must be done before you resubmit:

1. App Store Connect → Kairo → **App Privacy** → Edit
2. **Remove Precise Location** — the app never asks for location
3. **Remove Contacts** — the app never reads the phone's address book
4. **Publish**

Leaving those declared claims the app collects data it does not touch, which is
its own rejection reason.

Then: the version page → **Add for Review** → **Submit to App Review**.

---

## Part F — afterwards

- The extra appointment and invoice you created on camera stay in the demo.
  That is fine and it is what a reviewer expects to find — a salon in use.
- **Do not run `npm run reset-demo` on the shard.** That script is not
  tenant-scoped: on a multi-salon shard it does not know which salon it is
  clearing. It is a local development tool only.
- Change the demo password once review is over. `Sachi123456` has been typed in
  plain text in several places by now.
- Buyers currently sign up at `kairo-platform.onrender.com/start`. That works,
  but it is not a link you would want on marketing material. Worth putting on
  a proper kairobookings.com address before you push the app publicly — it is
  not a submission blocker.
