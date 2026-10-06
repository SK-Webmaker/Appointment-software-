#!/usr/bin/env bash
# Turn a Lovable project folder into two client files: <slug>-website.zip (drag into app.netlify.com/drop)
# and <slug>-code.zip (source for any future developer). Fails loudly if any Lovable trace is left.
# Usage: build-handoff.sh <project-dir> <slug> <out-dir>
set -euo pipefail
DIR=$(cd "$1" && pwd); SLUG="$2"; OUT=$(mkdir -p "$3" && cd "$3" && pwd)
cd "$DIR"

# 1. Lovable traces in the source (left for Claude to fix in Lovable, never silently).
TRACES=$(grep -ril --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.lovable --exclude-dir=.output --exclude-dir=dist \
  --exclude='*.lock' --exclude='package-lock.json' --exclude='vite.config.ts' --exclude='package.json' -e lovable . || true)
if [ -n "$TRACES" ]; then echo "STOP: remove Lovable references from:"; echo "$TRACES"; exit 2; fi

# 2. Newer Lovable projects (TanStack Start) build a Cloudflare server, not a website folder.
#    Prerendering makes a plain index.html that Netlify Drop can host.
if grep -q "vite-tanstack-config" vite.config.ts && ! grep -q "prerender" vite.config.ts; then
  python3 - <<'PY'
import re, pathlib
p = pathlib.Path("vite.config.ts"); s = p.read_text()
if "tanstackStart:" in s:
    s = s.replace("tanstackStart: {", "tanstackStart: {\n    prerender: { enabled: true, crawlLinks: true },", 1)
else:
    s = s.replace("defineConfig({", "defineConfig({\n  tanstackStart: { prerender: { enabled: true, crawlLinks: true } },", 1)
p.write_text(s)
PY
fi

# 3. Build.
npm install --no-audit --no-fund --loglevel=error
rm -rf .output dist && npx vite build >/tmp/handoff-build.log 2>&1 || { tail -30 /tmp/handoff-build.log; exit 1; }
SITE=.output/public; [ -f "$SITE/index.html" ] || SITE=dist
[ -f "$SITE/index.html" ] || { echo "STOP: build made no index.html"; exit 1; }
rm -f "$SITE/_headers" "$SITE/_redirects.json"

# 4. Nothing in the finished site may mention Lovable.
if grep -ril lovable "$SITE"; then echo "STOP: built site still mentions Lovable (files above)"; exit 3; fi

# 5. Zip both.
rm -f "$OUT/$SLUG-website.zip" "$OUT/$SLUG-code.zip"
(cd "$SITE" && zip -qr "$OUT/$SLUG-website.zip" .)
zip -qr "$OUT/$SLUG-code.zip" . -x 'node_modules/*' '.git/*' '.lovable/*' '.output/*' 'dist/*' '.wrangler/*' 'AGENTS.md' 'roadmap.md'
echo "SITE_DIR=$DIR/$SITE"
ls -la "$OUT/$SLUG-website.zip" "$OUT/$SLUG-code.zip"
