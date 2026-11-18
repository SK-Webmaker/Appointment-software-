# Jovana Artistry

A one-page site for Jovana, a Sydney makeup, brow and spray tan artist
(@jovanaartistry, studio in Liverpool 2170, mobile by DM). Built from her
Instagram and her public Square booking page — every fact is in
`src/site.config.ts`, every source in `BRAND-BRIEF.md`.

The journey: a blush curtain; her babydoll glam in an arch that glides to the
centre as four more looks fan out, settling on her own line "POV: you just
found your new MUA"; the glam wall; brows with her exact menu; spray tans on
babydoll pink; bridal cards that stack; the full price menu (tap to book);
an arched booking card with both routes — in studio online, mobile by DM.

## Run it

```sh
bun install
bun run dev            # http://localhost:8080
bun run build          # production build (Cloudflare target, as Lovable publishes)
bun run typecheck      # tsc with Lovable's strict flags
```

## Where things live
- `src/site.config.ts` — every fact, price and caption.
- `src/components/` — one file per chapter: Hero, Glam, Brows, Tan, Bridal,
  Menu, Book; plus the booking sheet and floating bar.
- `public/images/` — her photos (credits in `CREDITS.md`).

## How booking works
Pick a service (and in studio or mobile, a date, a name) — the site writes
one message. In studio: "Pick a time online" opens her Square booking page.
Mobile: "Send on Instagram" copies the message and opens her DMs.

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
| Lovable project | https://lovable.dev/projects/52f3c936-96d1-4ed9-9ff8-cc77b338c329 ("Jovana Artistry") |
| Live site | https://jovana-artistry.lovable.app |

The project is a free remix; once GitHub is connected in Lovable, this folder
is pushed into the repo Lovable creates (one normal commit, never a
force-push) and published:

```sh
scripts/push-to-lovable.sh https://github.com/SK-Webmaker/<lovable-repo>.git
```

**Hide the "Edit with Lovable" badge** (Project settings → hide badge) — on
phones it sits over the bottom of the page.
