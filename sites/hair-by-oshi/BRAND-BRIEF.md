# Hair by Oshi — Research & Brand Brief

Everything below was gathered from public sources (Instagram search surfaces, the
Freedom Suites tenant directory, Facebook, YouTube). Items marked **[VERIFY]**
are inferred and should be confirmed by Oshi before launch.

---

## 1. The business

| Field | Value | Source |
|---|---|---|
| Trading name | **Hair by Oshi** | Instagram grid watermark, Facebook |
| Stylist | **Oshi Dias** | Instagram bio line 1 |
| Instagram | [@hair_by_oshi_](https://www.instagram.com/hair_by_oshi_/) | — |
| Profile title | *Oakleigh Hairdresser \| Dark Hair Specialist* | IG profile title |
| Audience | 5,000+ followers · 449 posts | IG profile |
| Facebook | `cuts_colour_oshi` (Melbourne VIC) | Facebook page |
| Location tag | Oakleigh South, Victoria | recent IG posts |
| Studio | Private suite, **Freedom Suites Oakleigh**, 350 Warrigal Rd, Oakleigh South VIC 3167 | Freedom Suites directory + IG signage |
| Booking | **DM on Instagram**, plus a "Book Now" action on the IG profile | IG bio + captions |

### Instagram bio (verbatim)

```
OSHI DIAS
COLOUR + NANOPLASTY + KERATIN
DM TO BOOK
🗓️MON, TUE, FRI & SAT
OAKLEIGH
```

**Working days are therefore Monday, Tuesday, Friday and Saturday.**
Start/finish times are *not* public — **[VERIFY]**.

### The move

Feb 2025 announcement: *"After years of hard work, dedication, and incredible
support from all of you, I'm beyond excited to announce that Hair by Oshi is
moving to a brand-new, permanent location in OAKLEIGH!"* — this is why the site
leans on "the new studio" as a chapter of the story.

---

## 2. Positioning — why this site is not a generic salon site

**"Dark Hair Specialist" is the whole business.** Most Melbourne colourists sell
blonde. Oshi sells the opposite skill: making *dark* hair look expensive —
depth, shine, tone, and the way light travels through it. Her audience is
largely South Asian, Mediterranean and Middle Eastern hair — coarse, dense,
high-pigment hair that most salons either over-bleach or refuse.

The site's creative concept is therefore **"The light in dark hair."**
Dark is not the absence of colour; it is the presence of depth. Every animation
is light moving across a dark surface — exactly like shine travelling across
healthy dark hair.

### Three service pillars (straight from the bio)

1. **Colour** — tonal brunette work, colour correction, grey blending, gloss.
2. **Nanoplasty** — the signature. She uses `#melbournenanoplasty`
   and `#nanoplastyspecialist`. Formaldehyde-free smoothing that keeps movement.
3. **Keratin** — the classic smoothing service she also educates heavily on.

### Her own content pillars (mirror these in copy)

- **Education.** "WHAT IS KERATIN? Keratin makes hair straight by depositing
  keratin protein into…", "Keratin treatments are not a permanent treatment and
  do not affect…", box-dye warnings, "if you are under 40% grey and still using
  a permanent colour…", why colour correction costs more.
- **Transformation.** Before/after, "new hair, new confidence".
- **The person.** *"A little glimpse of the girl behind the chair — building my
  little dream, doing what I love."*
- **Tagline on her own grid:** **HEALTHY HAIR — CONFIDENT YOU.**

---

## 3. Brand system

**Palette — "obsidian & bronze"**

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0A0807` | page base |
| `--ink-2` | `#13100E` | raised panels |
| `--ink-3` | `#1C1714` | image wells |
| `--bronze` | `#C0854F` | primary accent |
| `--gold` | `#E8BE86` | highlights, shine sweep |
| `--cream` | `#F4EDE4` | primary text |
| `--mocha` | `#9A8573` | secondary text — WCAG AA on both backgrounds |

**Type**
- Display: **Cormorant Garamond** — high-contrast editorial serif.
- Body: **Inter** — clean, quiet.
- Eyebrow: Inter, uppercase, wide tracking.

---

## 4. Photography — what is still needed

Instagram images are hotlink-protected and cannot legally or reliably be
scraped, so the site ships with a **named image-slot system**. Every slot is an
empty `<img>` with a documented filename in `assets/img/`. Dropping correctly
named files in makes the whole site come alive with no code changes.

See `assets/img/README.md` for the full shot list.
