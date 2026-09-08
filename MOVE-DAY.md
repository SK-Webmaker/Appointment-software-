# Move day

> ## HORAHAIRCUTZ IS MOVED — 8 September, 13:57 UTC (23:57 Melbourne)
>
> She is live on the shard at `horahaircutz.kairobookings.com`, running v1.58.0,
> with all 14 clients, 102 appointments, 49 invoices and 43 payments
> (702,551 cents) intact. Her owner signs in, her booking page takes bookings,
> and a real test booking's confirmation was **delivered via Resend** before
> being cancelled and cleaned up.
>
> **The rollback, if she is ever wrong:** her old service
> `horahaircutz-booking` is still running, untouched, with her data as it was
> at the moment of the move. Put the custom domain `horahaircutz.kairobookings.com`
> back on it in Render (removing it from `kairo-shard-au` first), and turn its
> online booking back on. That is the whole of it — no DNS change is needed,
> because Render routes by the Host header and the custom domain is what decides
> which service answers.
>
> **Online booking is deliberately OFF on the old service** so nobody can book
> into a copy nobody is reading. Leave it that way.
>
> **Next: Hair By Sha, Monday 14 September**, after a week of Hora running. Her
> rehearsal already passed on real data.

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

Verified 8 September, 13:32 UTC (23:32 Melbourne).

| Thing | State |
|---|---|
| `kairo-shard-au` (Singapore, starter) | **Live**, v1.58.0, multi-tenant, holds no salons |
| Its persistent disk | **Added** — 5 GB at `/var/data` |
| Its health check path | **Set** — `/api/version` |
| Cloudflare `*` record | **Correct, DNS only** — CNAME to `kairo-shard-au.onrender.com`; `_acme-challenge` and `_cf-custom-hostname` both correct and resolving (validation token present) |
| Render custom domain | The wildcard `*.kairobookings.com` **verifies, issues a certificate, and never routes** — Cloudflare Error 1000, confirmed from a clean network. Render's edge is itself behind Cloudflare, so a salon hostname pointed at it resolves to a Cloudflare IP and is refused as a loop. Do not retry it. Replaced by the front door, below |
| The front door | `cloudflare/salon-router.js` — a Worker that forwards every salon to the shard's own address and carries the real hostname in `X-Kairo-Host`. Shard side is **built, tested and live**; the Worker itself is **not deployed yet** |
| Demo salon on the shard | **Live and proven.** Created over the control API; serves at the shard's own `onrender.com` address (added to its `domains`), the owner signs in, a real booking was taken — **and the booking survived a full redeploy**, which is the persistent disk actually working |
| Control API import verb | **Live on the shard**, refusing bad snapshots correctly |
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

**Then Cloudflare:** `kairobookings.com` → DNS → **three** records. A
wildcard needs more than a plain subdomain does: Render has to issue a
*wildcard* certificate (DNS-01, via `_acme-challenge`) and register the
hostname with Cloudflare for SaaS (via `_cf-custom-hostname`). The two
verification records must be **DNS only** (grey cloud): proxied, Cloudflare
answers with its own IPs and Render's verifier sees the wrong thing — which is
also what happens when the proxied `*` record swallows them, so they must exist
explicitly.

| Type | Name | Target | Proxy |
|---|---|---|---|
| `CNAME` | `*` | `kairo-shard-au.onrender.com` | **on** |
| `CNAME` | `_acme-challenge` | `kairo-shard-au.verify.renderdns.com` | **DNS only** |
| `CNAME` | `_cf-custom-hostname` | copy the exact value from Render's Custom Domains dialog | **DNS only** |

Render shows all three targets on the custom domain's dialog with copy buttons;
use those rather than typing them.

**Leave the existing `hairbysha` and `horahaircutz` records exactly as they
are.** They are more specific than the wildcard, so they keep winning and both
salons carry on unchanged. That is what makes the cutover in 3.4 a
one-record edit.

**Check before retrying:** from anywhere,
`dig +short CNAME _acme-challenge.kairobookings.com` must print
`kairo-shard-au.verify.renderdns.com.` — not a Cloudflare IP. Then press
*Retry Verification* on Render.

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

## The custom-domain cap, and the way past it

Render's Custom Domains page reports **"2 / 2 custom domains included with your
workspace plan"**. The wildcard shows *Verified* and *Certificate Issued* and
still does not route: every `x.kairobookings.com` gets Cloudflare Error 1000,
confirmed from a clean network. Verification passing while routing never
activates is what a quota block looks like from outside.

**This does not block Hora.** The shard routes a salon by any hostname listed
in its `tenant.json` `domains`, which is how the demo salon is being served
today at the shard's own `onrender.com` address. So Hora moves by *swapping*
her existing custom domain rather than adding a new one — net zero against the
cap:

1. Import her onto the shard (§3.3). Nothing is serving her there yet.
2. Give the tenant her hostname:
   `patchTenant('horahaircutz', { domains: ['horahaircutz.kairobookings.com'] })`
3. On Render, **remove** `horahaircutz.kairobookings.com` from
   `horahaircutz-booking`, then **add** it to `kairo-shard-au`. One out, one in.
