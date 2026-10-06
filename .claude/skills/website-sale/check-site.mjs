// Opens the built site in Chromium and fails on page errors, a blank page or a "lovable" mention.
// Usage: node check-site.mjs <site-dir>
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const require = createRequire(join(execSync("npm root -g").toString().trim(), "x"));
const { chromium } = require("playwright");
const dir = process.argv[2];
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  try { res.writeHead(200, { "content-type": types[extname(p)] ?? "application/octet-stream" }); res.end(await readFile(join(dir, p))); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const problems = [];
for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => problems.push(`${viewport.width}px page error: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  const text = await page.innerText("body");
  if (text.trim().length < 200) problems.push(`${viewport.width}px: page looks empty`);
  if (/lovable/i.test(await page.content())) problems.push("page mentions Lovable");
  if (/photo to come|lorem ipsum|placeholder/i.test(text)) problems.push(`${viewport.width}px: placeholder text visible`);
  await page.screenshot({ path: join(dir, `..`, `check-${viewport.width}.png`), fullPage: false });
  await page.close();
}
await browser.close(); server.close();
console.log(problems.length ? "PROBLEMS:\n- " + [...new Set(problems)].join("\n- ") : "OK: loads on desktop and phone, no errors, no Lovable mentions");
process.exit(problems.length ? 1 : 0);
