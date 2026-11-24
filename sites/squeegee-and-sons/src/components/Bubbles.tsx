import { useMemo, type CSSProperties } from "react";

/**
 * Soap bubbles drifting up through the opening and popping. CSS transforms
 * only, mounted only while the opening is on screen. Decorative.
 */
export function Bubbles({ on, count = 11 }: { on: boolean; count?: number }) {
  const bubbles = useMemo(() => {
    let s = 3;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    return Array.from({ length: count }, () => ({
      left: 2 + rnd() * 96,
      size: 18 + rnd() * 58,
      dur: 7 + rnd() * 7,
      delay: -rnd() * 14,
      dx: (rnd() - 0.5) * 16,
      rise: 55 + rnd() * 50,
    }));
  }, [count]);
  if (!on) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden="true">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="bubble absolute bottom-[-80px]"
          style={
            {
              left: `${b.left}%`,
              width: b.size,
              height: b.size,
              animationDuration: `${b.dur}s`,
              animationDelay: `${b.delay}s`,
              "--dx": `${b.dx}vw`,
              "--rise": `-${b.rise}vh`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
