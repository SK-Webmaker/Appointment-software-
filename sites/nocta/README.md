# NOCTA Light Studio — "insane website"

A concept one-page site for a made-up neon and light studio, built to show
the ceiling of scroll-driven motion: an ignition curtain, a pinned hero
where neon letters lean with the mouse and fly apart as a point of light
fills the room, a manifesto that switches on word by word, a sideways
gallery of neon signs that catch as they reach you, a pinned spectrum lesson
where one tube changes gas, stacking process cards that draw themselves, a
velocity-skewed amber band, a magnetic light switch and a footer wordmark
that fills with light. A custom cursor, magnetic buttons and a live clock
throughout.

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
