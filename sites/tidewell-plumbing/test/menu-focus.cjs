// TARGET=url node test/menu-focus.cjs
// Mobile menu: focus stays inside while tabbing, Escape closes and returns focus to the trigger.
const { launch } = require("./pw.cjs");
(async () => {
  const b = await launch();
  for (const motion of ["reduce", "no-preference"]) {
    const page = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: motion });
    await page.goto(process.env.TARGET || "http://localhost:4173/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3200);
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    await page.waitForTimeout(900);
    const menu = page.getByRole("dialog", { name: "Menu" });
    let inside = true;
    for (const key of [...Array(20).fill("Tab"), ...Array(20).fill("Shift+Tab")]) {
      await page.keyboard.press(key);
      inside = inside && (await menu.evaluate((e) => e.contains(document.activeElement)));
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    const closed = (await menu.count()) === 0;
    const back = await trigger.evaluate((e) => e === document.activeElement);
    const unlocked = await page.evaluate(() => document.documentElement.style.overflow === "");
    console.log(`${motion.padEnd(13)} focus kept inside: ${inside}  closed: ${closed}  focus back on trigger: ${back}  page unlocked: ${unlocked}`);
    await page.close();
  }
  await b.close();
})();
