import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { lockScroll } from "@/lib/smooth";
import { markIntroDone } from "./intro";

const EASE = [0.76, 0, 0.24, 1] as const;

/**
 * The opening: a count from 0 to 100 over the brand, then the screen splits
 * and slides away top and bottom to reveal the page. Rendered on the server
 * so it covers the first paint; a CSS fail-safe (.curtain) lifts it even if
 * JavaScript never runs. Reduced motion gets a short fade.
 */
export function Preloader({
  children,
  bg = "#0f2b2a",
  accent = "#ffb59f",
}: {
  children: ReactNode;
  bg?: string;
  accent?: string;
}) {
  const [n, setN] = useState(0);
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFade(reduce);
    const release = lockScroll();
    const total = reduce ? 300 : 1300;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / total);
      setN(Math.round(100 * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
      else
        window.setTimeout(
          () => {
            setShow(false);
            release();
            markIntroDone();
          },
          reduce ? 0 : 180,
        );
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      release();
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="pre"
          className="curtain fixed inset-0 z-[100] text-white"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          exit={fade ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: fade ? 0.4 : 0.9 }}
        >
          <motion.div
            className="absolute inset-x-0 top-0 h-1/2"
            style={{ background: bg }}
            exit={fade ? {} : { y: "-100%" }}
            transition={{ duration: 0.9, ease: EASE }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: bg }}
            exit={fade ? {} : { y: "100%" }}
            transition={{ duration: 0.9, ease: EASE }}
          />
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
          >
            {children}
            <div className="mt-8 h-[3px] w-[min(60vw,280px)] overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full origin-left rounded-full"
                style={{ background: accent, transform: `scaleX(${n / 100})` }}
              />
            </div>
            <p
              className="absolute bottom-8 right-8 font-sans text-[clamp(56px,12vw,140px)] font-bold leading-none tabular-nums tracking-[-0.04em]"
              style={{ color: accent }}
            >
              {n}
              <span className="text-[0.35em] align-top">%</span>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
