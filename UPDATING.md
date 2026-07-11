# Updating Kairo — quick, simple, and safe

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
