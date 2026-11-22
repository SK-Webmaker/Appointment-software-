# Project knowledge — Petalcoat Nail Studio (concept)

Paste this into the Lovable project's **Knowledge**.

## What this is
A one-page site for a fictional nail studio, made to showcase what a nail
website can do. It must keep saying it's a concept (footer + confirmation).
No backend: availability is simulated in `src/lib/slots.ts`.

## Where things live
- All facts in `src/site.config.ts`; the drawn hand in `NailHand.tsx`.
- Tokens in `src/styles.css`: porcelain, cherry lacquer, cherry-black,
  petal pink. Bodoni Moda + Figtree, self-hosted.

## Do not change without being asked
- **The motion:** the hero nail wearing six shades with names sweeping
  behind; the pinned sideways sets wall; the pinned sixty-minute clock.
  Transforms and opacity only.
- **The shade bar** and how a look travels into the booking.
- **The booking flow:** service → look → artist/time → details → booked.
- Reduced motion: `useReducedMotionSafe()`; scroll scenes still play.
- Lenis on desktop only; modals call `lockScroll()`.
