# Project knowledge — Lowlight Detailing (concept)

## What this is
A one-page site for a fictional car detailing studio, made to showcase what a detailing website can do. It must keep saying it's a concept. No backend: availability is simulated in `src/lib/slots.ts`; prices in `src/site.config.ts` (`quote()`).

## Do not change without being asked
- **The polish pass hero** (two baked photos — `hero` and `hero-dull` — the dull one a clipped layer sliding right while its photo slides left: transforms only, no CSS filters).
- **The builder** (live price, time, protection, ready-by), the shimmer-edged stages, the water-bead demo.
- **The booking flow:** build → studio/mobile (correction & ceramic studio-only) → day/time → details → booked.
- Reduced motion: `useReducedMotionSafe()`; scroll scenes still play. Lenis desktop only; modals call `lockScroll()`.
- Photos are Unsplash (free licence) — `public/images/CREDITS.md`.
