# Phase 6 — Build log

*One entry per slice. Each slice ships alone, tested, with both live salons
untouched. Nothing on this branch deploys anywhere.*

---

## Slice 1 — the test harness (2026-09-05) — done

**What was built**

- `test/helpers/kairo.js`: boots a real Kairo on a free port and a scratch
  data directory, drives it over HTTP, reads its SQLite file directly for
  assertions, and kills anything it started when the runner exits.
- Twelve suites, **77 checks**, on Node's built-in `node:test`. No framework,
  no mocks of Kairo. ~35 s on three parallel workers.
- `test/falsify.mjs`: **14 deliberate defects** (auth gate removed, session
  version ignored, cookie not HttpOnly, double booking allowed, unknown fields
  accepted, rate limiter disabled, secrets unmasked, CSP dropped, calendar
  file readable without its token, cancellation window ignored, origin lock
  never blocks, admin email case kept, move drops client, pre-update backup
  skipped), each applied to a throwaway copy and required to make its suite
  fail. **14/14 caught.**
- `.github/workflows/test.yml`: both commands on every push. Zero install.
- `test/README.md`, and a Tests section in the main README.

**What the harness found on its first day** — both fixed, both with a
regression test and a mutation:

1. **A moved appointment lost its client.** `PUT /api/appointments/:id`
   without `client_id` wrote `NULL`; the calendar always sends the id so no
   live salon has hit it, but the app's partial updates would have. Now an
   omitted `client_id` keeps the client; only an explicit null (the editor's
   walk-in) clears it.
2. **An owner email with a capital letter at first boot could never sign
   in.** Bootstrap stored `KAIRO_ADMIN_EMAIL` as typed; login lowercases.
   Now stored lowercased and trimmed.

Version bumped to **1.53.0**; not released to the deploy branch (that is
slice 3's `release` branch).

**Known gaps, deliberately left for later slices**

- No browser (Chromium) suite yet; everything is API-level. The old suites
  the brief mentions were browser-driven. A Playwright-free browser check is
  planned with the iOS web-view work, where it earns its cost.
- Stripe, Resend and ClickSend paths are tested only to the "not configured →
  skipped" boundary. The connector slices add tests against each provider's
  test surface.
- The two-tenant isolation suite belongs to slice 2, where the code it tests
  is written.

**Next: slice 2 — the shard.** Tenant context, `db` proxy, host routing,
single-tenant mode preserved, the two-tenant isolation suite (written first),
`KAIRO_READ_ONLY`.
