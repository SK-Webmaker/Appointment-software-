import { useMemo, type CSSProperties } from "react";

/** Gum leaves and the odd dry one, in the colours of the garden. */
const COLOURS = ["#7d9474", "#93a88a", "#5f7a5c", "#b7a66c", "#a9b8a0", "#c48a4a"];

/** A narrow, slightly curved gum leaf with its midrib. */
function GumLeaf({ colour }: { colour: string }) {
  return (
    <svg viewBox="0 0 24 64" className="h-full w-full" aria-hidden="true">
      <path d="M12 1C20 14 21 38 12 63C3 40 3 16 12 1Z" fill={colour} />
      <path d="M12 4C13 22 13 42 12 61" stroke="rgb(0 0 0 / 0.18)" strokeWidth="1" fill="none" />
    </svg>
  );
}

/**
 * Leaves drifting down the screen, swaying as they fall. Pure CSS transforms
 * (two nested layers per leaf: one falls, one sways), and only mounted while
 * the scene is on screen — so nothing runs once you've scrolled past.
 */
export function Leaves({ on, count = 16 }: { on: boolean; count?: number }) {
  const leaves = useMemo(() => {
    // fixed seed so server and browser agree
    let s = 7;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    return Array.from({ length: count }, (_, i) => ({
      left: 3 + rnd() * 94,
      size: 22 + rnd() * 28,
      dur: 9 + rnd() * 8,
      delay: -rnd() * 16,
      sway: 2.6 + rnd() * 2.4,
      dx: (rnd() - 0.5) * 24,
      spin: (rnd() > 0.5 ? 1 : -1) * (200 + rnd() * 340),
      colour: COLOURS[i % COLOURS.length]!,
      blur: i % 5 === 0,
    }));
  }, [count]);
  if (!on) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden="true">
      {leaves.map((l, i) => (
        <span
          key={i}
          className="leaf-fall absolute top-0"
          style={
            {
              left: `${l.left}%`,
              width: l.size * 0.38,
              height: l.size,
              animationDuration: `${l.dur}s`,
              animationDelay: `${l.delay}s`,
              "--dx": `${l.dx}vw`,
              "--spin": `${l.spin}deg`,
              opacity: l.blur ? 0.55 : 0.95,
            } as CSSProperties
          }
        >
          <span
            className="leaf-sway block h-full w-full"
            style={{ animationDuration: `${l.sway}s`, animationDelay: `${l.delay / 3}s` }}
          >
            <GumLeaf colour={l.colour} />
          </span>
        </span>
      ))}
    </div>
  );
}
