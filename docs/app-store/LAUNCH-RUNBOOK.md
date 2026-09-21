# Kairo launch runbook

Written 19 September 2026. Everything left, in the order it has to happen.

Each step says what to click, what to send me, and what I do with it. Steps 1
and 2 need nothing from Apple. Steps 3 onward assume the enrolment
confirmation has arrived.

**The one rule that never bends:** Hair By Sha and Horahaircutz keep taking
bookings. Only step 2 restarts the shard they run on, it is ~90 seconds, and
it is the only interruption in this whole document.

---

## Step 1 — Clear the two test businesses (5 min)

### 1a. `kairolivetest` — delete it from inside the app

Do it this way rather than asking me: it refunds your $5 automatically, and
it exercises the account-deletion path Apple checks during review.

1. Go to **https://kairolivetest.kairobookings.com** and sign in
2. **Settings → Account → Delete my account**
3. It asks for your password **and** the business name typed exactly:
   `Kairo Live Test`
4. Confirm

The salon shuts immediately, the platform refunds the $5 through live Stripe,
and the tenant is removed. Files are kept 7 days, so a mistake at 11pm is
fixable at 9am.

### 1b. `testsalonkairo` — send me the key

This one I have to do, because its refund would be attempted against a
test-mode payment intent under a live key. That fails, and self-delete would
leave it read-only rather than gone.

Render → **kairo-platform** → **Environment** → copy `KAIRO_PLATFORM_KEY`
and send it to me.

**Then I:** delete the tenant, confirm `testsalonkairo.kairobookings.com`
returns 404, and confirm Sha, Hora and demo are all still answering.

---

## Step 2 — The one restart (90 seconds, pick your time)

Two jobs that both need the shard to restart, done in one interruption
instead of two. **Pick a quiet time** — overnight Melbourne is ideal. Tell me
when and I will do it then.

**What happens:** `kairo-shard-au` restarts. For roughly 60–90 seconds, the
booking pages for Hair By Sha, Horahaircutz and the demo salon return an
error. Bookings already in the database are untouched. A customer who lands
mid-restart sees a failure and has to try again.

**Why it cannot be zero-downtime:** the shard has a persistent disk, and
Render cannot run two instances against one disk. This is a known trade-off,
not a fault.

**What it achieves:**

1. **The new icons reach the salons.** Everything in step 4 works without
   this, but the app icon on a salon owner's home screen stays the old muddy
   one until it happens.
2. **`KAIRO_PLATFORM_KEY` gets rotated.** It has been through a chat
   transcript and can export any salon's database, including Sha's and
   Hora's. It is the shared secret between the platform and the shard, so it
   must change on **both** in the same sitting — change one alone and the
   platform can no longer create salons.

**You do nothing but say when.** I generate the new key, set it on both
services, deploy both, and verify both banners afterwards.

---

## Step 3 — Apple, once the enrolment email arrives

Work straight down. 3a to 3c are on Apple's site, 3d to 3e are GitHub and
Render, 3f ships it.

### 3a. Register the App ID

1. <https://developer.apple.com/account/resources/identifiers/list>
2. **+** → **App IDs** → **Continue** → **App** → **Continue**
3. Description: `Kairo`
4. Bundle ID: select **Explicit**, then enter exactly:

       com.kairobookings.kairo

5. Under **Capabilities**, tick **Push Notifications**
6. **Continue** → **Register**

> The bundle ID must match exactly. It is hard-coded as the default in
> `src/push.js` and in the iOS project. A typo here means push fails with a
> `TopicDisallowed` error that looks like a bad key.

### 3b. Find your Team ID

<https://developer.apple.com/account> → **Membership details**.

**Team ID** is 10 characters, like `A1B2C3D4E5`. Write it down — you need it
twice (GitHub and Render).

### 3c. Create two keys

These are different keys for different jobs. Both download **once only** and
cannot be re-downloaded. Save both somewhere safe immediately.

**Key 1 — App Store Connect API key** (lets GitHub upload builds)

1. <https://appstoreconnect.apple.com/access/integrations/api>
2. **+** under *Team Keys*
3. Name: `Kairo CI`, Access: **Admin**

   > Admin, not App Manager. App Manager cannot create cloud-managed
   > distribution certificates, and the upload needs one — Apple answers the
   > archive export with 403 FORBIDDEN_ERROR, "You haven't been given access
   > to cloud-managed distribution certificates", which does not mention roles
   > or keys and reads like an account problem. A key's role cannot be changed
   > after it is made, so getting this wrong costs a new key.
4. **Generate**, then **Download API Key** — a file named
   `AuthKey_XXXXXXXXXX.p8`
5. Note the **Key ID** (10 chars, in the filename) and the **Issuer ID**
   (a long UUID shown at the top of that page)

**Key 2 — APNs key** (lets the shard send push)

1. <https://developer.apple.com/account/resources/authkeys/list>
2. **+**, name it `Kairo Push`, tick **Apple Push Notifications service (APNs)**
3. **Continue** → **Register** → **Download**
4. Note this **Key ID** too — it is a *different* 10-character ID from Key 1

> Do not mix them up. Key 1 is for GitHub, Key 2 is for Render. Both are
> `.p8` files and they look identical.

### 3d. Add four secrets to GitHub

<https://github.com/SK-Webmaker/Appointment-software-/settings/secrets/actions>
→ **New repository secret**, four times:

| Secret name | Value |
|---|---|
| `APPLE_TEAM_ID` | the 10-char Team ID from 3b |
| `ASC_KEY_ID` | Key 1's Key ID |
| `ASC_ISSUER_ID` | the Issuer ID (long UUID) |
| `ASC_KEY_P8` | the **entire contents** of Key 1's `.p8` file |

