# Project knowledge — Saltbush Landscapes (concept)

## What this is
A one-page site for a fictional native garden designer in Sydney's Hills District, made to showcase what a landscaping website can do. It must keep saying it's a concept. No backend: visit times and estimates are simulated in `src/lib/slots.ts`; every fact, plant and price lives in `src/site.config.ts`.

## Do not change without being asked
- **The opening garden** (SVG plants in `PlantArt.tsx` growing on scroll, dawn-to-dusk sky — transforms and opacity only; it stops rendering once scrolled away).
- **The plant finder and plant list**, the year-in-flower dial, the estimator and its drawn plan.
- **The booking flow:** project → garden → visit → details → booked (.ics), carrying the plant list.
- Reduced motion: `useReducedMotionSafe()`; scroll scenes still play. Lenis desktop only; modals call `lockScroll()`.
- Plant notes stay general and accurate; the phone stays in the ACMA fiction range and email on `.example` while this is a concept.
- Photos are Unsplash (free licence) — `public/images/CREDITS.md`.
