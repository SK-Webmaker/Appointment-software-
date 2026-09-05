# Kairo's tests

No test framework: Node's built-in `node:test` and `node:assert`, the same
zero-dependency rule as the product. Every suite boots a **real Kairo** on a
scratch database and drives it over HTTP, the way a browser or the app would.
Nothing inside Kairo is mocked.

```bash
npm test                 # every suite, three in parallel
node --test test/auth.test.js   # one suite
npm run test:falsify     # break Kairo on purpose; every suite that should fail, must
```

## The rule

**A test that cannot fail is not a test.** `test/falsify.mjs` keeps a list of
deliberate defects — the auth gate removed, double booking allowed, secrets
unmasked, the rate limiter disabled, the CSP dropped — applies each to a
throwaway copy of the repo, and requires the guarding suite to fail. A
mutation that survives fails CI. When you fix a bug, add its mutation.

## Layout

| File | What it proves |
|---|---|
| `helpers/kairo.js` | boots Kairo on a free port and a temp data dir; `api()`, `login()`, `db()`, `stop()`; kills stray servers on exit |
| `helpers/mocks.js` | stand-ins for the four outside services, built to behave rather than to agree: mock Stripe signs webhooks exactly as Stripe does, and mock Resend verifies a domain **only** when the records are genuinely present in mock Cloudflare |
| `boot.test.js` | version, security headers, static serving, traversal, manifest, no-store |
| `auth.test.js` | 401 gate, login, cookie flags, forged cookies, password rules, session retirement on password change |
| `settings.test.js` | write-only secrets, allow-list, time zone and From validation, public URL derivation, image URIs, the wizard |
| `public-booking.test.js` | info exposure, availability, booking, the 40-way race, unknown fields, closed days, blocks, booking off |
| `cancel.test.js` | cancel links, notice window, owner cancel, undo, quiet cancel, DELETE is cancel |
| `billing.test.js` | invoices in integer cents, partial and full payments, receipts, validation, numbering |
| `ratelimit.test.js` | login and booking limits, 429 + Retry-After, X-Forwarded-For spoofing |
| `messages.test.js` | skipped vs failed, SMS gating, retry, reminders and moves, the client survives a move |
| `security.test.js` | no secret in any response, token-scoped ICS and reviews, malformed and oversized bodies, demo reset guard |
| `origin-lock.test.js` | off / monitor / enforce, the foot-gun checks, the environment override |
| `backup-and-boot.test.js` | downloadable backup, pre-update backup, first-boot owner from the environment, pinned public URL |
| `control-api.test.js` | the shard's control API: unsigned, wrongly signed, stale, future-dated and path-swapped requests refused; create, status, settings, patch, password reset, export, delete |
| `signup.test.js` | a business signs up and comes out taking bookings — with a mock Stripe that signs webhooks exactly as Stripe does, and a mock ABN register |
| `migrate.test.js` | the Phase 5 move rehearsed end to end: fetch, dry-run import, verify, serve, compare, since — and the verifier failing on a lost client, one cent, a changed owner |
| `tenants.test.js` | many salons in one process: unknown host → nobody, per-salon data/sessions/tokens, 200 interleaved requests never cross, lazy creation, per-salon maintenance and mute, deletion, per-salon rate limits |
| `connect.test.js` | the connectors: email set up inside the business's own Resend account with the DNS Resend asks for written to Cloudflare, one DMARC record however many salons connect, a conflicting record aborting the whole thing, an own-domain salon getting the records rather than a green tick, and texts on the salon's own mobile via ClickSend Own Numbers |

## Conventions

- Each suite owns one server (`before`/`after`). Tests within a suite share it
  and must not depend on order beyond what `before` set up.
- Dates come from `openDateAhead(n)`, which skips Sundays (the demo salon is
  closed). Anything time-of-day sensitive uses a date at least two days out.
- Rate limiting is off by default in the harness; `ratelimit.test.js` turns it
  on and simulates addresses with `cf-connecting-ip`.
- The breach check is off (`KAIRO_BREACH_CHECK=off`) so no test touches the
  network.
