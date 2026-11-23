# Saltbush Landscapes (concept)

A one-page site for a **made-up** native garden designer in Sydney's Hills
District — a showcase of what a landscaping website can do. Business,
prices, hours and phone are fictional (phone from the ACMA fiction range).
Plant notes are general gardening knowledge, not advice for a particular
garden. Photos: Unsplash (`public/images/CREDITS.md`).

The journey:
- **A day in a garden.** Dawn over the Hills, a bed of bare dirt and two
  sandstone rocks. Scroll and the sun crosses the sky while a native garden
  grows — mat rush, kangaroo paws, a banksia in flower, a grass tree, a gum —
  until it's dusk and the stars are out. "Plant it once. Let the weather do
  the rest." All drawn in SVG.
- **Find your plants.** Filter fourteen natives by sun, size and what you
  want from them (birds, salt and wind, hedges, pots); save the ones you like
  to a list that comes with you to the visit.
- **Something in flower, every month.** A radial calendar: each ring is a
  plant, each arc a month it flowers. Turn the dial and that month lights up.
- **Dig into the numbers.** Garden size, the job, the look and extras give a
  rough price, plant count and days on site — while a plan of your plot is
  drawn from above and planted in that style's colours.
- **Gardens we've grown.** Prints that come in crooked and straighten up.
- **Let's walk the garden.** Postcode check and four kinds of job.

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

Performance notes: the opening garden stops rendering (and drops its layers)
once it has scrolled away, and the estimator's dots use a `backwards`
animation fill so they don't stay composited — an earlier `both` fill kept
~140 layers alive and made every frame further down the page slower.

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/97a92de9-4972-4368-814e-f9eb24de8170 ("Saltbush Landscapes") |
| Live site | https://saltbush-landscapes.lovable.app |
