import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/smooth";

/**
 * A short brand reveal. It is rendered on the server, so it is the very first
 * thing painted, and lifts ~1.4s after the page comes alive. Reduced motion
 * skips it; a CSS fail-safe (.curtain in styles.css) lifts it even if
 * JavaScript never runs.
 */
export function Curtain() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShow(false);
      return undefined;
    }
    lockScroll(true);
    const t = window.setTimeout(() => setShow(false), 1450);
    return () => {
      window.clearTimeout(t);
      lockScroll(false);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="curtain"
          className="curtain fixed inset-0 z-[100] flex items-center justify-center bg-espresso"
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: 1.05, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden="true"
        >
          <motion.div
            className="flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <svg viewBox="0 0 120 150" className="h-20 w-16" fill="none">
              <motion.path
                d="M6 146V60a54 54 0 0 1 108 0v86"
                stroke="#C9A876"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
              />
            </svg>
            <p className="opsz-sm mt-5 font-display text-[28px] leading-none text-cream">
              The Beauty <em className="text-gold">L'atelier</em>
            </p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-label text-gold/80">Beauty · Care · Confidence</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
