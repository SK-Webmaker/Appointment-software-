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

## The 11 files

| Filename | What it needs to be | Crop | Priority |
|---|---|---|---|
| `hero-oshi.jpg` | **The hero.** Oshi at work, or a striking dark-hair result. Shot wide with room at the top — text sits over the lower-left. Darker frames work best. | landscape, 2400×1600+ | ★★★ |
| `oshi-portrait.jpg` | **Oshi herself.** A real portrait — in the studio, looking at camera or mid-work. This is the trust shot; the whole "Meet Oshi" section rests on it. | portrait 4:5, 1600×2000 | ★★★ |
| `studio.jpg` | The private suite — chair, mirror, the space. Shot with the lights on, wide enough to read as a room. | landscape 5:4, 2000×1600 | ★★★ |
| `svc-colour.jpg` | A dimensional brunette / gloss result. | portrait 4:5 | ★★☆ |
| `svc-nanoplasty.jpg` | A nanoplasty finish — the glossy, smooth one. | portrait 4:5 | ★★★ |
| `work-1.jpg` … `work-6.jpg` | Six best results for the scrolling gallery. Vary them: gloss, nanoplasty, balayage, correction, tone, warm chocolate. | portrait 3:4 | ★★☆ |
| `og-cover.jpg` | Link-preview card for when the site is shared. Usually the hero, re-cropped. | 1200×630 | ★★☆ |

### Notes

- **JPEG, sRGB, under ~400 KB each** after export. Big files are the single
  fastest way to make a beautiful site feel cheap.
- **Shoot/choose dark.** The whole design assumes deep, moody frames. Bright
  white-background photos will fight it.
- **The hero and the portrait matter most.** If only two get done properly,
  make it those — they carry the top of the page and the whole Meet Oshi
  section.
- If a file is missing, nothing breaks. The slot just keeps waiting.

---

## Bulk-downloading everything at once (recommended)

Instagram no longer serves profiles or posts to anyone who isn't logged in —
every public endpoint now returns a login wall, so the photos can't be fetched
programmatically from here. The fastest route is Instagram's own export, which
gives **every photo Oshi has ever posted, at original upload quality, in one
ZIP**:

On Oshi's phone, in the Instagram app:

**Profile → ☰ → Accounts Centre → Your information and permissions →
Download your information → Download or transfer information →
her account → Some of your information → tick *Posts* →
Download to device → Date range: All time → Media quality: High → Submit**

It arrives by email in roughly 10 minutes to a few hours. Inside the ZIP,
`media/posts/` holds the lot.

Even better where they exist: the **originals from her camera roll**, since
Instagram re-compresses everything on upload.

Either way, rename the chosen shots per the table above and drop them into this
folder. Missing files keep rendering as labelled placeholders until then.
