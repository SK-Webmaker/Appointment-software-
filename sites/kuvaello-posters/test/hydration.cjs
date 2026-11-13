// Loads the server-rendered page in Chromium and fails on any hydration
// warning or console error (React 19 logs mismatches as errors).
const { launch, TARGET } = require("./pw.cjs");
(async () => {
  const b = await launch();
  let bad = 0;
  for (const [w, h, reduce] of [[390, 844, false], [1440, 900, false], [390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: reduce ? "reduce" : "no-preference" });
    const p = await ctx.newPage();
    const msgs = [];
    p.on("console", (m) => ["error", "warning"].includes(m.type()) && msgs.push(`${m.type()}: ${m.text().slice(0, 300)}`));
    p.on("pageerror", (e) => msgs.push(`pageerror: ${e.message}`));
    await p.goto(TARGET, { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    const relevant = msgs.filter((m) => !/Download the React DevTools|\[vite\]/.test(m));
    bad += relevant.length;
    console.log(`${w}${reduce ? " reduced" : ""}: ${relevant.length ? "\n  " + relevant.join("\n  ") : "clean"}`);
    await ctx.close();
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
