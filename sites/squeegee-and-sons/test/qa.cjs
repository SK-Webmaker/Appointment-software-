/*
 * Full pre-handover check. Run against a built preview:
 *   npm run build && npx vite preview --host 127.0.0.1 --port 4173 &
 *   node test/qa.cjs
 *
 * At ten widths from 320 to 1920 it checks:
 *   - nothing spills sideways (no horizontal scroll on a phone)
 *   - no text is cut off by its own box or a clipping parent
 *   - no two text blocks sit on top of one another
 *   - tap targets are at least 40px on phones
 *   - every image loads and has alt text
 * then runs axe-core, checks every in-page link has a target, and drives the
 * job request end to end (problem, when, where, details, job number, calendar
 * file, persistence), emergency mode, the price gauge and the area checker.
 */
const { launch, TARGET } = require("./pw.cjs");
const fs = require("fs");
const path = require("path");

const WIDTHS = [
  [320, 640], [360, 740], [375, 667], [390, 844], [414, 896],
  [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080],
];
const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

// Walk the page so every in-view animation has fired, then come back up.
async function settle(page) {
  await page.waitForTimeout(2200);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  for (let y = 0; y <= h; y += Math.round(vh * 0.6)) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0)); // sticky things back in their natural place
  await page.waitForTimeout(1400);
}

