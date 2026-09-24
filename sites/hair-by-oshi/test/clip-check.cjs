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

/* A remote TARGET is fetched through Node rather than by the browser:
   Chromium does not trust this sandbox's CA, so it would refuse the
   connection outright. Node does trust it, so every request is piped
   through and fulfilled into the page — TLS verification stays on. */
const pipe = ctx => ctx.route('**/*', async r => {
  try {
    const res = await fetch(r.request().url(), { headers: r.request().headers() });
    const body = Buffer.from(await res.arrayBuffer());
    const h = {};
    res.headers.forEach((v, k) => { if (!/content-encoding|content-length/i.test(k)) h[k] = v; });
    await r.fulfill({ status: res.status, headers: h, body });
  } catch { await r.abort(); }
});

/* Clipped on purpose, and not text that has been lost:
   the marquee is an endless strip, the gallery scrolls sideways,
   a closed <details> hides its answer, and the cursor is decoration. */
const EXEMPT = '.marquee, .faq__item:not([open]) p, .cursor, .preloader, ' +
  /* parked off-screen until focused — that is the skip link working */
  '.skip, .sr-only, .visually-hidden';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  let total = 0;

  for (const width of WIDTHS) {
    const mobile = width <= 430;
    /* Measured with reduced motion on. Both the entrance choreography
       and the reveal observers put every element in its finished state
       under that setting, so nothing is mid-transition and nothing is
       waiting on an observer that a scripted scroll may have jumped
       past. It is also a real user setting, so this is the layout a
       good many people actually get — the resting one, which is the
       only state in which "is this text cut off" has a fixed answer. */
    const ctx = await browser.newContext({
      viewport: { width, height: mobile ? 844 : 900 },
      isMobile: mobile, hasTouch: mobile,
      reducedMotion: 'reduce'
    });
    if (/^https/.test(TARGET)) await pipe(ctx);
    const page = await ctx.newPage();
    await page.goto(TARGET, { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(2600);

    /* Walk the page so every reveal observer fires. The step has to be
       small enough that no section is skipped and the dwell long enough
       that the observer actually runs — over the network a coarser sweep
       leaves late sections unrevealed, and a heading still parked outside
       its mask then reads as text that has been cut off. */
    /* The page grows as it reveals — a collapsed placeholder fills out,
       a section expands — so the height is re-read every step. Reading
       it once and looping to that value stops short of the last
       sections, which then never reveal, and a heading still sitting
       outside its mask reads as text that has been cut off. */
    for (let y = 0, guard = 0; guard < 400; guard++) {
      await page.evaluate(v => scrollTo(0, v), y);
      await page.waitForTimeout(90);
      const bottom = await page.evaluate(() =>
        document.documentElement.scrollHeight - window.innerHeight);
      if (y >= bottom) break;
      y = Math.min(y + 400, bottom);
    }

    /* Then visit every section in turn. A jump-scroll can pass a section
       between frames without the browser ever reporting it as intersecting,
       so a reveal observer set on it never fires and its heading stays
       parked outside its mask — which this check would then report as text
       cut off, when a person scrolling normally would have seen it appear.
       Bringing each one into view individually makes that deterministic. */
    const sections = await page.$$('section, [data-sequence], footer');
    for (const node of sections) {
      await node.evaluate(el => el.scrollIntoView({ block: 'center' })).catch(() => {});
      await page.waitForTimeout(160);
    }
    await page.evaluate(() => scrollTo(0, 0));

    /* then wait for the transforms to stop moving, rather than guessing */
    await page.waitForFunction(() => {
      const sample = () => [...document.querySelectorAll('h1,h2,h3,[data-anim],.mask > *')]
        .map(e => getComputedStyle(e).transform).join('|');
      const now = sample();
      if (window.__clipPrev === now) return true;
      window.__clipPrev = now;
      return false;
    }, null, { timeout: 15000, polling: 350 }).catch(() => {});
    await page.waitForTimeout(1200);
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

      /* Measure the TEXT, not the element. An element's scrollWidth and
         scrollHeight include every descendant, so a button holding a
         decorative fill parked outside its own box until hover reads as
         overflowing when nothing is wrong with the words. A Range over
         the element's own text nodes gives the rectangles the glyphs
         actually occupy, which is the only thing that can be cut off. */
      const textRects = el => {
        const range = document.createRange();
        const rects = [];
        for (const node of el.childNodes) {
          if (node.nodeType !== 3 || !node.textContent.trim()) continue;
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) rects.push(r);
        }
        return rects;
      };

      const all = [...document.querySelectorAll('body *')].filter(el => {
        if (el.closest(exempt)) return false;
        /* Text hidden from assistive tech is decoration — an oversized
           initial bleeding off the page, or a duplicated carousel card
           whose original is checked anyway. Neither is content going
           missing. */
        if (el.closest('[aria-hidden="true"]')) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
        return [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      });

      for (const el of all) {
        const rects = textRects(el);
        if (!rects.length) continue;
        const text = el.textContent.trim().slice(0, 44);
        const ellipsis = getComputedStyle(el).textOverflow === 'ellipsis';

        /* Every box between the text and the page that clips it — but the
           walk stops at the first container the visitor can scroll. Text
           outside a scroller is reachable, not lost, and whatever clips
           that scroller from the outside is only hiding what the scroller
           itself already handles. Without this, every card in a carousel
           reads as cut off. */
        const scrolls = v => v === 'auto' || v === 'scroll';
        const boxes = [];
        for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
          const ps = getComputedStyle(p);
          if (scrolls(ps.overflowX) || scrolls(ps.overflowY)) break;
          if (clips(ps.overflowX) || clips(ps.overflowY))
            boxes.push({ el: p, r: p.getBoundingClientRect(),
                         cx: clips(ps.overflowX), cy: clips(ps.overflowY) });
        }
        if (!boxes.length) continue;

        for (const box of boxes) {
          if (ellipsis && box.el === el) continue;      // truncation on purpose
          /* Against an ancestor's clip, measure the element's own box.
             A line box is not the ink: display type is routinely set with
             line-height below 1, so the line boxes overhang the element
             while every letter still paints inside the mask. The element
             box is what the browser lays the mask out around, so it is
             the honest thing to compare. Text rectangles are only used
             where the element clips itself, which is the case a fixed
             height or width actually severs a word. */
          const probe = box.el === el ? rects : [el.getBoundingClientRect()];
          let lost = 0, vertical = false;
          for (const r of probe) {
            if (box.cx) {
              const h = Math.max(Math.max(0, box.r.left - r.left),
                                 Math.max(0, r.right - box.r.right));
              if (h > lost) { lost = h; vertical = false; }
            }
            if (box.cy) {
              const v = Math.max(Math.max(0, box.r.top - r.top),
                                 Math.max(0, r.bottom - box.r.bottom));
              if (v > lost) { lost = v; vertical = true; }
            }
          }
          /* Horizontally a glyph box is tight, so a few px lost is real.
             Vertically it is not: the line box carries half-leading above
             and below the ink, so a large heading routinely reports several
             px outside a mask that is not clipping any actual letter. The
             vertical allowance therefore scales with the type size. */
          const size = parseFloat(getComputedStyle(el).fontSize) || 16;
          if (lost > Math.max(3, vertical ? size * 0.18 : 0)) {
            out.push({ what: box.el === el ? 'its own box' : 'clipped by ' + label(box.el),
                       el: label(el), text, by: Math.round(lost) });
            break;
          }
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
