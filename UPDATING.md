# Updating Kairo

Kairo runs in two shapes, and they update differently:

| | |
|---|---|
| **One salon, its own service** | how Sha and Hora have always run. Update it and one business restarts. |
| **The shard** — many salons, one process | one deploy updates, restarts and can break *all* of them at once. |

**[Updating the shard](#updating-the-shard) is the second half of this file.**
Read it before deploying anything that serves more than one business. Everything
above it is the single-salon story and still applies to a business on its own
service.

---

You improve the software once; every deployed business gets the update. Because
Kairo has **no dependencies to install** and **migrates its own database on
startup**, updating is essentially "get the new code, restart" — and the data is
protected automatically.

---

## The one thing to know

**On every start, if the code is a newer version than the database was last
touched by, Kairo makes a full backup of the database *before* applying any
changes.** So an update can always be rolled back. You don't have to remember to
back up before upgrading — it happens for you.

Backups land next to the database as `data/backup-v<old>-<timestamp>.db`
(the 5 most recent are kept). Each is a complete, standalone SQLite file.

## How to update, by where it's hosted

### Render / Railway / Fly (the recommended path) — automatic

> **Not for the shard.** Auto-deploy on a service that carries more than one
> business means a documentation commit takes every salon off the air, and a
> service with a persistent disk cannot hand over seamlessly. See
> [Updating the shard](#updating-the-shard).

These platforms redeploy whenever the connected branch changes. So the whole
update process is:

1. The new code is pushed to `claude/appointment-booking-software-xqoy4f` (done for you).
2. The platform detects the change and redeploys — usually within a minute or two.
3. On boot the new instance backs up the database and runs migrations. Done.

To force it immediately instead of waiting: open the service and click
**Manual Deploy → Deploy latest commit**.

### A VPS or your own box — one command

```bash
npm run update      # pulls the latest code (safe: refuses if you have local edits)
# then restart however you run it:
sudo systemctl restart kairo     # if using systemd
pm2 restart kairo                # if using pm2
# or just stop the process and:  npm start
```

That's it. No `npm install`, no build step.

## Confirming the version

- **In the app:** the version shows at the bottom of the left sidebar (e.g. `Kairo v1.2.0`).
- **Startup log:** `◆ Kairo v1.2.0 is running`.
- **Remotely:** `GET /api/version` → `{"version":"1.2.0"}` (no login needed) — handy
  for checking which version a client's instance is on.

## Why updates never lose data

- **Additive migrations.** New columns/tables are added with
  `ALTER TABLE … ADD COLUMN` / `CREATE TABLE IF NOT EXISTS`; existing data is never
  dropped or rewritten. New settings get sensible defaults automatically.
- **Automatic pre-update backup** (above) — a restore point every time the version changes.
- **The whole business is one file** (`data/kairo.db`), so a manual snapshot is trivial too.

## Manual backups & restore

```bash
npm run backup      # writes data/backup-manual-<timestamp>.db right now
```

Good as a nightly cron on a VPS:

```cron
0 2 * * *  cd /opt/kairo && /usr/bin/npm run backup
```

**To roll back / restore:** stop the server, replace `data/kairo.db` with a backup
file (rename the backup to `kairo.db`), delete any `kairo.db-wal` / `kairo.db-shm`
alongside it, and start again.

```bash
# example rollback
cp data/backup-v1.1.0-2026-07-11T10-15-59.db data/kairo.db
rm -f data/kairo.db-wal data/kairo.db-shm
npm start
```

## Rolling out to multiple clients

Each business is its own instance, so you update them independently — which is a
feature: you can update one client, confirm it's happy, then do the rest.

- **All on Render from the same branch:** a single push updates them all on the
  platform's next deploy cycle.
- **Prefer to stage:** point a pilot client's service at the branch and others at a
  tagged commit, promote the tag when you're satisfied.

## Versioning

`package.json` `version` is the single source of truth (surfaced by
`src/version.js`). Bump it when you cut a release so the sidebar, startup log,
`/api/version`, and the backup filenames all reflect it — and so the pre-update
backup triggers on the next start.

---

# Updating the shard

**Every salon on the shard shares one process.** One deploy updates all of
them, restarts all of them, and — if it is wrong — breaks all of them. That is
the whole reason this file exists.

Written 13 September 2026, after finding that a single salon's unreadable
database would end the process for everyone on it.

---

## The one fact that shapes everything

> *"Adding a persistent disk to your service **disables zero-downtime deploys**
> for it."* — Render's deploy documentation

The shard has a 5 GB disk, because that is where every salon's database lives.
A disk can only be mounted by one instance, so Render cannot start the new
instance while the old one is still serving. **Every shard deploy has a real
gap** — not a seamless hand-over — and it is a gap for every salon at once.

Three consequences, and they are not negotiable:

1. **Auto-deploy stays off.** A documentation commit must not take the salons
   off the air. Deploys are batched and deliberate.
2. **Deploy at a quiet hour.** Late evening or early morning, Melbourne time.
3. **Keep the gap short.** There is no build step (`echo "no build step"`) and
   nothing to install, so the gap is process start plus the boot check. Do not
   add a build step to this service without a reason worth the downtime.

---

## Before you deploy

CI already runs `npm test` and `npm run test:falsify` on every push
(`.github/workflows/test.yml`). **Check it is green for the commit you are
about to deploy** — not for the branch, for the commit. That is the gate, and
it is free.

Locally, the same two commands:

```
npm test              # 214 checks
npm run test:falsify  # 90 deliberate breakages, all of which must be caught
```

---

## Deploying

```bash
# 1. Note the time FIRST. This is what tells the verifier that the process it
#    is looking at is the new one and not the old one.
AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 2. Deploy: Render → kairo-shard-au → Manual Deploy → Deploy latest commit.

# 3. Verify. This waits for the restart before it judges anything.
node scripts/verify-deploy.mjs \
  --url https://kairo-shard-au.onrender.com \
  --after "$AT" \
  --salon horahaircutz --salon hairbysha
```

`verify-deploy` exists because of a mistake that has already been made here
once: a post-deploy check ran the instant the deploy was triggered, came back
green, and was green **about the code being replaced**. Render serves the old
instance until the new one is healthy, so `--after` is the whole point — it
refuses to judge anything until `started_at` has moved.

It checks three things, in order:

| | |
|---|---|
| The new process is live | `started_at` is later than `--after` |
| Every salon opened and migrated | `/api/ready` reports `ok`, nothing degraded |
| The named salons actually serve | their real booking page answers |

The third is not redundant. Opening is not serving, and the people who would
otherwise discover the difference are the salon's customers.

**If it fails: Render → Rollback.** One click, previous deploy. Do that first
and diagnose afterwards — every minute of diagnosis is a minute every salon is
wrong.

---

## What the shard now does for itself

### Asking whether it is ready is what makes it ready

`/api/ready` opens and migrates **every salon that exists at the moment it is
asked**, rather than reporting on whichever ones something happened to have
opened already. So by the time `verify-deploy` says a deploy is finished, every
schema is built and no customer is the one who pays for a migration.

That "at the moment it is asked" is load-bearing. An explicit open-everything
loop was written into `server.js` first and then deleted: it could not be made
to fail a test, because the scheduler's first tick already walks every salon.
Two mechanisms that merely *happen* to have run before anyone asks are not a
deploy gate — and neither of them has seen a salon provisioned thirty seconds
ago. Asking the question directly is what makes the answer true.

### One salon cannot take the others down

This was real, not theoretical. A tenant whose database would not open threw
out of `getTenant`, through a request handler that nothing wrapped, and Node
exited — **every salon on the shard, stopped by one stranger loading one
booking page.** A corrupt file after a bad update is exactly when that would
have happened.

Now:

- `getTenant` contains its own failures and records them
- that salon answers **503 "temporarily unavailable"**, not 404 — its customers
  are not sent looking for a mistake they did not make
- every other salon is untouched
- the whole request handler is wrapped, so any future throw ruins one request
  instead of the process. A malformed `Host` header used to be enough.
- a salon that is repaired **recovers on the next request**, with no deploy

### `/api/ready`

```json
{ "ok": true, "version": "1.60.0", "multi_tenant": true,
  "salons": 3, "serving": 3, "started_at": "…", "degraded": [] }
```

It answers **200 while at least one salon is serving**, and 503 only when none
is. That looks too lenient and is deliberate: Render answers a failing health
check by restarting, so 503-ing over one broken salon would take the healthy
ones down and then loop. The strict check belongs in `verify-deploy`, where a
person decides what to do, rather than in a supervisor whose only move is to
restart.

The error text has the server's paths stripped out — the endpoint is
unauthenticated, because Render has to reach it.

---

## Changing the health check on a running service

The shard's `healthCheckPath` should be `/api/ready`. **Order matters:**

1. Deploy the code that serves `/api/ready` **first**, with the health check
   still on `/api/version`.
2. Confirm it answers: `curl https://kairo-shard-au.onrender.com/api/ready`
3. *Then* change Render → Settings → Health Check Path to `/api/ready`.

Doing it the other way round points the health check at a path the running code
does not serve. Every check fails, Render restarts the service, and it loops —
on live salons.

---

## Migrations

Each salon's database is backed up before it migrates, into its own folder,
and the five most recent are kept:

```
  ↳ database backed up before update → data/backup-v1.55.0-2026-09-12T09-43-02.db
```

Rolling the **code** back does not roll a **migration** back. If an update
migrates a salon and then has to be reverted, the schema has already moved.
That backup is the way out, and it is per salon.

So: a release that changes the schema deserves more care than one that does
not. Read the migration, and be able to say what it does to a database that
already has data in it.

---

## What is deliberately not automated

**Auto-deploy after CI passes.** Render supports it, and with zero-downtime
deploys it would be the obvious answer. With a disk it is not: it would mean
every green commit takes the salons off the air, including the documentation
ones. The gate is CI being green *before* a deliberate deploy.

**Rollback on a failed verification.** `verify-deploy` tells you to roll back;
it does not do it. Rollback is one click, and an automated one would need
credentials that this repo should not hold.
