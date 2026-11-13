import { useEffect, useRef } from "react";
import { useLightsOff } from "@/lib/lights";

/**
 * Lights off: everything goes dark except a pool of light around the mouse
 * (or the middle of the screen on touch). Sits under the header, so the
 * switch to turn the lights back on is always visible.
 */
export function Flashlight() {
  const off = useLightsOff();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!off) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    const paint = () => {
      raf = 0;
      el.style.setProperty("--fx", `${x}px`);
      el.style.setProperty("--fy", `${y}px`);
    };
    paint();
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      raf ||= requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
    };
  }, [off]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[45] transition-opacity duration-700 ${off ? "opacity-100" : "opacity-0"}`}
      style={{
        background:
          "radial-gradient(circle 260px at var(--fx, 50%) var(--fy, 50%), transparent 0%, color-mix(in oklab, var(--glow) 6%, transparent) 45%, rgba(4,3,8,0.95) 100%)",
      }}
    />
  );
}
