# Kuvaello Posters — website

A premium, scroll-driven one-page site for **Kuvaello** — custom sports &
cinematic posters made from your own photo. "Where your name becomes art."
Their portfolio, how it works, their prices and FAQ, and an order that
writes itself — or goes straight to their own checkout.

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
| `src/site.config.ts` | **Every fact and quote** — tagline, work, steps, products and prices, FAQ. |
| `src/components/` | `Hero`, `Work`, `How`, `Seen`, `Marquee`, `Pricing`, `Book`, plus `Nav`, `StrandRail`, `BookingSheet`, `BookingBar`, `Footer`. |
| `src/styles.css` | Colour and font tokens, self-hosted fonts, the `sheet` shape. |
| `public/images/` | WebP of their own posters. Credits: `public/images/CREDITS.md`. |
| `BRAND-BRIEF.md` | All research, with sources and what to confirm. |
| `lovable-knowledge.md` | Paste into the Lovable project's Knowledge. |

## The scroll journey

1. **Opening** — floodlight beams draw down a black ground; the Kuvaello
   mark arrives with "Where your name becomes art."
2. **Hero** — "Turn your photo into a sports poster." beside their
   Silventoinen motorsport poster, framed like a print on a gallery wall. On
   scroll it glides to the centre and four more posters are dealt out around
   it, then "Where your name becomes art" settles. It plays for everyone,
   "Reduce motion" included.
3. **I · The work** — six posters on a dark wall, captioned sport · style.
4. **II · How it works** — "Do not leave your best moment on your phone."
   and their three steps.
5. **III · Made to be seen** — on amber: DUO, the gift, the team wall, the
   framed piece, as cards that stack.
6. **IV · Pricing** — their five products (tap one to choose it) and their FAQ.
7. **V · Create yours** — a poster frame rising out of the dark: pick a
   product, then the sheet writes the order — or "Order & pay online" goes
   to their own checkout.

The standard every site meets is in [`../PLAYBOOK.md`](../PLAYBOOK.md).

## How ordering works

The order sheet asks what their own form asks: product, name on the poster,
number, sport, team colours or request, a way to reach you. **Send on
Instagram** copies the message and opens `ig.me/m/kuvaello_posters`; **Send
by email** opens it as an email to info@kuvaelloposters.fi. The photo goes
with it. Payment stays on their own site.

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
| Lovable project | https://lovable.dev/projects/6a7beab8-b67b-447f-9c82-18dfe60bad4b ("Kuvaello Posters") |
| Live site | https://kuvaello-posters.lovable.app |

The project is a free remix; once GitHub is connected in Lovable, this folder
is pushed into the repo Lovable creates (one normal commit, never a
force-push) and published:

```sh
scripts/push-to-lovable.sh https://github.com/SK-Webmaker/<lovable-repo>.git
```

**Hide the "Edit with Lovable" badge** (Project settings → hide badge) — on
phones it sits over the bottom of the page.
