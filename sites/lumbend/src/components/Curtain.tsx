import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/smooth";

/**
 * Ignition. A counter runs 000 → 100 while a filament draws across the dark,
 * then LUMBEND flickers on like a tube catching, and the dark splits open from
 * the middle. Rendered on the server so it is the first paint; under reduced
 * motion it fades instead; a CSS fail-safe (.curtain) lifts it even if
 * JavaScript never runs.
 */
export function Curtain() {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);
  const count = useMotionValue(0);
  const label = useTransform(count, (v) => String(Math.round(v)).padStart(3, "0"));

  useEffect(() => {
    setFade(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const release = lockScroll();
    const run = animate(count, 100, { duration: 1.05, ease: [0.65, 0, 0.35, 1] });
    const t = window.setTimeout(() => {
      setShow(false);
      release();
    }, 1500);
    return () => {
      run.stop();
      window.clearTimeout(t);
      release();
    };
  }, [count]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="curtain"
          className="curtain fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-void"
          initial={fade ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)" }}
          exit={fade ? { opacity: 0 } : { clipPath: "inset(50% 0% 50% 0%)" }}
          transition={fade ? { duration: 0.6, ease: "easeOut" } : { duration: 0.95, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden="true"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,rgba(155,107,255,0.18),transparent_70%)]" />
          <div className="relative flex w-full flex-col items-center">
            <span className="neon flicker-on font-display text-[clamp(44px,12vw,170px)] font-extrabold leading-none tracking-[0.04em]  [animation-delay:0.75s]">
              LUMBEND
            </span>
            <motion.span
              className="mt-8 block h-px w-[min(70vw,520px)] origin-left bg-gradient-to-r from-transparent via-amber to-transparent shadow-[0_0_14px_2px_rgba(255,181,71,0.6)]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, ease: [0.65, 0, 0.35, 1] }}
            />
            <div className="stamp mt-5 flex w-[min(70vw,520px)] justify-between text-haze">
              <span>Warming the tube</span>
              <motion.span className="text-amber">{label}</motion.span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
