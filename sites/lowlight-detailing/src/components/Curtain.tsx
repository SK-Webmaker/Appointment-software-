import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/smooth";
import { Wordmark } from "./Logo";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A short reveal: three light streaks sweep across the dark bay like
 * reflections down a bonnet, then the badge lights up. Rendered on the server so it is the first paint;
 * reduced motion fades it; a CSS fail-safe (.curtain) lifts it even if
 * JavaScript never runs.
 */
export function Curtain() {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    setFade(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const release = lockScroll();
    const t = window.setTimeout(() => {
      setShow(false);
      release();
    }, 1500);
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
          className="curtain fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-noir"
          initial={fade ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)" }}
          exit={fade ? { opacity: 0 } : { clipPath: "inset(0% 100% 0% 0%)" }}
          transition={
            fade ? { duration: 0.6, ease: "easeOut" } : { duration: 1, ease: [0.76, 0, 0.24, 1] }
          }
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 800 800"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            fill="none"
          >
            {[
              { d: "M-100 520 L 900 300", c: "#9BE6FF", w: 3, delay: 0 },
              { d: "M-100 560 L 900 340", c: "#B3A8FF", w: 1.5, delay: 0.08 },
              { d: "M-100 600 L 900 380", c: "#FF9AD5", w: 1, delay: 0.16 },
            ].map((s) => (
              <motion.path
                key={s.d}
                d={s.d}
                stroke={s.c}
                strokeOpacity={0.5}
                strokeWidth={s.w}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, delay: s.delay, ease: [0.65, 0, 0.35, 1] }}
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
            <Wordmark size={78} tone="light" />
            <span className="mt-6 h-px w-14 bg-ivory/30" />
            <span className="aside mt-5 text-[22px] text-pearl">
              Sharp cuts, hot towels, no rush.
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
