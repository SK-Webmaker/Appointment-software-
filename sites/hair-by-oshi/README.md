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

- Hero on one hand-set entrance timeline, released when the loader lifts:
  rule, eyebrow, headline out of its mask, then the photograph opening
  while the headline is still settling
- A pinned statement that lights **character by character** as you scroll
- A draggable before/after slider that nudges itself once on first view
- A gallery that drifts left to right on its own while it is left alone,
  looping seamlessly, and hands straight over to you on touch
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
it's added. The multi-file version is the one to edit; regenerate this one with

```sh
node scripts/build-standalone.cjs
```

The script inlines through a replacement *function* rather than a replacement
string on purpose. A replacement string reads `$$`, `$&` and `$1` as escapes,
which silently rewrote every `$$` helper in `site.js` to `$` and broke the
preloader and the cursor in the inlined copy while the multi-file build stayed
fine. The script now diffs both payloads after substituting and fails if either
came out changed.

## Checking for collisions

Two blocks sitting on top of one another is the failure that screenshots
hide — a card over a paragraph still renders, and at a glance the page looks
whole. `test/overlap-check.cjs` walks every text block and image frame at nine
widths from 320 to 1920 and fails if any two that aren't ancestor and
descendant intersect by more than a small fraction of the smaller one.

```sh
node test/overlap-check.cjs                       # this build
TARGET=https://example.com node test/overlap-check.cjs
```

## Checking for cut-off text

The other failure a screenshot hides: a caption that loses its last word,
or a heading sheared off by a mask it never finished animating out of.
`test/clip-check.cjs` walks every text-bearing element at the same nine
widths and reports two things — text overflowing its own clipped box, and
text painted outside an ancestor that clips. It measures only once every
entrance has settled, because a masked heading and a wiping photograph are
both legitimately clipped while they animate.

```sh
node test/clip-check.cjs
TARGET=https://example.com node test/clip-check.cjs
```

The marquee, the gallery rail and a closed `<details>` are exempt: all
three are clipped by design rather than by accident.

It needs Playwright and a Chromium binary on the machine.

Three exclusions are deliberate: overlays meant to sit above the page (modal,
menu, nav, sticky bar), collapsed `<details>` whose hidden children all report
the same rect, and the before/after comparison, which stacks its two images by
design. Everything else is a real finding.
