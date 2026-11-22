# Petalcoat Nail Studio (concept)

A one-page site for a **made-up** nail studio in Surry Hills, Sydney — a
showcase of what a nail studio website can do. The business, artists,
prices, hours and phone are fictional (the phone is from the ACMA's fiction
range). Photos are from Unsplash (`public/images/CREDITS.md`).

The journey:
- **One giant nail.** A fresh set framed in an almond melts into bare lacquer;
  the nail takes the centre and wears six shades as each name sweeps past
  behind it, perfume-ad style.
- **The shade bar.** A drawn hand you dress yourself — shade, finish (gloss,
  matte, chrome, french), shape, length, skin tone — then "Book this look".
- **The sets.** The page turns sideways: recent work slides past in almond
  frames, each with its recipe ("Wear this").
- **Your sixty minutes.** The chapter pins and the scroll winds a clock
  through a gel manicure, step by step.
- The menu (tap to book), and today's board with live free times per artist.

## Run it

```sh
bun install
bun run dev
bun run build
bun run typecheck
```

## Where things live
- `src/site.config.ts` — every fact: services, shades, sets, artists, hours.
- `src/lib/slots.ts` — the appointment book (free times, open now, next free,
  reference, calendar file).
- `src/components/NailHand.tsx` — the drawn hand (shapes, finishes, skin).
- `src/components/` — Hero, Shades, Sets, Care, Menu, Book, BookingSheet.

## How booking works
Service → look (from the shade bar, or "choose in the studio") → artist,
day and time → name and mobile → booked: reference (PC-XXXX), summary and
**Add to calendar** (.ics). Choices persist (`petalcoat.booking.v1`). To go
live, replace `isTaken()` in `lib/slots.ts` and send `confirm()` to a real
booking system.

## Quality gates

```sh
NITRO_PRESET=node_server bun run build
PORT=4300 node .output/server/index.mjs &
export TARGET=http://localhost:4300/
node test/qa.cjs; SITE=petal node test/audit.cjs; node test/a11y-overlays.cjs
node test/hydration.cjs; node test/menu-focus.cjs; node test/imgq.cjs
MODE=desktop node test/smooth.cjs; MODE=phone node test/smooth.cjs
```

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/a406b194-19dc-4399-a268-e41dd7626f89 ("Petalcoat Nail Studio") |
| Live site | https://petalcoat.lovable.app |
