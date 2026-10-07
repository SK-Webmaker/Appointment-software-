// Screenshots of interactive states and edge sizes, for a visual pass.
const { launch, TARGET } = require("./pw.cjs");
const path = require("path");
const OUT = path.join(__dirname, "shots");
(async () => {
  const b = await launch();
  const shot = (p, n) => p.screenshot({ path: path.join(OUT, `state-${n}.png`) });
  // small phone hero + tablet hero
  for (const [w, h, n] of [[375, 667, "hero-375"], [768, 1024, "hero-768"], [1024, 768, "hero-1024"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.goto(TARGET, { waitUntil: "networkidle" }); await p.waitForTimeout(3000); await shot(p, n); await p.close();
  }
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(TARGET, { waitUntil: "networkidle" }); await p.waitForTimeout(400); await shot(p, "curtain");
  await p.waitForTimeout(2600);
  await p.getByRole("button", { name: "Open menu" }).click(); await p.waitForTimeout(1200); await shot(p, "menu-open");
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  await p.locator("#your-time").scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
  await p.getByRole("button", { name: "A peaceful, quiet one" }).scrollIntoViewIfNeeded();
  await p.getByRole("button", { name: "A peaceful, quiet one" }).click(); await p.waitForTimeout(900); await shot(p, "vibe");
  await p.locator("#book").scrollIntoViewIfNeeded(); await p.locator("#book").getByRole("button", { name: "Nanoplasty", exact: true }).scrollIntoViewIfNeeded();
  await p.locator("#book").getByRole("button", { name: "Nanoplasty", exact: true }).click();
  await p.locator("#book").getByRole("button", { name: "Colour correction", exact: true }).click(); await p.waitForTimeout(900); await shot(p, "book-selected");
  await p.locator("#book").getByRole("button", { name: /Write my booking message/ }).click(); await p.waitForTimeout(1000); await shot(p, "sheet");
  await p.getByRole("dialog").getByText("Preview your message").click(); await p.getByRole("dialog").locator(".overflow-y-auto").evaluate((e) => e.scrollTo(0, 9999)); await p.waitForTimeout(500); await shot(p, "sheet-preview");
  await p.close();
  await b.close();
})();
