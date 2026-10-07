# Empress Hair — website

A premium, scroll-driven one-page site for **Empress Hair** — braids and
protective styling in Melbourne, built around their four goals (scalp health,
clean & low-tox styling, length retention, comfort & confidence) and their
motto, "Quality > Quantity". Booked by Instagram DM.

Built on Lovable's own stack (TanStack Start, React 19, Tailwind v4, Vite 8,
bun) so it runs in a Lovable project unchanged, without spending Lovable
credits to build it.

## Run it

```sh
bun install
bun run dev            # http://localhost:8080
bun run build          # production build (Cloudflare target, as Lovable publishes)
bun run typecheck      # tsc with Lovable's strict flags
```

## Where things live

| | |
|---|---|
| `src/site.config.ts` | **Every fact and quote** — the name, city, Instagram, the four goals. One edit changes the whole site. |
| `src/components/` | `Hero`, `Goals`, `Marquee`, `Products`, `Book`, plus `Nav`, `StrandRail`, `BookingSheet`, `BookingBar`, `Footer`. `Site.tsx` composes them. |
| `src/routes/index.tsx` | Page title, description, social card, JSON-LD. |
| `src/styles.css` | Colour and font tokens (`@theme`), self-hosted fonts, utilities. |
| `public/images/` | WebP in 480–1200 widths, all from their Instagram. Credits: `public/images/CREDITS.md`. |
| `BRAND-BRIEF.md` | All research, with sources and what to confirm. |
| `lovable-knowledge.md` | Paste into the Lovable project's Knowledge. |

## The scroll journey

1. **Opening** — fine strands draw down a black ground; "EMPRESS HAIR"
   arrives, then "Quality > Quantity".
2. **Hero** — "Braids that look after your hair." beside their signature
   curl, in a capsule. As you scroll, the words step back, the capsule glides
   to the centre and the mood board (braids, length, products, coils) is dealt
   out around it; then "Quality > Quantity" settles underneath.
3. **I · Our goals** — "My goals as your stylist": four cards that stack,
   each goal in their own words with the script title from their slides.
4. **II · Clean products** — their station photo in an arch, and "We
   research each and every product and ingredient that touches your head"
   lighting up word by word.
5. **III · Book** — an ivory arch rising out of the dark: pick the days that
   suit you, then the booking sheet writes the DM.

Desktop gets Lenis smooth scrolling and a strand down the left edge that
tracks the chapters; phones keep native scrolling.

## How booking works (the call to action)

Empress Hair books by Instagram DM, with no public menu or prices. So the
site writes the DM for the client:

- **Book** (nav, floating bar, chapter III) opens a sheet: the style she's
  after (in her words), her hair length now, the days that suit her, name.
- **Send on Instagram** copies the finished message and opens their DM thread
  (`ig.me/m/empresshairaus`). It reminds the client to add a photo of her hair
  and her inspo.
- The request survives a reload.

## Before you launch

See "To confirm with Empress Hair" in `BRAND-BRIEF.md` — the stylist's name,
the suburb, the menu and prices (or confirm DM quotes), booking days and
hours, photo permissions, and the domain (`url` in `src/site.config.ts`).

## Deliberately unusual — don't "fix" these

- **No menu, prices, address, hours or stylist name** — none are public yet.
  The site says "we", as their posts do. Add them to `src/site.config.ts`
  when confirmed.
- **The goal photos had their slide titles painted out** (see
  `public/images/CREDITS.md`); the titles are set in type instead.
- **`useReducedMotionSafe()` instead of framer's `useReducedMotion()`** — the
  framer hook reads the preference during the first render, which differs
  from the server render and breaks hydration.
- **The hero capsule starts from a measured layout slot** and then moves by
  transform to the centre of the stage, so the text and buttons never collide
  with it.
- **The curtain is server-rendered** with a CSS fail-safe (`.curtain`) that
  lifts it after 3.4s even if JavaScript never runs.
- **`lockScroll()`** must wrap any new modal: `const release = lockScroll()`
  when it opens, `release()` when it closes. Holds stack, so the curtain, menu
  and sheet can't strand each other.
- **Touch devices get no Lenis** — native momentum scrolling is smoother.
- **No `blur()` glows or blend modes on scrolling sections** — soft light is a
  `radial-gradient`; elements that move with the scroll carry
  `will-change-transform`.
- **Footer year is `__BUILD_YEAR__`** — reading the clock during render breaks
  hydration.

## Quality gates (run before every hand-over)

```sh
NITRO_PRESET=node_server bun run build
HOST=127.0.0.1 PORT=4173 node .output/server/index.mjs &
TARGET=http://127.0.0.1:4173/ node test/qa.cjs              # all gates, 10 widths, booking flow
TARGET=http://127.0.0.1:4173/ node test/a11y-overlays.cjs   # axe with sheet and menu open
TARGET=http://127.0.0.1:4173/ node test/hydration.cjs       # SSR hydration
TARGET=http://127.0.0.1:4173/ node test/audit.cjs           # every link, sticky scene, lock, menu, sheet — desktop + phone + reduced motion
TARGET=http://127.0.0.1:4173/ MODE=desktop node test/smooth.cjs   # frame times while wheel-scrolling
TARGET=http://127.0.0.1:4173/ MODE=phone node test/smooth.cjs     # frame times while finger-swiping, CPU 4x slower
TARGET=http://127.0.0.1:4173/ node test/shots.cjs           # scroll-journey screenshots
```

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/ca2b48cb-91a8-4a0f-8502-36d0d703c43f ("Empress Hair") |
| Live site | https://empress-hair.lovable.app |

The project is a free remix; once GitHub is connected in Lovable, this folder
is pushed into the repo Lovable creates (one normal commit, never a
force-push) and published:

```sh
scripts/push-to-lovable.sh https://github.com/SK-Webmaker/<lovable-repo>.git
```

**Hide the "Edit with Lovable" badge** (Project settings → hide badge) — on
phones it sits over the bottom of the page.
