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
| 0 — Learn the system | [`00-phase-0-how-kairo-works.md`](00-phase-0-how-kairo-works.md) | **Written, awaiting the owner's corrections** |
| 1 — Is it possible at all? | `01-…` | not started |
| 2 — How | `02-…` | not started |
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

## Where things stand on the live systems (read 2026-09-05, nothing changed)

Both on v1.52.0. Sha: Oregon, no health-check path, stale `yarn install`
build command, emails from its own domain. Hora: Singapore, `/api/version`
health check, emails from the platform subdomain, no business phone set.
Origin lock off on both; `*.onrender.com` reachable on both. Cloudflare API
token expired 26 August. ACMA sender-ID registration outstanding for both.
