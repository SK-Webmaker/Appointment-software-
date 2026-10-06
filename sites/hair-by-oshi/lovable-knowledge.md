# Project knowledge — Hair by Oshi

Paste this into the Lovable project's **Knowledge** so any later edit keeps
what was built on purpose.

## What this is
A one-page site for Hair by Oshi — Oshi Dias, a colourist and Nanoplasty
specialist for dark, thick hair, in a private suite at Freedom Suites
Oakleigh (Melbourne). She works Mon, Tue, Fri and Sat and books **by
Instagram DM only**. There is no booking system, no backend, no phone or
email, and no prices on purpose — do not add any unless asked.

## Where things live
- **All business facts and quotes** are in `src/site.config.ts`. Change them
  there only — never hard-code a fact in a component.
- One chapter per file in `src/components/` (`Hero`, `Oshi`, `DarkHair`, `Work`,
  `Nanoplasty`, `Always`, `YourTime`, `Book`). `Site.tsx` composes them.
- Colours and fonts are tokens in `src/styles.css` (`@theme`): a soft,
  tonal chocolate / caramel / honey / cream palette taken from her hair work.
  The owner asked for no bold purple — keep it that way (the logo heart is a
  muted mauve, nothing more).

## Do not change without being asked
- **Keratin stays off the site** (the owner asked for it to be removed).
- **The motion.** The hero capsule holds Oshi's portrait; on scroll it glides
  to the centre and her work is dealt out around her like a mood board;
  chapter II draws strands of light; the gallery travels sideways while the page is
  pinned; nano-particles travel into the hair cross-section; the "Always"
  cards stack. These are scroll-linked framer-motion transforms, not fade-ins.
- **Reduced motion.** Every animated component reads `useReducedMotionSafe()`
  and swaps in static values (the gallery becomes a swipeable row). Keep that
  pattern — framer's own hook breaks server-side hydration.
- **Timing uses arbitrary Tailwind values** (`ease-[cubic-bezier(0.22,1,0.36,1)]`),
  never custom theme keys.
- **Lenis smooth scroll** (`src/lib/smooth.ts`): any new modal must call
  `lockScroll(true/false)`, and any scrollable panel inside one needs
  `data-lenis-prevent`.
- **Nothing reads the clock during render** — the footer year is
  `__BUILD_YEAR__`, injected in `vite.config.ts`.
- **Photos are all hers** (see `public/images/CREDITS.md`). Never add stock
  photos captioned as her work.

## Copy rules
Use her own words. Never invent facts, reviews, prices, hours or offers. If
something isn't in `src/site.config.ts` or `BRAND-BRIEF.md`, ask.
