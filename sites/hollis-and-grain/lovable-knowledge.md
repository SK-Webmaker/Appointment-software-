# Project knowledge — Hollis & Grain Barbers (concept)

Paste this into the Lovable project's **Knowledge** so any later edit keeps
what was built on purpose.

## What this is
A one-page site for a fictional barbershop, made to show what a barber
website can do. It must keep saying it's a concept (footer + booking
confirmation). No backend: availability is simulated in `src/lib/slots.ts`.

## Where things live
- **All facts** (services, prices, barbers, hours, FAQ) in `src/site.config.ts`.
- **The appointment book** in `src/lib/slots.ts` (free times, open now,
  next free chair, .ics). Replace `isTaken()` to connect a real system.
- One chapter per file in `src/components/`; `Site.tsx` composes them.
- Colours and fonts are tokens in `src/styles.css` (`@theme`): bone,
  tobacco black, pole red, brass. Big Shoulders Display, Instrument Serif
  italic, Hanken Grotesk — self-hosted.

## Do not change without being asked
- **The motion.** Pole-stripe curtain; the shop doors parting on scroll onto
  the lamp-lit shop; chapters sliding up as sheets; headings rising line by
  line; ritual cards stacking. Transforms and opacity only (smooth on phones).
- **The booking flow:** service → barber → day/time → details → booked
  (reference + Add to calendar). Steps validate; choices persist.
- **Reduced motion:** `useReducedMotionSafe()`; the opening still plays.
- **Lenis on desktop only**; modals call `lockScroll()`.
- Photos are Unsplash (free licence) — `public/images/CREDITS.md`.
