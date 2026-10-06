#!/usr/bin/env bash
# Lovable's read_file cannot return images, so download each binary file from the
# published/preview site into the local copy of the project.
# Usage: fetch-assets.sh <site-url> <project-dir> public/favicon.ico public/images/hero.jpg ...
set -euo pipefail
URL="${1%/}"; DIR="$2"; shift 2
for f in "$@"; do
  mkdir -p "$DIR/$(dirname "$f")"
  code=$(curl -sS -o "$DIR/$f" -w "%{http_code}" "$URL/${f#public/}")
  [ "$code" = 200 ] || { echo "STOP: $f -> HTTP $code"; exit 1; }
  echo "ok $f"
done
