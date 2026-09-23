/* Text that is cut off still renders, so a screenshot rarely shows it —
   a caption loses its last word, a heading loses a descender, and the
   page still looks whole. This walks every text-bearing element at nine
   widths and reports two things: text overflowing its own clipped box,
   and text painted outside an ancestor that clips. It runs only once
   every entrance has settled, because a masked heading and a wiping
   photograph are both legitimately clipped while they animate. */
const { chromium } = require('playwright');

const TARGET = process.env.TARGET ||
  'file:///home/user/Appointment-software-/sites/hair-by-oshi/index.html';
const WIDTHS = [1920, 1440, 1280, 1024, 768, 430, 390, 360, 320];

/* Clipped on purpose, and not text that has been lost:
   the marquee is an endless strip, the gallery scrolls sideways,
   a closed <details> hides its answer, and the cursor is decoration. */
const EXEMPT = '.marquee, .work__track, .faq__item:not([open]) p, .cursor, .preloader';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  let total = 0;

  for (const width of WIDTHS) {
    const mobile = width <= 430;
    const ctx = await browser.newContext({
      viewport: { width, height: mobile ? 844 : 900 },
      isMobile: mobile, hasTouch: mobile
    });
    const page = await ctx.newPage();
    await page.goto(TARGET, { waitUntil: 'load' });
    await page.waitForTimeout(2600);

    /* walk the page so every observer has fired */
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 500) {
      await page.evaluate(v => scrollTo(0, v), y);
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => scrollTo(0, 0));
    /* let every entrance transition finish before measuring */
    await page.waitForTimeout(2600);
    await page.evaluate(() => {
      document.querySelectorAll('.work__track').forEach(t => (t.scrollLeft = 0));
    });
    await page.waitForTimeout(400);

    const findings = await page.evaluate((exempt) => {
      const out = [];
      const clips = v => v === 'hidden' || v === 'clip';
      const label = el => {
        const id = el.id ? '#' + el.id : '';
        const cls = (el.className && typeof el.className === 'string')
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        return el.tagName.toLowerCase() + id + cls;
      };

      const all = [...document.querySelectorAll('body *')].filter(el => {
        if (el.closest(exempt)) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
        /* only elements that carry their own text */
        const own = [...el.childNodes]
          .filter(n => n.nodeType === 3 && n.textContent.trim()).length;
        return own > 0;
      });

      for (const el of all) {
        const cs = getComputedStyle(el);
        const text = el.textContent.trim().slice(0, 44);

        /* (a) text overflowing its own box, where that box clips */
        const ellipsis = cs.textOverflow === 'ellipsis';
        if (!ellipsis) {
          if (clips(cs.overflowX) && el.scrollWidth > el.clientWidth + 1)
            out.push({ what: 'own box, sideways', el: label(el), text,
                       by: el.scrollWidth - el.clientWidth });
          if (clips(cs.overflowY) && el.scrollHeight > el.clientHeight + 1)
            out.push({ what: 'own box, vertically', el: label(el), text,
                       by: el.scrollHeight - el.clientHeight });
        }

        /* (b) text painted outside an ancestor that clips it */
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ps = getComputedStyle(p);
          const cx = clips(ps.overflowX), cy = clips(ps.overflowY);
          if (!cx && !cy) continue;
          const pr = p.getBoundingClientRect();
          /* padding on the clipping box is part of its painted area */
          const lost =
            (cx ? Math.max(0, pr.left - r.left) + Math.max(0, r.right - pr.right) : 0) +
            (cy ? Math.max(0, pr.top - r.top) + Math.max(0, r.bottom - pr.bottom) : 0);
          if (lost > 1.5)
            out.push({ what: 'clipped by ' + label(p), el: label(el), text,
                       by: Math.round(lost) });
        }
      }
      return out;
    }, EXEMPT);

    total += findings.length;
    if (!findings.length) console.log(`${String(width).padStart(4)}px — no text cut off`);
    else {
      console.log(`${String(width).padStart(4)}px — ${findings.length} CUT OFF`);
      findings.forEach(f =>
        console.log(`        ${f.el}  ${f.what}  by ${f.by}px   "${f.text}"`));
    }
    await ctx.close();
  }

  console.log(`\n${TARGET}: ${total} clipped text element(s) across ${WIDTHS.length} widths`);
  await browser.close();
  process.exit(0);
})();
