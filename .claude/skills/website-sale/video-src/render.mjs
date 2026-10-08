// node render.mjs stills 1.5 30 60 ...   -> stills/t-<sec>.png
// node render.mjs video [fps]            -> frames piped to ffmpeg -> video.mp4 (no audio)
import { createRequire } from "node:module";
import { execSync, spawn } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(execSync("npm root -g").toString().trim(), "x"));
const { chromium } = require("playwright");
const TL = JSON.parse(readFileSync(join(here, "timeline.json"), "utf8"));
const [mode, ...rest] = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
await page.addInitScript((tl) => { window.TL = tl; }, TL);
await page.goto("file://" + join(here, "index.html"));
await page.evaluate(() => window.ready);
await page.waitForTimeout(500);

if (mode === "sfx") {
  const ev = await page.evaluate(() => window.sfxEvents());
  (await import("node:fs")).writeFileSync(join(here, "sfx.json"), JSON.stringify(ev));
  console.log(ev.length, "sfx events");
} else if (mode === "stills") {
  mkdirSync(join(here, "stills"), { recursive: true });
  // play forward from 0 so one-shot effects (confetti) trigger as in the real render
  const times = rest.map(Number).sort((a, b) => a - b);
  for (const t of times) {
    await page.evaluate((x) => { for (let s = Math.max(0, x - 3); s < x; s += 0.2) window.render(s); window.render(x); }, t);
    await page.screenshot({ path: join(here, "stills", `t-${t}.png`) });
    console.log("still", t);
  }
} else {
  const fps = Number(rest[0] || 30), n = Math.ceil(TL.total * fps);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", join(here, "video.mp4")], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate((x) => window.render(x), i / fps);
    const buf = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % (fps * 10) === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("done", ((Date.now() - t0) / 1000).toFixed(0) + "s");
}
await browser.close();
