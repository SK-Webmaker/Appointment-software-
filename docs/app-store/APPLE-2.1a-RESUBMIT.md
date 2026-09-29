# Rejected 28 September 2026 — 2.1(a) App Completeness: "launched to an error message"

Submission `a36c1697-e3e2-4d95-8d28-07936ffb57f8`, version 1.0 (17), reviewed on
an iPhone 17 Pro Max, iOS 27.0. Apple's screenshot: the shard's
**"No salon at this address — Check the link you were given."** page.

## What actually happened

Build 17 opened on a native screen: *"What is your Kairo address?"*. Whatever
the reviewer typed was turned into `<name>.kairobookings.com`. Every such
address reaches the shard (wildcard DNS), and one that names no salon gets the
"No salon at this address" page — `kairo`, `luxehairstudio`, `kairobookings`
all do. Nothing was wrong on the server: no deploy or restart that day, and
`demo` resolved throughout.

The part that made it a rejection rather than a retry: the app **saved** the
address before loading it, and had no way back to the address screen. So every
launch after one wrong guess went straight to the error page. Only deleting
the app got out.

## What changed

**Build 1.0.0 (19)** — see `ios/README.md` → *Signing in*:

- Opens on **login.kairobookings.com** (email + password). No address is typed.
  The front door finds the salon and hands over; the app adopts that salon from
  the response and opens straight to it after that.
- A saved address that stops naming a salon is forgotten (`X-Kairo-No-Salon`),
  and the app returns to sign-in on its own. Old saved values that are not a
  salon address are dropped at launch.
- Signing out anywhere in the workspace (menu, Account page, Close my account)
  returns the app to the sign-in screen.
- No connection: "Can't reach Kairo — Try again", not a blank page.
- In the app, the front door hides "Back to the website", "Get started" and
  the website footer links (the app sells nothing — 3.1.1).

**Server 1.69.0**: the "No salon" page offers *Sign in with your email* and
carries the header; the demo seed now fills six weeks ahead (the demo had
nothing booked after the current week — a review a week later would have
found an empty calendar); inside the app the setup checklist no longer tells
the owner to "put Kairo on your phone".

**Verified** against the live service with the App Review credentials, in an
iPhone-sized browser with the app's `kairoNative` marker and its navigation
rules applied: front door (links hidden) → sign in → handoff → demo workspace,
no setup wizard, `signed-in` sent to the app; calendar, clients, billing and
account all render; "Close my account" present; a relaunch opens the demo
directly; an unknown address carries `X-Kairo-No-Salon`.

## Resubmitting

1. Wait for **1.0.0 (19)** to finish processing (App Store Connect emails you).
2. On a real iPhone: delete Kairo, install **19** from TestFlight, open it,
   sign in with the demo account. It should land in Luxe Hair Studio.
3. Re-record the screen recording from launch (the old one shows the address
   screen, which no longer exists). Same order as before, starting at
   "Sign in to Kairo". Stop at the final button of *Close my account*.
4. **Distribution → iOS App 1.0 → Build**: remove 17, add **19**.
5. **App Review Information**: sign-in required, `demo@kairobookings.com` and
   the demo password; Notes = `APPLE-2.1-NOTES-4000.txt` with the password and
   the new video link filled in (3,937 characters with both).
6. **Save**, then **Resubmit to App Review**, and reply to Apple's message with
   the text below.

## The reply

> Hello,
>
> Thank you for the screenshot. It showed us a real bug, and it is fixed.
>
> What happened: build 1.0.0 (17) opened on a screen asking for the business's
> Kairo address. The address entered did not match a business, so the app
> showed "No salon at this address". Because the app saved what was typed,
> every later launch went straight back to that page with no way to try again.
>
> What we changed in build 1.0.0 (19):
> - The app now opens on a standard sign-in screen: email and password. There
>   is no address to type.
> - After sign-in it opens the demo business automatically and remembers it.
> - If a saved business cannot be found, the app returns to sign-in by itself
>   instead of showing an error.
> - With no connection it shows "Can't reach Kairo" with a Try again button.
>
> To review:
> 1. Open Kairo. The first screen is "Sign in to Kairo".
> 2. Email: demo@kairobookings.com — Password: (as in App Review Information)
> 3. Tap Sign in. You are in the demo business, Luxe Hair Studio, filled with
>    sample stylists, clients and six weeks of bookings.
>
> We tested this sign-in end to end against our live service with these exact
> credentials, and the App Review notes are updated to match.
>
> Thank you,
> The Kairo team

## Do not, while it is in review

- Change the demo password, or sign the demo out everywhere.
- Action a "purge" task for Luxe Hair Studio if one sits in the operator queue
  (the demo's "Close my account" was pressed on 23 September while recording).
- Cancel and resubmit: that goes to the back of the queue.
