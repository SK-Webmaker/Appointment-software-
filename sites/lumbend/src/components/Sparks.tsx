import { useEffect, useRef } from "react";
import { useReducedMotionSafe } from "@/lib/motion";

type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };

/**
 * Every click throws sparks in the lamp's current colour. One canvas over the
 * page; it only draws while sparks are alive, then goes completely idle.
 * Off under reduced motion.
 */
export function Sparks() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotionSafe();

  useEffect(() => {
    if (reduce) return undefined;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;
    let parts: P[] = [];
    let raf = 0;
    let colour = "#ffb547";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalCompositeOperation = "lighter";
      parts = parts.filter((p) => p.life < p.max);
      for (const p of parts) {
        p.life += 1;
        p.vy += 0.18;
        p.vx *= 0.98;
        p.x += p.vx;
        p.y += p.vy;
        const a = Math.max(0, 1 - p.life / p.max);
        ctx.globalAlpha = a;
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a * 0.25;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3 * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = parts.length ? requestAnimationFrame(tick) : 0;
    };
    const burst = (e: PointerEvent) => {
      colour = getComputedStyle(document.documentElement).getPropertyValue("--glow").trim() || colour;
      for (let i = 0; i < 26; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 6;
        parts.push({ x: e.clientX, y: e.clientY, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2.5, life: 0, max: 34 + Math.random() * 26, size: 1.2 + Math.random() * 2.2 });
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointerdown", burst, { passive: true });
    window.addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", burst);
      window.removeEventListener("resize", size);
    };
  }, [reduce]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[110] h-full w-full" />;
}
