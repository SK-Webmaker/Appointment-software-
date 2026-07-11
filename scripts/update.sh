#!/usr/bin/env bash
# Update a self-hosted Kairo instance to the latest code — quick and safe.
#
#   bash scripts/update.sh
#
# Kairo has no dependencies to install, and the server automatically backs up
# the database and runs any migrations on the next start, so updating is just
# "pull the latest code and restart".
set -euo pipefail

BRANCH="${KAIRO_BRANCH:-claude/appointment-booking-software-xqoy4f}"
cd "$(dirname "$0")/.."

echo "◆ Updating Kairo (branch: $BRANCH)…"

# Stash nothing; refuse to clobber local edits.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "  ✗ You have uncommitted local changes. Commit or discard them first."
  exit 1
fi

for attempt in 1 2 3 4; do
  if git fetch origin "$BRANCH"; then break; fi
  echo "  … network hiccup, retrying ($attempt)"; sleep $((attempt * 2))
done

BEFORE="$(git rev-parse --short HEAD)"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
AFTER="$(git rev-parse --short HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "  ✓ Already up to date ($AFTER)."
else
  echo "  ✓ Updated $BEFORE → $AFTER"
fi

echo ""
echo "Now restart Kairo to apply (it will back up the database and migrate automatically):"
echo "  • systemd:   sudo systemctl restart kairo"
echo "  • pm2:       pm2 restart kairo"
echo "  • manual:    stop the running process, then  npm start"
echo ""
echo "On Render/Railway/Fly this isn't needed — a push to '$BRANCH' auto-deploys."
