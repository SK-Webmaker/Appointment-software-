# Studio Estelle — website

A premium, scroll-driven one-page site for **Studio Estelle** — dress and suit
hire in Mulgrave, Melbourne: "Luxury looks without the luxury price tag".
Her price guide, her "garment hire myths" and "bond" explainers in her own
words, and a try-on request that writes itself and is sent by Instagram DM
or email.

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
| `src/site.config.ts` | **Every fact and quote** — name, suburb, sizes, email, prices, myths, bond, booking chips. One edit changes the whole site. |
| `src/components/` | `Hero`, `Estelle`, `Prices`, `Myths`, `Marquee`, `Bond`, `Book`, plus `Nav`, `StrandRail`, `BookingSheet`, `BookingBar`, `Footer`. `Site.tsx` composes them. |
| `src/routes/index.tsx` | Page title, description, social card, JSON-LD. |
| `src/styles.css` | Colour and font tokens (`@theme`), self-hosted fonts, the `sheet`, `capsule` and `arch` shapes. |
| `public/images/` | WebP in 480–1125 widths, all from her Instagram. Credits: `public/images/CREDITS.md`. |
| `BRAND-BRIEF.md` | All research, with sources and what to confirm. |
| `lovable-knowledge.md` | Paste into the Lovable project's Knowledge. |

## The scroll journey

1. **Opening** — silk ribbons draw down a chocolate ground; her "Studio
   ESTELLE" logo arrives with her tagline.
2. **Hero** — "Luxury looks without the luxury price tag." beside the Nara
   in a capsule, like a long mirror. As you scroll, the words step back, the
   mirror glides to the centre and her rail (the red gown, the Nara from
   behind) is dealt out around it; then "Any event deserves the right outfit"
   settles underneath.
3. **I · Meet Estelle** — her fitting room in an arch; "I've always loved
   getting dressed up…" lights word by word.
4. **II · Price guide** — her prices set like a boutique price list, beside
   her rail.
5. **III · Hire myths** — on the pink of her myth posts: four cards that
   stack, each myth and its reality in her words; then a band of the events
   she dresses people for.
6. **IV · The bond** — on the mint of her bond posts: "A bond is a safety
   net, not a test." and her four answers.
7. **V · Book a try-on** — an ivory arch rising out of the dark: pick the
   look, then the sheet writes the message.

Every chapter arrives as a **sheet** sliding up over the one before, with an
arched top like her mirror — no hard cuts between colours. Desktop gets Lenis
smooth scrolling and a ribbon down the left edge that tracks the chapters;
phones keep native scrolling.

## How booking works (the call to action)

Studio Estelle books try-ons by Instagram DM ("Please dm me to book a try
on") or email. So the site writes the message for the client:

- **Book a try-on** (nav, hero, floating bar, chapters II and V) opens a
  sheet: the event, its date, the look (mini, midi, gown, suit), her size
  (4–14), a piece she's seen, her name.
- **Send on Instagram** copies the message and opens Estelle's DM thread
  (`ig.me/m/studio.estelle_`). **Or email** opens the same message as an
  email to studio.estelle.vic@gmail.com.
- The request survives a reload.

## Before you launch

See "To confirm with Estelle" in `BRAND-BRIEF.md` — the price guide, her
T&Cs, try-on times, photo permissions, and the domain (`url` in
`src/site.config.ts`).

## Deliberately unusual — don't "fix" these

- **Sections overlap.** Each chapter is a `.sheet` with a negative top margin
  (36px, 48px from 768px) that slides over the previous chapter's bottom
  padding. The hero's last scene and the marquee carry exactly that much
  bottom padding so nothing is covered. Keep the padding if you move things.
- **The person wearing a dress is never named** — her first drop was
  modelled by friends (see `public/images/CREDITS.md`).
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
  `will-change-transform`. The myth card photos sit still inside their cards
  (one layer per card) so the stack stays smooth.
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
TARGET=http://127.0.0.1:4173/ node test/menu-focus.cjs      # mobile menu keeps focus, Escape returns it
TARGET=http://127.0.0.1:4173/ node test/imgq.cjs            # every photo sharp at phone, tablet, laptop, desktop
TARGET=http://127.0.0.1:4173/ node test/shots.cjs           # scroll-journey screenshots
TARGET=http://127.0.0.1:4173/ node test/flow.cjs            # the hero scene frame by frame + every chapter hand-off
```

The full standard — and the pass marks for each gate — is in
[`../PLAYBOOK.md`](../PLAYBOOK.md).

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/a9916ff5-c03e-4bd5-b740-ae07ad56ca98 ("Studio Estelle") |
| Live site | https://studio-estelle.lovable.app |

The project is a free remix; once GitHub is connected in Lovable, this folder
is pushed into the repo Lovable creates (one normal commit, never a
force-push) and published:

```sh
scripts/push-to-lovable.sh https://github.com/SK-Webmaker/<lovable-repo>.git
```

**Hide the "Edit with Lovable" badge** (Project settings → hide badge) — on
phones it sits over the bottom of the page.
