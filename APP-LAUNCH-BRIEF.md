# Kairo → the App Store, and onboarding that runs itself

You are picking up a working, live product and being asked to answer a hard
question about its future. Read this whole brief before you touch anything.

---

## 1. What you are inheriting

**Kairo** is booking, payments and client-management software for appointment
businesses — hairdressers, barbers, beauty. It is sold **once, for $400. No
monthly fee, no commission, ever.** That price is not a detail; it is the entire
proposition, and it is the thing every decision below has to survive.

It is live. Two real businesses run their diaries on it today:

| Business | Address | Render service | Region |
|---|---|---|---|
| Hair By Sha (Camberwell, Melbourne) | `hairbysha.kairobookings.com` | `hairbysha-booking` / `srv-d9945q67r5hc73aoeb20` | Oregon |
| Horahaircutz | `horahaircutz.kairobookings.com` | `horahaircutz-booking` / `srv-dac10jou01pc73fe99ug` | Singapore |

Currently on **v1.55.0**. Both auto-deploy from branch
`claude/appointment-booking-software-xqoy4f`. Render workspace
`tea-d98ovh3eo5us73fgj8n0`. Cloudflare holds the zone `kairobookings.com`.

**These two businesses take real bookings from real customers every day. They
must keep working, uninterrupted, through everything that follows.** That is the
one hard constraint in this document.

### How it is built

Deliberately, unusually plain — and you should understand *why* before you
propose changing it:

- **Zero dependencies.** No npm packages, no framework, no build step. Node ≥
  22.5 using the built-in `node:sqlite` (`DatabaseSync`) and plain `node:http`.
  The front end is vanilla ES-module JavaScript served as files.
- **Single-tenant.** One business = one Render service = one SQLite file on a
  persistent disk at `/var/data`. Businesses share the codebase and nothing else
  — no shared database, no shared table with a `tenant_id` column.
- **Two front ends in one server:** the owner's workspace (calendar, clients,
  invoices, POS, settings) and the customer-facing booking page at `/book`.
- **Kai**, the ⌘K console, is the product's point of difference and the thing
  most likely to sell it. It answers questions from the salon's own data, makes
  changes from a sentence (hours, reminders, deposits, no-show rules, message
  channels, the booking page's palette, service prices — most of what an owner
  can click), and takes them to any screen or settings card on any day they
  name — all of it by voice if they want, using the browser's own dictation.
  Four files: `kai.js` (the questions), `kai-actions.js` (the changes),
  `kai-nav.js` (the destinations), `kai-voice.js` (the personality). Read them
  before you touch anything near it. The rules are the design rather than
  decoration: do-then-undo rather than confirm-before, a question is never a
  command, looking at a day is not trading on it, it asks rather than guessing
  between close readings, the warm opener always ends with the plain fact
  character-for-character, and nothing that reaches a client happens there.
  **There is no language model anywhere in
  this product**, deliberately, for reasons recorded in `src/kai.js` — cost per
  business on a one-off price, cross-border disclosure of health information
  under APP 8, and the rule that nothing acts silently. If your route reaches
  for one, argue it explicitly.

The zero-dependency rule exists because this is sold once and must still run in
five years without anybody maintaining a dependency tree. The single-tenant rule
exists because a bug in a shared database is a bug in everybody's business at
once, and because a salon's client list is theirs. **You may argue against either
of these — but argue, with reasons, rather than quietly replacing them.**

### Per-business third-party accounts

This is important and it is a constraint, not an accident:

- **Resend** for email — **each business has its own Resend account.** Their free
  tier (3,000/month, 100/day) covers a salon completely, so the business pays
  nothing. The From address must be on the exact domain verified in Resend.
- **ClickSend** for SMS — **each business has its own ClickSend account**, paying
  their own usage. A dedicated Australian number is about $20.71 AUD/month;
  alphanumeric sender IDs cannot receive replies, and ACMA registration is
  required from 1 July 2026.
- **Stripe**, optional, per business, for deposits and card payments.

