# Move day

**Read this first, whichever of us is reading.** This is the operating script
for moving Horahaircutz onto the shard. It is written to be picked up cold —
by the owner, or by a fresh Claude session that has none of yesterday's
context — and followed top to bottom.

Nothing in here is a decision. The decisions were made in
[`docs/app-store/05-phase-5-sha-and-hora.md`](docs/app-store/05-phase-5-sha-and-hora.md)
and the programme record. This is only the doing.

---

## The one rule

**Hair By Sha does not move today.** She is the working salon. Hora goes
first, runs for a week, and Sha follows on Monday 14 September once a real
salon has survived a real Saturday on the shard.

If at any point a check fails: **stop, and change nothing else.** Both salons
keep running on exactly what they are running on now. Nothing today is
urgent enough to push past a red check.

---

## Where things stand

Verified 8 September, 12:40 UTC (22:40 Melbourne).

| Thing | State |
|---|---|
| `kairo-shard-au` (Singapore, starter) | **Live**, v1.58.0, multi-tenant, holds no salons |
| Its persistent disk | **Added** — 5 GB at `/var/data` |
| Its health check path | **Set** — `/api/version` |
| Cloudflare `*` record | **Correct** — proxied CNAME to `kairo-shard-au.onrender.com` |
| Render custom domain | **WRONG ONE** — `kairobookings.com` (the apex) was added instead of `*.kairobookings.com`. Cloudflare answers Error 1000 for every `x.kairobookings.com` until the wildcard is registered on Render. See 1.3 |
| The apex `kairobookings.com` | Still serves the marketing site. Untouched. Must **not** be pointed at the shard |
| `hairbysha-booking`, `horahaircutz-booking` | Untouched, answering normally, **on the default branch's Kai v1.55.0** (auto-deployed 7 Sep 21:44 UTC) |
| Kai work on the default branch | **Merged into the working branch** as v1.58.0 — 154 checks, 42/42 mutations caught |
| Rehearsals, from the owner's own backups | **Both green.** Hora 38 verify + 65 compare; Sha 38 + 37 (own-domain email intact). Hora re-rehearsed on the merged code: green |
| Off-Render backups | **Taken** — 8 Sep, both salons, on the owner's machine |

The working branch is `claude/markdown-file-analysis-a5ppnf`. The shard deploys
from it directly.

> **Never merge the working branch into
> `claude/appointment-booking-software-xqoy4f`.** Both live services
> auto-deploy from it on every commit — this is not hypothetical, it happened
> three times on 7 September with the Kai work — so a merge puts new code onto
> Sha and Hora within a minute, unrehearsed and with no window. The shard reads
> the working branch, so there is no reason to merge. When the time comes, the
> Kai lineage is already inside the working branch (v1.58.0), so nothing is lost
> by leaving the default branch where it is.

---

## Part 1 — Setup (browser only, ~25 min)

None of this touches a booking. Do it in order.

### 1.1 Add the disk — before anything else

The shard writes to `/var/data`. With no disk that is scratch space, wiped on
every deploy. Empty, that is harmless. With a salon on it, it is the whole
salon.

Render → `kairo-shard-au` → **Settings → Disks → Add Disk**

| Field | Value |
|---|---|
| Name | `data` |
| Mount path | `/var/data` |
| Size | `5 GB` |

It redeploys itself, about a minute.

**Check:** `curl https://kairo-shard-au.onrender.com/api/version` → `{"version":"1.58.0"}`

### 1.2 Health check path

Same Settings page → **Health Check Path** → `/api/version`.

Without it Render keeps routing customers to a process that has died. Hora's
own service already has this set; the shard does not.

### 1.3 Point the salon addresses at the shard

**Render first:** `kairo-shard-au` → Settings → **Custom Domains** → add
**`*.kairobookings.com`** — the wildcard, with the asterisk. Not the bare
domain: `kairobookings.com` is the marketing site and must never point at the
shard. If the apex was added by mistake, remove it there.

**Then Cloudflare:** `kairobookings.com` → DNS → a record

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `*` |
| Target | `kairo-shard-au.onrender.com` |
| Proxy | on |

**Leave the existing `hairbysha` and `horahaircutz` records exactly as they
are.** They are more specific than the wildcard, so they keep winning and both
salons carry on unchanged. That is what makes the cutover in 3.4 a
one-record edit.

If Render's verification of the wildcard sits on "pending" behind the
Cloudflare proxy, switch the `*` record to *DNS only* (grey cloud), press
*Retry verification*, and switch the proxy back on once it says verified.

**Check:** `curl https://demo.kairobookings.com/api/version` → `{"version":…}`
from the shard, not a Cloudflare error page.

### 1.4 Download a backup of each salon

Sign in to each salon → Settings → **Download a backup**. Two files, kept on
your own machine, not on Render.

This is a precondition of the move in its own right, and it is what makes the
rehearsal need no password.

---

## Part 2 — Prove the shard (~20 min)

### 2.1 A demo tenant first

The first salon on a new shard should be one nobody depends on.

```bash
# creates the folder and the database; the shard makes tenants lazily
curl -s -o /dev/null -w '%{http_code}\n' https://demo.kairobookings.com/api/public/info
```

Then, in a browser, open `https://demo.kairobookings.com`, sign in, and take a
booking on it.

**Checks, all of which must pass:**

- The demo booking page loads and a booking can be made.
- `https://kairo-shard-au.onrender.com/` (no salon in the hostname) → **404**.
- `https://a.b.kairobookings.com/` → **404**. Two labels is nobody.
- `https://kairo-shard-au.onrender.com/api/platform/health` → **404**
  (no `KAIRO_PLATFORM_KEY` is set, which is correct for now).
