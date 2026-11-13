import { useEffect, useLayoutEffect, useState } from "react";

/** The house curve: a long, soft expo-out. Used for every entrance. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * useLayoutEffect on the client, useEffect on the server. The hero measures
 * its arch before paint; React has no layout phase on the server.
 */
export const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * prefers-reduced-motion, safe for server rendering.
 *
 * Returns false on the server and on the first client render — so both
 * produce identical markup and hydration never mismatches — then switches to
 * the real preference straight after mount. framer-motion's own hook reads
 * matchMedia during the first render, which would differ from the server.
 */
export function useReducedMotionSafe(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduce;
}
