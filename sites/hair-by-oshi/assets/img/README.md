# Photography — the shot list

The site is built around **named image slots**. Every slot currently renders as
a branded placeholder that displays the exact filename it is waiting for. Drop a
correctly named file into this folder and it appears automatically — no code
changes, no rebuild.

## Why these aren't already here

Instagram serves its images from a signed, expiring CDN and blocks automated
downloading, so they can't be pulled programmatically — and re-hosting them that
way would break both Instagram's terms and, for client photos, the model
releases Oshi has with the people in them. The right source is Oshi's own camera
roll, which is also where the full-resolution originals live.

## How to get them (easiest route)

On Oshi's phone, in the Instagram app: **Profile → the post → ⋯ → Share to →
Save** (or just pull the originals out of her camera roll, which is better —
Instagram compresses everything on upload). AirDrop / Google Drive them across
and rename per the table.

---

## The 14 files

| Filename | What it needs to be | Crop | Priority |
|---|---|---|---|
| `hero-oshi.jpg` | **The hero.** Oshi at work, or a striking dark-hair result. Shot wide with room at the top — text sits over the lower-left. Darker frames work best. | landscape, 2400×1600+ | ★★★ |
| `oshi-portrait.jpg` | **Oshi herself.** A real portrait — in the studio, looking at camera or mid-work. This is the trust shot; the whole "Meet Oshi" section rests on it. | portrait 4:5, 1600×2000 | ★★★ |
| `studio.jpg` | The private suite — chair, mirror, the space. Shot with the lights on, wide enough to read as a room. | landscape 5:4, 2000×1600 | ★★★ |
| `svc-colour.jpg` | A dimensional brunette / gloss result. | portrait 4:5 | ★★☆ |
| `svc-nanoplasty.jpg` | A nanoplasty finish — the glossy, smooth one. | portrait 4:5 | ★★★ |
| `svc-keratin.jpg` | A keratin smoothing result. | portrait 4:5 | ★★☆ |
| `ba-1-before.jpg` | **Before** — frizz/dullness clearly visible. | landscape 16:10 | ★★★ |
| `ba-1-after.jpg` | **After** — same client, *same angle, same framing, same distance*. The slider only works if the two line up. | landscape 16:10 | ★★★ |
| `work-1.jpg` … `work-6.jpg` | Six best results for the scrolling gallery. Vary them: gloss, nanoplasty, balayage, correction, keratin, warm tone. | portrait 3:4 | ★★☆ |
| `og-cover.jpg` | Link-preview card for when the site is shared. Usually the hero, re-cropped. | 1200×630 | ★★☆ |

### Notes

- **JPEG, sRGB, under ~400 KB each** after export. Big files are the single
  fastest way to make a beautiful site feel cheap.
- **Shoot/choose dark.** The whole design assumes deep, moody frames. Bright
  white-background photos will fight it.
- **The before/after pair matters most.** If only one thing gets done properly,
  make it that pair — matched framing is the difference between convincing and
  amateur.
- If a file is missing, nothing breaks. The slot just keeps waiting.
