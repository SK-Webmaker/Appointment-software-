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
| 2 — How | [`02-phase-2-how.md`](02-phase-2-how.md) | **Written, awaiting the owner's approval and decisions D8–D12** |
| 3 — What it costs (1 / 10 / 50 / 200 businesses) | `03-…` | not started |
| 4 — The onboarding flow, end to end | `04-…` | not started |
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
