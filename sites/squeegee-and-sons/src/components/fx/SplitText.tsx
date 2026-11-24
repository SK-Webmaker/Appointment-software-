import { motion, useInView } from "framer-motion";
import { useRef, type ElementType } from "react";
import { useReducedMotionSafe } from "@/lib/motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A heading that arrives letter by letter: each word sits in its own mask
 * and its letters rise and untwist into place, staggered. Screen readers get
 * the plain text once (aria-label). Starts when in view, or when `go` turns
 * true (the hero waits for the preloader).
 */
export function SplitText({
  text,
  as = "h2",
  id,
  className = "",
  accent = [],
  accentClass = "",
  go,
  delay = 0,
  stagger = 0.022,
}: {
  text: string;
  as?: ElementType;
  id?: string;
  className?: string;
  /** words (as written) to colour with accentClass */
  accent?: string[];
  accentClass?: string;
  go?: boolean;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotionSafe();
  const play = go ?? inView;
  const Tag = as;
  let i = 0;
  const words = text.split(" ");
  return (
    <Tag ref={ref} id={id} className={className} aria-label={text} data-qa="layered">
      {words.map((w, wi) => (
        <span
          key={wi}
          aria-hidden="true"
          className={`inline-block overflow-hidden pb-[0.12em] align-top -mb-[0.12em] ${accent.includes(w) ? accentClass : ""}`}
        >
          {[...w].map((ch, ci) => {
            const d = delay + i++ * stagger;
            return (
              <motion.span
                key={ci}
                className="inline-block"
                initial={reduce ? false : { y: "110%", rotate: 8, opacity: 0 }}
                animate={play || reduce ? { y: "0%", rotate: 0, opacity: 1 } : {}}
                transition={{ duration: 0.8, ease: EASE, delay: d }}
              >
                {ch}
              </motion.span>
            );
          })}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </Tag>
  );
}
