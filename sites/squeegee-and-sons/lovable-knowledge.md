# Project knowledge — Squeegee & Sons (concept)

## What this is
A one-page site for a fictional family cleaning business in Sydney's Eastern Suburbs, made to showcase what a cleaning website can do. It must keep saying it's a concept. No backend: prices and free arrival times are simulated in `src/lib/slots.ts`; every fact and price lives in `src/site.config.ts`.

## Do not change without being asked
- **The photo-led layout**: split hero with an example price, services, the price builder and the checklist (they share one clean choice through `context/booking.tsx`), the window before-and-after (labelled as an illustration), our kit photo grid and how booking works. Real photos only (no drawn illustrations; the fogged glass is the photo with grime baked over it, labelled as an illustration in the before-and-after). Motion round (v3): intro curtain, wipe-the-window hero (`FogWindow.tsx`, canvas), bubbles, sparkle trail, SplitText headings, velocity marquee, tilt cards, rolling prices (exact figure kept in an sr-only span for screen readers and tests), pinned kit reel (`#kit`), stacking booking steps, cursor — keep them transforms-only and reduced-motion safe (reduced motion shows clean glass).
- **The booking flow:** clean → how often → when → details → booked (.ics). End-of-lease cleans are one-off only.
- Reduced motion: `useReducedMotionSafe()`; scroll scenes still play. Lenis desktop only; modals call `lockScroll()`.
- No invented reviews, staff names or photos of "the team". The phone stays in the ACMA fiction range and email on `.example` while this is a concept.
- Photos are Unsplash (free licence) — `public/images/CREDITS.md`.
