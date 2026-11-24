import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useReducedMotionSafe } from "@/lib/motion";

const EASE = [0.76, 0, 0.24, 1] as const;

/**
 * A photo that wipes into view from below as it enters: the frame slides up
 * while the picture inside slides down by the same amount and settles from a
 * slight zoom. Transforms only, so it never repaints the picture. The trigger
 * watches the untransformed outer box, so a clipped start never hides it.
 */
export function RevealImg({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  const reduce = useReducedMotionSafe();
  const t = { duration: 1.1, ease: EASE, delay };
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div
        className="h-full w-full will-change-transform"
        initial={reduce ? false : { y: "100%" }}
        animate={seen || reduce ? { y: "0%" } : {}}
        transition={t}
      >
        <motion.div
          className="h-full w-full will-change-transform"
          initial={reduce ? false : { y: "-100%", scale: 1.25 }}
          animate={seen || reduce ? { y: "0%", scale: 1 } : {}}
          transition={{ ...t, scale: { duration: 1.6, ease: [0.22, 1, 0.36, 1], delay } }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
