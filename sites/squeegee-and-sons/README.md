# Squeegee & Sons (concept)

A one-page site for a **made-up** family cleaning business in Sydney's
Eastern Suburbs — a showcase of what a cleaning website can do. Business,
prices, hours, products and phone are fictional (phone from the ACMA fiction
range). Photos: Unsplash (`public/images/CREDITS.md`).

The journey:
- **The wipe.** A kitchen seen through a filthy window — fogged, streaked,
  CLEAN ME written in the grime. Scroll and a squeegee pulls down the glass
  with a wave of suds on its blade, leaving it so clear the window vanishes;
  a few glints, then "So clean, you'll walk into it." Two baked photos and a
  moving clip — transforms only.
- **Your price, right now.** Bedrooms and bathrooms steppers, regular / deep
  / end of lease, how often (with the discount) and extras. The price bubble
  wobbles to each new number, with the team and time beside it.
- **Every room, ticked off.** Room tabs and the same clean choice as the
  price (change one, the other follows); the clipboard ticks itself off and
  shows what a bigger clean would add.
- **What's in the bucket.** A drawn bucket of kit; pick a tool and it lifts
  out while its card slides in.
- **Get your Saturday back.** Postcode check, the three cleans, FAQ.

## Booking
Clean → how often → day and arrival time → postcode, address, how we get in
and who you are → reference SQ-XXXXX, summary, **Add to calendar**. The
price rides along at the bottom of every step. Persists in
`squeegee.clean.v1`. Simulated in `src/lib/slots.ts` (`quote()`,
`freeWindows()`) — wire `confirm()` to a real diary to go live.

## Quality gates

```sh
NITRO_PRESET=node_server bun run build && PORT=4300 node .output/server/index.mjs &
export TARGET=http://localhost:4300/
node test/qa.cjs; SITE=sq node test/audit.cjs; node test/a11y-overlays.cjs
node test/hydration.cjs; node test/menu-focus.cjs; node test/imgq.cjs
MODE=desktop node test/smooth.cjs; MODE=phone node test/smooth.cjs
```

## Lovable (no credits spent)

| | |
|---|---|
| Lovable project | https://lovable.dev/projects/42c6c66c-1873-423c-bc98-5535c824d942 ("Squeegee & Sons") |
| Live site | https://squeegee-and-sons.lovable.app |
