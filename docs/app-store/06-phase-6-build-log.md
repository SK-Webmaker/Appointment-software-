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

## Slice 2 — the shard: many salons, one process (2026-09-05) — done

**What was built** (v1.54.0, this branch only)

- `src/tenant.js` (new, ~250 lines): a tenant is a folder under
  `tenants/<slug>/` with `kairo.db` and `tenant.json`; an `AsyncLocalStorage`
  context; `resolveHost()` — the one line that turns a hostname into a file —
  which returns *nobody* for any address it cannot name; lazy open on first
  request; `tenant.json` re-read when it changes; `forEachTenant()` for the
  scheduler; `createTenant`, `updateTenantConfig`, `closeTenant`;
  `isReadOnly()` and `isMuted()`.
- `db.js`: `db` is now a proxy that resolves the current tenant's handle at
  call time, so **13,000 lines of callers did not change**. Backups land
  beside the tenant's own file. The owner can come from `tenant.json` (already
  hashed) instead of the environment; `seed: 'none'` gives a provisioned salon
  an empty diary and the wizard.
- `server.js`: Host → tenant before anything else; unknown host → a dull 404
  (JSON for `/api/*`, a plain page otherwise); `/api/version` answers for any
  host so Render's health check never fails; `X-Kairo-Tenant` header in
  multi-tenant mode; **maintenance mode**: writes to `/api/*` get a friendly
  `503` with `Retry-After`, reads and sign-in work.
- `notify.js`: the minute tick runs once per tenant in its own context; a
  **muted** tenant (rehearsal copy) marks every send `skipped`.
- Per-tenant module state: automations' daily marker, the SMS balance cache,
  the public-URL warning. Public rate-limit buckets keyed per salon.
- `public/js/book.js`: an amber bar when the salon is in maintenance.
- `scripts/tenant.mjs`: `create | list | set` — the operator's tool until the
  platform service exists; also what the tests use.
- **Single-tenant mode is byte-for-byte the same behaviour**: every existing
  suite runs in it unchanged, and the two live salons would run this code
  without noticing.

**Tests:** `test/tenants.test.js`, 12 checks written first and passing:
nobody's address serves nobody; each address serves only itself; sessions,
credentials, cancel and calendar tokens are worthless across salons; a booking
writes to one file only; **200 interleaved requests never cross**; a salon
created while running is served on its next request; per-salon maintenance;
per-salon mute; deletion; per-salon rate limits; single-tenant maintenance
via the environment. Whole suite: **13 suites, 89 checks, ~50 s.** Four new
mutations (route to the first tenant, maintenance not enforced, muted still
sends, rate limits shared) — **18/18 caught.**

**Not in this slice:** LRU closing of idle tenant handles (every tenant stays
open; fine for hundreds, revisit at thousands); the wildcard-domain and shard
setup on Render (Phase 7 / the owner's one-time list); the migration script
(slice 3).

**Next: slice 3 — `release` branch and `scripts/migrate-tenant.mjs`**
(snapshot → tenant folder → verification checklist, dry-run by default), then
a rehearsal against a copy of the demo data.
