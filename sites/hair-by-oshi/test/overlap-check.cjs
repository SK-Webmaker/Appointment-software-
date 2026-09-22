/*
 * Overlap check.
 *
 * Collision between two blocks is the failure mode that screenshots hide:
 * a card sitting over a paragraph still renders, and at a glance the page
 * looks whole. This walks every text block and image frame at nine widths
 * and fails if any two that are not ancestor/descendant intersect by more
 * than a small fraction of the smaller one.
 *
 * Exclusions are deliberate, not convenience: overlays that are meant to
 * sit above the page, collapsed <details> whose hidden children all report
 * the same rect, and a before/after comparison, which stacks its two
 * images by design.
 *
 *   node test/overlap-check.js                 # this build
 *   TARGET=https://example.com node test/overlap-check.js
 */
const { chromium } = require('playwright');
const TARGET = process.env.TARGET ||
  'file://' + require('path').resolve(__dirname, '../index.html');
const LABEL = process.env.LABEL || TARGET;
const pipe = ctx => ctx.route('**/*', async r => { try {
  const res = await fetch(r.request().url(), { headers: r.request().headers() });
  const body = Buffer.from(await res.arrayBuffer()); const h = {};
  res.headers.forEach((v,k)=>{ if(!/content-encoding|content-length/i.test(k)) h[k]=v; });
  await r.fulfill({ status: res.status, headers: h, body }); } catch { await r.abort(); } });

const detect = () => {
  // Leaf-ish blocks that should never sit on top of one another.
  const SEL = 'p,h1,h2,h3,h4,li,figcaption,blockquote,label,summary,button,a,' +
              '.image-slot,.image-placeholder,.slot,.svc__media,.oshi__portrait,' +
              '.studio__media,.work__card,.hero__frame,.ba__stage,.proof__item,.step,.val';
  const nodes = Array.from(document.querySelectorAll(SEL)).filter(e => {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    // ignore things that are meant to float above the page
    if (e.closest('[role="dialog"],.modal,.menu,.nav,.mcta,.mobile-actions,.cursor,.preloader')) return false;
    // a closed <details> still reports a rect for its hidden content, and all
    // of it stacks at the same point — not a real overlap
    const d = e.closest('details');
    if (d && !d.open && e !== d && !e.matches('summary') && !e.closest('summary')) return false;
    if (cs.contentVisibility === 'hidden') return false;
    const r = e.getBoundingClientRect();
    return r.width > 12 && r.height > 8;
  });
  // An element's own box is not what you see. A heading inside a mask with
  // overflow:hidden has a box taller than the slot it is shown through, and
  // the hidden part is not on screen — counting it produces collisions that
  // exist only in the geometry. So intersect each box with every clipping
  // ancestor to get the rectangle actually painted.
  const rect = e => {
    let r = e.getBoundingClientRect();
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let n = e.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const clips = /hidden|clip|scroll|auto/.test(cs.overflow + cs.overflowX + cs.overflowY);
      if (!clips) continue;
      const c = n.getBoundingClientRect();
      box = { l: Math.max(box.l, c.left), t: Math.max(box.t, c.top),
              r: Math.min(box.r, c.right), b: Math.min(box.b, c.bottom) };
      if (box.r <= box.l || box.b <= box.t) break;   // clipped away entirely
    }
    return { l: box.l + window.scrollX, t: box.t + window.scrollY,
             r: box.r + window.scrollX, b: box.b + window.scrollY };
  };
  const rs = nodes.map(rect);
  const visible = rs.map(r => r.r > r.l && r.b > r.t);
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (!visible[i] || !visible[j]) continue;
      if (a.contains(b) || b.contains(a)) continue;
      // a before/after comparison stacks its two images by design
      const cmp = '.ba__stage, .comparison, .compare-image, .compare-before';
      if (a.closest(cmp) && b.closest(cmp)) continue;
      const A = rs[i], B = rs[j];
      const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l);
      const oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
      if (ox > 6 && oy > 6) {
        const area = ox * oy;
        const smaller = Math.min((A.r-A.l)*(A.b-A.t), (B.r-B.l)*(B.b-B.t));
        if (area / smaller > 0.12) {   // meaningful, not a 1px kiss
          const name = e => ((e.className && e.className.toString()) || e.tagName).slice(0, 30)
                          + ' «' + (e.textContent || '').trim().slice(0, 26) + '»';
          out.push({ a: name(a), b: name(b), overlap: Math.round(ox) + 'x' + Math.round(oy) });
        }
      }
    }
  }
  const seen = new Set();
  return out.filter(o => { const k = o.a + o.b; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 25);
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let total = 0;
  for (const [w, h, mob] of [[1920,1000,false],[1440,900,false],[1280,900,false],[1024,800,false],
                              [768,900,true],[430,932,true],[390,844,true],[360,800,true],[320,568,true]]) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, isMobile:mob, hasTouch:mob });
    if (/^https/.test(TARGET)) await pipe(ctx);
    const p = await ctx.newPage();
    await p.goto(TARGET, { waitUntil:'domcontentloaded', timeout:60000 });
    await p.waitForTimeout(4200);
    const H = await p.evaluate(()=>document.documentElement.scrollHeight);
    for (let y=0; y<H; y+=450){ await p.evaluate(v=>window.scrollTo(0,v),y); await p.waitForTimeout(130); }
    await p.evaluate(()=>window.scrollTo(0,0));

    // Entrances move things. Measuring while one is still playing reports a
    // position the element is only passing through, which reads as a
    // collision that never appears on screen. Wait for every transform to
    // settle to identity, then measure twice and keep only what both agree
    // on — a transient state cannot survive both passes.
    await p.waitForFunction(() => {
      const moving = [...document.querySelectorAll('h1,h2,h3,p,li,figure,.image-slot,[data-anim]')]
        .filter(e => {
          const t = getComputedStyle(e).transform;
          if (t === 'none') return false;
          const m = t.match(/matrix\(([^)]+)\)/);
          if (!m) return true;
          const v = m[1].split(',').map(Number);
          return Math.abs(v[4]) > 0.5 || Math.abs(v[5]) > 0.5;   // still offset
        });
      return moving.length === 0;
    }, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1200);

    const first = await p.evaluate(detect);
    await p.waitForTimeout(900);
    const second = await p.evaluate(detect);
    const key = o => o.a + '|' + o.b;
    const inBoth = new Set(second.map(key));
    const hits = first.filter(o => inBoth.has(key(o)));
    total += hits.length;
    console.log(`\n${LABEL} @ ${w}px — ${hits.length ? hits.length + ' OVERLAP(S)' : 'clean'}`);
    hits.forEach(o => console.log(`   ${o.overlap}  ${o.a}\n            ON  ${o.b}`));
    await ctx.close();
  }
  console.log(`\n${LABEL}: ${total} total overlaps across 9 widths`);
  await b.close();
  process.exit(total === 0 ? 0 : 1);
})();
