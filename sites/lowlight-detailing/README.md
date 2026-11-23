# Lowlight Detailing (concept)

A one-page site for a **made-up** car detailing studio in Alexandria, Sydney —
a showcase of what a detailing website can do. Business, prices, hours and
phone are fictional (phone from the ACMA fiction range). Photos: Unsplash
(`public/images/CREDITS.md`).

The journey:
- **The polish pass.** The car sits tired in a dark bay; scroll and a line of
  light sweeps across it, leaving deep, wet paint behind and a reflection
  gliding over the finish. "Gloss is a decision."
- **Build the detail.** Pick the car (drawn silhouettes), the package and
  extras — the spec sheet counts up the price, the time in the bay, the
  protection and when you'd have the car back.
- **Six stages** on a dark bento wall, each tile's edge drawn in the ceramic shimmer.
- **Watch the water.** A paint panel with beads of water: choose wax,
  sealant or ceramic and drag the months — beads flatten into puddles —
  then rinse the panel and watch them roll off (or not).
- **Book a bay** with live next drop-off times, or the mobile van.

## Booking
Build → studio or mobile (correction/ceramic are studio-only) → day and
time (shows when it's ready) → details → reference LL-XXXX, summary,
**Add to calendar**. Persists in `lowlight.booking.v1`. Simulated in
`src/lib/slots.ts` — wire `confirm()` to a real system to go live.

## Quality gates

```sh
NITRO_PRESET=node_server bun run build && PORT=4300 node .output/server/index.mjs &
export TARGET=http://localhost:4300/
node test/qa.cjs; SITE=lowlight node test/audit.cjs; node test/a11y-overlays.cjs
node test/hydration.cjs; node test/menu-focus.cjs; node test/imgq.cjs
MODE=desktop node test/smooth.cjs; MODE=phone node test/smooth.cjs
```

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/eadd7bc8-4753-4c1c-a943-8ef4aaef0550 ("Lowlight Detailing") |
| Live site | https://lowlight-detailing.lovable.app |
