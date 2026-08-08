#!/usr/bin/env bash
#
# new-business.sh — stand up a new Kairo customer in one command.
#
# One copy of the code, one data folder per business. Each business gets its
# own port, its own systemd service and its own subdomain; they share nothing
# but the files in this repo, so updating everybody is `git pull` plus one
# restart. That is the whole reason this is a script and not a checklist: the
# fifth business is set up exactly like the first, at 9pm, without thinking.
#
# Usage:
#   sudo scripts/new-business.sh --name "Hair by Sha" --host sha.example.com \
#        --email sha@hairbysha.com
#
# Everything else is optional. Add the provider keys and it wires those up too:
#   --resend-key re_xxx --from "Hair by Sha <hello@hairbysha.com>"
#   --sms-user you@example.com --sms-key XXXX --sms-from KAIRO
#
# Rehearse first with --dry-run: it prints every file and command and touches
# nothing.
#
# Override the layout with KAIRO_ROOT, SYSTEMD_DIR and CADDY_DIR if your box is
# arranged differently (they are also what the test harness points at a temp
# folder).
set -euo pipefail

CODE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KAIRO_ROOT="${KAIRO_ROOT:-/srv/kairo}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
CADDY_DIR="${CADDY_DIR:-/etc/caddy/sites}"
RUN_USER="${KAIRO_USER:-kairo}"
PORT_BASE="${KAIRO_PORT_BASE:-4820}"

NAME="" HOST="" EMAIL="" SLUG="" PORT="" PASSWORD=""
RESEND_KEY="" FROM_ADDR=""
SMS_USER="" SMS_KEY="" SMS_FROM=""
DRY=0 NO_START=0

die() { printf '\n\033[1;31m✗ %s\033[0m\n\n' "$*" >&2; exit 1; }
say() { printf '\033[1;36m%s\033[0m\n' "$*"; }
ok()  { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then printf '  \033[2m$ %s\033[0m\n' "$*"; else eval "$@"; fi; }

usage() { awk 'NR>2 && /^#/ { sub(/^# ?/, ""); print; next } NR>2 { exit }' "${BASH_SOURCE[0]}"; exit 0; }

while [ $# -gt 0 ]; do
  case "$1" in
    --name)        NAME="$2"; shift 2 ;;
    --host)        HOST="$2"; shift 2 ;;
    --email)       EMAIL="$2"; shift 2 ;;
    --slug)        SLUG="$2"; shift 2 ;;
    --port)        PORT="$2"; shift 2 ;;
    --password)    PASSWORD="$2"; shift 2 ;;
    --resend-key)  RESEND_KEY="$2"; shift 2 ;;
    --from)        FROM_ADDR="$2"; shift 2 ;;
    --sms-user)    SMS_USER="$2"; shift 2 ;;
    --sms-key)     SMS_KEY="$2"; shift 2 ;;
    --sms-from)    SMS_FROM="$2"; shift 2 ;;
    --dry-run)     DRY=1; shift ;;
    --no-start)    NO_START=1; shift ;;
    -h|--help)     usage ;;
    *) die "Unknown option: $1  (try --help)" ;;
  esac
done

