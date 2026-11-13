/*
 * Scroll-journey screenshots: walks the page in steps at a phone and a
 * desktop size so every scroll-linked scene can be eyeballed.
 *   node test/shots.cjs            # writes test/shots/*.png
 */
const { launch, TARGET } = require("./pw.cjs");
const path = require("path");
const fs = require("fs");
const OUT = path.join(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });
const SIZES = (process.env.SIZES || "390x844,1440x900").split(",").map((s) => s.split("x").map(Number));

(async () => {
  const browser = await launch();
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 600 ? 2 : 1, hasTouch: w < 600, isMobile: w < 600 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(TARGET, { waitUntil: "networkidle" });
    await page.waitForTimeout(2600); // curtain + hero entrance
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = Math.round(h * (Number(process.env.STEP) || 0.9));
    let i = 0;
    for (let y = 0; y < total; y += step) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT, `${w}-${String(i++).padStart(2, "0")}.png`) });
    }
    console.log(`${w}x${h}: ${i} shots, page ${total}px`, errors.length ? `\n  errors: ${errors.join("\n  ")}` : "no console errors");
    await page.close();
  }
  await browser.close();
})();
