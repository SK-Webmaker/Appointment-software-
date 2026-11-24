# Project knowledge — Tidewell Plumbing (concept)

## What this is
A one-page site for a fictional Northern Beaches plumbing business, made to showcase what a trade website can do. It must keep saying it's a concept. No backend: availability and job booking are simulated in `src/lib/slots.ts`; every fact and price lives in `src/site.config.ts`.

## Do not change without being asked
- **The photo-led layout**: hero photo with Book/Call and four promises, services with "from" prices, common problems by room (photo tabs), About + How a job works, recent work grid, Before you call (quick checks + drip calculator). Real photos only (no drawn illustrations). Motion round (v3): intro curtain, pinned growing-photo opening with ripples, SplitText headings, velocity marquee, tilt cards, stacking job steps, pinned recent-work reel (`#work`), cursor — keep them transforms-only and reduced-motion safe.
- **The booking flow:** problem → when (today / window / reno quote) → postcode and address → details → job booked (.ics).
- Reduced motion: `useReducedMotionSafe()`; scroll scenes still play. Lenis desktop only; modals call `lockScroll()`.
- The phone number stays in the ACMA fiction range and email on `.example` while this is a concept.
- Photos are Unsplash (free licence) — `public/images/CREDITS.md`.
