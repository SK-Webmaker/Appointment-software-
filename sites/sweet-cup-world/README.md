# Sweet Cup World — website

A premium, scroll-driven one-page site for **Sweet Cup World** — freshly
handcrafted dessert cups made with love by two sisters in Liverpool, Sydney.
Their six flavours, their story in their own words, and an order request
that writes itself and is sent by Instagram DM.

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
| `src/site.config.ts` | **Every fact and quote** — name, suburb, price, flavours, occasions. One edit changes the whole site. |
| `src/components/` | `Hero`, `Story`, `Flavours`, `Occasions`, `Marquee`, `Book`, plus `Nav`, `StrandRail`, `BookingSheet`, `BookingBar`, `Footer`. `Site.tsx` composes them. |
| `src/styles.css` | Colour and font tokens, self-hosted fonts, the `sheet`, `capsule` and `arch` shapes. |
| `public/images/` | WebP, all from their Instagram. Credits: `public/images/CREDITS.md`. |
| `BRAND-BRIEF.md` | All research, with sources and what to confirm. |
| `lovable-knowledge.md` | Paste into the Lovable project's Knowledge. |

## The scroll journey

1. **Opening** — ribbons draw down a chocolate ground; "Sweet Cup WORLD"
   arrives with "Dessert cups for any occasion".
2. **Hero** — "Dessert cups for any occasion." beside their Biscoff
   cheesecake cups in a capsule; on scroll it glides to the centre and four
   flavours from their menu are dealt out around it, then "Bringing
   sweetness to your door" settles.
3. **I · Our story** — their badge, and "What started as a passion for
   baking between two sisters…" lighting word by word.
4. **II · Flavours** — the six flavours in arched frames; tap to add them to
   your order.
5. **III · For any occasion** — party cups, bee honey jars and "made fresh to
   order" as cards that stack.
6. **IV · Order** — an ivory arch rising out of the chocolate: pickup or
   delivery, then the sheet writes the DM.

Every chapter arrives as a sheet sliding over the last. The standard every
site meets is in [`../PLAYBOOK.md`](../PLAYBOOK.md).

## How ordering works

They take orders by Instagram DM, so the site writes the DM: flavours (also
tappable in chapter II), how many cups, pickup or delivery, the date, the
occasion or theme, a name. **Send on Instagram** copies it and opens
`ig.me/m/sweetcupworld`. The order survives a reload.

## Before you launch

See "To confirm" in `BRAND-BRIEF.md` — price, delivery area, the honey jars,
the menu illustrations, the domain.

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
| Lovable project | https://lovable.dev/projects/4f7269ec-ff34-442a-90bf-11cb6c737787 ("Sweetcup") |
| Live site | https://sweet-cup-world.lovable.app |

The project is a free remix; once GitHub is connected in Lovable, this folder
is pushed into the repo Lovable creates (one normal commit, never a
force-push) and published:

```sh
scripts/push-to-lovable.sh https://github.com/SK-Webmaker/<lovable-repo>.git
```

**Hide the "Edit with Lovable" badge** (Project settings → hide badge) — on
phones it sits over the bottom of the page.
