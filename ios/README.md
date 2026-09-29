# Kairo for iPhone

A shell around the same Kairo the browser loads — not a second client.

A native rewrite would mean every feature built twice, two things to keep in
step forever, and a salon owner still waiting for the second one. What the
shell adds is the four things a web page genuinely cannot do:

1. **Wake the phone when somebody books.** The one thing that earns an app its
   place on the home screen.
2. **Unlock with a face.** The phone sits on the counter all day and the book
   has every client's number in it.
3. **Open booking links in the app** instead of Safari.
4. **Sit on the home screen** with an icon, which is how people actually find
   software they use twenty times a day.

Everything else — the calendar, clients, invoices, settings — is the workspace
that already exists, loaded in a `WKWebView` that holds the same session cookie
a laptop holds. The app never stores a password and never holds a credential of
its own.

## What is here

| File | What it does |
|---|---|
| `project.yml` | XcodeGen spec. The `.xcodeproj` is generated, never committed — an Xcode project file is a merge-conflict machine and nobody here has Xcode to resolve one |
| `Kairo/KairoApp.swift` | the app, the push registration callbacks, notification taps |
| `Kairo/Session.swift` | which salon this phone belongs to (learned from the sign-in, never typed), and the Face ID preference. No password, no token |
| `Kairo/RootView.swift` | two states and only two: prove it is you, and the book. There is no "which salon?" screen — see below |
| `Kairo/WebView.swift` | the sign-in and the workspace. Only the front door and this phone's salon open in the app; everything else goes to Safari, where the address bar tells the owner where they are |
| `Kairo/Push.swift` | asks for notifications at the only fair moment — after somebody signs in, never on first launch |
| `Kairo/Lock.swift` | Face ID, with the passcode as a fallback so a cracked screen cannot lock an owner out of their own book |

## Signing in

The app opens on **login.kairobookings.com** — email and password, the same
front door the website's **Log in** button goes to (`docs/12-central-login.md`).
The front door finds the salon the account belongs to and hands over to it;
the app remembers that salon and opens straight to it from then on.

It used to open on a native "What is your Kairo address?" screen. App Review
typed something that was not a salon, got "No salon at this address", and
because the address was saved, every later launch went back to that page with
no way out. Now:

- nobody types an address, so nobody can type a wrong one;
- a saved address that stops naming a salon (the server marks that page with
  `X-Kairo-No-Salon`) is forgotten and the app returns to sign-in by itself;
- signing out in the workspace forgets the salon too, so the next sign-in on
  that phone starts at the front door;
- no connection is a "Can't reach Kairo — Try again" page, not a blank screen;
- inside the app the front door hides its links to the website and to
  "Get started", because the app is sign-in only and sells nothing.

## Building it, with no Mac

`.github/workflows/ios.yml` does the whole thing on GitHub's hosted macOS
runners, which come with Xcode installed. **This is proven, not assumed:**
run 1 of the `ios` workflow compiled and linked `Kairo.app` for arm64 and
x86_64 on Xcode 26.6 and finished `** BUILD SUCCEEDED **` — with no Apple
account, no certificate and no Mac anywhere.

- **`compile (unsigned)`** runs on every push that touches `ios/`. Signing is
  off, so it needs no Apple account at all and proves the code is real.
- **`archive and upload`** runs when a GitHub release is published (or a
  dispatched run ticks *ship*), and only if the Apple secrets exist. Until the
  developer account is enrolled it skips silently, so nothing waits for it.

### The secrets it will need, once the account exists

| Secret | Where it comes from |
|---|---|
| `APPLE_TEAM_ID` | App Store Connect → Membership |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` | App Store Connect → Users and Access → Integrations → App Store Connect API. **App Manager** role |

The App Store Connect API key is what removes the Mac from the signing step
too: Xcode fetches and renews the provisioning profiles itself, so nobody ever
exports a certificate from a machine they do not own.

### Server-side environment (the shard, not this project)

| Variable | Why |
|---|---|
| `KAIRO_APNS_KEY`, `KAIRO_APNS_KEY_ID`, `KAIRO_APNS_TEAM_ID` | the APNs auth key. **One app serves every salon**, so these belong to the process, never to a salon's settings |
| `KAIRO_APNS_BUNDLE_ID` | `com.kairobookings.kairo` |
| `KAIRO_APNS_HOST` | `https://api.sandbox.push.apple.com` while testing |
| `KAIRO_APPLE_APP_ID` | `TEAMID.com.kairobookings.kairo` — serves the app-site-association file. Absent, no association is served at all, because one naming no app would only break links |

## Deployment target

iOS 17. It is two major versions old at launch and covers the overwhelming
majority of iPhones in use, and it means the modern SwiftUI and concurrency
APIs here need no second, back-compatible version of themselves.

## What is deliberately not here

No offline mode, no local database, no second copy of the booking logic. A
salon that cannot reach the internet cannot take an online booking either, and
a cached calendar that disagrees with the real one is worse than no calendar.
