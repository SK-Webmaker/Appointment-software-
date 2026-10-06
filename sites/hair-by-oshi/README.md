# Hair by Oshi — website

A premium, scroll-driven one-page site for **Hair by Oshi** — Oshi Dias,
colourist and Nanoplasty specialist for dark, thick hair, in her private suite
at Freedom Suites Oakleigh, Melbourne. Booked by Instagram DM, Mon · Tue ·
Fri · Sat.

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
| `src/site.config.ts` | **Every fact and quote** — days, address, services, her words, the Nanoplasty facts, the gallery captions. One edit changes the whole site. |
| `src/components/` | One file per chapter: `Hero`, `Oshi`, `DarkHair`, `Work`, `Nanoplasty` (+ `Compare`), `Always`, `YourTime`, `Book`, plus `Nav`, `StrandRail`, `BookingSheet`, `BookingBar`, `Footer`. `Site.tsx` composes them. |
| `src/routes/index.tsx` | Page title, description, social card, JSON-LD (HairSalon with her services). |
| `src/styles.css` | Colour and font tokens (`@theme`), self-hosted fonts, utilities. |
| `public/images/` | WebP in 480–1200 widths, all from her Instagram. Credits: `public/images/CREDITS.md`. |
| `BRAND-BRIEF.md` | All research, with sources and what to confirm. |
| `lovable-knowledge.md` | Paste into the Lovable project's Knowledge. |

## The scroll journey

1. **Opening** — three strands of light draw down an espresso ground; her
   script "Oshi" and the heart arrive.
2. **Hero** — "Healthy hair. Confident you." (her tagline) beside Oshi
   herself, in a capsule. Scrolling opens the capsule to full screen and she
   dissolves into her work — glossy dark hair — as "Beautiful hair starts with
   honesty" arrives.
3. **I · Oshi** — "Kinda chic for a Sri Lankan girl building her little dream
   in Melbourne", her story, and two moments from her feed.
4. **II · Dark hair** — "I specialise in dark, thick hair…" lights up word by
   word; strands of light draw themselves across the page.
5. **III · The work** — the page pins and her colour work travels sideways as
   you scroll (honey blonde, cherry red, glossy brunette, summer tones…),
   each with her own caption.
6. **IV · Nanoplasty** — a before/after you can drag; a hair cross-section
   that nano-particles travel into (cuticle, cortex, medulla); wash → blow dry
   → seal; the 4–6 month timeline; aftercare.
7. **V · Always** — "Things I'll always do as your hairdresser…", four cards
   that stack.
8. **VI · Your time** — her suite, and "I'll match your vibe": pick chat,
   work, Netflix or quiet and it goes into the booking message.
9. **VII · Book** — a cream capsule rising out of the dark.

Desktop gets Lenis smooth scrolling and a strand of hair down the left edge
that tracks the chapters; phones keep native scrolling.

## How booking works (the call to action)

Oshi books by Instagram DM only — no phone, no email, no prices. So the site
writes the DM for the client:

- Services can be added from the Nanoplasty chapter and the Book chapter;
  days and the appointment vibe are picked on the page too.
- **Book** (nav, floating bar, chapter VII) opens a sheet: services, hair
  length and texture, hair history (box dye, bleached…), days, vibe, name.
- **Send to Oshi on Instagram** copies the finished message and opens her DM
  thread (`ig.me/m/hair_by_oshi_`). It reminds the client to add a photo of
  their hair — "your starting point matters".
- The request survives a reload.

## Before you launch

See "To confirm with Oshi" in `BRAND-BRIEF.md` — the address line / suite
number, her start and finish times, Nanoplasty longevity (4–6 vs 3–6 months),
whether to list cuts, and the domain (`url` in `src/site.config.ts`).

## Deliberately unusual — don't "fix" these

- **No keratin** anywhere — removed at the owner's request.
- **No prices** — she quotes by message.
- **`useReducedMotionSafe()` instead of framer's `useReducedMotion()`** — the
  framer hook reads the preference during the first render, which differs
  from the server render and breaks hydration.
- **The hero photo is clipped to the capsule with a measured `clip-path`**,
  not a resized box, so text and buttons never collide with it. Oshi's
  portrait layer follows the same measured edges, then fades out.
- **No bold purple.** The palette is tonal on purpose (the owner's call);
  her logo's purple survives only as a muted mauve heart.
- **The gallery's height is measured** (`Work.tsx`): the section is as tall as
  the sideways travel. With reduced motion it is a swipeable row instead.
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
booking flow end to end (Nanoplasty → vibe → Colour + Saturday → sheet → hair
details → message → Instagram + clipboard → reload).

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/9cc284d6-0632-4c6b-b1b8-db9eb5105829 ("Oshi's Dark Radiance") |
| Live site | https://hair-by-oshi.lovable.app |
| Synced repo | `SK-Webmaker/hair-by-oshi` (`main` syncs both ways) |

The project is connected to GitHub; this folder is pushed into the repo
Lovable created. Pushing never spends credits — only messages to Lovable's
agent do. To push a new version from this folder:

```sh
scripts/push-to-lovable.sh https://github.com/SK-Webmaker/hair-by-oshi.git
```

Then **Publish** in Lovable. Edits made inside Lovable land in that repo —
pull them back here before working locally.

**Hide the "Edit with Lovable" badge** (Project settings → hide badge) — on
phones it sits over the bottom of the page.
