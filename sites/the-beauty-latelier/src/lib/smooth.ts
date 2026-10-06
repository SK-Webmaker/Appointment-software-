import Lenis from "lenis";

/**
 * Smooth wheel scrolling on desktop, via Lenis.
 *
 * Touch is left native on purpose (syncTouch: false): iOS momentum scrolling
 * is tuned by Apple, and a JS lerp makes a phone feel worse. Reduced motion
 * gets no Lenis at all.
 *
 * Lenis writes the real window scroll position, so position: sticky and
 * framer-motion's useScroll keep working unchanged.
 */

let lenis: Lenis | null = null;

/** Clearance for the fixed header when jumping to a section. */
const ANCHOR_OFFSET = -64;

export function startSmoothScroll(): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const instance = new Lenis({
    duration: 1.1,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
    autoRaf: true,
  });
  lenis = instance;

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
    instance.scrollTo(target, { offset: target === 0 ? 0 : ANCHOR_OFFSET, force: true });
    history.pushState(null, "", href);
  };
  document.addEventListener("click", onClick);

  return () => {
    document.removeEventListener("click", onClick);
    instance.destroy();
    lenis = null;
  };
}

/** Freeze the page behind a dialog — and resume it — with or without Lenis. */
export function lockScroll(locked: boolean): void {
  document.documentElement.style.overflow = locked ? "hidden" : "";
  if (!lenis) return;
  if (locked) lenis.stop();
  else lenis.start();
}
