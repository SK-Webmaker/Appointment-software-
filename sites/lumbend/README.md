# LUMBEND One — "insane website"

A concept one-page site for a made-up product, LUMBEND One, the real-glass
neon desk lamp, built to show the ceiling of scroll-driven motion: an
ignition curtain; a pinned hero where the lamp floats over its own name,
tries on its shapes, tilts with the mouse, then swells until its light fills
the room; a manifesto that switches on word by word; a pinned exploded view
where the lamp comes apart into its five parts and snaps back lit; a
sideways gallery of the five shapes, each catching in a different gas; a
pinned colour lesson where choosing a gas recolours the whole page; stacking
process cards that draw themselves; specs; a velocity-skewed band; a live
configurator with a magnetic glowing switch. Throughout: a custom cursor,
click sparks, a lights-off flashlight mode, scrambling labels, magnetic
buttons and a live clock.

All content lives in `src/site.config.ts`. See `BRAND-BRIEF.md` for the
palette and `sites/PLAYBOOK.md` for the gates.
## Run
```
bun install
bun run dev
```

## Check (from this folder, against a built server)
```
NITRO_PRESET=node_server bun run build
PORT=4300 node .output/server/index.mjs &
TARGET=http://localhost:4300/ node test/qa.cjs
TARGET=http://localhost:4300/ node test/audit.cjs
TARGET=http://localhost:4300/ node test/a11y-overlays.cjs
TARGET=http://localhost:4300/ node test/hydration.cjs
TARGET=http://localhost:4300/ MODE=desktop node test/smooth.cjs
TARGET=http://localhost:4300/ MODE=phone node test/smooth.cjs
```
