# Kairo → the App Store — programme record

This folder is the durable record of the work described in the owner's brief
(*"Kairo → the App Store, and onboarding that runs itself"*). Decisions,
findings and deliverables live here, not only in chat, so a change of model or
session loses nothing.

## The rules this work runs under

- Stop at the end of every phase and get the owner's approval before starting
  the next. No building during a research phase.
- Never touch the two live services (`hairbysha-booking`,
  `horahaircutz-booking`) without saying what is about to happen first.
  Reading their configuration is fine; changing anything is not, without notice.
- Write deliverables to files in this folder.
- Say when something is a bad idea, including things in the brief.
- Do not gold-plate.

## Phases and status

| Phase | Deliverable | Status |
|---|---|---|
| 0 — Learn the system | [`00-phase-0-how-kairo-works.md`](00-phase-0-how-kairo-works.md) | Approved 2026-09-05 (owner's answers logged below) |
| 1 — Is it possible at all? | [`01-phase-1-is-it-possible.md`](01-phase-1-is-it-possible.md) | Approved 2026-09-05 with decisions D1–D7 (below) |
| 2 — How | [`02-phase-2-how.md`](02-phase-2-how.md) | Approved 2026-09-05 with amendments (see its Amendments section); D8 and D12 carried |
| 3 — What it costs (1 / 10 / 50 / 200 businesses) | [`03-phase-3-what-it-costs.md`](03-phase-3-what-it-costs.md) | Approved 2026-09-05 with directions; see addendum |
| 2b — Architecture decision | [`02b-architecture-decision.md`](02b-architecture-decision.md) | **Decided per owner's direction; awaiting confirmation** |
| 4 — The onboarding flow, end to end | [`04-phase-4-onboarding-flow.md`](04-phase-4-onboarding-flow.md) · [`04b-connectors-made-easy.md`](04b-connectors-made-easy.md) · [`04-policies.md`](04-policies.md) · [`walkthrough-business-abc.md`](walkthrough-business-abc.md) | **Written, awaiting the owner's green light for Phase 5** |
| 5 — Sha and Hora, uninterrupted | `05-…` | not started |
| 6 — Build, in shippable slices | code + tests | not started |
| 7 — Launch | `07-…` | not started |

## Decision log

| Date | Decision / finding | Where |
|---|---|---|
| 2026-09-05 | Phase 0 written from the code, a local run, and read-only probes of the live services. | `00-…` |
| 2026-09-05 | Finding: the 1,738-check test suite is not in the repository and never was; a harness must be rebuilt and committed before "test the way this repo tests" is possible. | `00-…` §12.1 |
| 2026-09-05 | Finding: the docs (`SELLING.md`, README footer, `plan_*` settings) describe monthly pricing; the brief says $400 once. To reconcile in Phase 2. | `00-…` §12.3 |
| 2026-09-05 | Work branch `claude/markdown-file-analysis-a5ppnf` does not deploy anywhere. The deploy branch is `claude/appointment-booking-software-xqoy4f`. | — |
| 2026-09-05 | Owner: no known copy of the test harness. A harness will be rebuilt and committed as the first slice of Phase 6. | `00-…` §13 |
| 2026-09-05 | Owner: Hair By Sha's own-domain email is deliberate. Keep it; the onboarding design must support "own domain" as a first-class case. | `00-…` §12.4, `01-…` §4.3 |
| 2026-09-05 | Owner could not confirm the reminder-timing observation on the live Messages page. Left as an unconfirmed observation; out of scope; nothing changed. | `00-…` §7 |
| 2026-09-05 | Phase 0 approved; Phase 1 started. | — |
| 2026-09-05 | Phase 1 verdict: go, with three forced changes — pay on the web not in the app (Apple 3.1.1 / 3.1.3(f)); one owner app, one binary (4.2.6, 4.3); Resend/ClickSend accounts cannot be machine-created, so the account step moves to the business or to a Kairo-held Resend team with per-business domains and domain-scoped keys. Decisions D1–D7 put to the owner. | `01-…` §0, §9 |

## Where things stand on the live systems (read 2026-09-05, nothing changed)

Both on v1.52.0. Sha: Oregon, no health-check path, stale `yarn install`
build command, emails from its own domain. Hora: Singapore, `/api/version`
health check, emails from the platform subdomain, no business phone set.
Origin lock off on both; `*.onrender.com` reachable on both. Cloudflare API
token expired 26 August. ACMA sender-ID registration outstanding for both.
| 2026-09-05 | Owner's decisions on Phase 1. D1: the app is for the salon owner. D2: sign up then pay $400 **in the app** (owner accepts the in-app door; Apple's 15% and GST-first arithmetic are documented in `02-…` §2). D3: each business on its **own** Resend account, Kairo pays for none; connected by the business or done for them by the owner, as automated as possible. D4: Stripe and/or Square optional, including linking their own payment link. D5: business's own ClickSend via guided setup, ACMA status tracked, clearly theirs. D6: owner's role is flagged signups and refunds; a clear refund policy plus every needed policy. D7: iOS first, Android after. | `01-…` §9, `02-…` |
| 2026-09-05 | Phase 2 written: platform service + instance control API + iOS shell; two purchase doors (web via Stripe at 0%, app via IAP at 15% after GST); four business-owned connectors; provisioning state machine; `release` branch; policy set. Decisions D8–D12 put to the owner. | `02-…` |
| 2026-09-05 | Owner on Phase 2: free download, the $400 is an order placed in the app for access; **14-day** no-reason refund; D10 yes; a platform Stripe account is fine. D8 and D12 not addressed, carried (D12 assumed). | `02-…` Amendments |
| 2026-09-05 | Phase 3 written. Finding: hosting is the only perpetual cost; on Render ≈ A$140/salon/year (the $400 covers ~3 years; 200 salons ≈ A$28,600/year), on a Sydney VPS ≈ A$21/salon/year (200 salons ≈ A$4,500/year). Recommends a `vps` host driver before salon 25. Forgotten cost surfaced: a Mac (or macOS CI minutes) is required to build and submit the iOS app; this session cannot. D13–D15 put to the owner. | `03-…` |
| 2026-09-05 | Owner on Phase 3: decide the hosting myself, must hold many salons securely and properly, keep Render if it can work; the iOS app ships from cloud build machines, no Mac; policies are brief statements, no external review; price so the owner nets $400. | — |
| 2026-09-05 | **Architecture decision:** one Render service per region serving many salons, each in its own SQLite file (no shared database), wildcard domain, instant provisioning. ≈ A$10/salon/year at 200 salons. Single-tenant mode preserved for the live salons until Phase 5. The only new risk is host-to-file routing; its falsification tests are specified. Phase 2 host-driver amendment withdrawn. | `02b-…` |
| 2026-09-05 | D8: website A$410, app A$519.99 (both net ≈ A$400). D14: GitHub Actions macOS runners, Codemagic overflow. D15: brief policy statements, drafted. | `02b-…` §7–9, `04-policies.md` |
| 2026-09-05 | Phase 4 written: end-to-end flow, screening, provisioning in seconds, setup checklist, fourteen unhappy paths, the owner's four residual roles; policies drafted. | `04-…` |
| 2026-09-05 | Owner: confirmed free download, sign up or log in, buy on the website or in the app, pay once. Everything must be tested; no failures. API-key steps are too confusing for most owners: email setup defaults to **Kairo (the owner) does it**, prefilled, ≈3 min copy-paste; texts stay the business's own account but Kairo checks the key live and **buys the number in-app** via ClickSend's API; ABN optional; ACMA only for the advanced "show your name" option. | `04b-…` |
| 2026-09-05 | Owner: two prices for one product is unacceptable. Recommended and pending confirmation: **one price, A$410, sold on the website only; the app is free and sign-in only** (Apple 3.1.3(f)), reversing D2. Alternatives (one price both doors at A$410 netting ≈A$317 in-app, or at A$519.99) documented. Confirmed: each business has its own dedicated number on its own ClickSend account. | `02b-…` amendment, `04-…` amendments |
