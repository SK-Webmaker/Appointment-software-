# Prompt 2 — adding the photos in Lovable

Once you have the 14 files, do this in Lovable.

## Step 1 — upload

In the Lovable chat, click the **attach** (paperclip) icon and drag in all 14
images at once. Don't paste them one at a time; the agent handles a batch far
better than a drip feed.

## Step 2 — paste this with the upload

```
I'm attaching the real photography for Hair by Oshi. Put each file into its
matching slot and delete the placeholder fallbacks — they've done their job.

Save them to public/images/ using exactly these names, and wire them up:

  hero-oshi.jpg        → the hero image
  oshi-portrait.jpg    → the "You're not booking a salon, you're booking Oshi" portrait
  studio.jpg           → the studio section
  svc-colour.jpg       → service card 01, Colour
  svc-nanoplasty.jpg   → service card 02, Nanoplasty
  svc-keratin.jpg      → service card 03, Keratin
  ba-1-before.jpg      → the LEFT/clipped side of the before-after slider
  ba-1-after.jpg       → the RIGHT/base side of the before-after slider
  work-1.jpg … work-6.jpg → the six gallery cards, in that order
  og-cover.jpg         → the social share image

Handling, please:

- Keep every existing aspect ratio and crop. The hero is 4:5 on desktop and 4:3
  on mobile; services are 4:5 desktop and 4:3 mobile; the portrait is 4:5;
  studio is 5:4; gallery cards are 3:4; the slider is 16:10 desktop, 3:4 mobile.
  Use object-fit: cover with a sensible object-position — faces must not get
  cropped at the forehead on mobile. Check each one at 390px wide.

- The before/after pair must be rendered at IDENTICAL dimensions and position,
  or the drag slider looks broken. The clipped image needs the same intrinsic
  width as the base image so the two line up as the handle moves.

- Add width and height attributes to every image so nothing shifts while
  loading, lazy-load everything below the fold, and keep the hero eager with
  fetchpriority="high".

- Compress on the way in: max ~1800px on the long edge, JPEG quality ~80,
  target under 400KB each. Serve WebP with a JPEG fallback if that's easy.

- Now that og-cover.jpg exists at a real URL, add the og:image and
  twitter:image meta tags back in, absolute URL.

- Write real alt text describing what's actually in each photo — not the
  filename. For the gallery, describe the hair: "dimensional chocolate brunette
  with a root melt", not "work 1".

- The gallery sits in a dark section, so if any card looks washed out against
  it, a very slight contrast lift is fine. Don't apply heavy filters, and don't
  desaturate — these are colour results, the colour is the product.

Then show me the hero, the portrait, the slider and the gallery at 390px and
1440px so I can check the crops.
```

## Step 3 — check these four things

The agent usually gets this right, but these are the ones worth eyeballing:

1. **The slider.** Drag it. If the two halves jump or misalign, the before and
   after aren't the same size — tell it: *"the before/after images must have
   identical intrinsic dimensions and object-position so they align under the
   handle."*
2. **Faces on mobile.** Portrait crops love to cut foreheads at 390px.
3. **Placeholders gone.** No filename labels left anywhere.
4. **Weight.** If the page got slow, say *"compress the images further, target
   under 300KB each."*
