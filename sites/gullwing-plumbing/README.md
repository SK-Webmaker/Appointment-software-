# Gullwing Plumbing (concept)

A one-page site for a **made-up** 24/7 plumber covering Sydney's Inner West
and Eastern Suburbs — a showcase of what a trade website can do. The
business, prices, service area, response times and phone are fictional (the
phone is from the ACMA's fiction range). Photos: Unsplash
(`public/images/CREDITS.md`).

The journey:
- **The flood.** LEAKS DON'T WAIT. stands in outline over a night shot of a
  tap gone wild. Scroll, and water rises up the screen — rolling surface,
  bubbles — filling every letter it passes; then "Neither do we." surfaces.
- **Emergency mode.** One tap floods the whole screen hazard-orange: a giant
  call button, the nearest van's ETA for your postcode, a tick-as-you-go
  checklist (mains off, hot water off…), and "Send a van".
- **What's wrong?** Six problem cards that flip in 3D to the signs and a
  fixed-price range.
- **The price, before the spanner.** A pressure gauge: pick the problem, how
  much, after hours — the needle swings to the fixed-price range.
- **Are we near you?** Postcode checker on a drawn map with vans driving
  their routes; every suburb listed.
- **Call to all fixed.** A pipe beside the four steps fills with water as you read.
- **Get a plumber.** Call, or choose now / a time / a quote.

## Where things live
- `src/site.config.ts` — problems, prices, area postcodes, steps, FAQ.
- `src/lib/slots.ts` — the job book: windows, van ETA, price ranges, status, .ics.
- `src/components/` — Hero, Emergency, Problems, Prices, Area, How, Book,
  BookingSheet.

## How a job request works
Problem → how soon (now / a time / a quote; a time picks a day and a
two-hour window) → where (postcode checked against the area, address) →
details with an optional photo → logged: job number GW-XXXXX; emergencies
get a live ETA ring, booked jobs an .ics. Persists in `gullwing.job.v1`.
To go live, wire `confirm()` and `lib/slots.ts` to a dispatch system.

## Quality gates

```sh
NITRO_PRESET=node_server bun run build
PORT=4300 node .output/server/index.mjs &
export TARGET=http://localhost:4300/
node test/qa.cjs; SITE=gull node test/audit.cjs; node test/a11y-overlays.cjs
node test/hydration.cjs; node test/menu-focus.cjs; node test/imgq.cjs
MODE=desktop node test/smooth.cjs; MODE=phone node test/smooth.cjs
```

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/0d792543-c00a-47be-87ce-5f6cfd14ae66 ("Gullwing Plumbing") |
| Live site | https://gullwing-plumbing.lovable.app |
