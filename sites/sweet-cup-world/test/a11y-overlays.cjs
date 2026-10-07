// axe-core with the booking sheet and the mobile menu open.
const { launch, TARGET } = require("./pw.cjs");
const fs = require("fs");
(async () => {
  const axe = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.goto(TARGET, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  let bad = 0;
  const run = async (label) => {
    await page.addScriptTag({ content: axe });
    const v = await page.evaluate(async () => (await window.axe.run(document)).violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`));
    bad += v.length;
    console.log(`${label}: ${v.length ? "\n  " + v.join("\n  ") : "no violations"}`);
  };
  await page.getByRole("button", { name: "Order", exact: true }).click();
  await page.getByRole("dialog", { name: /Your order message/ }).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Pistachio", exact: true }).click();
  await page.getByRole("dialog").getByText("Preview your message").click();
  await page.waitForTimeout(500);
  await run("booking sheet open");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.waitForTimeout(900);
  await run("mobile menu open");
  await b.close();
  process.exit(bad ? 1 : 0);
})();
