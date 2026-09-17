# Hair by Oshi — website

A premium, scroll-driven marketing site for **Hair by Oshi** — Oshi Dias, dark
hair specialist, Oakleigh South, Melbourne.

## What's here

| File | What it is |
|---|---|
| `index.html` | The complete site — one page, semantic, with `HairSalon` JSON-LD |
| `css/site.css` | The full design system and every animation |
| `js/site.js` | The motion engine (preloader, cursor, scroll-linked effects, slider) |
| `BRAND-BRIEF.md` | All research on the business, with sources and what still needs verifying |
| `LOVABLE-PROMPT.md` | A self-contained master prompt to rebuild this in Lovable |
| `assets/img/README.md` | The photography shot list — 14 named slots |

## Running it

It's static with no build step. Open `index.html`, or:

```sh
npx serve .
```

## The design

Concept: **"the light in dark hair."** Dark hair isn't the absence of colour —
it's depth, and the way light moves across it. So the site is near-black and
every animation is light travelling over a dark surface.

Set pieces:

- Hero with masked word reveals and a shine sweep across the italic gold words
- A pinned statement that lights **character by character** as you scroll
- An animated SVG cuticle diagram for the nanoplasty explainer
- A draggable before/after slider that nudges itself once on first view
- A pinned gallery that scrolls horizontally as you scroll down
- Custom lerped cursor, magnetic buttons, hairline scroll progress

Uses native scrolling throughout, so `position: sticky` and anchor links behave.
Fully honours `prefers-reduced-motion` — the pinned sections unpin and all text
shows immediately.

## Before it goes live

1. Add the 14 photos (`assets/img/README.md`). Missing images render as
   on-brand slots naming the file they want, so nothing looks broken meanwhile.
2. Confirm the items marked **[VERIFY]** in `BRAND-BRIEF.md` with Oshi —
   principally her start/finish times and the exact suite number.
3. Point the canonical URL and `og:image` at the real domain.

## `hair-by-oshi-standalone.html`

The same site inlined into one file — open it directly in a browser, no server
needed. Keep it next to the `assets/` folder so the photography resolves once
it's added. The multi-file version is the one to edit.
