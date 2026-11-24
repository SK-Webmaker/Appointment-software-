# Project knowledge — Saltbush Landscapes (concept)

## What this is
A one-page site for a fictional native garden designer in Sydney's Hills District, made to showcase what a landscaping website can do. It must keep saying it's a concept. No backend: visit times and estimates are simulated in `src/lib/slots.ts`; every fact, plant and price lives in `src/site.config.ts`.

## Do not change without being asked
- **The photo-led layout**: hero photo with Book/Call and four promises, services, how we work (four steps with photos), projects grid, plants we love (real photos only, plant list), pricing guide. Real photos only (no drawn illustrations). Motion round (v3): intro curtain, pinned fly-through-the-word opening with falling leaves, SplitText headings, velocity marquee, tilt cards, stacking process cards, pinned projects reel (`#projects`), rolling price, cursor — keep them transforms-only and reduced-motion safe.
- **The booking flow:** project → garden → visit → details → booked (.ics), carrying the plant list.
- Reduced motion: `useReducedMotionSafe()`; scroll scenes still play. Lenis desktop only; modals call `lockScroll()`.
- Plant notes stay general and accurate; the phone stays in the ACMA fiction range and email on `.example` while this is a concept.
- Photos are Unsplash (free licence) — `public/images/CREDITS.md`.
