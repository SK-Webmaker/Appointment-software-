# Saltbush Landscapes (concept)

A one-page site for a **made-up** native garden designer in Sydney's Hills
District — a showcase of what a landscaping website can do. Business,
prices, hours and phone are fictional (phone from the ACMA fiction range).
Plant notes are general gardening knowledge, not advice for a particular
garden. Photos: Unsplash (`public/images/CREDITS.md`).

The page, top to bottom:
- **Hero** — a full-width photo of a native garden, what we do in one line,
  Book a free site visit and Call, and four promises underneath.
- **Services** — garden design, landscape construction, planting and garden
  care, each with a photo, a price guide and a Book button.
- **How we work** — site visit, drawn plan and fixed price, build, aftercare,
  each with a photo.
- **Projects** — a photo grid of recent gardens with what was planted.
- **Plants we love** — seven natives with real photos, height, light and
  flowering months; save them to a list that comes to the site visit.
- **Pricing** — a rough guide (size, job, look, extras) with a photo of that
  kind of job.
- **Book a site visit** — postcode check, the four jobs, FAQs.

Version 2 (the realistic redesign) replaced the drawn, scroll-grown garden,
the drawn plant cards, the flower-calendar dial and the drawn estimate plan
with real photography, and dropped the intro curtain, chapter rail, numbered
chapter labels and marquee. The plant guide now only lists plants whose
photos are clearly identified.

Version 3 (the motion round, made for screen recordings) keeps the real
photos and the booking flow and adds: a 0–100 intro curtain; a pinned
opening where the garden shows through a huge cut-out "NATIVE" and the
camera flies through the "I" until the garden fills the screen; gum leaves
drifting down; headings that type in; a speed-reactive marquee of plant
names; tilting service and plant cards with photos that wipe in; "How we
work" as stacking photo cards that shrink back as the next arrives; projects
as a pinned sideways reel; the price guide rolling between figures; a mouse
spotlight on Book; a giant "Saltbush" in the footer; custom cursor and
magnetic buttons.

Shared motion kit in `src/components/fx/`: intro counter and split curtain (Preloader), custom cursor, magnetic buttons, letter-by-letter headings (SplitText), speed-reactive word marquee, 3D tilt cards, wipe-in photos (RevealImg), pinned sideways gallery (HScroll), counters and rolling prices (Counter, Tween), scroll progress bar, mouse spotlight. Everything is transforms-only, mounts only while on screen, and calms down under reduced motion (no cursor, no curtain wipe, no decorative loops).

## Booking
Project → garden (size, look, postcode, address) → visit (day and start
time) → details (with the plant list and an optional photo) → reference
SB-XXXXX, summary, **Add to calendar**. Persists in `saltbush.visit.v1`.
Simulated in `src/lib/slots.ts` — wire `confirm()` to a real diary to go
live.

## Quality gates

```sh
NITRO_PRESET=node_server bun run build && PORT=4300 node .output/server/index.mjs &
export TARGET=http://localhost:4300/
node test/qa.cjs; SITE=salt node test/audit.cjs; node test/a11y-overlays.cjs
node test/hydration.cjs; node test/menu-focus.cjs; node test/imgq.cjs
MODE=desktop node test/smooth.cjs; MODE=phone node test/smooth.cjs
```

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/97a92de9-4972-4368-814e-f9eb24de8170 ("Saltbush Landscapes") |
| Live site | https://saltbush-landscapes.lovable.app |