- Trigger a deploy on the shard, wait for it, and confirm the demo booking is
  **still there**. This is the disk actually working, and it is the check that
  matters most.

### 2.2 Rehearse both salons

Hand over the two backup files from 1.4.

```bash
node scripts/rehearse-move.mjs \
  --url https://horahaircutz-booking.onrender.com \
  --slug horahaircutz \
  --from ~/Downloads/hora-backup.db.gz

node scripts/rehearse-move.mjs \
  --url https://hairbysha-booking.onrender.com \
  --slug hairbysha \
  --from ~/Downloads/sha-backup.db.gz
```

Each one imports the copy, checks **every row, every cent and every setting**
against the original, boots a scratch shard, and compares the booking page and
the next fortnight of availability against the live salon. It only ever reads
from the live salon.

**Exit 0 on both, or the salon that failed does not move.** Sha's rehearsal is
run today even though she moves next week — if her data has a surprise in it,
today is when we want to find out.

---

## Part 3 — Move Hora (~15 min, writes frozen for about 5)

### 3.0 The decision that has to be made first

Freezing writes on Hora's *old* service needs `KAIRO_READ_ONLY`, and the old
service runs old code that does not have it. Two ways forward:

**A — Deploy the new code to Hora's service first (recommended).**
Render → `horahaircutz-booking` → Settings → Branch →
`claude/markdown-file-analysis-a5ppnf`. It redeploys in single-tenant mode,
which is byte-for-byte the same behaviour she has now (there is no `tenants/`
folder on her disk, and single-tenant mode is covered by the test suite).
Confirm her booking page still works, then continue. Reversible: switch the
branch back.

*This is a change to a live salon.* It is the smallest one available, it is
what the plan's precondition 4 asks for, and doing it on Hora first is exactly
how we learn whether it is safe before Sha. **Get the owner's word before
doing it.**

**B — No freeze; reconcile afterwards.**
Skip the read-only step, move fast, and afterwards run
`node scripts/migrate-tenant.mjs since --slug horahaircutz --since "<UTC timestamp of the export>"`
to list anything that landed on the old service during the window, then re-enter
it by hand. Acceptable for Hora, who is quiet and new. **Not acceptable for
Sha.**

### 3.1 Freeze writes (path A only)

Render → `horahaircutz-booking` → Environment → `KAIRO_READ_ONLY` = `1`.

Reads keep working: her booking page stays up and readable, and anyone
mid-booking sees "back in a few minutes" rather than an error. Note the UTC
time.

### 3.2 Take the real snapshot and import it

```bash
node scripts/migrate-tenant.mjs fetch \
  --url https://horahaircutz-booking.onrender.com \
  --email <hora owner email> --password '<password>' \
  --out hora-final.db.gz

node scripts/migrate-tenant.mjs import \
  --slug horahaircutz --from hora-final.db.gz \
  --public-url https://horahaircutz.kairobookings.com --apply

node scripts/migrate-tenant.mjs verify \
  --slug horahaircutz --from hora-final.db.gz
```

Note: **no `--muted` this time.** The rehearsal copy was muted so it could
never send; the real one must be able to send her reminders.

`verify` must pass. If it does not, stop: nothing has moved yet, and setting
`KAIRO_READ_ONLY` back to `0` puts her exactly where she started.

### 3.3 Check the new one before anyone is sent to it

```bash
node scripts/migrate-tenant.mjs compare \
  --old https://horahaircutz-booking.onrender.com \
  --new https://kairo-shard-au.onrender.com \
  --new-host horahaircutz.kairobookings.com
```

### 3.4 Flip the one DNS record

Cloudflare → `kairobookings.com` → DNS → the `horahaircutz` record → point it
at `kairo-shard-au.onrender.com`.

Then, in a browser: open her booking page, **make a real test booking**, and
check it appears in her calendar. Cancel it afterwards.

### 3.5 Unfreeze and leave the old one standing

Set `KAIRO_READ_ONLY` back to `0` on the shard if it was ever set there. Leave
`horahaircutz-booking` **running, read-only, for a week**. Rolling back is then
one DNS record and nothing else.

---

## Part 4 — Afterwards

- Watch Hora for the week. A real Saturday is the test.
- **Monday 14 September:** Sha, same script, with her rehearsal already done.
- Do not delete `horahaircutz-booking` until Sha has also moved and settled.

---

## Rollback

At any point before 3.4, there is nothing to roll back: Hora is still being
served by her own service and the shard copy is inert.

After 3.4: point the `horahaircutz` DNS record back at
`horahaircutz-booking.onrender.com` and set `KAIRO_READ_ONLY` to `0` on it.
That is the whole rollback. Anything booked on the shard in between is found
with:

```bash
node scripts/migrate-tenant.mjs since --slug horahaircutz --since "<UTC time of the flip>"
```

and re-entered by hand. This is why the old service stays up for a week.

---

## Loose ends, neither blocking

- The branch `claude/ios-ci-falsify` on GitHub holds one deliberately broken
  commit from proving the iOS CI can fail. It is merged nowhere and should be
  deleted — one click on the branches page. This session's git proxy refuses
  ref deletions.
- The App Store work ([`docs/app-store/07-phase-7-launch.md`](docs/app-store/07-phase-7-launch.md))
  is entirely separate and waits on the A$149 Apple enrolment. It should not
  share a week with a salon migration.
