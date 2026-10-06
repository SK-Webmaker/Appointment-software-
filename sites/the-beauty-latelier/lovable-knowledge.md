# Project knowledge — The Beauty L'atelier

Paste this into the Lovable project's **Knowledge** so any later edit keeps
what was built on purpose.

## What this is
A one-page marketing site for The Beauty L'atelier (Atelier Helena), a
private beauty studio in Doonside, Sydney, run by Helena. Booking is by
message — Instagram DM, text or email. There is no booking system and no
backend; do not add one unless asked.

## Where things live
- **All business facts** (phone, email, prices, re-opening date, services)
  are in `src/site.config.ts`. Change them there only — never hard-code a
  fact in a component.
- One section per file in `src/components/`. `Site.tsx` composes them.
- Colours and fonts are tokens in `src/styles.css` (`@theme`). Colours are
  sampled from Helena's own price list — keep them.

## Do not change without being asked
- **The motion.** The hero's arch opens to full screen on scroll; the
  statement lights word by word; the promise cards stack; nail-art tiers
  fill a gold line. These are scroll-linked framer-motion transforms, not
  fade-ins. Don't replace them with generic animations.
- **Reduced motion.** Every animated component reads
  `useReducedMotionSafe()` and swaps in static values. Keep that pattern —
  framer's own hook breaks server-side hydration.
- **Bodoni Moda optical size is pinned** (`.font-display { font-variation-settings: "opsz" 24 }`,
  `.opsz-sm` for small text). Automatic optical sizing makes the H in
  "Helena" read as "I I" at large sizes.
- **Em dashes and underscores are set in the sans** inside big Bodoni text —
  Bodoni's versions are hairlines that vanish.
- **Timing uses arbitrary Tailwind values** (`ease-[cubic-bezier(0.22,1,0.36,1)]`),
  never custom theme keys.
- **Lenis smooth scroll** (`src/lib/smooth.ts`, desktop only — touch devices
  keep native scrolling): any new modal must call `const release =
  lockScroll()` when it opens and `release()` when it closes, and any
  scrollable panel inside one needs
  `data-lenis-prevent`.
- **Keep scrolling smooth:** no `blur()` filter glows or `mix-blend-mode` on
  sections that scroll — soft light is a `radial-gradient`. Photos that move
  with the scroll carry `will-change-transform`; don't read layout
  (`getBoundingClientRect`) on every scroll event. Check with
  `test/smooth.cjs` and `test/audit.cjs` (see README).
- **Nothing reads the clock during render** — the footer year is
  `__BUILD_YEAR__`, injected in `vite.config.ts`.
- **Stock photos are never captioned as Helena's work.** Only the nail,
  portrait and detail photos are hers (see `public/images/CREDITS.md`).

## Copy rules
Never invent facts, reviews, hours or an address. If something isn't in
`src/site.config.ts` or `BRAND-BRIEF.md`, ask.
