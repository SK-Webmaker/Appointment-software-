import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { pointer, startPointer } from "@/lib/pointer";
import { useReducedMotionSafe } from "@/lib/motion";

/**
 * A light that follows the mouse: a sharp amber dot on the pointer and a soft
 * ring that trails it, growing over anything you can press (and showing a
 * word over elements that carry data-cursor="…"). Mouse only — touch screens
 * and reduced motion keep the normal cursor.
 */
export function Cursor() {
  const reduce = useReducedMotionSafe();
  const [on, setOn] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const rx = useSpring(pointer.x, { stiffness: 260, damping: 28, mass: 0.6 });
  const ry = useSpring(pointer.y, { stiffness: 260, damping: 28, mass: 0.6 });
  const ringX = useTransform(rx, (v) => v - 22);
  const ringY = useTransform(ry, (v) => v - 22);
  const dotX = useTransform(pointer.x, (v) => v - 3);
  const dotY = useTransform(pointer.y, (v) => v - 3);

  useEffect(() => {
    if (reduce) return undefined;
    if (!startPointer()) return undefined;
    setOn(true);
    document.documentElement.classList.add("has-cursor");
    const over = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      const tagged = t?.closest?.<HTMLElement>("[data-cursor]");
      if (tagged) return setHover(tagged.dataset["cursor"] || "");
      setHover(t?.closest?.("a,button,input,textarea,label,[role=button]") ? "" : null);
    };
    const leave = () => pointer.x.set(-200);
    window.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointerover", over);
      document.removeEventListener("pointerleave", leave);
    };
  }, [reduce]);

  if (!on) return null;
  const big = hover !== null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[120]">
      <motion.div className="absolute left-0 top-0 h-11 w-11" style={{ x: ringX, y: ringY }}>
        <div
          className={`grid h-full w-full place-items-center rounded-full border transition-[transform,background-color,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            big ? "scale-[1.9] border-amber/0 bg-amber/90" : "scale-100 border-bone/40 bg-transparent"
          }`}
        >
          <span className={`stamp text-[5px] tracking-[0.18em] text-void transition-opacity duration-300 ${hover ? "opacity-100" : "opacity-0"}`}>{hover}</span>
        </div>
      </motion.div>
      <motion.div
        className={`absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-amber shadow-[0_0_12px_3px_rgba(255,181,71,0.7)] transition-opacity duration-300 ${big ? "opacity-0" : "opacity-100"}`}
        style={{ x: dotX, y: dotY }}
      />
    </div>
  );
}
