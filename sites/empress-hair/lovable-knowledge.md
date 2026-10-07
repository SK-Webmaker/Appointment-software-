# Project knowledge — Empress Hair

Paste this into the Lovable project's **Knowledge** so any later edit keeps
what was built on purpose.

## What this is
A one-page site for Empress Hair — braids and protective styling in
Melbourne, VIC — built around their four goals (scalp health, clean & low-tox
styling, length retention, comfort & confidence) and their motto
"Quality > Quantity". They book **by Instagram DM only**. There is no booking
system, no backend, no phone or email, no menu, no prices, no address and no
stylist name on purpose — none are public yet. Do not add any unless the
owner confirms them.

## Where things live
- **All business facts and quotes** are in `src/site.config.ts`. Change them
  there only — never hard-code a fact in a component.
- One section per file in `src/components/` (`Hero`, `Goals`, `Marquee`,
  `Products`, `Book`). `Site.tsx` composes them.
- Colours and fonts are tokens in `src/styles.css` (`@theme`): monochrome like
  their black-and-ivory profile mark, with one warm taupe. Cormorant Garamond,
  Alex Brush (goal titles) and Jost are self-hosted.

## Do not change without being asked
- **The motion.** The hero capsule holds their curl; on scroll it glides to the
  centre and their mood board is dealt out around it, then "Quality >
  Quantity" settles; the goal cards stack; the product statement lights word
  by word; the booking arch rises. These are scroll-linked framer-motion
  transforms, not fade-ins.
- **Reduced motion.** Every animated component reads `useReducedMotionSafe()`
  and swaps in static values. Keep that pattern — framer's own hook breaks
  server-side hydration.
- **Timing uses arbitrary Tailwind values** (`ease-[cubic-bezier(0.22,1,0.36,1)]`),
  never custom theme keys.
- **Lenis smooth scroll** (`src/lib/smooth.ts`, desktop only — touch devices
  keep native scrolling): any new modal must call `const release =
  lockScroll()` when it opens and `release()` when it closes, and any
  scrollable panel inside one needs `data-lenis-prevent`.
- **Keep scrolling smooth:** no `blur()` filter glows or `mix-blend-mode` on
  sections that scroll — soft light is a `radial-gradient`. Photos that move
  with the scroll carry `will-change-transform`; don't read layout
  (`getBoundingClientRect`) on every scroll event. Check with
  `test/smooth.cjs` and `test/audit.cjs` (see README).
- **Nothing reads the clock during render** — the footer year is
  `__BUILD_YEAR__`, injected in `vite.config.ts`.
- **Photos are all from their Instagram** (see `public/images/CREDITS.md`).
  Never caption them as client work, and never add stock photos.

## Copy rules
Use their own words. Never invent facts, reviews, prices, hours, a name or an
address. If something isn't in `src/site.config.ts` or `BRAND-BRIEF.md`, ask.
