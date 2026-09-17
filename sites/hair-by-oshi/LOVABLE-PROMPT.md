# Lovable master prompt — Hair by Oshi

Paste the block below into a new Lovable project as the first message. It is
self-contained: every fact in it was verified from public sources (see
`BRAND-BRIEF.md`). Nothing is invented.

---

Build a world-class, award-tier marketing website for a real Melbourne hair
business. Single page, scroll-driven, cinematic. React + TypeScript + Tailwind +
Framer Motion. Treat this like an Awwwards Site of the Day submission, not a
template.

## The business (all facts verified — do not invent extras)

- **Name:** Hair by Oshi
- **Stylist:** Oshi Dias — she works alone, it is her studio
- **Positioning (this is the whole brand):** *Dark Hair Specialist*. Instagram
  profile title is literally "Oakleigh Hairdresser | Dark Hair Specialist"
- **Services, exactly three:** Colour · Nanoplasty · Keratin
- **Tagline she already uses on her own grid:** "HEALTHY HAIR — CONFIDENT YOU"
- **Studio:** a *private suite* (one client at a time, not a salon floor) at
  Freedom Suites, 350 Warrigal Rd, Oakleigh South VIC 3167. She moved into this
  permanent studio in 2025 after years renting a chair — it is a real milestone
  in her story, use it
- **Days open:** Monday, Tuesday, Friday, Saturday. **Do not invent opening
  times** — only the days are public
- **Booking:** DM on Instagram — @hair_by_oshi_ — she answers them herself.
  There is no online booking system. Every CTA points to
  https://www.instagram.com/hair_by_oshi_/
- **Audience:** 5,000+ followers, 449 posts
- **Do not put prices on the site.** Pricing depends on length, density and
  condition and is quoted in DMs. Say exactly that.

## Creative concept — "The light in dark hair"

Dark hair is not the absence of colour; it is depth, and the way light travels
across it. So: a near-black site where **every animation is light moving over a
dark surface** — gold sweeps, sheens, glints. That's the through-line. Do not
make a generic bright "salon website"; those all sell blonde. This sells the
opposite skill.

## Design system

- **Palette:** ink `#0A0807`, raised `#13100E`, bronze `#C0854F`,
  gold `#E8BE86`, cream `#F4EDE4`, mocha `#9A8573`, hairline `rgba(244,237,228,.12)`
- **Type:** Cormorant Garamond (display, light weights, generous italics for
  accent words) + Inter (body, 300/400). Eyebrows are 11px uppercase with
  `.32em` tracking in mocha.
- **Feel:** editorial fashion magazine. Enormous display type, tight leading
  (~0.95), heavy negative space, thin 1px rules, almost no borders or shadows.
- **Motion easing:** `cubic-bezier(.22,1,.36,1)` for entrances.

## Sections, in order

1. **Preloader** — a single hair-strand SVG path draws itself in gold, "Hair by
   Oshi" fades up, a hairline progress bar fills. Must self-dismiss after ~2.6s
   no matter what — never trap the visitor.
2. **Hero** — full-bleed dark portrait, heavy gradient veil, subtle film grain.
   Headline "Healthy hair. / *Confident you.*" where words mask-reveal upward
   line by line, and the italic gold words get a slow repeating shine sweep
   (animated background-position on background-clip:text). Sub: "Colour,
   nanoplasty and keratin for dark hair — the dense, high-pigment,
   hard-to-shift kind that most salons get wrong." Meta row: Specialty / Studio
   / Days. Vertical "Scroll" cue with a trickling gold line. Image parallaxes on
   scroll.
3. **Marquee** — infinitely drifting italic band: Colour ✦ Nanoplasty ✦ Keratin
   ✦ Colour correction ✦ Gloss & tone.
4. **The craft** — a tall pinned section. One sentence, revealed
   **character by character as you scroll**, dim → cream:
   *"Dark hair is not the absence of colour. It is depth, weight and the way
   light travels through it. Lifting it is easy. Keeping it healthy while you do
   is the entire skill."* This is the signature moment of the site.
5. **Services** — three alternating full-width rows (number / copy / image).
   Nanoplasty carries a "Signature" chip. Images desaturate at rest and bloom
   into full colour on hover. Close with the note that pricing is quoted in DMs.
6. **Nanoplasty, explained** — her differentiator, so give it a whole section.
   An animated SVG diagram: a jagged "lifted cuticle" wave above a smooth
   "sealed" wave, both stroke-drawn on scroll, with a light glint that runs
   along the smooth one. Four columns: What it is / What it is not /
   Nanoplasty vs keratin / Who it's for.
7. **Before & after** — a proper draggable comparison slider (pointer events +
   keyboard arrows + ARIA slider role). When it first scrolls into view it
   should nudge itself once so people understand it's draggable.
8. **The work** — a pinned section where a row of 6 portrait cards scrolls
   **horizontally** as the user scrolls vertically, with the translation lerped
   for a heavy, smooth feel. On mobile this degrades to a snap-scrolling
   carousel.
9. **Meet Oshi** — portrait + story. She specialises in the hair she grew up
   with; the private suite means you're the only client in the room; most of her
   content is teaching. Pull quote, in her own words: *"Building my little
   dream, doing what I love."* Sign off: "Healthy hair, confident you."
10. **The studio** — image + a 4-cell fact grid (Where / Days / Parking / 
    Booking) + "Open in Maps" button.
11. **FAQ** — accordion, written in her actual educational voice: how much will
    it cost, nanoplasty or keratin, will smoothing ruin my curls, can you fix
    box dye, do I need permanent colour if I'm going grey, how do I book.
12. **Book** — big centred "Let's talk about *your hair*", a slow breathing
    radial bronze glow behind it, one large DM button, the days beneath.
13. **Footer** — huge "Hair by Oshi" wordmark in a top-lit gradient, tagline,
    4-column details, copyright.

## Interaction details that make it feel expensive

- Custom cursor: a small cream dot with `mix-blend-mode: difference` that lerps
  toward the pointer and swells into a labelled circle over interactive things.
- Magnetic buttons — they lean toward the cursor and spring back.
- Buttons fill from the bottom on hover via a `::before` panel.
- Nav: transparent at top, blurs and condenses once scrolled, hides on scroll
  down and returns on scroll up.
- Mobile menu opens as a `clip-path: circle()` expansion from the burger, with
  links staggering in.
- Hairline scroll-progress bar at the very top, bronze→gold.
- Reveal-on-enter for everything via IntersectionObserver, with stagger.

## Non-negotiables

- **Use real native scrolling.** Do not transform the whole page for smooth
  scroll — it breaks `position: sticky`, which sections 4 and 8 depend on. Lerp
  the *elements*, not the page.
- **Honour `prefers-reduced-motion`**: unpin the pinned sections, kill the
  parallax and marquee, show all text immediately.
- Fully responsive; no horizontal overflow at 390px.
- Semantic HTML, keyboard accessible, visible focus states, real alt text.
- Add `HairSalon` JSON-LD with the address, the four opening days and the three
  services.

## Images

I will supply the photography. Create them as named slots —
`hero-oshi.jpg`, `oshi-portrait.jpg`, `studio.jpg`, `svc-colour.jpg`,
`svc-nanoplasty.jpg`, `svc-keratin.jpg`, `ba-1-before.jpg`, `ba-1-after.jpg`,
`work-1.jpg`…`work-6.jpg`, `og-cover.jpg` — and make any missing image fall back
to an on-brand placeholder that displays the filename it's waiting for, so the
layout never looks broken before the photos land.
