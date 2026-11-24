# Tidewell Plumbing (concept)

A one-page site for a **made-up** family plumbing business on Sydney's
Northern Beaches — a showcase of what a trade website can do. Business,
prices, hours, service area timings and phone are fictional (phone from the
ACMA fiction range). Photos: Unsplash (`public/images/CREDITS.md`).

The page, top to bottom:
- **Hero** — a full-width photo of a plumber at work, the promise in one line,
  Book and Call, and four promises underneath (fixed price, two-hour windows,
  same-day urgent jobs, 12-month guarantee).
- **Services** — six photo cards with a "from" price and a Book button, plus a
  renovation quote band.
- **Common problems** — pick a part of the house (photo tabs) and see what
  usually goes wrong there, what it usually costs, and book it.
- **About us** — the family story, what every job includes, and "How a job
  works" in four steps.
- **Recent work** — a photo grid with captions.
- **Before you call** — honest quick checks (hot water, slow drains, running
  toilets, leaks, gas) and what a dripping tap costs in a year.
- **Book** — postcode check, today / a time / a reno quote, and FAQs.

Version 2 (the realistic redesign) replaced the drawn tap-and-drop opening,
the cutaway house and the drip drawing with real photography, and dropped the
intro curtain, chapter rail, numbered chapter labels and marquee.

## Booking
Problem → when (today / a window / a quote) → where (Northern Beaches
postcodes only) → details → job number TW-XXXXX, summary, **Add to
calendar**. Persists in `tidewell.job.v1`. Simulated in `src/lib/slots.ts` —
wire `confirm()` to a real job system to go live.

## Quality gates

```sh
NITRO_PRESET=node_server bun run build && PORT=4300 node .output/server/index.mjs &
export TARGET=http://localhost:4300/
node test/qa.cjs; SITE=tide node test/audit.cjs; node test/a11y-overlays.cjs
node test/hydration.cjs; node test/menu-focus.cjs; node test/imgq.cjs
MODE=desktop node test/smooth.cjs; MODE=phone node test/smooth.cjs
```

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/fa7b5397-76bf-4279-af8e-306647b2180b ("Tidewell Plumbing") |
| Live site | https://tidewell-plumbing.lovable.app |
