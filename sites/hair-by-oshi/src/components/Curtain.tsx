import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/smooth";
import { SITE } from "@/site.config";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A short brand reveal: three strands of hair draw themselves down an espresso
 * ground, then her script "Oshi" and the heart arrive. Rendered on the
 * server so it is the first paint, it lifts ~1.5s after the page comes
 * alive. Reduced motion skips it; a CSS fail-safe (.curtain) lifts it even if
 * JavaScript never runs.
 */
export function Curtain() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShow(false);
      return undefined;
    }
    // Hold the page still while the curtain is up — and let go the moment it
    // lifts (the component stays mounted, so this can't wait for cleanup).
    const release = lockScroll();
    const t = window.setTimeout(() => {
      setShow(false);
      release();
    }, 1550);
    return () => {
      window.clearTimeout(t);
      release();
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="curtain"
          className="curtain fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-espresso"
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: 1.05, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" fill="none">
            {[
              { d: "M150 -20 C 120 160, 220 260, 170 420 S 140 700, 200 820", c: "#E3CBA8", w: 1.2, delay: 0 },
              { d: "M200 -20 C 175 170, 265 280, 215 430 S 190 690, 245 820", c: "#D2A26B", w: 1, delay: 0.08 },
              { d: "M250 -20 C 230 150, 310 290, 262 440 S 236 700, 290 820", c: "#E3CBA8", w: 0.8, delay: 0.16 },
            ].map((s) => (
              <motion.path
                key={s.d}
                d={s.d}
                stroke={s.c}
                strokeOpacity={0.55}
                strokeWidth={s.w}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, delay: s.delay, ease: [0.65, 0, 0.35, 1] }}
              />
            ))}
          </svg>
          <motion.div
            className="relative flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
          >
            <span className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.34em] text-cream/80">
              <span className="h-px w-8 bg-cream/40" /> Hair by <span className="h-px w-8 bg-cream/40" />
            </span>
            <span className="relative mt-1 font-script text-[88px] leading-none text-cream">
              Oshi
              <motion.svg
                viewBox="0 0 24 22"
                className="absolute -right-6 top-2 h-6 w-7 text-mauve"
                fill="none"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.75, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <path d="M12 20.2s-7.6-4.6-9.6-9.2C.9 7.4 3.1 3 6.9 3c2.1 0 3.7 1.3 5.1 3.2C13.4 4.3 15 3 17.1 3c3.8 0 6 4.4 4.5 8-2 4.6-9.6 9.2-9.6 9.2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </motion.svg>
            </span>
            <span className="mt-4 text-[10.5px] font-medium uppercase tracking-[0.34em] text-honey">{SITE.values.join(" · ")}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
