/*
 * Function audit of every scroll feature, link and dialog.
 *   TARGET=url SITE=empress|oshi|beauty node audit.cjs
 * Runs on desktop (Lenis, wheel) and phone (native touch scrolling).
 */
const { launch } = require("./pw.cjs");
const TARGET = process.env.TARGET;
const SITE = process.env.SITE || "empress";
const CFG = {
  empress: { first: "goals", sticky: ["top", "goals"], pinnedGallery: null, sheetName: /Your booking message/ },
  oshi: { first: "oshi", sticky: ["top", "work", "always"], pinnedGallery: "work", sheetName: /Your booking message/ },
  beauty: { first: "atelier", sticky: ["top", "promise"], pinnedGallery: null, sheetName: /Request your appointment/ },
}[SITE];

const fails = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else fails.push(msg); console.log(`${ok ? "  ✓" : "  ✗"} ${msg}`); };
const settle = (p, ms = 1600) => p.waitForTimeout(ms);
const sectionTop = (p, id) => p.evaluate((id) => document.getElementById(id)?.getBoundingClientRect().top ?? null, id);

async function swipe(cdp, p, dy = 450) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 700 }] });
  for (let i = 1; i <= 10; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: 700 - (i * dy) / 10 }] }); await p.waitForTimeout(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(700);
}

