import { useEffect, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/lib/motion";
import { useFinePointer } from "./intro";

/**
 * A custom cursor for mouse users: a dot that sits on the pointer and a ring
 * that trails it. Over links and buttons the ring swells; elements with
 * data-cursor="View" (etc.) show that word inside it. Touch and reduced
 * motion keep the normal cursor.
 */
export function Cursor({ color = "#0f5c56" }: { color?: string }) {
  const fine = useFinePointer();
  const reduce = useReducedMotionSafe();
  const on = fine && !reduce;
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");
  const [hot, setHot] = useState(false);

  useEffect(() => {
    if (!on) return undefined;
    document.documentElement.classList.add("has-cursor");
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let rx = x;
    let ry = y;
    let raf = 0;
    let visible = false;
    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(loop) : 0;
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (!visible && dot.current && ring.current) {
        visible = true;
        dot.current.style.opacity = "1";
        ring.current.style.opacity = "1";
      }
      if (!raf) raf = requestAnimationFrame(loop);
      const t = (e.target as Element | null)?.closest?.(
        "a,button,[role=tab],summary,label,[data-cursor]",
      );
      setHot(!!t);
      setLabel(t?.getAttribute("data-cursor") ?? "");
    };
    const leave = () => {
      visible = false;
      if (dot.current) dot.current.style.opacity = "0";
      if (ring.current) ring.current.style.opacity = "0";
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [on]);

  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[120]" aria-hidden="true">
      <div
        ref={ring}
        className="absolute left-0 top-0 opacity-0 transition-opacity duration-300"
        style={{ willChange: "transform" }}
      >
        <div
          className="-ml-5 -mt-5 grid h-10 w-10 place-items-center rounded-full border-2 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition-[transform,background-color] duration-300 ease-out"
          style={{
            borderColor: color,
            background: label ? color : "transparent",
            transform: `scale(${label ? 2.2 : hot ? 1.6 : 1})`,
          }}
        >
          <span style={{ transform: `scale(${label ? 0.45 : 1})` }}>{label}</span>
        </div>
      </div>
      <div
        ref={dot}
        className="absolute left-0 top-0 opacity-0"
        style={{ willChange: "transform" }}
      >
        <div className="-ml-1 -mt-1 h-2 w-2 rounded-full" style={{ background: color }} />
      </div>
    </div>
  );
}
