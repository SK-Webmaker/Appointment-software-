# Project knowledge — Studio Estelle

Paste this into the Lovable project's **Knowledge** so any later edit keeps
what was built on purpose.

## What this is
A one-page site for Studio Estelle — dress and suit hire in Mulgrave VIC
3170 (Melbourne), sizes 4–14, "Luxury looks without the luxury price tag".
Estelle books try-ons **by Instagram DM or email**
(studio.estelle.vic@gmail.com). There is no booking system, no backend, no
street address and no opening hours on purpose — none are public. Do not add
any unless the owner confirms them.

## Where things live
- **All business facts and quotes** are in `src/site.config.ts` (prices,
  myths, bond answers, sizes, looks, events). Change them there only — never
  hard-code a fact in a component.
- One section per file in `src/components/` (`Hero`, `Estelle`, `Prices`,
  `Myths`, `Marquee`, `Bond`, `Book`). `Site.tsx` composes them.
- Colours and fonts are tokens in `src/styles.css` (`@theme`): blush, candy
  pink (her myth posts), mint (her bond posts), chocolate brown. Bodoni Moda,
  Parisienne (script) and Jost are self-hosted.

## Do not change without being asked
- **The motion.** The Nara stands in a capsule; on scroll it glides to the
  centre and her rail is dealt out around it, then "Any event deserves the
  right outfit" settles; every chapter slides up over the previous one as a
  sheet with an arched top (`.sheet`); the myth cards stack; quotes light word
  by word; chapter labels draw in; the booking arch rises. These are
  scroll-linked framer-motion transforms, not fade-ins.
- **The sheets overlap on purpose:** `.sheet` has a negative top margin
  (36px, 48px from 768px). Anything placed at the very bottom of a section
  needs that much bottom padding, as the hero's last scene and the marquee
  have.
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
- **Photos are all from her Instagram** (see `public/images/CREDITS.md`).
  Never name the person wearing a dress, and never add stock photos.

## Copy rules
Use her own words, in the first person, as her posts are written. Never
invent facts, reviews, prices, hours or an address. If something isn't in
`src/site.config.ts` or `BRAND-BRIEF.md`, ask.
