/*
 * Scroll smoothness meter.
 *   TARGET=url MODE=desktop|phone node smooth.cjs
 * desktop: 1440x900, mouse-wheel scrolling (Lenis eases it), no throttling.
 * phone:   390x844 touch, CPU throttled 4x, finger-swipe scroll gestures.
 * Records every animation frame with the scroll position, then reports frame
 * times per section (which section is in the middle of the screen), long
 * tasks and layout shift.
 */
const { launch } = require("./pw.cjs");
const TARGET = process.env.TARGET;
const MODE = process.env.MODE || "desktop";

(async () => {
  const b = await launch();
  const phone = MODE === "phone";
  const page = await b.newPage(
    phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } },
  );
  const cdp = await page.context().newCDPSession(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(TARGET, { waitUntil: "networkidle" });
  await page.waitForTimeout(3200); // curtain
  if (phone) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // warm-up pass so images are decoded once (a returning visitor's experience is the fair test)
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += innerHeight) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__f = [];
    const loop = (t) => { window.__f.push([t, scrollY]); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: "longtask" });
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift" });
  });
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const t0 = Date.now();
  if (phone) {
    let guard = 0;
    // A real finger: down, 14 moves ~16ms apart, lift — and let the fling coast.
    while ((await page.evaluate(() => scrollY)) < total - 5 && guard++ < 120) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 720 }] });
      for (let i = 1; i <= 14; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: 720 - i * 32 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(650);
    }
  } else {
    await page.mouse.move(720, 450);
    let guard = 0;
    while ((await page.evaluate(() => scrollY)) < total - 5 && guard++ < 600) {
      await page.mouse.wheel(0, 110);
      await page.waitForTimeout(45);
    }
    await page.waitForTimeout(1200);
  }
  const secs = (Date.now() - t0) / 1000;
  const data = await page.evaluate(() => {
    const sections = [...document.querySelectorAll("main > section, main > div, footer")].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.id || el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""), top: r.top + scrollY, bottom: r.bottom + scrollY };
    });
    return { f: window.__f, lt: window.__lt, cls: window.__cls, sections, vh: innerHeight };
  });
  const rows = new Map();
  for (let i = 1; i < data.f.length; i++) {
    const [t, y] = data.f[i];
    const dt = t - data.f[i - 1][0];
    const mid = y + data.vh / 2;
    const s = data.sections.find((x) => mid >= x.top && mid < x.bottom);
    const key = s ? s.id : "?";
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(dt);
  }
  const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
  const all = [...rows.values()].flat();
  const line = (k, a) => `${k.padEnd(26)} frames ${String(a.length).padStart(5)}  p50 ${pct(a, 0.5).toFixed(1).padStart(5)}ms  p95 ${pct(a, 0.95).toFixed(1).padStart(6)}ms  max ${Math.max(...a).toFixed(0).padStart(5)}ms  janky(>34ms) ${((a.filter((x) => x > 34).length / a.length) * 100).toFixed(1).padStart(5)}%`;
  console.log(`${MODE} ${TARGET}  scrolled ${total}px in ${secs.toFixed(1)}s${phone ? " (CPU 4x slower)" : ""}`);
  for (const [k, a] of rows) console.log("  " + line(k, a));
  console.log("  " + line("ALL", all));
  const longT = data.lt.filter((x) => x[1] > 50);
  const where = new Map();
  for (const [st, d] of longT) {
    let best = data.f[0]; for (const fr of data.f) { if (fr[0] <= st) best = fr; else break; }
    const mid = (best?.[1] ?? 0) + data.vh / 2;
    const sec = data.sections.find((x) => mid >= x.top && mid < x.bottom);
    const k = sec ? sec.id : "?"; where.set(k, (where.get(k) || 0) + 1);
  }
  if (longT.length) console.log("  long tasks by section: " + [...where].map(([k, n]) => `${k} ${n}`).join(", "));
  console.log(`  long tasks >50ms: ${longT.length} (worst ${Math.max(0, ...longT.map((x) => x[1])).toFixed(0)}ms)   layout shift: ${data.cls.toFixed(4)}   errors: ${errors.length ? errors.join(" | ") : "none"}`);
  await b.close();
})();
