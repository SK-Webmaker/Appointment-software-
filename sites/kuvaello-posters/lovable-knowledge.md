# Project knowledge — Kuvaello Posters

## What this is
A one-page site for Kuvaello — custom sports & cinematic posters made from
a customer's photo. "Where your name becomes art." Prices: Digital €5, A3
€30, DUO A3 €40, Complete Collection €150, 50 × 70 Premium on request.
Orders: their own checkout at kuvaelloposters.fi (PayPal or card), email
info@kuvaelloposters.fi, or Instagram DM. No backend here on purpose.

## Where things live
- All facts and quotes are in `src/site.config.ts` (work, steps, cards,
  products, FAQ). Change them there only — never hard-code a fact in a
  component.
- One section per file in `src/components/` (Hero, Work, How, Seen,
  Marquee, Pricing, Book). `Site.tsx` composes them.
- Colours and fonts are tokens in `src/styles.css`: paper, black, amber.
  Anton (headlines, uppercase, emphasis in amber not italics) and
  Montserrat, self-hosted.

## Do not change without being asked
- The motion: the hero poster glides to centre while four more are dealt
  out, then "Where your name becomes art" settles; every chapter slides
  over the last as a sheet (`.sheet`, overlapping on purpose — it measured
  smoother); the "made to be seen" cards stack; quotes light word by word.
- The opening plays for everyone, "Reduce motion" included (it is
  scroll-driven; the curtain fades instead of wiping). Don't switch it off
  for reduced motion — on those devices the opening would look broken.
- Lenis on desktop only; modals call `lockScroll()`; no blur glows; nothing
  reads the clock during render; the turning badges are clipped to their
  square.
- Images are their own posters (`public/images/CREDITS.md`). Never add
  stock photos or say anything about the athletes beyond the poster caption.

## Copy rules
Use their words. Never invent prices, delivery promises or reviews. If
something isn't in `src/site.config.ts` or `BRAND-BRIEF.md`, ask.
