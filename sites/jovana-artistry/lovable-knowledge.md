# Project knowledge — Jovana Artistry

Paste this into the Lovable project's **Knowledge** so any later edit keeps
what was built on purpose.

## What this is
A one-page site for Jovana — Sydney makeup, brow and spray tan artist
(@jovanaartistry). Studio in Liverpool 2170, booked online through her
Square booking page; mobile bookings by Instagram DM. That's exactly what
her bio says — keep both routes. No backend.

## Where things live
- **All facts, prices and captions** are in `src/site.config.ts` (from her
  Instagram and her Square page — sources in `BRAND-BRIEF.md`). Never
  hard-code a fact in a component. Never add a street address or her full
  name — she only shows "Liverpool 2170" and "Jovana".
- One chapter per file in `src/components/` (`Hero`, `Glam`, `Brows`, `Tan`,
  `Bridal`, `Menu`, `Book`). `Site.tsx` composes them.
- Colours and fonts are tokens in `src/styles.css` (`@theme`): blush-milk
  canvas, petal and babydoll pink, cocoa ink, one raspberry-rose accent,
  espresso dark chapters. Playfair Display, Pinyon Script (her signature),
  Manrope — self-hosted.

## Do not change without being asked
- **The motion.** Curtain; the hero photo glides from its arch to the centre
  as four more looks fan out, then "POV: you just found your new MUA"
  settles; chapters slide up as sheets; headings rise line by line; the brow
  statement lights word by word; photos drift in their arches; bridal cards
  stack. Scroll-linked framer-motion transforms, not fade-ins.
- **Sheets overlap on purpose** (`.sheet`, 36px / 48px from 768px).
- **Reduced motion:** read it with `useReducedMotionSafe()`; the opening
  scene still plays (it's scroll-driven).
- **Lenis smooth scroll on desktop only**; modals call `lockScroll()`.
- **Photos are all hers** (`public/images/CREDITS.md`). Never name a client,
  never add stock photos.

## Copy rules
Her own words, first person, a little emoji (🤍🎀💗🫧). Never invent
prices, reviews, hours or policies — if it isn't in `src/site.config.ts` or
`BRAND-BRIEF.md`, ask.
