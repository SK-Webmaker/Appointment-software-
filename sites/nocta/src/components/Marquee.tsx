import { motion, useScroll, useSpring, useTransform, useVelocity } from "framer-motion";
import { useRef } from "react";
import { MARQUEE } from "@/site.config";
import { Mark } from "./Logo";

/**
 * The one full-bleed amber band. Two rows of giant words slide in opposite
 * directions with the scroll and lean with its speed. Decorative — the same
 * words are elsewhere on the page. Its bottom padding is what the next sheet
 * slides over.
 */
export function Marquee() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const velocity = useVelocity(scrollY);
  const skew = useSpring(useTransform(velocity, [-2500, 0, 2500], [8, 0, -8], { clamp: true }), { stiffness: 200, damping: 40 });
  const a = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const b = useTransform(scrollYProgress, [0, 1], ["-30%", "0%"]);
  const row = [...MARQUEE, ...MARQUEE, ...MARQUEE];

  return (
    <div ref={ref} className="relative overflow-hidden bg-amber pb-[calc(2.5rem+36px)] pt-10 text-void md:pb-[calc(3.5rem+48px)] md:pt-14" aria-hidden="true">
      {[a, b].map((x, r) => (
        <motion.div key={r} className="flex w-max items-center gap-8 whitespace-nowrap will-change-transform md:gap-12" style={{ x, skewX: skew }}>
          {row.map((t, i) => (
            <span
              key={i}
              className={`flex items-center gap-8 font-display text-[clamp(56px,10vw,160px)] font-extrabold uppercase leading-[1] tracking-[-0.04em] md:gap-12 ${
                (i + r) % 2 ? "font-serif font-normal normal-case italic tracking-[-0.02em]" : ""
              }`}
            >
              {t}
              <span className="text-void/80">
                <Mark size={44} />
              </span>
            </span>
          ))}
        </motion.div>
      ))}
    </div>
  );
}
