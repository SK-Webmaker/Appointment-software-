# Project knowledge — LUMBEND One ("insane website")

Paste this into the Lovable project's **Knowledge** so any later edit keeps
what was built on purpose.

## What this is
A one-page concept site for LUMBEND One, a **fictional** real-glass neon desk
lamp, made as a showcase of scroll-driven motion. The footer and the order
sheet say it's a concept; keep them saying so. The order sheet copies an
order to the clipboard and charges or sends nothing — there is no backend.

## Where things live
- **All content** is in `src/site.config.ts` (chapters, manifesto, parts,
  shapes and prices, gases, steps, specs). Never hard-code copy in a component.
- One chapter per file in `src/components/` (`Hero`, `Studio` = why real
  neon, `Inside`, `Shapes`, `Spectrum` = colours, `Process`, `Specs`,
  `Marquee`, `Preorder`, `Footer`). The lamp itself is `Lamp.tsx`.
- Colours and fonts are tokens in `src/styles.css` (`@theme`). The accent
  (`amber`) is `var(--glow)`: the colour of the gas the visitor picks, set on
  `<html>` by `context/booking.tsx`, sodium amber by default.

## Do not change without being asked
- **The motion.** Ignition curtain; pinned hero (lamp cycles shapes, tilts
  with the mouse, swells into light, "Real glass. Real gas. Real glow.");
  manifesto lights word by word; pinned exploded view; pinned sideways shapes
  gallery; pinned colour lesson that recolours the page; process cards stick
  and draw; band skews with scroll speed; magnetic pre-order switch; footer
  wordmark fills with light; click sparks; lights-off flashlight; label
  scramble. These are scroll-linked framer-motion transforms, not fade-ins.
- **Only transform and opacity animate.** Glow is static (text-shadow or
  stacked SVG strokes); flicker is opacity. No `blur()` filters or blend
  modes on scrolling sections. Never read layout on scroll.
- **Sheets overlap on purpose** (`.sheet`, 36px / 48px from 768px).
- **Reduced motion:** read it with `useReducedMotionSafe()`; scroll-driven
  scenes still play, things that move by themselves stop (sparks off too).
- **Lenis on desktop only**; modals call `lockScroll()` and release it.
- **The custom cursor is mouse-only** (`Cursor.tsx`, `html.has-cursor`).
- **No images, on purpose.** Everything is type, light and line.