const geometry = () => {
  const out = { overflow: [], clipped: [], overlaps: [], small: [], images: [], invisible: [], contrast: [] };
  const vw = window.innerWidth;
  const visible = (e) => {
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    // the answer inside a closed <details> isn't shown, whatever its box says
    const d = e.closest("details");
    if (d && !d.open && !e.closest("summary")) return false;
    for (let n = e; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.05) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const designed = (e) => e.closest('[data-qa="layered"],[data-qa="scroller"],[aria-hidden="true"],[role="dialog"],header,.animate-marquee,.truncate');

  // 1. horizontal overflow
  if (document.documentElement.scrollWidth > vw + 1) {
    for (const e of document.querySelectorAll("body *")) {
      const r = e.getBoundingClientRect();
      if (r.right > vw + 1 && visible(e)) {
        let clipped = false;
        for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (/hidden|clip/.test(cs.overflowX) && n.getBoundingClientRect().right <= vw + 1) { clipped = true; break; }
        }
        if (!clipped) out.overflow.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)} right=${Math.round(r.right)}`);
      }
    }
    out.overflow.unshift(`scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  }

  // 2. clipped text
  const texts = [...document.querySelectorAll("h1,h2,h3,p,li,a,button,span,dt,dd,label,blockquote,figcaption")].filter(
    (e) => visible(e) && !designed(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
  );
  for (const e of texts) {
    const cs = getComputedStyle(e);
    if (/hidden|clip/.test(cs.overflow + cs.overflowX) && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 4)) {
      out.clipped.push(`${e.tagName.toLowerCase()} "${e.textContent.trim().slice(0, 40)}"`);
    }
    if (e.getBoundingClientRect().right > vw + 1) out.clipped.push(`off-screen: "${e.textContent.trim().slice(0, 40)}"`);
  }

  // 3. overlapping text blocks (document coordinates)
  const blocks = [...document.querySelectorAll("h1,h2,h3,p,li,blockquote,figcaption,dl,label,button,a.btn-primary,a.btn-ghost,a.btn-honey,img")]
    .filter((e) => visible(e) && !designed(e) && !e.closest("li button") )
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { e, l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY, a: r.width * r.height };
    });
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++) {
      const A = blocks[i], B = blocks[j];
      if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
      const w = Math.min(A.r, B.r) - Math.max(A.l, B.l), h = Math.min(A.b, B.b) - Math.max(A.t, B.t);
      if (w > 2 && h > 2 && (w * h) / Math.min(A.a, B.a) > 0.08)
        out.overlaps.push(`${A.e.tagName.toLowerCase()} "${(A.e.textContent || A.e.alt || "").trim().slice(0, 30)}" × ${B.e.tagName.toLowerCase()} "${(B.e.textContent || B.e.alt || "").trim().slice(0, 30)}"`);
    }

  // 4. tap targets on phones
  if (vw < 600) {
    for (const e of document.querySelectorAll("a[href],button")) {
      if (!visible(e) || e.closest('[aria-hidden="true"]') || e.closest("p")) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) out.small.push(`${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }

  // 6. playbook gate 3: with reduced motion nothing may stay invisible
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    out.invisible = [...document.querySelectorAll("h1,h2,h3,p,a,li,span,button,img")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || el.closest(".sr-only,[aria-hidden='true'],[data-qa='scroll-scene']") || getComputedStyle(el).visibility === "hidden") return false;
        let o = 1;
        for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
        return o < 0.15;
      })
      .map((el) => `${el.tagName} "${(el.textContent || el.getAttribute("alt") || "").trim().slice(0, 30)}"`);
  }

  // 7. playbook gate 1: WCAG contrast on every text node (flattening alpha and opacity)
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (str) => { const m = str.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const toRgb = (c) => { const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return `rgba(${d[0]}, ${d[1]}, ${d[2]}, ${(d[3] / 255).toFixed(3)})`; };
  const bgOf = (el) => { for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== "none" && n.tagName !== "BUTTON" && n.tagName !== "A") return null; const c = parse(toRgb(cs.backgroundColor)); if (c && c[3] > 0.5) return c; } return parse(toRgb(getComputedStyle(document.body).backgroundColor)); };
  out.contrast = [];
  for (const el of document.querySelectorAll("p,a,span,h1,h2,h3,li,label,button,dt,dd,em,summary,figcaption,blockquote")) {
    if (!el.textContent.trim() || el.closest(".sr-only,[aria-hidden='true'],[data-qa='bg-sibling']")) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden") continue;
    let op = 1; for (let n = el; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity);
    if (op < 0.05) continue;
    const fg = parse(toRgb(cs.color)); const bg = bgOf(el); if (!fg || !bg) continue;
    const a = fg[3] * op; const flat = [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
    const L1 = lum(flat), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) out.contrast.push(`"${el.textContent.trim().slice(0, 30)}" ${ratio.toFixed(2)} < ${need} (${Math.round(size)}px)`);
  }

  // 5. images
  for (const img of document.images) {
    if (!img.hasAttribute("alt")) out.images.push(`no alt: ${img.src}`);
    if (img.complete && img.naturalWidth === 0) out.images.push(`broken: ${img.currentSrc || img.src}`);
  }
  return out;
};

(async () => {
  const browser = await launch();

  // ---------- geometry at every width (reduced motion: everything in its resting place)
  for (const [w, h] of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", isMobile: w < 600, hasTouch: w < 600 });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await page.goto(TARGET, { waitUntil: "networkidle" });
    await settle(page);
    const g = await page.evaluate(geometry);
    const tag = `${w}px`;
    g.overflow.forEach((x) => fail(tag, `overflow ${x}`));
    g.clipped.forEach((x) => fail(tag, `clipped ${x}`));
    [...new Set(g.overlaps)].forEach((x) => fail(tag, `overlap ${x}`));
    [...new Set(g.small)].forEach((x) => fail(tag, `small tap target ${x}`));
    g.images.forEach((x) => fail(tag, x));
    g.invisible.forEach((x) => fail(tag, `invisible under reduced motion: ${x}`));
    [...new Set(g.contrast)].forEach((x) => fail(tag, `contrast ${x}`));
    errs.forEach((x) => fail(tag, `console ${x}`));
    console.log(`${tag.padEnd(7)} overflow ${g.overflow.length}  clipped ${g.clipped.length}  overlaps ${new Set(g.overlaps).size}  small ${new Set(g.small).size}  images ${g.images.length}  invisible ${g.invisible.length}  contrast ${new Set(g.contrast).size}  errors ${errs.length}`);
    await ctx.close();
  }

  // ---------- the animated version too: scroll it at a phone size and make sure nothing throws
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(TARGET, { waitUntil: "networkidle" });
    await settle(page);
    const g = await page.evaluate(geometry);
    g.overflow.forEach((x) => fail("390 animated", `overflow ${x}`));
    // Walk the whole page: at every point it must stay exactly one phone wide.
    // Anything that rotates or drifts past the edge mid-scroll (a turning
    // badge, a sliding card) makes a phone zoom the whole page out.
    const wide = [];
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= total; y += 250) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(60);
      const w = await page.evaluate(() => Math.max(innerWidth, document.documentElement.scrollWidth));
      if (w > 391) wide.push(`at ${y}px the page is ${w}px wide`);
    }
    wide.slice(0, 5).forEach((x) => fail("390 animated", x));
    errs.forEach((x) => fail("390 animated", `error ${x}`));
    console.log(`animated 390: overflow ${g.overflow.length + wide.length}, errors ${errs.length}`);
    await ctx.close();
  }

  // ---------- accessibility (axe) and links
  const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(TARGET, { waitUntil: "networkidle" });
    await settle(page);
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ["violations"] });
      return r.violations.map((v) => `${v.impact} ${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    });
    res.forEach((x) => fail(`axe ${w}`, x));
    console.log(`axe ${w}: ${res.length} violations`);

    if (w === 1440) {
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
      const anchors = [...new Set(links.filter((l) => l.startsWith("#")))];
      for (const a of anchors) {
        const ok = await page.evaluate((id) => !!document.getElementById(id), a.slice(1));
        if (!ok) fail("links", `no target for ${a}`);
      }
      const external = [...new Set(links.filter((l) => !l.startsWith("#")))];
      console.log(`links: ${anchors.length} in-page (${anchors.join(" ")}), ${external.length} external:\n  ${external.join("\n  ")}`);
    }
    await ctx.close();
  }

  // ---------- price builder, checklist, kit and booking — on a phone
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await ctx.newPage();
    await page.goto(TARGET, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const step = (ok, msg) => { if (!ok) fail("booking", msg); console.log(`${ok ? "  ✓" : "  ✗"} ${msg}`); };
    const cur = async (d) => (await d.locator('[aria-current="step"]').innerText()).toLowerCase();
    console.log("price, checklist, kit and booking:");

    const q = page.locator("#quote");
    await q.getByRole("button", { name: "More bedrooms" }).scrollIntoViewIfNeeded();
    step(/\$153/.test(await q.innerText()), "2 bed, 1 bath, regular, fortnightly: $153");
    await q.getByRole("button", { name: "More bedrooms" }).click();
    await q.getByRole("button", { name: /^Deep/ }).click();
    await q.getByRole("button", { name: /Inside the oven/ }).click();
    await page.waitForTimeout(700);
    let qt = await q.innerText();
    step(/\$356/.test(qt) && /Two of us/i.test(qt) && /3 hours/.test(qt), "3 bed deep + oven, fortnightly: $356, two of us, about 3 hours");
    await q.getByRole("button", { name: /^End of lease/ }).click();
    await page.waitForTimeout(700);
    qt = await q.innerText();
    step(/\$624/.test(qt) && (await q.getByRole("button", { name: /^Weekly/ }).isDisabled()), "end of lease: $624, one-off only");

    const c = page.locator("#checklist");
    await c.getByRole("tab", { name: "Kitchen" }).scrollIntoViewIfNeeded();
    step(/Kitchen: 11 of 11 jobs/.test(await c.innerText()), "the checklist follows: end of lease does all 11 kitchen jobs");
    await c.getByRole("group", { name: "Kind of clean" }).getByRole("button", { name: "Regular" }).click();
    await page.waitForTimeout(400);
    step(/Kitchen: 6 of 11 jobs/.test(await c.innerText()), "a regular clean does 6 of them");
    await c.getByRole("tab", { name: "Bathroom" }).click();
    await page.waitForTimeout(700);
    step(/Bathroom: 5 of 10 jobs/.test(await c.innerText()), "and 5 of 10 in the bathroom");

    const k = page.locator("#kit");
    await k.scrollIntoViewIfNeeded();
    step(/HEPA vacuum/.test(await k.innerText()) && /Refillable sprays/.test(await k.innerText()), "the kit section shows what we bring");

    const w = page.locator("#windows");
    await w.getByRole("button", { name: /Add inside windows/ }).scrollIntoViewIfNeeded();
    await w.getByRole("button", { name: /Add inside windows/ }).click();
    await page.waitForTimeout(300);
    step((await w.getByRole("button", { name: /Windows added/ }).getAttribute("aria-pressed")) === "true", "inside windows can be added from the before-and-after");
    await w.getByRole("button", { name: /Windows added/ }).click();
    await page.waitForTimeout(300);
    await w.getByLabel("Compare before and after").fill("20");
    step(true, "the before-and-after slider moves");

    const sv = page.locator("#services");
    await sv.getByRole("button", { name: "Book: Deep cleaning" }).scrollIntoViewIfNeeded();
    step(/From \$258/.test(await sv.innerText()), "a 1 bed, 1 bath deep clean starts from $258");

    await q.getByRole("button", { name: /Book this clean/ }).scrollIntoViewIfNeeded();
    step(/\$232/.test(await q.innerText()), "back in the price: regular again, 3 bed + oven, fortnightly: $232");
    await q.getByRole("button", { name: /Book this clean/ }).click();
    const dialog = page.getByRole("dialog", { name: /Your clean/ });
    await dialog.waitFor();
    step((await cur(dialog)).includes("how often"), "booking from the price opens on 'How often'");
    await dialog.getByRole("button", { name: /^Weekly/ }).click();
    await page.waitForTimeout(300);
    step(/\$218/.test(await dialog.innerText()), "weekly brings it to $218");
    await dialog.getByRole("button", { name: /^Continue/ }).click();
    await page.waitForTimeout(500);
    const win = dialog.locator("fieldset").last().getByRole("button").first();
    const winText = (await win.innerText()).trim();
    await win.click();
    await dialog.getByRole("button", { name: /^Continue/ }).click();
    await page.waitForTimeout(500);
    step((await cur(dialog)).includes("details"), "then on to 'Details'");
    await dialog.getByLabel(/Postcode/).fill("2000");
    await dialog.getByRole("button", { name: "Book the clean" }).click();
    step(/outside the Eastern Suburbs/.test(await dialog.innerText()), "a city postcode is outside the area");
    await dialog.getByLabel(/Postcode/).fill("2026");
    step(/Bondi/.test(await dialog.innerText()), "2026 is Bondi");
    await dialog.getByLabel(/Street address/).fill("4/12 Example St");
    await dialog.getByRole("button", { name: "Key in a lockbox" }).click();
    await dialog.getByLabel(/Your name/).fill("Priya Shah");
    await dialog.getByLabel(/Mobile/).fill("0412 345 678");
    await dialog.getByRole("button", { name: "Book the clean" }).click();
    await page.waitForTimeout(700);
    const done = page.getByRole("dialog", { name: /Clean booked/ });
    step(await done.isVisible(), "booking shows the confirmation");
    const txt = await done.innerText();
    step(/SQ-[A-Z0-9]{5}/.test(txt) && txt.includes("Regular clean · 3 bed, 1 bath") && /every week/.test(txt) && txt.includes("Bondi 2026") && txt.includes("Key in a lockbox") && txt.includes("$218") && txt.includes(winText), "with a reference, the clean, how often, where, how we get in, the price and the time");
    const [dl] = await Promise.all([page.waitForEvent("download"), done.getByRole("button", { name: /Add to calendar/ }).click()]);
    step(dl.suggestedFilename().endsWith(".ics"), `Add to calendar downloads an .ics (${dl.suggestedFilename()})`);
    await done.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(800);
    step(!(await done.isVisible()), "Done closes the sheet");

    const book = page.locator("#book");
    await book.getByLabel(/Are we in your area/).scrollIntoViewIfNeeded();
    await book.getByLabel(/Are we in your area/).fill("2034");
    step(/Coogee/.test(await book.innerText()), "the postcode check knows 2034 is Coogee");

    // Mobile menu
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await menu.waitFor();
    step((await menu.getByRole("link").count()) >= 3, "mobile menu opens with its links");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    step(!(await menu.isVisible()), "Escape closes the mobile menu");
    await ctx.close();
  }

  await browser.close();
  report();
})().catch((e) => { fail("crash", e.message.split("\n").slice(0, 14).join("\n    ")); report(); });

function report() {
  console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join("\n- ")}` : "\nAll checks passed.");
  process.exit(problems.length ? 1 : 0);
}
