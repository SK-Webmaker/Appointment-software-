# Getting 1.0.3 onto every owner's phone

*Written 19 October 2026. Build **1.0.3 (29)** is uploaded and signed with
push (production) and the kairobookings.com app links, checked before upload.*

## Why the App Store shows no Update button yet

The App Store is still giving out **1.0.1**. 1.0.2 is waiting for review and
1.0.3 is only uploaded, so on an owner's iPhone there is nothing newer to
update to. Both 1.0.1 and 1.0.2 were signed without Apple's push permission,
so neither can ever show a notification. 1.0.3 is the fix.

An iPhone app cannot install its own update: only the App Store does that.
What Kairo does instead (server 1.84.0, live for every version of the app,
including the 1.0.1 on phones now):

- **A strip under the top bar**, inside the app only, the moment the App Store
  has a newer Kairo: *"Update Kairo to get booking notifications on this
  phone"* with an **Update** button that opens Kairo's App Store page, where
  Apple's own Update button is. **Later** hides it for a day.
- **Settings → App & Kai → Phone notifications** says the same, with an
  **Update Kairo** button.
- The server asks Apple every hour which version the App Store is giving out,
  so both appear within about an hour of release, with no deploy.
- iPhones with automatic updates on (the default: iPhone **Settings → App
  Store → App Updates**) install it by themselves, usually overnight on Wi-Fi.

## 1. Swap 1.0.2 for 1.0.3 in review (about 5 minutes)

1. App Store Connect → **Kairo** → the version in review (1.0.2) →
   **Remove from Review** (top right). It goes to *Developer Rejected*.
2. Change the version number at the top of that page from `1.0.2` to `1.0.3`
   and save.
3. **Build:** remove 1.0.2's build and pick **1.0.3 (29)**. If 29 is not
   listed yet, it is still processing; Apple emails when it is done.
4. **What's New in This Version.** This is shown to the public on the App
   Store. Only this goes in it:

   ```
   Booking notifications now arrive on your phone. After updating, open Kairo and tap Allow when it asks.
   ```

   The 1.0.1 listing has the reviewer notes in this box (the demo email and
   the "how to review" steps) and they are public. Replace them.
5. **App Review Information → Notes:** replace what is there with
   `APPLE-1.0.3-NOTES.txt`, pasted as it is (3,952 characters, under the
   4,000 limit). Sign-in details stay as they are.
6. **Version Release:** *Automatically release this version*, so it reaches
   phones the moment Apple approves it.
7. **Add for Review → Submit.**

Export compliance is already answered in the build (`ITSAppUsesNonExemptEncryption`
is false), so TestFlight and review will not ask.

## 2. On Sha's phone after approval

The strip appears in Kairo (or the phone updates itself overnight). Tap
**Update**, then **Update** on the App Store page, open Kairo and tap **Allow**.
Settings → App & Kai → *Send a test notification* then reaches the phone,
and the phone is listed under it.

## Before approval, only if it cannot wait

TestFlight installs 1.0.3 today, but only for an Apple ID on the tester list:

- **Internal tester:** no review, available as soon as build 29 finishes
  processing. The person has to be a user of your App Store Connect team
  (the *Marketing* role is the smallest that can test), which gives them a
  sign-in to App Store Connect.
- **External tester:** by email, no team access, but the first build of 1.0.3
  needs Apple's beta review first (usually under a day), which is about as
  long as the real review.

Installing from TestFlight replaces the App Store copy on that phone and keeps
the sign-in. For a real customer, waiting for the App Store release is
simpler.

## From now on

Builds from 1.0.4 tell the page their exact version (`kairoNative.app`), so
the prompt compares versions exactly. Older builds are placed by their bridge
version (2 is everything up to 1.0.2, 3 is 1.0.3), so an up-to-date phone is
never told to update.
