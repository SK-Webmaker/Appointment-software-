# Kairo SEO plan (16 Nov 2026)

## What the research says for a site like this

kairobookings.com is a young domain with almost no links pointing at it. A
site in that position doesn't win the big searches ("salon booking software")
for months. It wins first on long, specific searches that owners actually type
and that nobody has answered well. Then it needs a few real links and reviews
so Google trusts it for the bigger ones.

- Google's 2024–26 spam policies ("scaled content abuse") punish sites that
  publish lots of near-identical pages to catch searches. City clones such as
  "salon software Sydney/Melbourne/Brisbane…" are exactly that. One useful page
  beats ten thin ones.
- Free software listings (G2/Capterra, Product Hunt, SaaSHub, AlternativeTo,
  Crunchbase) are the usual first links for a new SaaS. Some links don't pass
  ranking value, but they still bring discovery, trust and branded searches.
  Reviews on them matter more than the link.
- Speed, a clean structure and correct tags are table stakes. Kairo already
  has most of them.

Sources: Google Search Central spam policies (March 2024 update),
SaaS-directory guides (dupple.com, witscode.com, 2026), Google AU
autocomplete pulled 16 Nov 2026.

## Audit (16 Nov 2026)

- **Good already:** server-rendered HTML, one H1 per page, FAQ, breadcrumb
  and software schema, a sitemap, robots.txt open to search and AI crawlers,
  `llms.txt`, and Search Console verified by meta tag. Landing pages have
  900–1,000 words each.
- **Fixed today:**
  - The home title named no niche ("Booking, Payments & Client Management
    Software"), and its description was 201 characters, so Google cut it off.
  - `/guide` (which also has an `?app=1` view) and all legal pages had no
    canonical tag.
  - Four links on landing pages pointed to the hidden `/features/*`
    placeholders.
  - Titles now match how owners search ("booking app", "booking system").
  - Screenshots were 6.7 MB and are now 3.4 MB.
- **Speed:** on a throttled phone (1.6 Mbps, 4× CPU) the main content
  appears in about 3.1–3.7 s, with no layout jumping. Real 4G is faster.
  Leave the rest unless Search Console's Core Web Vitals report flags it.

## Keywords (Google AU autocomplete, 16 Nov 2026)

| Searches owners type | Page |
|---|---|
| salon no show policy / fee / template, hairdresser no show fee, nail salon no show policy, salon cancellation and no show policy | `/salon-no-show-policy` (new) |
| salon client record app, client record app free, hairdressing client cards, patch test record form | `/salon-client-record-app` (new) |
| booking app for nail techs, nail salon booking system | `/nail-salon-software-australia` (title retuned) |
| barber booking app, booking software for barbers | `/barber-software-australia` (title retuned) |
| hair salon booking system australia | `/hair-salon-software-australia` (title retuned) |
| beauty salon booking system | `/beauty-salon-software-australia` (title retuned) |
| cheapest booking app for salon, salon software cost | `/salon-software-cost` (title retuned) |
| lash booking app, eyelash booking app | `/lash-and-brow-booking-software-australia` (9 Nov) |

**Left out on purpose:**
- **Mobile hairdresser and makeup artist pages:** Kairo has no travel or
  on-location booking features, so a page would over-claim.
- **Massage booking pages:** Australian therapists expect health-fund
  claiming, which Kairo doesn't do.
- **"Best … software" and "… alternative" pages:** they need competitors
  named, which the house rules forbid.

## Next pages (one a week, weekly run)

1. `/how-to-start-a-lash-business` (autocomplete: "how to start a lash business
   from home", "step by step", "with no money"). This is a genuine checklist:
   ABN, insurance, patch tests, pricing, a booking link. It reaches new solo
   techs at the moment they choose software.
2. A cosmetic-tattoo booking page, but only after checking the app covers
   what they need (consent, patch tests, deposits, healed-result photos).
3. `/switch-salon-software` (already in the weekly backlog).

## Owner to-do (only you can do these)

1. **Google Search Console, 10 min.** Sitemaps → submit
   `https://kairobookings.com/sitemap.xml`. URL Inspection → *Request indexing*
   for `/`, `/salon-no-show-policy`, `/salon-client-record-app`,
   `/salon-booking-software-australia` and `/lash-and-brow-booking-software-australia`.
   Then open *Pages → Why pages aren't indexed* and send me a screenshot.
   If you can't see the property, add it again with the HTML-tag method and
   send me the code. I'll put it on the site.
2. **Bing Webmaster Tools, 2 min:** *Import from Google Search Console*.
   Bing also feeds ChatGPT search and DuckDuckGo.
3. **App Store Connect, 2 min:** set the app's Marketing URL to
   `https://kairobookings.com` and Support URL to
   `https://kairobookings.com/support`. That's a link from apple.com.
4. **Free listings, about 15 min each, best first:** G2 (also covers
   Capterra/GetApp), Product Hunt (launch on a Tue–Thu), SaaSHub,
   AlternativeTo, Crunchbase, then Yellow Pages, True Local and Hotfrog.
   Paste the copy below.
5. **Reviews and links from customers.** Ask your two salons yourself (I
   never contact them) for:
   - a 2-line review on G2 or Product Hunt once the listing is up;
   - an "Online booking by Kairo" link in their website footer or link-in-bio page.
6. **Don't** buy links, pay for "SEO packages" or add city clone pages.

## Listing copy (paste as-is)

- **Name:** Kairo
- **Website:** https://kairobookings.com
- **Tagline:** Salon booking software with no monthly fees
- **Short description:** Booking, deposits, reminders and client records for
  salons, barbers and beauty studios. $400 AUD once or 3 × $150, then $0 a
  month. No commission.
- **Long description:** Kairo is booking software for Australian salons,
  barbers, nail, lash and beauty studios. Clients book from your own link with
  no app or account. You get deposits through your own Stripe account,
  reminders by email or text, a cancellation window, and automatic rules for
  repeat no-shows. Client records hold colour formulas, allergies, patch
  tests, consent and up to eight photos a visit. There's a free iPhone app
  for the team. Instead of a monthly subscription, Kairo costs $400 once or
  three payments of $150, then nothing, with no commission on bookings and a
  full refund within 14 days.
- **Categories:** Salon Software; Appointment Scheduling Software; Spa & Salon
  Management
- **Pricing:** One-time A$400, or 3 monthly payments of A$150 (A$450 total).
  No free plan. 14-day refund.
- **Platforms:** Web (any browser), iPhone
- **Screenshots:** https://kairobookings.com/screenshots/01-dashboard.jpg,
  …/04-calendar-day.jpg, …/09-client-profile.jpg, …/25-phone-booking.jpg
- **Support:** https://kairobookings.com/support
