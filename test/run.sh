#!/bin/bash
#
# Every suite, one after another, with the servers cleared between each.
#
#   ./test/run.sh                 # all of them
#   ./test/run.sh kai-core-test.mjs   # just one
#
# A stale process holding a port serves the OLD code and quietly turns a
# regression run into a lie, which is why each suite starts from a clean slate.
# Every suite spawns its own server on its own port with its own KAIRO_DATA_DIR,
# so none of them can see another's data.
#
# Browser suites need playwright-core, which is a DEV dependency and
# deliberately not one of Kairo's — the product ships with none:
#
#   cd test && npm i playwright-core
#
# Without it those suites say so and stand down rather than failing.
cd "$(dirname "$0")/.." || exit 1
HERE="$(cd "$(dirname "$0")" && pwd)"

SUITES=("$@")
if [ ${#SUITES[@]} -eq 0 ]; then
  cd "$HERE" || exit 1
  SUITES=(*-test.mjs)
  cd - > /dev/null || exit 1
fi

TOTAL_P=0; TOTAL_F=0; FAILED=""
for t in "${SUITES[@]}"; do
  # Matched with a bracket so the awk process cannot match itself, and killed by
  # pid rather than pattern: `pkill -f "node.*server.js"` also matches the shell
  # that is running this script.
  for pid in $(ps -eo pid,args | awk '/[n]ode .*server\.js/ {print $1}'); do kill -9 "$pid" 2>/dev/null; done
  sleep 0.6
  out=$(timeout 420 node --disable-warning=ExperimentalWarning "$HERE/$t" 2>&1)
  line=$(echo "$out" | grep -E "^[0-9]+ passed, [0-9]+ failed" | tail -1)
  p=$(echo "$line" | sed -E 's/^([0-9]+) passed.*/\1/')
  f=$(echo "$line" | sed -E 's/.* ([0-9]+) failed/\1/')
  [ -z "$p" ] && p=0
  [ -z "$f" ] && { f=1; line="NO RESULT LINE"; }
  TOTAL_P=$((TOTAL_P + p)); TOTAL_F=$((TOTAL_F + f))
  if [ "$f" != "0" ]; then
    FAILED="$FAILED $t"
    printf '❌ %-28s %s\n' "$t" "$line"
    echo "$out" | grep -E "^❌|^💥" | head -12 | sed 's/^/     /'
  elif echo "$out" | grep -q "⚠️  SKIPPED"; then
    printf '⚠️  %-28s skipped\n' "$t"
    echo "$out" | grep -A 1 "SKIPPED" | head -2 | sed 's/^/     /'
  else
    printf '✅ %-28s %s\n' "$t" "$line"
  fi
done

for pid in $(ps -eo pid,args | awk '/[n]ode .*server\.js/ {print $1}'); do kill -9 "$pid" 2>/dev/null; done
echo ""
echo "================================================"
echo "  $TOTAL_P passed, $TOTAL_F failed"
[ -n "$FAILED" ] && echo "  suites with failures:$FAILED"
echo "================================================"
[ "$TOTAL_F" = "0" ] || exit 1