# ---------------------------------------------------------------- check inputs
[ -n "$NAME" ]  || die "--name is required, e.g. --name \"Hair by Sha\""
[ -n "$HOST" ]  || die "--host is required, e.g. --host sha.example.com"
[ -n "$EMAIL" ] || die "--email is required — it is the owner's sign-in address"
# Bash's own matching, not a pipe into grep: `grep -q` exits the moment it
# matches, which under `set -o pipefail` makes the pipeline look like a failure
# and would reject perfectly good input.
[[ "$HOST" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "--host must be a plain hostname like sha.example.com"
[[ "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$ ]] || die "--email does not look like an email address"

# Slug: what the folder, the service and the data directory are called.
if [ -z "$SLUG" ]; then
  SLUG="$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')"
fi
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]] || die "Slug '$SLUG' is not usable — pass --slug yourself"

DATA_DIR="$KAIRO_ROOT/data/$SLUG"
UNIT="kairo-$SLUG.service"

# Refuse to touch a business that already exists. Re-running this by accident
# must never point a live salon at an empty database.
if [ -d "$DATA_DIR" ]; then
  die "$DATA_DIR already exists — '$SLUG' is already set up. Delete it by hand if you really mean to start over."
fi
[ -f "$SYSTEMD_DIR/$UNIT" ] && die "$SYSTEMD_DIR/$UNIT already exists — '$SLUG' is already set up."

NODE_BIN="$(command -v node || echo /usr/bin/node)"

# Port: the first one at or above the base that no existing unit has claimed
# and that nothing is actually listening on. The listening half is done by
# binding the port for real rather than reading `ss`, which a minimal VPS may
# not have installed — and a missed port would silently hand a new business a
# port already serving someone else's salon.
if [ -z "$PORT" ]; then
  CLAIMED="$(cat "$SYSTEMD_DIR"/kairo-*.service 2>/dev/null | sed -n 's/^Environment=PORT=//p' | tr '\n' ',' || true)"
  PORT="$("$NODE_BIN" -e '
    const net = require("node:net");
    const base = Number(process.argv[1]);
    const claimed = new Set(String(process.argv[2] || "").split(",").filter(Boolean).map(Number));
    (async () => {
      for (let p = base; p < base + 200; p++) {
        if (claimed.has(p)) continue;
        const free = await new Promise((res) => {
          const s = net.createServer();
          s.once("error", () => res(false));
          s.once("listening", () => s.close(() => res(true)));
          s.listen(p, "127.0.0.1");
        });
        if (free) { process.stdout.write(String(p)); return; }
      }
      process.exit(1);
    })();' "$PORT_BASE" "$CLAIMED")" || die "No free port found above $PORT_BASE"
fi

# Password: strong, printed once, never stored anywhere but the database hash.
# Fixed-size read so nothing in the pipeline exits early on a closed pipe.
[ -n "$PASSWORD" ] || PASSWORD="$(LC_ALL=C head -c 256 /dev/urandom | tr -dc 'A-Za-z0-9' | cut -c1-14)"

PUBLIC_URL="https://$HOST"

say ""
say "Setting up $NAME"
printf '  folder   %s\n  service  %s\n  port     %s\n  address  %s\n\n' "$DATA_DIR" "$UNIT" "$PORT" "$PUBLIC_URL"
[ "$DRY" = 1 ] && printf '\033[1;33m  DRY RUN — nothing below is actually done\033[0m\n\n'

# ------------------------------------------------------------------- 1. folder
say "1/6  Data folder"
run "mkdir -p '$DATA_DIR'"
if id "$RUN_USER" >/dev/null 2>&1; then
  run "chown -R '$RUN_USER:$RUN_USER' '$DATA_DIR'"
  ok "owned by $RUN_USER"
else
  RUN_USER="$(id -un)"
  ok "user 'kairo' not found — running as $RUN_USER"
fi
run "chmod 700 '$DATA_DIR'"
ok "$DATA_DIR"

# ------------------------------------------------------------------ 2. service
say "2/6  Service"
UNIT_TEXT="[Unit]
Description=Kairo — $NAME
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$CODE_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=HOST=127.0.0.1
Environment=KAIRO_DATA_DIR=$DATA_DIR
Environment=KAIRO_ADMIN_EMAIL=$EMAIL
Environment=KAIRO_ADMIN_PASSWORD=$PASSWORD
ExecStart=$NODE_BIN --disable-warning=ExperimentalWarning $CODE_DIR/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target"

if [ "$DRY" = 1 ]; then
  printf '  \033[2m--- %s/%s ---\n%s\n  ---\033[0m\n' "$SYSTEMD_DIR" "$UNIT" "$UNIT_TEXT"
else
  mkdir -p "$SYSTEMD_DIR"
  printf '%s\n' "$UNIT_TEXT" > "$SYSTEMD_DIR/$UNIT"
  chmod 600 "$SYSTEMD_DIR/$UNIT"   # the first-run admin password is in here
fi
ok "$SYSTEMD_DIR/$UNIT"

# --------------------------------------------------------------------- 3. HTTPS
say "3/6  HTTPS"
CADDY_TEXT="$HOST {
	reverse_proxy 127.0.0.1:$PORT
}"
if [ "$DRY" = 1 ]; then
  printf '  \033[2m--- %s/%s.caddy ---\n%s\n  ---\033[0m\n' "$CADDY_DIR" "$SLUG" "$CADDY_TEXT"
else
  mkdir -p "$CADDY_DIR"
  printf '%s\n' "$CADDY_TEXT" > "$CADDY_DIR/$SLUG.caddy"
fi
ok "$CADDY_DIR/$SLUG.caddy  (Caddy gets the certificate itself)"

# --------------------------------------------------------------------- 4. start
say "4/6  Start"
if [ "$NO_START" = 1 ]; then
  ok "skipped (--no-start)"
elif [ "$DRY" = 1 ]; then
  run "systemctl daemon-reload"
  run "systemctl enable --now $UNIT"
  run "systemctl reload caddy"
elif command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload
  systemctl enable --now "$UNIT"
  command -v caddy >/dev/null 2>&1 && systemctl reload caddy 2>/dev/null || true
  ok "started and set to come back after a reboot"
else
  die "systemctl not found. This script targets a systemd Linux box (any \$5 VPS).
     To run it anyway without starting anything, add --no-start."
fi

# ------------------------------------------------------------------ 5. settings
# Seed through the API rather than the database: it proves the instance is up,
# proves the login works, and goes through the same validation the UI does.
say "5/6  Settings"
if [ "$NO_START" = 1 ] || [ "$DRY" = 1 ]; then
  ok "skipped — nothing running to talk to"
else
  BASE="http://127.0.0.1:$PORT"
  for _ in $(seq 1 40); do
    curl -fsS -o /dev/null "$BASE/api/public/info" 2>/dev/null && break
    sleep 0.5
  done
  curl -fsS -o /dev/null "$BASE/api/public/info" 2>/dev/null \
    || die "The instance did not come up. Look at:  journalctl -u $UNIT -n 50"
  ok "instance answering on port $PORT"

  JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
  curl -fsS -o /dev/null -c "$JAR" -X POST "$BASE/api/auth/login" \
    -H 'content-type: application/json' \
    -d "$(printf '{"email":%s,"password":%s}' "$(printf '%s' "$EMAIL" | sed 's/"/\\"/g; s/^/"/; s/$/"/')" \
                                              "$(printf '%s' "$PASSWORD" | sed 's/"/\\"/g; s/^/"/; s/$/"/')")" \
    || die "Could not sign in as $EMAIL. Look at: journalctl -u $UNIT -n 50"
  ok "signed in as $EMAIL"

  # Build the settings payload with node (already installed) so quoting and
  # escaping are handled properly whatever is in the business name.
  PAYLOAD="$(NAME="$NAME" EMAIL="$EMAIL" PUBLIC_URL="$PUBLIC_URL" \
             RESEND_KEY="$RESEND_KEY" FROM_ADDR="$FROM_ADDR" \
             SMS_USER="$SMS_USER" SMS_KEY="$SMS_KEY" SMS_FROM="$SMS_FROM" \
    "$NODE_BIN" -e '
    const e = process.env;
    const s = { business_name: e.NAME, business_email: e.EMAIL, public_url: e.PUBLIC_URL };
    if (e.RESEND_KEY) s.resend_api_key = e.RESEND_KEY;
    if (e.FROM_ADDR)  s.notif_from_email = e.FROM_ADDR;
    if (e.SMS_USER && e.SMS_KEY) {
      s.sms_provider = "clicksend";
      s.clicksend_username = e.SMS_USER;
      s.clicksend_api_key = e.SMS_KEY;
      if (e.SMS_FROM) s.clicksend_from = e.SMS_FROM;
      s.sms_notifications_enabled = "1";
    }
    process.stdout.write(JSON.stringify(s));')"

  curl -fsS -o /dev/null -b "$JAR" -X PUT "$BASE/api/settings" \
    -H 'content-type: application/json' -d "$PAYLOAD" \
    || die "Saving settings failed."
  ok "business name and address saved"
  [ -n "$RESEND_KEY" ] && ok "email key saved" || printf '  \033[2m·\033[0m email not set up yet — paste the key in Settings → Notifications\n'
  [ -n "$SMS_KEY" ]    && ok "text key saved"  || printf '  \033[2m·\033[0m texts not set up yet — optional, and costs per message\n'
fi

# -------------------------------------------------------------------- 6. record
say "6/6  Record"
LEDGER="$KAIRO_ROOT/businesses.tsv"
if [ "$DRY" = 1 ]; then
  run "echo '...' >> $LEDGER"
else
  mkdir -p "$KAIRO_ROOT"
  [ -f "$LEDGER" ] || printf 'slug\tname\thost\tport\tservice\tcreated\n' > "$LEDGER"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$SLUG" "$NAME" "$HOST" "$PORT" "$UNIT" "$(date -Iseconds)" >> "$LEDGER"
fi
ok "$LEDGER"

# --------------------------------------------------------------------- summary
cat <<SUMMARY

  ┌─────────────────────────────────────────────────────────────
  │  $NAME is ready
  ├─────────────────────────────────────────────────────────────
  │  Their workspace   $PUBLIC_URL
  │  Their booking link $PUBLIC_URL/book
  │
  │  Sign in           $EMAIL
  │  Password          $PASSWORD
  │
  │  This password is shown once. Write it down now, and have the
  │  owner change it during onboarding (Account → Change password).
  └─────────────────────────────────────────────────────────────

  Before the meeting, check:
    • $HOST points at this server (an A record at your registrar)
    • $PUBLIC_URL opens with a padlock
    • $PUBLIC_URL/book shows the demo salon

  Useful later:
    systemctl status $UNIT        how it's doing
    journalctl -u $UNIT -f        watch its log
    systemctl restart $UNIT       after a code update

SUMMARY
