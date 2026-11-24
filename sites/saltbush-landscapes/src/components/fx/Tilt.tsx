import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useReducedMotionSafe } from "@/lib/motion";
import { useFinePointer } from "./intro";

/**
 * A card that tilts toward the mouse in 3D, with a soft highlight that
 * follows the pointer across its surface. Mouse only; flat everywhere else.
 */
export function Tilt({
  children,
  className = "",
  max = 9,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const fine = useFinePointer();
  const reduce = useReducedMotionSafe();
  const on = fine && !reduce;
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 200, damping: 20 });
  const sy = useSpring(py, { stiffness: 200, damping: 20 });
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const glareX = useTransform(sx, (v) => `${v * 100}%`);
  const glareY = useTransform(sy, (v) => `${v * 100}%`);
  const glare = useTransform(
    [glareX, glareY] as never,
    ([gx, gy]: string[]) =>
      `radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.35), transparent 55%)`,
  );

  return (
    <div className={`[perspective:900px] ${className}`}>
      <motion.div
        ref={ref}
        className="group/tilt relative h-full [transform-style:preserve-3d]"
        style={on ? { rotateX, rotateY } : {}}
        onPointerMove={(e) => {
          if (!on || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => {
          px.set(0.5);
          py.set(0.5);
        }}
      >
        {children}
        {on && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
            style={{ background: glare }}
            aria-hidden="true"
          />
        )}
      </motion.div>
    </div>
  );
}
