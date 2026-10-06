import { animate, useInView } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { MoveHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Img } from "./Img";

/**
 * Before / after, with a handle you can drag (or move with the arrow keys).
 * The first time it comes into view the handle sweeps once to show it moves.
 */
export function Compare() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const touched = useRef(false);
  const reduce = useReducedMotionSafe();
  const inView = useInView(ref, { once: true, margin: "0px 0px -25% 0px" });

  useEffect(() => {
    if (!inView || reduce || touched.current) return undefined;
    const controls = animate(84, 50, {
      duration: 1.6,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (v) => {
        if (!touched.current) setPos(v);
      },
    });
    return () => controls.stop();
  }, [inView, reduce]);

  return (
    <div ref={ref} className="relative select-none overflow-hidden rounded-t-full bg-sand shadow-[0_40px_80px_-40px_rgba(34,22,31,0.6)]" data-qa="layered">
      <Img name="nano-after" widths={[480, 720]} sizes="(min-width:1024px) 420px, 86vw" alt="After Nanoplasty: long, sleek, smooth hair with soft blonde pieces, seen from behind" className="aspect-[3/4.4] w-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Img name="nano-before" widths={[480, 720]} sizes="(min-width:1024px) 420px, 86vw" alt="Before Nanoplasty: the same client's long hair, wavy and frizzy, seen from behind" className="h-full w-full object-cover" />
      </div>

      {/* divider + handle */}
      <div className="pointer-events-none absolute inset-y-0 w-px bg-cream/90" style={{ left: `${pos}%` }} aria-hidden="true">
        <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cream text-plum shadow-lg">
          <MoveHorizontal size={20} strokeWidth={1.8} />
        </span>
      </div>
      <span className="pointer-events-none absolute bottom-5 left-5 rounded-full bg-night/75 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-cream" aria-hidden="true">
        Before
      </span>
      <span className="pointer-events-none absolute bottom-5 right-5 rounded-full bg-cream/90 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-plum" aria-hidden="true">
        After
      </span>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(pos)}
        onChange={(e) => {
          touched.current = true;
          setPos(Number(e.target.value));
        }}
        onPointerDown={() => (touched.current = true)}
        aria-label="Compare before and after Nanoplasty"
        aria-valuetext={`${Math.round(pos)}% before`}
        className="compare-range absolute inset-0 h-full w-full cursor-ew-resize touch-pan-y opacity-0"
      />
    </div>
  );
}
