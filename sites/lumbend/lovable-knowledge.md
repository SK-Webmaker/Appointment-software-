# Project knowledge — NOCTA Light Studio ("insane website")

Paste this into the Lovable project's **Knowledge** so any later edit keeps
what was built on purpose.

## What this is
A one-page concept site for NOCTA, a **fictional** neon and light studio,
made as a showcase of scroll-driven motion. The footer and the commission
sheet say it's a concept; keep them saying so. The brief sheet copies a
brief to the clipboard and sends nothing anywhere — there is no backend.

## Where things live
- **All content** is in `src/site.config.ts` (chapters, manifesto, works,
  gases, steps, commissions). Never hard-code copy in a component.
- One chapter per file in `src/components/` (`Hero`, `Studio`, `Work`,
  `Spectrum`, `Process`, `Offer`, `Marquee`, `Contact`, `Footer`).
- Colours and fonts are tokens in `src/styles.css` (`@theme`): void/night/
  dusk (violet-tinted darks), bone/paper, haze/smoke, one accent amber
  (ember on bone), rare uv. Gas colours only light the pieces themselves.

## Do not change without being asked
- **The motion.** Ignition curtain; pinned hero (letters lean with the mouse,
  spread on scroll, a light fills the room, "Darkness is our canvas."); the
  manifesto lights word by word; the work gallery is pinned and travels
  sideways; the spectrum is pinned and the tube changes gas; process cards
  stick and draw; the amber band skews with scroll speed; the contact switch
  is magnetic; the footer wordmark fills with light. These are scroll-linked
  framer-motion transforms, not fade-ins.
- **Only transform and opacity animate.** Neon glow is a static text-shadow
  (`.neon`, colour from `--tube`); flicker is opacity. No `blur()` filters or
  blend modes on scrolling sections. Never read layout on scroll.
- **Sheets overlap on purpose** (`.sheet`, 36px / 48px from 768px).
- **Reduced motion:** read it with `useReducedMotionSafe()`; scroll-driven
  scenes still play, things that move by themselves stop.
- **Lenis on desktop only**; modals call `lockScroll()` and release it.
- **The custom cursor is mouse-only** (`Cursor.tsx`, `html.has-cursor`).
- **No images, on purpose.** Everything is type, light and line.
