import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/lib/motion";

/**
 * A number that rolls to its new value whenever it changes, like a meter.
 * The exact value is always in the page for screen readers (and anyone
 * copying it); the rolling figure is decoration.
 */
/** The rolling value on its own, for figures built from several numbers. */
export function useTweened(value: number, duration = 0.7) {
  const reduce = useReducedMotionSafe();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) {
      from.current = value;
      setShown(value);
      return undefined;
    }
    const c = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => c.stop();
  }, [value, reduce, duration]);
  return shown;
}

export function Tween({
  value,
  format,
  duration = 0.7,
  className = "",
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const shown = useTweened(value, duration);
  return (
    <span className={`tabular-nums ${className}`}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}
