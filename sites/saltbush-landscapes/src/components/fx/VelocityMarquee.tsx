import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { useRef } from "react";
import { useReducedMotionSafe } from "@/lib/motion";

const wrap = (min: number, max: number, v: number) => {
  const r = max - min;
  return ((((v - min) % r) + r) % r) + min;
};

/**
 * Giant words sliding across the screen. Scroll faster and they speed up and
 * lean into it; scroll up and they run backwards. Decorative — the same words
 * are elsewhere on the page.
 */
export function VelocityMarquee({
  items,
  speed = 3,
  direction = 1,
  className = "",
  outline = false,
}: {
  items: readonly string[];
  speed?: number;
  direction?: 1 | -1;
  className?: string;
  outline?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduce = useReducedMotionSafe();
  const base = useMotionValue(0);
  const { scrollY } = useScroll();
  const vel = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const factor = useTransform(vel, [-2500, 0, 2500], [-6, 0, 6], { clamp: false });
  const skew = useTransform(vel, [-2500, 0, 2500], [8, 0, -8]);
  const x = useTransform(base, (v) => `${wrap(-50, 0, v)}%`);
  const dir = useRef(direction);

  useAnimationFrame((_, delta) => {
    if (!inView || reduce) return;
    let move = dir.current * speed * (delta / 1000);
    const f = factor.get();
    if (f < 0) dir.current = -direction as 1 | -1;
    else if (f > 0) dir.current = direction;
    move += dir.current * move * Math.abs(f);
    base.set(base.get() + move);
  });

  const row = [...items, ...items];
  return (
    <div ref={ref} className={`overflow-hidden ${className}`} aria-hidden="true" data-qa="scroller">
      <motion.div
        className="flex w-max whitespace-nowrap will-change-transform"
        style={{ x, skewX: skew }}
      >
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0">
            {row.map((t, i) => (
              <span
                key={i}
                className="mx-[0.35em] inline-flex items-center gap-[0.35em]"
                style={
                  outline && i % 2
                    ? { color: "transparent", WebkitTextStroke: "2px currentColor" }
                    : undefined
                }
              >
                {t}
                <span className="inline-block h-[0.28em] w-[0.28em] rounded-full bg-current opacity-60" />
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
