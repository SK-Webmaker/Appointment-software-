import { useEffect, useRef } from "react";
import { useReducedMotionSafe } from "@/lib/motion";
import { useFinePointer } from "./intro";

/**
 * A soft pool of light that follows the mouse across a dark section. One
 * blurred circle moved with transforms — no repainting. Place inside a
 * relatively positioned, overflow-hidden parent.
 */
export function Spotlight({
  color = "rgb(159 227 212 / 0.22)",
  size = 720,
}: {
  color?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduce = useReducedMotionSafe();
  useEffect(() => {
    if (!fine || reduce) return undefined;
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return undefined;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    const loop = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.transform = `translate3d(${x - size / 2}px, ${y - size / 2}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    const move = (e: PointerEvent) => {
      const r = parent.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      el.style.opacity = "1";
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const leave = () => (el.style.opacity = "0");
    parent.addEventListener("pointermove", move);
    parent.addEventListener("pointerleave", leave);
    return () => {
      parent.removeEventListener("pointermove", move);
      parent.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [fine, reduce, size]);
  if (!fine || reduce) return null;
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-500 will-change-transform"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(closest-side, ${color}, transparent)`,
      }}
      aria-hidden="true"
    />
  );
}