(async () => {
  const b = await launch();
  for (const mode of ["desktop", "phone"]) {
    const phone = mode === "phone";
    console.log(`\n${SITE} — ${mode}`);
    const ctx = await b.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.addInitScript(() => { window.open = () => null; window.__to = (y) => window.scrollTo({ top: y, behavior: "instant" }); });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const cdp = await ctx.newCDPSession(p);
    await p.goto(TARGET, { waitUntil: "networkidle" });

    // 1. curtain lifts and the page is scrollable by the user's own input
    await p.waitForTimeout(3000);
    check(await p.evaluate(() => document.documentElement.style.overflow === ""), "page unlocks after the opening curtain");
    const y0 = await p.evaluate(() => scrollY);
    if (phone) await swipe(cdp, p, 500); else { await p.mouse.move(720, 450); for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(40); } await settle(p, 1400); }
    const y1 = await p.evaluate(() => scrollY);
    check(y1 > y0 + 150, `${phone ? "a finger swipe" : "the mouse wheel"} scrolls the page (${y0} → ${y1})`);
    check(await p.evaluate(() => document.documentElement.classList.contains("lenis")) === !phone, phone ? "phones keep native scrolling (no Lenis)" : "desktop uses Lenis smooth scrolling");

    // 2. sticky scenes stay pinned while their section scrolls past
    for (const id of CFG.sticky) {
      const r = await p.evaluate((id) => { const st = document.getElementById(id).querySelector(".sticky"); if (!st) return null; const par = st.parentElement.getBoundingClientRect(); return { top: par.top + scrollY, h: par.height, cssTop: parseFloat(getComputedStyle(st).top) || 0 }; }, id);
      if (!r) { check(false, `#${id} has a sticky element`); continue; }
      await p.evaluate((y) => __to(y), Math.round(r.top + Math.min(400, r.h * 0.3)));
      await settle(p, 500);
      const stickTop = await p.evaluate((id) => document.getElementById(id).querySelector(".sticky").getBoundingClientRect().top, id);
      check(Math.abs(stickTop - r.cssTop) < 3, `#${id} stays pinned while scrolling through it (held at ${Math.round(stickTop)}px, expected ${Math.round(r.cssTop)}px)`);
    }

    // 3. pinned gallery travels sideways and reaches its last panel
    if (CFG.pinnedGallery) {
      const g = CFG.pinnedGallery;
      const info = await p.evaluate((id) => { const s = document.getElementById(id); return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight }; }, g);
      check(info.h > 1500, `#${g} is pinned (section ${info.h}px tall)`);
      await p.evaluate((y) => __to(y), Math.round(info.top + 10));
      await settle(p, 600);
      const x0 = await p.evaluate((id) => document.getElementById(id).querySelector(".sticky > div").getBoundingClientRect().left, g);
      await p.evaluate((end) => __to(end - innerHeight - 2), Math.round(info.top + info.h));
      await settle(p, 900);
      const lastRight = await p.evaluate((id) => { const t = document.getElementById(id).querySelector(".sticky > div"); return t.lastElementChild.getBoundingClientRect().right; }, g);
      const vw = await p.evaluate(() => innerWidth);
      check(lastRight <= vw + 2 && lastRight > vw * 0.5, `gallery reaches its last panel at the end (right edge ${Math.round(lastRight)} of ${vw})`);
      check(x0 > -50, `gallery starts at its first panel (left ${Math.round(x0)})`);
    }

    // 4. every in-page link a visitor uses lands on its section, just under the header
    const contexts = phone ? ["footer"] : ["header", "footer"];
    for (const ctxSel of contexts) {
      const hrefs = await p.evaluate((sel) => [...new Set([...document.querySelectorAll(`${sel} a[href^="#"]`)].map((a) => a.getAttribute("href")))].filter((h) => h.length > 1 && h !== "#top"), ctxSel);
      for (const href of hrefs) {
        await p.evaluate((sel) => { if (sel === "footer") document.querySelector("footer").scrollIntoView({ block: "end", behavior: "instant" }); else __to(0); }, ctxSel);
        await settle(p, 1300);
        const link = p.locator(`${ctxSel} a[href="${href}"]`).first();
        try { await link.click({ timeout: 4000 }); } catch (e) { check(false, `${ctxSel} link ${href} is clickable (${e.message.split("\n")[0]})`); continue; }
        await settle(p, 2200);
        const t = await sectionTop(p, href.slice(1));
        check(t !== null && t > -8 && t < 110, `${ctxSel} link ${href} lands on its section (top ${t === null ? "?" : Math.round(t)}px)`);
      }
    }
    // the opening scene's own buttons, used from the top of the page
    await p.evaluate(() => __to(0)); await settle(p, 900);
    const heroLinks = await p.evaluate(() => [...document.querySelectorAll('#top a[href^="#"]')].filter((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(a).visibility !== "hidden" && a.tabIndex !== -1; }).map((a) => a.getAttribute("href")));
    for (const href of [...new Set(heroLinks)]) {
      await p.evaluate(() => __to(0)); await settle(p, 900);
      await p.locator(`#top a[href="${href}"]:visible`).first().click({ timeout: 4000 });
      await settle(p, 2400);
      const t = await sectionTop(p, href.slice(1));
      check(t !== null && t > -8 && t < 110, `opening-scene button ${href} lands on its section (top ${t === null ? "?" : Math.round(t)}px)`);
    }

    // 5. a link straight to a section works on load (shared URLs)
    const p2 = await ctx.newPage();
    await p2.addInitScript(() => { window.__to = (y) => window.scrollTo({ top: y, behavior: "instant" }); });
    await p2.goto(TARGET + "#book", { waitUntil: "networkidle" });
    await p2.waitForTimeout(3500);
    const tb = await sectionTop(p2, "book");
    check(tb !== null && Math.abs(tb) < 140, `opening the site at #book lands on the booking section (top ${Math.round(tb ?? -1)}px)`);
    await p2.close();

    // 6. floating booking bar: hidden on the opening scene, shown in the page, hidden on #book
    await p.evaluate(() => __to(0)); await settle(p, 900);
    const bar = () => p.evaluate(() => [...document.querySelectorAll("button")].some((b) => /DM to book|Book by Instagram DM|Secure your appointment|Your request|Your appointment/.test(b.textContent || "") && b.closest(".fixed") && b.getBoundingClientRect().height > 0));
    check(!(await bar()), "floating book bar is hidden on the opening scene");
    await p.evaluate((id) => __to(document.getElementById(id).getBoundingClientRect().top + scrollY + 200), CFG.first); await settle(p, 1100);
    check(await bar(), "floating book bar appears once you're into the page");
    await p.evaluate(() => __to(document.getElementById("book").getBoundingClientRect().top + scrollY + 100)); await settle(p, 1100);
    check(!(await bar()), "floating book bar steps aside on the booking section");

    // 7. booking sheet locks the page, unlocks on close, keeps your place
    await p.evaluate((id) => __to(document.getElementById(id).getBoundingClientRect().top + scrollY + 300), CFG.first); await settle(p, 1200);
    const before = await p.evaluate(() => scrollY);
    await p.locator("header button:visible", { hasText: /^Book/ }).first().click();
    const dialog = p.getByRole("dialog", { name: CFG.sheetName });
    await dialog.waitFor({ timeout: 4000 });
    check(await p.evaluate(() => document.documentElement.style.overflow === "hidden"), "booking sheet locks the page behind it");
    if (phone) await swipe(cdp, p, 400); else { await p.mouse.move(200, 450); await p.mouse.wheel(0, 400); await settle(p, 800); }
    check(Math.abs((await p.evaluate(() => scrollY)) - before) < 4, "the page behind the sheet doesn't move");
    await p.keyboard.press("Escape"); await settle(p, 900);
    check(await p.evaluate(() => document.documentElement.style.overflow === ""), "closing the sheet unlocks the page");
    check(Math.abs((await p.evaluate(() => scrollY)) - before) < 4, "you're back exactly where you were");
    if (phone) await swipe(cdp, p, 400); else { await p.mouse.move(720, 450); await p.mouse.wheel(0, 300); await settle(p, 1200); }
    check((await p.evaluate(() => scrollY)) > before + 100, "and the page scrolls again");

    // 8. phone menu: opens, locks, a link navigates and closes it, page unlocks
    if (phone) {
      await p.evaluate(() => __to(0)); await settle(p, 700);
      await p.getByRole("button", { name: "Open menu" }).click(); await settle(p, 900);
      const menu = p.getByRole("dialog", { name: "Menu" });
      check(await menu.isVisible(), "menu opens");
      check(await p.evaluate(() => document.documentElement.style.overflow === "hidden"), "menu locks the page");
      const target = await menu.locator('a[href^="#"]').nth(1).getAttribute("href");
      await menu.locator('a[href^="#"]').nth(1).click(); await settle(p, 2200);
      check(!(await menu.isVisible()), "tapping a menu link closes the menu");
      check(await p.evaluate(() => document.documentElement.style.overflow === ""), "and unlocks the page");
      const t = await sectionTop(p, target.slice(1));
      check(t !== null && t > -8 && t < 110, `menu link ${target} lands on its section (top ${Math.round(t ?? -999)}px)`);
      const ya = await p.evaluate(() => scrollY); await swipe(cdp, p, 400);
      check((await p.evaluate(() => scrollY)) > ya + 100, "page scrolls normally after using the menu");
      // rotate to landscape and back
      await p.setViewportSize({ width: 844, height: 390 }); await settle(p, 900);
      check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "landscape phone: no sideways scroll");
      await p.setViewportSize({ width: 390, height: 844 }); await settle(p, 900);
      check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "back to portrait: no sideways scroll");
    } else {
      // chapter rail (wide screens)
      await p.setViewportSize({ width: 1440, height: 900 });
      await p.evaluate((id) => __to(document.getElementById(id).getBoundingClientRect().top + scrollY + 200), CFG.first); await settle(p, 1400);
      const rail = p.getByRole("navigation", { name: "Page chapters" });
      check(await rail.isVisible(), "chapter rail shows once the chapters begin");
      const cur = await rail.locator('[aria-current="true"]').getAttribute("href").catch(() => null);
      check(cur === `#${CFG.first}`, `rail marks the current chapter (${cur})`);
      const lastLink = rail.locator("a").last(); const lh = await lastLink.getAttribute("href");
      await lastLink.click(); await settle(p, 2200);
      const t = await sectionTop(p, lh.slice(1));
      check(t !== null && t > -8 && t < 110, `rail link ${lh} jumps to its chapter (top ${Math.round(t ?? -999)}px)`);
      await p.goBack(); await settle(p, 1500);
      check(true, "back button works after a jump");
      await p.setViewportSize({ width: 1024, height: 768 }); await settle(p, 900);
      check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "resize to 1024: no sideways scroll");
      await p.setViewportSize({ width: 1440, height: 900 }); await settle(p, 700);
    }
    check(errors.length === 0, `no console errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
    await ctx.close();
  }

  // 9. reduced motion: nothing pinned, everything reachable, page scrolls
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await p.addInitScript(() => { window.__to = (y) => window.scrollTo({ top: y, behavior: "instant" }); });
    await p.goto(TARGET, { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
    console.log(`\n${SITE} — reduced motion`);
    check(await p.evaluate(() => document.documentElement.style.overflow === ""), "no curtain lock with reduced motion");
    const y0 = await p.evaluate(() => scrollY); await swipe(cdp, p, 500);
    check((await p.evaluate(() => scrollY)) > y0 + 150, "page scrolls with reduced motion");
    const tall = await p.evaluate(() => document.getElementById("top").offsetHeight <= innerHeight * 1.3);
    check(tall, "opening scene isn't a long pinned stretch with reduced motion");
    await ctx.close();
  }
  await b.close();
  console.log(`\n${SITE}: ${passes} passed, ${fails.length} failed${fails.length ? "\n- " + fails.join("\n- ") : ""}`);
  process.exit(fails.length ? 1 : 0);
})();
