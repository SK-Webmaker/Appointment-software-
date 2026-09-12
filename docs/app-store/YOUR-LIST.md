# Everything that needs you — decisions and actions

*Written 11 September 2026, revised 12 September. Every line below was checked
against the live services, the repo and the accounts on the day, not taken from
memory.*

Nothing here requires you to read code. Each item is a decision, a form, a
dashboard, or a phone call.

**Two things are true right now and stay true through all of this:** Sha and
Hora are both live on v1.60.0 and taking bookings, and nothing on this list
changes either of them except the one item that says so (Sha's move).

---

## Part A — Decisions

These are yours to make. Nothing can be built around them until they land, and
three of them gate Part D.

### A1. Who sells Kairo · **the only launch blocker**

`platform/public/terms.html` says the seller is `[legal name, ABN]`. Until
that is a real name, the contract names nobody — which weakens the whole
document, including the liability cap.

Recommended: **your legal name, trading as Kairo Bookings.** What most
Australian sole traders do before registering, legally accurate, and still
shows the customer the brand they bought from.

Also settle the spelling while you are here: the product is **Kairo**
everywhere — domain, code, app, listing. On 9 September you wrote "Kario". If
*Kario* is the intended trading name, that is a much larger decision than this
file and it needs settling first.

Full reasoning: `docs/app-store/LEGAL-TODO.md` §1.

### A2. ABN now, or later

Not needed to sell. Needed to register a business name, and needed before you
can register for GST.

**The trap:** if you register for GST later, the A$410 you have already banked
is deemed to have included GST — about **A$37 a sale**, payable out of margin.
So if you think you will register, decide the price question at the same time
(A$410 including GST, or A$451). Not a decision to discover at tax time.

Free, ~15 minutes, abr.gov.au. Details in `LEGAL-TODO.md` §2–3.

### A3. What answers `kairobookings.com`

Today the apex serves the marketing site. The platform — the thing that takes
the A$410 — needs a home too.

Recommended: **leave the apex alone, sell from `get.kairobookings.com`.** You
can prove the whole purchase on a new address without touching the site that
is already up. The apex only has to keep answering `/privacy` and `/support`,
because the App Store listing links to both.

### A4. Adopt shared email sending

Built and tested this week, not yet switched on. A salon with no Resend
account of its own sends through Kairo's account, under its own business name,
with replies going to its own inbox.

What it costs you: a Resend account for Kairo, `kairobookings.com` verified on
it, and **Resend Pro at US$20/month** — the free tier caps at 100 emails a
day across all salons, which one busy salon can eat alone.

What it saves: every new customer sends confirmations from minute one instead
of pasting an API key into a dashboard they have never seen.

**Note:** the Resend account currently connected to my tools is *Sha's* — the
only domain on it is `mail.hairbyshacamberwell.com`. Kairo needs its own,
separate account. Do not use hers.

Recommended: **yes.** It is the difference between onboarding that runs itself
and onboarding that needs you on the phone.

### A5. Texts — one account or each salon's own

Still parked, and still fine to park until the first stranger buys. Sha and
Hora each have their own ClickSend account, which works. The problem you hit
with Hora — ClickSend wanting *his* phone number to verify — is the reason
this needs answering before you sell to someone who is not in the room.

Decide before the first public sale, not before the App Store submission.

---

## Part B — Do now

Nothing blocks these, and B3 sits in a queue, so the sooner it starts the
sooner it is gone.

### B1. Turn off auto-deploy on the two salon services · 2 min

Both are still set to deploy on every commit to
`claude/appointment-booking-software-xqoy4f`.

- `hairbysha-booking` → Settings → Build & Deploy → Auto-Deploy → **Off**
- `horahaircutz-booking` → same

That branch is 48 commits behind the work I have been doing, so nothing is
about to fire. But it means a single push to an old branch restarts two live
salons with no warning — and on Monday, mid-move, that would be a genuine
problem rather than a lucky no-op.

*(The shard, `kairo-shard-au`, is already off. I checked.)*

### B2. Point `support@kairobookings.com` somewhere · 3 min

The App Store listing publishes this address, and Cloudflare's MX records are
already live and answering. The address just has no destination yet — mail
sent to it goes nowhere.

Cloudflare → your domain → **Email Routing** → add a rule forwarding
`support@kairobookings.com` to the inbox you actually read. Free.

### B3. Enrol in the Apple Developer Program · A$149 · then 1–2 days of waiting

developer.apple.com/programs/enroll. Choose **Individual / Sole Proprietor**.
Use an Apple ID you intend to keep permanently, with two-factor already on.
Your legal name must match your government ID.

Faster: enrol through the **Apple Developer app on your iPhone** — it can
verify you through the device instead of by document review, often same-day.

**Do not choose Company/Organization.** It needs a D-U-N-S number, takes
weeks, and adds roughly A$600 in ASIC fees. The only thing it unlocks is Tap
to Pay, which is a version 1.1 plan, and converting later keeps your Team ID,
certificates and apps intact.

---

## Part C — After Apple approves

All three are pure clicking. None touches the live salons.

### C1. Register the app identifier · 5 min

Certificates, Identifiers & Profiles → Identifiers → + → App IDs → App.
Description `Kairo`, Bundle ID **explicit**: `com.kairobookings.kairo`.
Tick **Push Notifications** and **Associated Domains**.

Copy that bundle id rather than typing it — it has to match the project
exactly or the build fails to sign an hour later, confusingly.

### C2. Upload key, and four GitHub secrets · 10 min

App Store Connect → Users and Access → Integrations → create a key with the
**App Manager** role. Download the `.p8` — **one chance only**.

Repo → Settings → Secrets and variables → Actions, named exactly:

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | Membership page on developer.apple.com |
| `ASC_KEY_ID` | shown when you make the key |
| `ASC_ISSUER_ID` | shown on the same page |
| `ASC_KEY_P8` | the whole `.p8`, `-----BEGIN` and `-----END` lines included |

Until all four exist the release job skips itself quietly rather than failing,
so nothing breaks while you are part-way through.

### C3. Push key, on the shard · 10 min

Certificates, Identifiers & Profiles → Keys → + → tick **APNs**. Download that
`.p8` too — again one chance.

On Render, `kairo-shard-au` → Environment:

| Variable | Value |
|---|---|
| `KAIRO_APNS_KEY` | the `.p8` contents |
| `KAIRO_APNS_KEY_ID` | the key's ID |
| `KAIRO_APNS_TEAM_ID` | your Team ID |
| `KAIRO_APPLE_APP_ID` | Team ID, a dot, then the bundle — `A1B2C3D4E5.com.kairobookings.kairo` |

Until `KAIRO_APPLE_APP_ID` is set, tapping a booking link opens the browser
instead of the app. That is the correct safe default, not a bug.

---

## Part D — Stand up the thing that sells Kairo

**Blocked on A1, A3 and A4.** This is the part that turns Kairo from software
two friends use into something a stranger can buy at 11pm without you.

### D1. Kairo's own Resend account · needs A4

Sign up fresh — not Sha's account. Verify `kairobookings.com` on it. Upgrade
to **Pro, US$20/month**, because the free tier's 100-a-day cap is shared
across every salon you ever sell to.

### D2. Two variables on the shard · needs D1

`kairo-shard-au` → Environment:

- `KAIRO_SHARED_RESEND_KEY` — the new account's API key
- `KAIRO_SHARED_FROM` — e.g. `bookings@kairobookings.com`

The moment these exist, every future salon can send email without configuring
anything. **Sha and Hora are unaffected** — the code checks for a salon's own
account first and keeps using it. That is covered by a test that fails if it
ever stops being true.

### D3. Stripe live keys

Platform service → `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Until both
are set, nobody can pay and nothing provisions.

### D4. Deploy the platform · needs A3

Render → New → Blueprint → this repo → Blueprint file `platform/render.yaml`
→ Apply. Then fill in the variables marked `sync: false` — the file explains
each one. Test it on its own `onrender.com` address first, then put
`get.kairobookings.com` on it.

### D5. Buy Kairo yourself, with a real card · ~20 min

Go through the whole purchase as a stranger would: the signup, the email code,
the SMS code, the A$410, the wait, the "your Kairo is ready" email, the first
login. Then refund yourself in Stripe.

This is the single most valuable hour on this list. Every dead end I have
found in that funnel so far, I found by reading it — a real card finds the
ones reading cannot.

---

## Part E — Sha's move · **Tuesday 16 September**

Moved from Monday at your request. The full runsheet is `MOVE-SHA.md` — read
that on the night, not this summary. Three things changed on 12 September after
a full rehearsal, and two of them change what you click:

1. **It is not a same-version move.** Her service and the shard are both
   v1.60.0 and are 1,623 lines of runtime code apart. Tested rather than
   assumed: the same snapshot on both versions compares **identical across 37
   checks**, and the comparison was falsified to prove it can fail.
2. **The cutover is a Worker deploy, not a custom-domain swap.** Deleting one
   line from `cloudflare/salon-router.js` and deploying is the whole switch.
   **Do not** move her custom domain off `hairbysha-booking` — that
   registration is the rollback.
3. **Her old service keeps sending after the move** unless it is suspended, and
   must be suspended the moment the Worker flips.

### E1. Suspend `horahaircutz-booking` · 1 min · do this now, not Tuesday

Hora moved on 8 September and his old service is still running with his data.
By the same mechanism as (3) it has been able to text and email his clients for
a week. Whether it has actually done so could not be established from here.
Suspending it keeps the disk, so his rollback survives, and his move is six
days proven.

## Part F — Submit

### F1. App Store submission · needs A1, B3, C1–C3

Screenshots, description, the privacy questionnaire, and the two links the
listing requires — `kairobookings.com/privacy` and `/support` — which is why
A3 and B2 have to be settled first. Then review, typically a few days.

---

## The order, if you only read one thing

1. **A1** — decide the seller name. Everything App Store-shaped waits on it.
2. **B3** — start Apple today. It is a queue and you are not in control of it.
3. **B1, B2** — ten minutes between them, and B1 removes a real Monday risk.
4. **A3, A4** — then Part D can start.
5. **Tuesday: Part E** — and **E1 today**, not Tuesday.
6. **A2, A5** — before the first stranger pays, not before the submission.

Re-run `node scripts/launch-check.mjs` after A1. It should then report nothing
blocking.
