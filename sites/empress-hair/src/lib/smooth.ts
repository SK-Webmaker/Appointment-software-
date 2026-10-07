import Lenis from "lenis";

/**
 * Smooth wheel scrolling on desktop, via Lenis.
 *
 * Touch devices get no Lenis at all: native momentum scrolling is tuned by
 * the OS, and a JS lerp makes a phone feel worse. Reduced motion gets none
 * either.
 *
 * Lenis writes the real window scroll position, so position: sticky and
 * framer-motion's useScroll keep working unchanged.
 */

let lenis: Lenis | null = null;

/**
 * Extra offset when jumping to a section. Zero on purpose: Lenis already
 * honours the html `scroll-padding-top` (header height + 12px) from
 * styles.css, exactly like the browser's own jumps on phones — adding the
 * header height here as well left every section 140px down.
 */
const ANCHOR_OFFSET = 0;

export function startSmoothScroll(): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  // Phones and tablets keep their own scrolling untouched: Lenis would only
  // sit on every touch without smoothing it. Anchors there use the native
  // smooth scroll and scroll-padding from styles.css.
  if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return () => {};

  const instance = new Lenis({
    duration: 1.1,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
    autoRaf: true,
  });
  lenis = instance;
  // Something (the opening curtain) may already be holding the page still.
  if (holds > 0) instance.stop();

  // Every in-page anchor goes through Lenis: it rewrites the scroll position
  // each frame, so a native hash jump would be undone on the next tick.
  // `force` lets a link inside the (scroll-locked) mobile menu still move
  // the page as the menu closes.
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const link = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href === "#") return;
    const target = href === "#top" ? 0 : document.getElementById(href.slice(1));
    if (target === null) return;
    e.preventDefault();
    instance.scrollTo(target, { offset: ANCHOR_OFFSET, force: true });
    history.pushState(null, "", href);
  };
  document.addEventListener("click", onClick);

  return () => {
    document.removeEventListener("click", onClick);
    instance.destroy();
    lenis = null;
  };
}

let holds = 0;

function applyLock(): void {
  const locked = holds > 0;
  document.documentElement.style.overflow = locked ? "hidden" : "";
  if (!lenis) return;
  if (locked) lenis.stop();
  else lenis.start();
}

/**
 * Freeze the page behind the opening curtain or a dialog, with or without
 * Lenis. Returns the release function. Holds stack — the page only scrolls
 * again once every holder has let go — and releasing twice is harmless.
 */
export function lockScroll(): () => void {
  holds += 1;
  applyLock();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    applyLock();
  };
}

/**
 * Opening a shared link like /#book: the browser jumps before the page has
 * finished laying out (pinned scenes and fonts change its height), so jump
 * again once it has — and stop the moment the visitor scrolls themselves.
 */
export function settleHashJump(): () => void {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return () => {};
  let cancelled = false;
  const go = () => {
    const el = document.getElementById(id);
    if (cancelled || !el) return;
    if (lenis) lenis.scrollTo(el, { offset: ANCHOR_OFFSET, immediate: true, force: true });
    else el.scrollIntoView({ block: "start" });
  };
  const timers = [120, 600, 1700].map((ms) => window.setTimeout(go, ms));
  const stop = () => {
    cancelled = true;
  };
  const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  events.forEach((e) => window.addEventListener(e, stop, { passive: true }));
  return () => {
    cancelled = true;
    timers.forEach((t) => window.clearTimeout(t));
    events.forEach((e) => window.removeEventListener(e, stop));
  };
}
