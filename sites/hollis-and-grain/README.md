# Hollis & Grain Barbers (concept)

A one-page site for a **made-up** barbershop in Newtown, Sydney — built to
show what a barber website can do: a cinematic scroll journey, and a booking
flow that works like the real thing. The business, barbers, prices, hours and
phone number are fictional (the phone is from the ACMA's fiction range).
Photos are from Unsplash (`public/images/CREDITS.md`).

The journey:
- **The shop doors.** HOLLIS and GRAIN on two dark doors, turning
  barber-pole stripes down their edges — scroll and they swing apart onto
  the lamp-lit shop; "Sharp cuts. Hot towels. No rush." comes up from the floor.
- **Sliced headlines.** Every chapter title arrives cut in two: a pole-red
  slash sweeps across, then the halves slide in from opposite sides.
- **The window.** The cuts slide past sideways as you scroll; on a mouse the
  pointer becomes a pair of scissors that snip when you click to book.
- **Three chairs** with each barber's live next-free time ("Take 2:30 pm").
- **The ritual** as cards that stack; a brass band; the price list.
- **The departures board.** Today's free chairs on split-flap tiles that
  clatter into place; tap a time to take it.

## Run it

```sh
bun install
bun run dev            # http://localhost:8080
bun run build          # production build (Cloudflare target, as Lovable publishes)
bun run typecheck      # tsc with Lovable's strict flags
```

## Where things live
- `src/site.config.ts` — every fact: services, prices, barbers, hours, FAQ.
- `src/lib/slots.ts` — the appointment book: opening hours → free times,
  "open now", next free chair, booking reference, calendar file.
- `src/components/` — one file per chapter: Hero, Cuts, Barbers, Ritual,
  Menu (prices), Book; plus BookingSheet and the floating BookingBar.

## How booking works
Service → barber (or first available) → day and time → name and mobile →
booked: a reference (HG-XXXX), a summary and **Add to calendar** (.ics).
Choices persist in `localStorage` (`hollis.booking.v1`). Free times are
simulated deterministically from the date in `lib/slots.ts` — to go live,
replace `isTaken()` with a call to the shop's booking system and send the
confirmed booking to it in `BookingSheet` → `confirm()`.

## Quality gates (run before every hand-over)

```sh
NITRO_PRESET=node_server bun run build
PORT=4300 node .output/server/index.mjs &
export TARGET=http://localhost:4300/
node test/qa.cjs              # 10 widths + the booking flow end to end
SITE=hollis node test/audit.cjs   # links, sticky scenes, locks, menu, sheet — desktop + phone + reduced motion
node test/a11y-overlays.cjs   # axe with the sheet and menu open
node test/hydration.cjs       # SSR hydration
node test/menu-focus.cjs      # mobile menu focus
node test/imgq.cjs            # every photo sharp at every size
MODE=desktop node test/smooth.cjs; MODE=phone node test/smooth.cjs
```

Pass marks: [`../PLAYBOOK.md`](../PLAYBOOK.md).

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/bd9911b6-7ee1-4c51-be0b-3e803078ceb0 ("Hollis & Grain Barbers") |
| Live site | https://hollis-and-grain.lovable.app |
