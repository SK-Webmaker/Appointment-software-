# Project knowledge — Gullwing Plumbing (concept)

Paste this into the Lovable project's **Knowledge**.

## What this is
A one-page site for a fictional 24/7 plumber, made to showcase what a trade
website can do. It must keep saying it's a concept. No backend: the job
book is simulated in `src/lib/slots.ts`.

## Where things live
- All facts in `src/site.config.ts`; tokens in `src/styles.css`.
- Archivo (with its width axis) and JetBrains Mono, self-hosted.

## Do not change without being asked
- **The flood hero** (outline headline filling as the water rises — a
  clipped layer sliding up, its contents sliding down: transforms only).
- **Emergency mode**, the flip cards, the gauge, the map, the filling pipe.
- **The job request flow** and its validation.
- Reduced motion: `useReducedMotionSafe()`; scroll scenes still play.
- Lenis on desktop only; modals call `lockScroll()`.
