# Demo-site playbook

How every one-page business site in `sites/` is built, polished, checked and
published. A new site starts as a copy of the most recent one (its
components, motion system and `test/` folder), so every improvement carries
forward. Nothing ships until every gate below passes.

## 1. Facts — only theirs

- Read their public Instagram (profile embed, captions, reel covers), plus
  search snippets of their bio and pinned comments. A post counts only if its
  caption is signed by their handle; never borrow another business's details.
- Every fact and quote lives in `src/site.config.ts`, with its source in
  `BRAND-BRIEF.md`. Anything unconfirmed goes on the brief's "To confirm"
  list. Never invent a review, price, hour, address or name.
- Write in their voice ("I" for a solo owner, "we" if their posts say "we").

## 2. Photos — sharp, theirs, honest

- Only their own Instagram photos and reel frames (the sharpest frame of each
  moment). Never stock, never upscaled: export the source's own size plus
  480w (`export_webp.py` refuses to enlarge).
- `sizes` must be at least the displayed width — an `object-cover` photo in a
  tall frame needs more than its box width.
- Alt text describes the piece or the work; never names a model.
- Credits for every file in `public/images/CREDITS.md`.

## 3. Flow and transitions — the standard

The page is one continuous journey. No hard cuts, no jumps, nothing that
stutters.

1. **Opening.** A brand curtain (≤ 1.6 s), server-rendered with a CSS
   fail-safe, skipped under reduced motion. It locks scroll and always
   releases it.
2. **Hero.** A pinned scene driven by the scroll: the signature photo starts
   in a measured layout slot (so it never collides with text), glides to the
   centre, supporting photos are dealt out around it, and a closing line
   settles. The scene's last frame leaves exactly the room the next chapter
   needs.
3. **Chapter hand-offs.** Every chapter after the hero is a `.sheet`: it
   slides up over the one before with a rounded top and a soft shadow (36 px
   overlap, 48 px from 768 px). Whatever sits at the bottom of a section keeps
   that much bottom padding so nothing is ever covered. Dark and light
   chapters alternate; neighbouring colours never meet in a straight line.
4. **Inside a chapter.** Headings rise line by line out of masks; the chapter
   label's rule draws in; one statement per chapter lights word by word;
   framed photos drift gently (parallax) inside their frames; card stacks
   stick and settle back as the next card covers them.
5. **The call to action is always one tap away.** A floating booking bar
   appears after the hero, names what the client has picked, and steps aside
   on the booking chapter and the footer. Nav and menu links glide to their
   chapter and land just under the header.
6. **One motion language.** Easing `cubic-bezier(0.22, 1, 0.36, 1)` for
   everything that arrives, `(0.76, 0, 0.24, 1)` for curtains and menus;
   0.6–1.2 s; nothing bounces or overshoots.
7. **Reduced motion.** Everything static and fully visible from the first
   paint; no pinned scenes; no curtain. Read the preference with
   `useReducedMotionSafe()` (framer's hook breaks hydration).
8. **Performance rules.** Animate only `transform` and `opacity`. No `blur()`
   or blend modes on scrolling sections (soft light is a `radial-gradient`).
   Never read layout on a scroll event — measure on load and resize. One
   composited layer per moving card: don't move a child inside a rounded,
   clipped parent that is itself moving. Lenis smooth scroll on desktop only;
   touch keeps native scrolling. Modals call `lockScroll()` and release it.

## 4. Quality gates — all must pass

Build with `NITRO_PRESET=node_server bun run build`, serve
`.output/server/index.mjs`, then from the site folder:

| Gate | Command | Pass mark |
|---|---|---|
| Layout, contrast, links, booking flow | `node test/qa.cjs` | 0 overflow, clipped, overlapping, small-target, broken-image, invisible and contrast issues at all 10 widths (320–1920); axe 0 violations; every booking step ✓ |
| Accessibility with overlays open | `node test/a11y-overlays.cjs` | 0 violations with the booking sheet and the menu open |
| Hydration | `node test/hydration.cjs` | clean at 390, 1440 and 390 reduced-motion |
| Every feature | `node test/audit.cjs` | all ✓ on desktop, phone and reduced motion (links land, pinned scenes pin, sheet and menu lock and release, bar appears and steps aside) |
| Mobile menu | `node test/menu-focus.cjs` | focus kept inside, Escape closes, focus returns, page unlocked |
| Smoothness | `MODE=desktop node test/smooth.cjs` and `MODE=phone …` (nothing else running) | p50 16.7 ms and layout shift 0 everywhere. Desktop: janky frames (> 34 ms) ≤ 1%, no long tasks. Phone (CPU 4× slower, software rendering — the harsh case): janky ≤ 2% averaged over 3 runs, no chapter above 4%, at most 2 long tasks a run and none over 200 ms (≈ 50 ms on a real phone) |
| Photo sharpness | `node test/imgq.cjs` | no photo shown softer than 1.5× where a larger file would fix it, on phone, tablet, laptop and desktop (exits 1 otherwise); source-limited photos are listed for swapping |
| Eyes on the flow | `node test/flow.cjs` and `node test/shots.cjs` | the hero frames and every chapter hand-off at 375, 768 and 1440 look right: nothing covered, nothing jumps |

Then the same suite against the live URL after publishing.

**Measuring smoothness honestly.** One phone run swings by ±1% on its own,
so never judge a change by a single run, and never measure while anything
else (a build, a type-check, a push) is running. To choose between two
versions, serve both and alternate runs (A, B, A, B, A, B), then compare
the averages. Measured lessons so far: chapters that overlap as sheets
scroll smoother than the same chapters flattened or contained (composited
chapters keep repaints local), and an occasional long task on the throttled
phone appears whatever the layout — it is not a reason to restructure.

## 5. Publishing to Lovable — no credits

1. `remix_project` an earlier site (free) and set placeholder knowledge.
2. The owner connects GitHub in the new project; Lovable creates
   `SK-Webmaker/<slug>`.
3. Clone it, then `sync-lovable.sh`: one normal commit on top of Lovable's
   history that keeps its `AGENTS.md` and `.lovable/` files. Never
   force-push, never rewrite its history.
4. Wait until the project's latest commit is ours, `deploy_project` with the
   slug, paste `lovable-knowledge.md` into the project's knowledge.
5. Check the live bundle matches the local build and run the gates live.

Never call Lovable's `send_message` or `create_project` with a prompt — they
spend credits.

## 6. Hand-over

Tell the owner: hide the "Edit with Lovable" badge (Project settings), and
send the "To confirm" list from `BRAND-BRIEF.md`.
