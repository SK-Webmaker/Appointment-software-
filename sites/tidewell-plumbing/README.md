# Tidewell Plumbing (concept)

A one-page site for a **made-up** family plumbing business on Sydney's
Northern Beaches — a showcase of what a trade website can do. Business,
prices, hours, service area timings and phone are fictional (phone from the
ACMA fiction range). Photos: Unsplash (`public/images/CREDITS.md`).

The journey:
- **The drop.** A tap hangs over a still tide. Scroll and a single drop
  falls, hits the water and rings spread out — "Little leak or big one,
  we're on our way."
- **Around the house.** A cutaway drawing of a home. Tap a room (or a chip)
  and see what usually goes wrong there and what it usually costs — each with
  its own Book button.
- **That drip.** Set how fast your tap drips; the drawing drips at that speed
  while litres a year, baths a year and dollars on the bill add up.
- **DIY or call?** Two or three taps for an honest answer: try this first, or
  turn the water off and call.
- **Our work.** Two rows of finished bathrooms and kitchens drifting in
  opposite directions.
- **Book.** Check your postcode, then choose today, a two-hour window, or a
  reno quote. Or call.

## Booking
Problem → when (today / a window / a quote) → where (Northern Beaches
postcodes only) → details → job number TW-XXXXX, summary, **Add to
calendar**. Persists in `tidewell.job.v1`. Simulated in `src/lib/slots.ts` —
wire `confirm()` to a real job system to go live.

## Quality gates

```sh
NITRO_PRESET=node_server bun run build && PORT=4300 node .output/server/index.mjs &
export TARGET=http://localhost:4300/
node test/qa.cjs; SITE=tide node test/audit.cjs; node test/a11y-overlays.cjs
node test/hydration.cjs; node test/menu-focus.cjs; node test/imgq.cjs
MODE=desktop node test/smooth.cjs; MODE=phone node test/smooth.cjs
```

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/fa7b5397-76bf-4279-af8e-306647b2180b ("Tidewell Plumbing") |
| Live site | https://tidewell-plumbing.lovable.app |
