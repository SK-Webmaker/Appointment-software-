import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/lib/motion";

/** A number that counts up from zero the first time it comes into view. */
export function Counter({
  to,
  duration = 1.6,
  format = (n: number) => String(Math.round(n)),
  className = "",
}: {
  to: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotionSafe();
  const [v, setV] = useState(to);
  useEffect(() => {
    if (!inView || reduce) {
      setV(to);
      return undefined;
    }
    const c = animate(0, to, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, reduce, to, duration]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(v)}
    </span>
  );
}
