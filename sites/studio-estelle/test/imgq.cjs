/*
 * Photo quality audit: TARGET=url node test/imgq.cjs
 * At several real device sizes it scrolls the whole page and, for every
 * photo on screen, measures how many device pixels each image pixel is
 * stretched over (object-fit: cover aware, transforms included). >1 means
 * the browser is enlarging the photo; >1.5 starts to look soft.
 */
const { launch } = require("./pw.cjs");
const TARGET = process.env.TARGET || "http://localhost:4173/";
const DEVICES = [
  { name: "phone 390@3x", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: "phone 360@3x", viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: "tablet 768@2x", viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "laptop 1440@2x", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { name: "desktop 1920@1x", viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
];
(async () => {
  const b = await launch();
  const all = {};
  for (const dev of DEVICES) {
    const page = await b.newPage(dev);
    await page.goto(TARGET, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const vh = dev.viewport.height;
    for (let y = 0; y < total; y += Math.round(vh / 3)) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
      await page.waitForTimeout(140);
      const rows = await page.evaluate((dpr) => {
        const out = [];
        for (const img of document.querySelectorAll("img")) {
          if (!img.complete || !img.naturalWidth) continue;
          const r = img.getBoundingClientRect();
          if (r.width < 24 || r.height < 24) continue;
          if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
          const cs = getComputedStyle(img);
          if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
          const nw = img.naturalWidth, nh = img.naturalHeight;
          const fit = cs.objectFit;
          const k = fit === "cover" ? Math.max(r.width / nw, r.height / nh) : fit === "contain" ? Math.min(r.width / nw, r.height / nh) : r.width / nw;
          const name = (img.currentSrc || img.src).split("/").pop();
          const cands = (img.srcset || "").split(",").map((s) => s.trim().split(" ")).filter((x) => x[0]).map((x) => [x[0].split("/").pop(), parseInt(x[1])]);
          const maxW = Math.max(nw, ...cands.map((c) => c[1] || 0));
          const kBest = k * nw / maxW;
          const sec = img.closest("section[id], footer, header, [role=dialog]");
          const where = sec ? (sec.id || sec.tagName.toLowerCase()) : "?";
          out.push({ name, where, sizes: img.sizes, nw, nh, w: Math.round(r.width), h: Math.round(r.height), up: +(k * dpr).toFixed(2), best: +(kBest * dpr).toFixed(2), maxW });
        }
        return out;
      }, dev.deviceScaleFactor);
      for (const row of rows) {
        const base = row.name.replace(/-\d+\.webp$/, "");
        const key = `${base} @${row.where}`;
        all[key] ??= {};
        const prev = all[key][dev.name];
        if (!prev || row.up > prev.up) all[key][dev.name] = row;
      }
    }
    await page.close();
  }
  await b.close();
  const names = Object.keys(all).sort();
  const devs = DEVICES.map((d) => d.name);
  console.log("photo @section".padEnd(30) + devs.map((d) => d.padStart(21)).join(""));
  for (const n of names) {
    const cells = devs.map((d) => {
      const r = all[n][d];
      if (!r) return "—".padStart(17);
      const flag = r.up > 2 ? "!!" : r.up > 1.5 ? "! " : "  ";
      const chosen = r.name.match(/-(\d+)\.webp$/)?.[1] ?? "?";
      const fix = r.best < r.up - 0.05 ? `→${r.best.toFixed(1)}` : "";
      return `${flag}${r.up.toFixed(2)}x ${chosen}w${fix}`.padStart(21);
    });
    console.log(n.padEnd(30) + cells.join(""));
  }
  console.log("\nNumbers = device pixels per photo pixel at its largest on screen (1.00 = pixel-perfect; ! >1.5 soft; !! >2 blurry). Then the file the browser chose; →N = what it would be with the largest file that exists.");
  require("fs").writeFileSync(process.env.OUT || "/dev/null", JSON.stringify(all, null, 1));
})();
