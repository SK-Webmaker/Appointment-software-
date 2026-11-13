---
name: colour-palettes
description: Build a colour palette that complements itself for a website, from the brand's own material to tested tokens. Use whenever a site in sites/ is started or recoloured, when choosing an accent, tints, dark/light chapters or glow colours, or when a page "looks off" colour-wise.
---

# Colour palettes that complement each other

Learned from web designers who teach colour on short videos (notably
@bymarcoperez: "an accent colour brings personality to web design"; he gives
away full palettes with every design), together with the colour systems in
`../style-references/`. The aim: few colours, each with a job, all from
one family, with one accent that gives the page its personality.

## 1. Start from the brand, not a colour wheel

- Sample the brand's own colours: logo, packaging, products, the dominant
  tones of their Instagram grid. Those are the anchors; never fight them.
- Pick ONE **brand hue**. Everything else is derived from it.
- Name each colour after what it is in their world (Ember Rust, Bone, Tiger
  Gold): names keep roles clear in code and in conversation.

## 2. The roles (60 · 30 · 10)

| Share | Role | Rule |
|---|---|---|
| ~60% | **Canvas** | Never pure #fff or #000. Tint it toward the brand hue (bone #e8e6e0, void #090909 with a hint of the hue, rust #823513). The tint is what makes a page feel designed instead of default. |
| ~30% | **Ink + surfaces** | Text colour and 2–3 surface steps of the *same* hue, darker or lighter than the canvas (page → card → deepest). Depth comes from these steps, not from grey shadows. |
| ≤10% | **Accent** | The one saturated colour. Calls to action, active states, one signature moment per chapter (a word, a glow, a band). Rationed like signal lighting: if it's everywhere it stops meaning anything. |
| rare | **Heat colour** | Optional second accent for alerts or one badge only (Hungry Tiger's chili red). Never a second theme. |

## 3. Choosing the accent

- **Complementary** (opposite on the wheel: violet ↔ amber, blue ↔ orange,
  green ↔ magenta) for maximum punch on a tinted canvas of the other hue.
- **Analogous** (neighbours: rust → saffron → gold) for warm, calm, premium
  brands; contrast then comes from lightness, not hue.
- **Split-complementary** when a pure complement feels loud: the two
  neighbours of the complement, one as accent, one as the rare heat colour.
- The accent must work on the canvas: ≥ 3:1 as a fill or icon, ≥ 4.5:1
  if text sits in it or is written in it.

## 4. Making the ramp

- Build tints and shades in **OKLCH** (`oklch(L C H)`): keep H fixed, step L
  evenly, lower C near white and black. Colours stay the same hue instead of
  going muddy (grey) or chalky (pastel) the way HSL ramps do.
- 5 steps per hue is enough for a one-page site: deepest, deep, base, light,
  lightest.
- Neutrals are the brand hue at very low chroma (C 0.005–0.02), never true
  grey.

## 5. Light and dark chapters

- Alternate tinted-light and tinted-dark chapters for rhythm; one
  full-bleed accent band per page is a statement (Outsource's indigo, New
  Form's green band).
- Don't invert colours for dark: on dark, raise the accent's lightness a
  touch; on light, lower its chroma a touch so it doesn't vibrate.
- Text on dark is the canvas colour of the light chapters (bone on void),
  so the two modes feel like one family.

## 6. Glow, shadow and photos

- Glows and shadows take the **accent's hue** (`rgba(16,94,29,.45)` under a
  green button), never grey. A glow is a `radial-gradient` of the accent
  fading to transparent, not a `blur()` filter.
- Bring photos into the palette when they clash: a duotone or tint layer
  (`mix-blend` only on still sections, or bake it into the image) so every
  picture reads as part of the system.
- Gradients run between neighbours on the ramp (or accent → its own light
  tint), never across the wheel through grey.

## 7. Check before shipping

```
node .claude/skills/colour-palettes/scripts/contrast.mjs --css src/styles.css
node .claude/skills/colour-palettes/scripts/contrast.mjs "#f4efe6" "#0a0812"
```

- Body text ≥ 4.5:1, large text and UI parts ≥ 3:1 (the qa gate also checks
  this in the browser).
- Squint test: blur your eyes at a full-page screenshot. You should see the
  canvas, the surface steps, and the accent in only a few places. If the
  accent is a wash, cut it back.
- Write the palette (name, hex, role) into the site's `BRAND-BRIEF.md`.

## Don't

- A second saturated accent "because it looks nice".
- Pure black text on pure white, or grey (#888) secondary text: tint it.
- Grey drop shadows under coloured things.
- Accent used for body copy or for large background washes (except the one
  deliberate band).
- Colours picked per section with no shared hue: the page falls apart into
  separate posters.
