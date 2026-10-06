import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { SERVICE_BY_ID, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

/**
 * The always-there call to action. On phones it's a bar in the thumb zone; on
 * desktop a small pill. It waits until the opening scene has played, and steps
 * aside while the booking chapter itself is on screen.
 */
export function BookingBar() {
  const { selected, openSheet, sheetOpen } = useBooking();
  const [show, setShow] = useState(false);

  // Position-based rather than an IntersectionObserver: a jump link can carry
  // the page straight past the hero without any edge ever being "crossed".
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const top = (id: string) => document.getElementById(id)?.getBoundingClientRect() ?? null;
      const first = top("oshi");
      const book = top("book");
      const footer = document.querySelector("footer")?.getBoundingClientRect();
      const pastHero = !!first && first.top < vh * 0.9;
      const onBook = !!book && book.top < vh * 0.85 && book.bottom > 0;
      const onFooter = !!footer && footer.top < vh;
      setShow(pastHero && !onBook && !onFooter);
    };
    const onScroll = () => (raf ||= requestAnimationFrame(update));
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const count = selected.length;

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
            className="group flex w-full items-center justify-between gap-4 rounded-full bg-espresso py-2 pl-6 pr-2 text-left text-cream shadow-[0_18px_40px_-14px_rgba(31,22,18,0.75)] ring-1 ring-champagne/25 md:w-auto md:min-w-[340px]"
          >
            <span className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={count}
                  className="block"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {count ? (
                    <>
                      <span className="block text-[10.5px] font-medium uppercase tracking-[0.22em] text-honey">Your request</span>
                      <span className="block truncate text-[14.5px]">
                        {count === 1 ? SERVICE_BY_ID[selected[0] ?? ""]?.short : `${count} services`}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block text-[10.5px] font-medium uppercase tracking-[0.22em] text-honey">{SITE.days.join(" · ")}</span>
                      <span className="block truncate text-[14.5px]">DM to book with {SITE.founder}</span>
                    </>
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-honey px-5 text-[11.5px] font-medium uppercase tracking-[0.18em] text-espresso transition-colors group-hover:bg-cream">
              Book <ArrowUpRight size={16} strokeWidth={2} />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
