// Finds Playwright whether it's installed locally, globally, or preinstalled.
let pw;
for (const id of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
  try { pw = require(id); break; } catch {}
}
if (!pw) { console.error("Playwright not found — npm i -D playwright"); process.exit(2); }
const fs = require("fs");
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
exports.launch = () => pw.chromium.launch(exe ? { executablePath: exe } : {});
exports.TARGET = process.env.TARGET || "http://localhost:4173/";
