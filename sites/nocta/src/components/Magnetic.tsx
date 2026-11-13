import { motion, useSpring } from "framer-motion";
import { useRef, type ReactNode } from "react";

/**
 * Pulls its child towards the mouse while the mouse is near, then springs
 * back. Reads its own box only when the pointer enters, never on scroll.
 */
export function Magnetic({ children, strength = 0.35, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useRef<DOMRect | null>(null);
  const x = useSpring(0, { stiffness: 220, damping: 18, mass: 0.5 });
  const y = useSpring(0, { stiffness: 220, damping: 18, mass: 0.5 });
  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className}`}
      style={{ x, y }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        box.current = ref.current?.getBoundingClientRect() ?? null;
      }}
      onPointerMove={(e) => {
        const b = box.current;
        if (!b || e.pointerType !== "mouse") return;
        x.set((e.clientX - (b.left + b.width / 2)) * strength);
        y.set((e.clientY - (b.top + b.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        box.current = null;
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
