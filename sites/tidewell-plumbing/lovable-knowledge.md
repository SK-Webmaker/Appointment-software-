# Project knowledge — Tidewell Plumbing (concept)

## What this is
A one-page site for a fictional Northern Beaches plumbing business, made to showcase what a trade website can do. It must keep saying it's a concept. No backend: availability and job booking are simulated in `src/lib/slots.ts`; every fact and price lives in `src/site.config.ts`.

## Do not change without being asked
- **The drop hero** (SVG tap, a drop that falls on scroll, rings and a wave — transforms and opacity only, no CSS filters).
- **The cutaway house** (rooms → problems → prices → Book), the drip calculator, the DIY-or-call quiz.
- **The booking flow:** problem → when (today / window / reno quote) → postcode and address → details → job booked (.ics).
- Reduced motion: `useReducedMotionSafe()`; scroll scenes still play. Lenis desktop only; modals call `lockScroll()`.
- The phone number stays in the ACMA fiction range and email on `.example` while this is a concept.
- Photos are Unsplash (free licence) — `public/images/CREDITS.md`.
