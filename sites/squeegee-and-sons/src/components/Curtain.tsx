import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/smooth";
import { Wordmark } from "./Logo";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A short reveal: three squeegee strokes sweep across the dark, then the bubble appears. Rendered on the server so it is the first paint;
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
              {
                d: "M-100 470 C 150 430, 450 430, 900 470",
                c: "#9AD7FF",
                w: 6,
                delay: 0,
              },
              {
                d: "M-100 560 C 150 520, 450 520, 900 560",
                c: "#FFD23F",
                w: 4,
                delay: 0.08,
              },
              {
                d: "M-100 650 C 150 610, 450 610, 900 650",
                c: "#FF7EB6",
                w: 2,
                delay: 0.16,
              },
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
            <span className="mt-5 max-w-[24ch] font-display text-[22px] text-pearl">
              So clean, you'll walk into it.
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
