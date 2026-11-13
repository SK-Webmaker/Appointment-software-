#!/usr/bin/env bash
# Pushes this site into the GitHub repo that Lovable created for the project,
# which Lovable then syncs into the editor and preview. Costs no Lovable credits.
#
#   scripts/push-to-lovable.sh https://github.com/SK-Webmaker/<lovable-repo>.git [branch]
#
# It replaces the repo's files with this folder in ONE new commit on top of
# Lovable's history (never a force-push — Lovable's AGENTS.md: rewriting
# pushed history loses the project's history on Lovable's side).
set -euo pipefail

REMOTE="${1:?usage: push-to-lovable.sh <lovable repo url> [branch]}"
BRANCH="${2:-main}"
SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone --quiet "$REMOTE" "$WORK/repo"
cd "$WORK/repo"
git checkout --quiet "$BRANCH"

# Clear everything except .git, then copy the site in (ignored files stay out).
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
(cd "$SITE_DIR" && git ls-files -z --cached --others --exclude-standard) |
  (cd "$SITE_DIR" && xargs -0 tar -cf -) | tar -xf -

# Lovable's own AGENTS.md banner is worth keeping if the template wrote one.
git show "HEAD:AGENTS.md" > AGENTS.md 2>/dev/null || rm -f AGENTS.md

git add -A
if git diff --cached --quiet; then
  echo "Nothing to push — the Lovable repo already matches."
  exit 0
fi
git commit --quiet -m "Empress Hair — site built outside Lovable, synced in"
git push --quiet origin "HEAD:$BRANCH"
echo "Pushed to $REMOTE ($BRANCH). Lovable will pick it up in a few seconds."
