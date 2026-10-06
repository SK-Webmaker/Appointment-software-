# The Beauty L'atelier — website

A premium, scroll-driven one-page site for **The Beauty L'atelier** —
**Atelier Helena**, Helena's private beauty studio in Doonside, Sydney.
Nails, nail art, lashes, brows, skin and hair; re-opening November–December;
booked by message.

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
| `src/site.config.ts` | **Every business fact** — phone, email, prices, re-opening date, services. One edit changes the whole site. |
| `src/components/` | One file per chapter: `Hero`, `Atelier`, `Menu`, `NailArt`, `Founder`, `Pillars`, `Book`, plus `Nav`, `BookingSheet`, `BookingBar`, `Footer`. `Site.tsx` composes them. |
| `src/routes/index.tsx` | Page title, description, social card, JSON-LD (BeautySalon with the full price list). |
| `src/styles.css` | Colour and font tokens (`@theme`), self-hosted fonts, utilities. |
| `public/images/` | WebP in 480/800/1200/1600 widths. Credits: `public/images/CREDITS.md`. |
| `BRAND-BRIEF.md` | All research, with sources. |
| `lovable-knowledge.md` | Paste into the Lovable project's Knowledge. |

## The scroll journey

1. **Opening** — a short espresso curtain draws the arch from her price list.
2. **Hero** — her real Gel-X Tier 4 set sits in that arch; scrolling opens the
   arch to full screen and "Your beauty, elevated." arrives.
3. **I · The atelier** — her own words light up word by word as you scroll;
   details from her launch post drift at different speeds.
4. **II · The menu** — her full price list as tabs. Tap **+** on any service to
   add it to "your appointment".
5. **III · Nail art** — Tier 1–5 with a gold line that fills as you scroll.
6. **IV · Helena** — her story, timeline and sign-off.
7. **V · The promise** — her three promises as arched cards that stack.
8. **VI · Book** — an ivory arch on champagne satin, like her price list.

Desktop gets Lenis smooth scrolling and a chapter rail down the left edge;
phones keep native scrolling.

## How booking works (the call to action)

There's no booking system — Helena books by message ("DM to book or
enquire"). So the site makes the message for the client:

- Services added from the menu collect in a floating **Book** bar.
- **Request your appointment** opens a sheet with the services, an estimate,
  and optional name / days / notes.
- **Send on Instagram** copies the finished message and opens the DM thread
  (`ig.me/m/thebeautyatelierrr__`); **Text** and **Email** open pre-written;
  **Call** dials.
- The selection survives a reload.

## Before you launch

- [ ] Confirm the **phone** (0413 348 497) and **email**
      (atelierhelena24@gmail.com) — both taken from her 5 Sep 2026 launch
      post. Marked `TODO: confirm` in `src/site.config.ts`.
- [ ] Confirm the **re-opening date** (bio says Nov–Dec) and update
      `reopening` / `reopeningShort`.
- [ ] Prices for **BIAB** and **upper-lip waxing/threading** — she offers
      them but listed no price; they show "On enquiry".
- [ ] What's inside the **Lash package**, **Brows package** and hair
      **Full package** — currently "ask when you book".
- [ ] Whether to publish a **street address** (site says Doonside only) and
      **opening hours** (not public yet, so not shown).
- [ ] Set `url` in `src/site.config.ts` to the real domain (canonical link
      and social cards use it).
- [ ] Replace the Unsplash lash, skin and hair photos with her own work as
      she posts it.

## Deliberately unusual — don't "fix" these

- **Bodoni Moda's optical size is pinned** (`opsz 24`, `.opsz-sm` = 11).
  Automatic sizing makes hairlines vanish: "Helena" read as "I Ielena".
- **Em dashes in big type and the Instagram handle are set in Montserrat** —
  Bodoni's dash and underscore are hairlines that disappear.
- **`useReducedMotionSafe()` instead of framer's `useReducedMotion()`** — the
  framer hook reads the preference during the first render, which differs
  from the server render and breaks hydration. Animated values are swapped
  for static ones at the `style` prop when motion is reduced.
- **The hero photo is clipped to the arch with a measured `clip-path`**, not
  a resized box, so the text and buttons can never collide with it. Until
  it's measured the photo stays fully clipped.
- **The curtain is server-rendered** with a CSS fail-safe (`.curtain`) that
  lifts it after 3.4s even if JavaScript never runs.
- **`lockScroll()`** must wrap any new modal — it stops Lenis as well as the
  page.
- **Footer year is `__BUILD_YEAR__`** — reading the clock during render breaks
  hydration.

## Quality gates (run before every hand-over)

```sh
NITRO_PRESET=node_server bun run build
HOST=127.0.0.1 PORT=4173 node .output/server/index.mjs &
TARGET=http://127.0.0.1:4173/ node test/qa.cjs              # all gates, 10 widths
TARGET=http://127.0.0.1:4173/ node test/a11y-overlays.cjs   # axe with sheet and menu open
TARGET=http://127.0.0.1:4173/ node test/hydration.cjs       # SSR hydration
TARGET=http://127.0.0.1:4173/ node test/shots.cjs           # scroll-journey screenshots
```

`test/qa.cjs` checks, at 320–1920px: no horizontal overflow, no clipped or
overlapping text, tap targets ≥ 40px on phones, every image loads with alt
text, WCAG AA contrast on every text node, nothing left invisible under
reduced motion, axe-core, every in-page link has a target — then drives the
booking flow end to end (services → message → Instagram / Text / Email /
Call, clipboard, reload).

Last run: **all checks passed**; Lighthouse desktop 98 performance, 97–100
accessibility / best practices / SEO.

## Getting it into Lovable (no credits)

Lovable can't import an existing repo, but it two-way-syncs the repo it
creates for a project. So:

1. Open the Lovable project **The Beauty L'atelier** → **GitHub → Connect**.
   Lovable creates a repo under `SK-Webmaker`.
2. Push this folder into it:
   `scripts/push-to-lovable.sh https://github.com/SK-Webmaker/<that-repo>.git`
3. Lovable syncs within seconds; **Publish** from the editor.

Pushing never spends credits — only messages to Lovable's agent do.