For `ASC_KEY_P8`, open the file in a text editor and paste everything,
including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
lines and the line breaks between them.

> Until all four exist the TestFlight job skips itself silently, which is
> deliberate — nothing has been waiting on Apple.

### 3e. Add four variables to Render (this turns push on)

Render → **kairo-shard-au** → **Environment**:

| Key | Value |
|---|---|
| `KAIRO_APNS_KEY` | the **entire contents** of Key 2's `.p8` file |
| `KAIRO_APNS_KEY_ID` | Key 2's Key ID |
| `KAIRO_APNS_TEAM_ID` | the same Team ID from 3b |
| `KAIRO_APPLE_APP_ID` | `<TeamID>.com.kairobookings.kairo` |

That last one is your Team ID, a dot, then the bundle ID — for example
`A1B2C3D4E5.com.kairobookings.kairo`.

Then **Save, rebuild, and deploy**.

> This restarts the shard, so it is another ~90 seconds of salon downtime.
> If you would rather not take a second interruption, tell me and I will fold
> these four variables into the step 2 restart instead — but only if you have
> the Apple keys by then.

**Then I:** read the boot banner. It must say

    Push: on — owners are told on their phone, not by email

If it says **HALF SET** it names which variable is missing. If it still says
**off**, none of the four took effect.

### 3f. Ship the build to TestFlight

1. <https://github.com/SK-Webmaker/Appointment-software-/actions/workflows/ios.yml>
2. **Run workflow**
3. Tick **Also archive and upload to TestFlight**
4. **Run workflow**

It compiles, signs and uploads on GitHub's macOS runners. You do not need a
Mac. The repository is public, so those runner minutes are free.

**Then I:** watch the run and fix anything that fails.

---

## Step 4 — App Store Connect listing

> **Do the "New App" part of this BEFORE step 3f.** The upload needs an app
> record to exist, and registering the Bundle ID in 3a does not create one —
> it creates the identifier the app is later attached to. Without the record
> the export dies on "Error Downloading App Information", which says nothing
> about what is missing. Everything else on this page can wait until after
> the build lands.

1. <https://appstoreconnect.apple.com/apps> → **+** → **New App**
2. Platform **iOS**, Name `Kairo`, Primary language **English (Australia)**,
   Bundle ID **com.kairobookings.kairo**, SKU `kairo-001`
3. Full access

Then fill these in:

- **App icon** — `public/icons/kairo-1024.png` in this repository. It is
  1024×1024, square, and has no alpha channel, which is what Apple requires.
  It did not exist before 19 September; I generated it.
- **Screenshots** — 6.7" iPhone. Take them from the demo salon.
- **Support URL** — `https://kairobookings.com/support`
- **Privacy Policy URL** — `https://kairobookings.com/legal/privacy`
- **Price** — **Free**. Kairo is bought on the website, not in the app.
- **Age rating** — 4+
- **App Review Information → Notes** — paste the block in
  `docs/app-store/07-phase-7-launch.md` §3, and **type the demo password into
  it at submission**. It is not in this repository and must not be: this
  repository is public.

### Before you press Submit — run the check

A reviewer who cannot sign in gets the build rejected the same day, and it is
the most common avoidable rejection there is. Do not trust memory:

```bash
KAIRO_REVIEW_URL=https://demo.kairobookings.com \
KAIRO_REVIEW_EMAIL=demo@kairobookings.com \
KAIRO_REVIEW_PASSWORD=<the demo password> \
node scripts/review-login-check.mjs
```

It signs in the way the reviewer will, then asks the question a login test
does not: **is there anything in there to look at?** An empty salon passes
every credential check and fails review under guideline 4.2, so a blank
calendar counts as a failure.

If it reports the salon is empty: **Settings → Reset to demo data**.

---

## Step 5 — After review

- **If a reviewer ran account deletion on the demo salon**, re-seed it:
  **Settings → Reset to demo data**. Nothing does this on a schedule.
- **Rotate the rest of the credentials.** `KAIRO_PLATFORM_KEY` is handled in
  step 2. Still to do: both Resend keys, the ClickSend key, the Cloudflare
  token, and the old Stripe test key. None of these needs a shard restart —
  tell me when and I will walk each one.

---

## Changing the price later

Ask me. One variable, `KAIRO_PRICE_CENTS`, about 90 seconds, **platform only
— no salon downtime**. I have done it twice already.

Two things worth knowing:

- The price is **frozen onto each business at signup**, so a change never
  affects anyone mid-flow or already paid.
- The marketing site hard-codes it — **27 mentions on the homepage and 9 in
  the Terms**. Both have to change together or your contract disagrees with
  your checkout. I will do both in one go.

---

## Already done — for your own confidence

| | Proven by |
|---|---|
| Live Stripe | A real card charged, salon provisioned end to end, banner reads `Stripe live — real cards, real money` |
| support@ | Confirmed arriving in `kairobooking18@gmail.com` from the inbox |
| Email day one | Shard banner: `Shared sender: on, from bookings@kairobookings.com` — every new salon can send the moment it is created |
| Owner alerts | Push first, email only if the phone did not get it. 6 tests, 4 of them failure cases |
| The logo | One vibrant gradient at constant lightness, unified across icon, signup and website |
| App Store icon | 1024 square, no alpha — and the maskable/apple-touch double-rounding bug fixed |
| Signup page | Real mark in the masthead, drifting-K field behind it, reduced motion honoured |
| Legal text | Seller is Shamalka Kiridena throughout, "including GST" gone |
| Operator queue | `PLATFORM_OPERATOR_PASSWORD` set, boot warning cleared |

339 tests passing. `node scripts/launch-check.mjs` reports nothing in the
repository blocking launch.
