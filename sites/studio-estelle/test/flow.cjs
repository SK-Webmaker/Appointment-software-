/*
 * Flow screenshots — the transitions, frame by frame, for eyeballing:
 *   TARGET=url node test/flow.cjs      # writes test/flow/*.png
 *   - hero-<w>-<pct>: the opening scene at 0–100% of its scroll
 *   - seam-<w>-<chapter>-<75|40>: each chapter's sheet arriving over the last
 * At a small phone, a tablet and a laptop. Every chapter must slide in over
 * the one before with no hard cut, nothing covered, nothing jumping.
 */
const { launch, TARGET } = require("./pw.cjs");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "flow");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await launch();
  for (const [w, h] of [[375, 667], [768, 1024], [1440, 900]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600 });
    await p.goto(TARGET, { waitUntil: "networkidle" });
    await p.waitForTimeout(3000); // curtain + hero entrance
    const scene = await p.evaluate(() => document.getElementById("top").offsetHeight - innerHeight);
    for (const f of [0, 0.15, 0.3, 0.45, 0.62, 0.8, 1]) {
      await p.evaluate((y) => scrollTo(0, y), Math.round(scene * f));
      await p.waitForTimeout(700);
      await p.screenshot({ path: path.join(OUT, `hero-${w}-${String(Math.round(f * 100)).padStart(3, "0")}.png`) });
    }
    // walk the page once so every in-view animation has fired
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += h * 0.7) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(90); }
    const chapters = await p.evaluate(() => [...document.querySelectorAll("main > section[id]")].map((s) => s.id).filter((id) => id !== "top"));
    for (const id of chapters) {
      const top = await p.evaluate((id) => document.getElementById(id).getBoundingClientRect().top + scrollY, id);
      for (const f of [0.75, 0.4]) {
        await p.evaluate((y) => scrollTo(0, y), Math.max(0, top - h * f));
        await p.waitForTimeout(700);
        await p.screenshot({ path: path.join(OUT, `seam-${w}-${id}-${Math.round(f * 100)}.png`) });
      }
    }
    await p.close();
  }
  await b.close();
  console.log(`flow screenshots in ${OUT}`);
})();
