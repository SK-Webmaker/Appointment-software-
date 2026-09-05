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

## Slice 3 — the move, as a tool (2026-09-05) — done

**What was built**

- `scripts/migrate-tenant.mjs`, five subcommands, all safe to repeat, none
  ever writing to a live salon:
  - `fetch` — downloads a salon's own backup snapshot through the authenticated
    endpoint the app uses (the T+2 step in Phase 5 §5);
  - `import` — **dry run by default**; `--apply` copies the file into
    `tenants/<slug>/` and writes `tenant.json`; refuses to overwrite;
    `--muted` for rehearsals;
  - `verify` — every table's row count, every cent of payments and line
    items, the newest ids and invoice number, every setting (secrets compared
    as set/empty with length), the owner's login row byte for byte, file size
    within 1%, integrity check. Exit 1 on any difference. This is Phase 5 §4.
  - `compare` — the old and new booking pages side by side: the public info
    and the next fortnight's availability per staff member, with a Host
    override because the shard decides the salon by Host;
  - `since` — what was written on the shard after a moment, for a rollback's
    reconciliation (Phase 5 §6 step 4).
- **`release` branch created** at the commit the two live salons run today
  (`49ded84`, v1.52.0). No service points at it yet; that is a Phase 5/7
  action on the live services and needs the owner's say-so at the time.

**Tests:** `test/migrate.test.js` rehearses the whole move end to end — a real
single-tenant Kairo with a booking, an invoice, a payment, a time zone and a
secret; `fetch` with the owner's credentials (and a refused wrong password);
dry-run creates nothing; import; verify passes; the shard serves the moved
salon with the same login, name, secret present and identical booking-page
data; `compare` reports identical; `since` reports nothing, then one row
after a booking. And **the verifier is shown to fail** on a lost client, a
one-cent change and a changed owner row. New mutation: the verifier ignoring
row counts — caught. **Whole suite: 14 suites, 94 checks. 19/19 mutations
caught.**

**Bug found by the rehearsal:** none in the product. One in the tool itself
(a parameter-count error in `since`) and one in the test's premise, both fixed
before the commit — which is what a rehearsal is for.

**Next: slice 4 — the platform service** (directory, signup, Stripe Checkout,
screening, provisioning via `createTenant`, the flag queue, the operator
console), against a scratch shard, with the connectors following in slice 5.