4. In Cloudflare, point the `horahaircutz` record at
   `kairo-shard-au.onrender.com`.

The wildcard is what makes *future* salons provision in seconds, so it still
has to be solved — a workspace plan upgrade, or Render support, since a domain
that verifies and issues a certificate but never routes is worth reporting. It
is not on today's critical path.

---

## Part 3 — Move Hora (~15 min, writes frozen for about 5)

### 3.0 The decision that has to be made first

Freezing writes on Hora's *old* service needs `KAIRO_READ_ONLY`, and the old
service runs old code that does not have it. Two ways forward:

**A — Deploy the new code to Hora's service first (recommended).**
Render → `horahaircutz-booking` → Settings → Branch →
`claude/markdown-file-analysis-a5ppnf`. It redeploys in single-tenant mode.
Since 8 September the working branch **contains** the Kai v1.55.0 she runs
today plus the move switch, so this is a pure superset of what she has —
nothing removed. Confirm her booking page still works, then continue.
Reversible: switch the branch back.

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

### 3.2 Take the real snapshot

Sign in to Hora's salon → Settings → **Download a backup**. This is the copy
that moves: nothing booked since the rehearsal snapshot is lost, because writes
are frozen (3.1) and this is taken after the freeze.

### 3.3 Put it on the shard and prove it — one command

There is no shell on the shard, and there does not need to be: the snapshot
travels over the signed control API, the shard checks it before writing
anything (not gzip, not a database, failed integrity check, no owner, or a
slug that exists — each refused, nothing written), and then the tool asks for
it straight back and compares every row and every cent against what it sent.
Finally the booking page and the next fortnight are compared, old salon
against the new tenant, through a temporary `horahaircutz-preview` address
under the wildcard — the exact path customers will use after the flip.

```bash
KAIRO_SHARD_URL=https://kairo-shard-au.onrender.com \
KAIRO_PLATFORM_KEY=<the shard's key> \
node scripts/move-tenant.mjs \
  --slug horahaircutz \
  --from ~/Downloads/horahaircutz-final.db.gz \
  --old https://horahaircutz.kairobookings.com
```

Note: **no `--muted`**. The rehearsal copy was muted so it could never send;
the real one must send her reminders.

Exit 0 or stop. If it stops after the import succeeded, delete the shard copy
(`DELETE /api/platform/tenants/horahaircutz` via the control API) before
retrying, because import never overwrites. Setting `KAIRO_READ_ONLY` back to
`0` on her old service puts her exactly where she started.

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

---

## What Hora's move actually taught us, 8 September

Four things that were not in the plan, and matter for Sha next Monday.

**1. The custom domain IS the cutover; DNS never changes.** Render routes by
the Host header, so the moment `horahaircutz.kairobookings.com` was removed
from her old service and added to `kairo-shard-au`, she was being served by the
shard. The Cloudflare record still points at `horahaircutz-booking.onrender.com`
and it does not matter. Two clicks, no propagation wait, and the rollback is the
same two clicks in reverse.

**2. `verify` fails on a cross-version move, and that is correct.** Moving
1.55.0 → 1.58.0 reported four failures: one extra table (`devices`), four extra
settings rows, the settings count, and the file size. Every row count, every
money total and the newest ids matched. Of her 105 settings **exactly one
changed** — `app_version`. Do not wave this away: diff the settings key by key
and confirm the only differences are new keys with default values and the
version stamp. If any of her own settings changed value, stop.

**3. Turning online booking off is a good enough freeze.** It is the only thing
that writes without a person present, and it works on the old code, so no
deploy is needed to get a clean snapshot. Her public page 404s while it is off,
so the `compare` step has to be run with booking briefly back on.

**4. Do not push to the working branch during a cutover.** The shard
auto-deploys from it, and a redeploy mid-import answers 502. One import failed
that way; nothing was written, because the import checks everything before it
creates the folder.

---

## Addressing salons: the front door replaces the wildcard

Render answers only for hostnames it has been told about, and the workspace
plan caps how many at **2** — which the two live salons already use. The
wildcard was meant to lift that and does not work here (see above).

So salons stop being addressed by name at Render. A Cloudflare Worker forwards
every `*.kairobookings.com` request to `kairo-shard-au.onrender.com`, which
Render always answers for, and passes the real hostname in `X-Kairo-Host`. The
shard believes that header only when `X-Kairo-Forward-Secret` matches
`KAIRO_FORWARD_SECRET`, compared in constant time; otherwise it ignores it
entirely and routes by the real Host as usual.

Proven on the live shard, not only in tests:

| Sent to `kairo-shard-au.onrender.com` | Answered by |
|---|---|
| correct secret, `X-Kairo-Host: horahaircutz.…` | **Horahaircutz** |
| no secret, `X-Kairo-Host: horahaircutz.…` | the demo salon — header ignored |
| wrong or truncated secret | the demo salon — header ignored |
| no secret, `X-Kairo-Host: hairbysha.…` | the demo salon — header ignored |

Setting it up is four steps in [`cloudflare/README.md`](cloudflare/README.md).
**Read the warning about Hair By Sha there before adding the route** — the
Worker catches every salon, including ones not yet moved, and it carries a
list that sends those to their own service untouched.
