# Project knowledge — Sweet Cup World

Paste this into the Lovable project's **Knowledge** so any later edit keeps
what was built on purpose.

## What this is
A one-page site for Sweet Cup World — freshly handcrafted dessert cups made
with love by two sisters in Liverpool, Sydney. Six flavours (Biscoff, Dubai
Chocolate, Pistachio, Mehelebi, Oreo, Coconut), "Dessert cups for any
occasion", pickup or delivery, **orders by Instagram DM only**. No backend,
phone, email, street address or hours on purpose — none are public.

## Where things live
- All facts and quotes are in `src/site.config.ts` (price, flavours,
  occasions). Change them there only — never hard-code a fact in a component.
- One section per file in `src/components/` (Hero, Story, Flavours,
  Occasions, Marquee, Book). `Site.tsx` composes them.
- Colours and fonts are tokens in `src/styles.css`: blush, candy pink,
  raspberry, honey cream, chocolate. Parisienne, Bodoni Moda, Jost.

## Do not change without being asked
- The motion: the cups' capsule glides to centre while four flavours are
  dealt out; every chapter slides over the last as a sheet (`.sheet`,
  negative top margin — overlapping sheets measured smoother; content at the
  very bottom of a section needs 36/48px bottom padding); occasion cards
  stack; quotes light word by word; the order arch rises.
- Reduced motion via `useReducedMotionSafe()`; Lenis on desktop only; modals
  call `lockScroll()`; no blur glows; nothing reads the clock during render.
- Images are all from their Instagram (`public/images/CREDITS.md`); the
  flavour pictures are crops of their own menu board. Never add stock photos.

## Copy rules
Use their words ("we", two sisters). Never invent prices, reviews, hours or
an address. If something isn't in `src/site.config.ts` or `BRAND-BRIEF.md`,
ask.
