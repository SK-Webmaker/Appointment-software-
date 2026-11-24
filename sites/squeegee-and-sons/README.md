# Squeegee & Sons (concept)

A one-page site for a **made-up** family cleaning business in Sydney's
Eastern Suburbs — a showcase of what a cleaning website can do. Business,
prices, hours, products and phone are fictional (phone from the ACMA fiction
range). Photos: Unsplash (`public/images/CREDITS.md`).

The page, top to bottom:
- **Hero** — what we do and where, Get your price and Call, beside a photo of
  a clean kitchen with a real example price (fortnightly, 2 bed, 1 bath).
  Four promises underneath.
- **Services** — regular, deep and end-of-lease cleaning, each with a photo
  and a "from" price.
- **Prices** — bedrooms and bathrooms, the clean, how often and extras; the
  price per clean, team and time update as you go.
- **What's included** — room tabs and the same clean choice as the price
  (change one, the other follows), ticking off what's in each clean.
- **Window cleaning** — a draggable before-and-after (labelled as an
  illustration) and an "add inside windows" button.
- **Our kit** — photos of what we bring, and how booking works in four steps.
- **Book a clean** — postcode check, the three cleans, FAQs.

Version 2 (the realistic redesign) replaced the scroll-wipe hero with its
drawn squeegee, the glossy price bubble and the drawn bucket with
photography, and dropped the intro curtain, chapter rail, numbered chapter
labels and marquee.

Version 3 (the motion round, made for screen recordings) keeps the real
photos and the booking flow and adds: a 0–100 intro curtain; the hero kitchen
behind steamed-up glass that a squeegee wipes clean in stripes — then you can
wipe it with the mouse or a finger, and the fog creeps back so it loops;
soap bubbles drifting up and popping; a sparkle trail behind the mouse; the
example price counting up; headings that type in; a speed-reactive marquee;
tilting service cards with photos that wipe in; the calculator price rolling
between figures; the before-and-after (now a living room with big windows)
sweeping once on its own; the kit as a pinned sideways reel; how booking
works as stacking cards; a giant "Squeegee" in the footer; custom cursor and
magnetic buttons.

Shared motion kit in `src/components/fx/`: intro counter and split curtain (Preloader), custom cursor, magnetic buttons, letter-by-letter headings (SplitText), speed-reactive word marquee, 3D tilt cards, wipe-in photos (RevealImg), pinned sideways gallery (HScroll), counters and rolling prices (Counter, Tween), scroll progress bar, mouse spotlight. Everything is transforms-only, mounts only while on screen, and calms down under reduced motion (no cursor, no curtain wipe, no decorative loops).

## Booking
Clean → how often → day and arrival time → postcode, address, how we get in
and who you are → reference SQ-XXXXX, summary, **Add to calendar**. The
price rides along at the bottom of every step. Persists in
`squeegee.clean.v1`. Simulated in `src/lib/slots.ts` (`quote()`,
`freeWindows()`) — wire `confirm()` to a real diary to go live.

## Quality gates

```sh
NITRO_PRESET=node_server bun run build && PORT=4300 node .output/server/index.mjs &
export TARGET=http://localhost:4300/
node test/qa.cjs; SITE=sq node test/audit.cjs; node test/a11y-overlays.cjs
node test/hydration.cjs; node test/menu-focus.cjs; node test/imgq.cjs
MODE=desktop node test/smooth.cjs; MODE=phone node test/smooth.cjs
```

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/42c6c66c-1873-423c-bc98-5535c824d942 ("Squeegee & Sons") |
| Live site | https://squeegee-and-sons.lovable.app |
