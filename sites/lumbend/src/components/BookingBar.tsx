import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { GASES, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

/**
 * The always-there call to action. On phones it’s a bar in the thumb zone; on
 * desktop a small pill. It waits until the opening scene has played, and steps
 * aside while the booking chapter itself is on screen.
 */
export function BookingBar() {
  const { shape, gas, started, openSheet, sheetOpen } = useBooking();
  const [show, setShow] = useState(false);

  // Position-based rather than an IntersectionObserver: a jump link can carry
  // the page straight past the hero without any edge ever being "crossed".
  // Section edges are measured in page coordinates on load and resize, never
  // while scrolling — reading layout mid-scroll makes the browser redo it.
  useEffect(() => {
    let marks = { first: Infinity, bookTop: Infinity, bookBottom: -Infinity, footerTop: Infinity };
    const measure = () => {
      const abs = (el: Element | null | undefined) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
      };
      const first = abs(document.getElementById("why"));
      const book = abs(document.getElementById("preorder"));
      const footer = abs(document.querySelector("footer"));
      marks = {
        first: first?.top ?? Infinity,
        bookTop: book?.top ?? Infinity,
        bookBottom: book?.bottom ?? -Infinity,
        footerTop: footer?.top ?? Infinity,
      };
    };
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const pastHero = marks.first - y < vh * 0.9;
      const onBook = marks.bookTop - y < vh * 0.85 && marks.bookBottom - y > 0;
      const onFooter = marks.footerTop - y < vh;
      setShow(pastHero && !onBook && !onFooter);
    };
    const onScroll = () => (raf ||= requestAnimationFrame(update));
    const remeasure = () => {
      measure();
      onScroll();
    };
    measure();
    update();
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
    };
  }, []);

  const gasName = GASES.find((g) => g.symbol === gas)?.name;
  const label = [shape && `The ${shape}`, gasName].filter(Boolean).join(" · ") || SITE.product;

  return (
    <AnimatePresence>
      {show && !sheetOpen && (
        <motion.div
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:inset-x-auto md:bottom-8 md:right-8"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            onClick={openSheet}
            className="group flex w-full items-center justify-between gap-4 rounded-full bg-night/90 py-2 pl-6 pr-2 text-left text-bone shadow-[0_18px_50px_-14px_rgba(155,107,255,0.55)] ring-1 ring-bone/15 backdrop-blur-md md:w-auto md:min-w-[340px]"
          >
            <span className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={started ? "request" : "idle"}
                  className="block"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {started ? (
                    <>
                      <span className="block stamp text-[10px] text-amber">Your lamp</span>
                      <span className="block truncate text-[14.5px]">{label}</span>
                    </>
                  ) : (
                    <>
                      <span className="block stamp text-[10px] text-amber">{SITE.role}</span>
                      <span className="block truncate text-[14.5px]">Pre-orders open</span>
                    </>
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-amber px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-void transition-colors group-hover:bg-bone">
              Order <ArrowUpRight size={16} strokeWidth={2} />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