**The owner wants this structure kept.** Each business on its own free/cheap
accounts is what makes $0/month true. Do not consolidate everyone onto one
platform account to make automation easier without first showing what that costs
and what it breaks.

### How a new business is onboarded *today*

By hand, in about six steps — see `ONBOARDING.md`. Roughly: their subdomain,
four DNS records (three of them Resend's), a Render service from the blueprint,
a Resend account and domain verification, a ClickSend account, then one pass
through the app before handover.

There are scripts that take the sharp edges off — `scripts/onboard-business.mjs`
(Cloudflare DNS), `scripts/new-business.sh` (a VPS/systemd path),
`scripts/verify-business.mjs`, `scripts/offboard-business.mjs` — but a human
drives all of it, and several steps involve logging into someone else's console
and copying a DKIM key.

**This manual process is the thing to be eliminated.**

---

## 2. What the owner wants

> Market Kairo on Instagram and other channels. Someone sees it, opens the App
> Store, finds Kairo, downloads it. They get a login/signup screen. They sign up,
> pass whatever verification is needed, pay, and come out the other side with
> their booking software fully set up and running — **without me doing anything.**

The benchmark named: **Fresha and Square.** You download, you sign up, you're
running. Nobody emails you a DKIM key.

Two words matter in that paragraph and you should not skate over either:

- **"App Store"** — an actual listed app people download, not a website you can
  add to a home screen.
- **"without me doing anything"** — as close to fully automated as is genuinely
  achievable. Where it cannot be fully automated, the owner needs to know exactly
  which steps still need a human and why.

---

## 3. Your job

Work out whether this is possible, then how, then what it costs, then build it —
**in that order, with the owner approving each phase before you start the next.**

You are being given the whole problem on purpose. **Do not follow a recipe from
this document — there isn't one in it.** No technology is prescribed below.
Where the owner has mentioned tools he has heard of, they are recorded in §6 as
*context, not instruction*; if they are the wrong answer, say so and say why.

### Phase 0 — Learn the system

Read the repo. Run it. Make a booking, take a payment, send a message, walk the
onboarding scripts. Then **write down how Kairo actually works** — the backend,
the data model, the onboarding path, the message pipeline, the deployment model,
and what the single-tenant boundary buys and costs.

You will be corrected if this account is wrong, and everything after it depends
on it being right. Do not start Phase 1 until you can explain the system without
looking.

### Phase 1 — Is it possible at all?

Not "how" — **whether.** Research it properly and answer with evidence and
citations. The known hard edges, at minimum, and there will be others you find:

- **Apple's cut.** Kairo is $400 once. What does the App Store take, when does
  its in-app-purchase requirement bite, what qualifies as a reader/business
  exemption, and what does that do to the price? If a 30% or 15% cut applies,
  the business model changes — say so plainly rather than absorbing it.
- **Guideline 4.2 (minimum functionality).** Apps that are a wrapper around a
  website get rejected. What would Kairo have to *be* to pass review?
- **Who is the app actually for?** The salon owner running their diary, or the
  salon's customers booking an appointment — or both, as separate apps? The
  owner has not settled this and it changes everything downstream. **Surface it,
  give a recommendation, get an answer.**
- **Automating what is currently manual.** Programmatic service provisioning,
  DNS, and domain verification — and specifically whether "each business gets
  their own Resend and ClickSend account" can be automated at all, or whether
  the structure has to change. This may be the hardest single item here.
- **Payment, verification and fraud.** Taking $400 from a stranger and
  provisioning real infrastructure automatically, without a human, is where this
  gets attacked.
- **Australian obligations** — privacy (Kairo now holds health information under
  APP-sensitive categories), consumer law, ACMA for SMS.

End with a **go / no-go, with reasons**, and if any part is no-go, the nearest
thing that *is* possible. An honest "this part cannot work as described, here is
what can" is worth more than a plan that collapses in month two.

### Phase 2 — How

Given Phase 1's answer: the route. What Kairo becomes, what changes, what stays,
what gets thrown away. Include what you would *add* to the stack and, for each
addition, what it earns — measured against a product with no dependencies today.
Name the trade-offs you are accepting, not just the wins.

### Phase 3 — What it costs

One-off and ongoing, at **1, 10, 50 and 200 businesses.** Include the things
people forget: the Apple developer program, per-service hosting, storage,
domains, payment processing fees, and whatever your Phase 2 route adds.

**Spend as close to nothing as possible.** Necessary costs are fine and expected
— unnecessary ones are not. If a free tier is load-bearing in your plan, say
what happens the day it changes.

### Phase 4 — The onboarding flow, designed end to end

From "saw an Instagram post" to "taking bookings", every step, including the
unhappy ones: payment fails, verification fails, they abandon halfway, they want
a refund, they want their data out, two people claim the same salon name.

Say explicitly which steps are automated and which still need the owner. He is
willing to stay in the loop somewhere if that is genuinely unavoidable — he needs
to know exactly where, and it should be as few places as possible.

### Phase 5 — Sha and Hora

How the two live businesses get from where they are to wherever this lands,
**with no interruption to either.** Their customers must be able to book
throughout. Their data must arrive intact. Include the rollback: what you do if
the migration goes wrong at 6pm on a Friday.

### Phase 6 — Build

In slices, each one shippable and tested, each one leaving the two live
businesses working. Not one big-bang cutover.

### Phase 7 — Launch

Submission, review, what to do when Apple rejects it the first time — because
they usually do — and what "live" actually means operationally on day one.

---

## 4. How to work

- **Stop at the end of every phase and get approval.** This product got to
  v1.55.0 through nine upgrades, each one explicitly gated by the owner. Keep
  that rhythm. Do not build during a research phase.
- **Write deliverables to files in the repo, not just into the chat.** Your
  session may change models partway through (see §5). Anything that exists only
  in conversation can be lost; anything written down survives.
- **Never touch the two live services without saying what you are about to do
  first.** Their owner's words, from the last session, still stand: *"I just
  don't want anything to harm businesses that are using the system currently."*
- **Test the way this repo tests.** 1,906 checks across 58 suites, all passing.
  The house discipline is falsification: after every fix, deliberately break it
  and confirm the test fails. A test that cannot fail is not a test.
- **Say when something is a bad idea.** Including anything in this brief. The
  owner would rather be told the plan is wrong in week one than in month three.
- **Do not gold-plate.** Answer what is asked, finish it, and stop.

---

## 5. Credits and models

The owner has roughly **$113 of usage credits**, and is happy for you to spend
all of them on this. When they run out — whenever that is, including mid-build —
the session falls back to **Opus 5** and continues.

Work so that handover is a non-event: decisions recorded in files, findings
written down, work committed in coherent slices. Do not leave a half-finished
change with the reasoning only in your head.

---

## 6. Context, not instruction

The owner has heard that developers building data-heavy apps often use **Vercel**
and **Supabase**, among others. He raised these as examples of the kind of thing
that might be needed — **not as a decision.** He has no attachment to them.
Evaluate them on merit alongside everything else, and if they are wrong for a
zero-dependency single-tenant product sold once for $400, say so and say why.

Kairo is on Render today, with a paid persistent disk per business. Whether that
survives is your question to answer, not a given.

---

## 7. Where things stand

- v1.55.0, live on both businesses, 2,134 checks across 60 suites, 0 failures.
- `README.md` is long and current — architecture, features, deployment, the lot.
- `ONBOARDING.md` is the manual runbook you are being asked to make obsolete.
- Open items unrelated to this work, so you do not trip over them: a stale
  `yarn install` build command on Sha's Render service; the Cloudflare origin
  lock is off on both services, so both are reachable directly at
  `*.onrender.com` (the Cloudflare API token expired 26 August); ACMA sender-ID
  registration is outstanding for both salons.

**Start with Phase 0. Do not plan anything until you can explain how Kairo
already works.**
