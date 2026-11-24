import { useEffect } from "react";
import { useReducedMotionSafe } from "@/lib/motion";
import { useFinePointer } from "./intro";

const COLOURS = ["#ffd23f", "#9ad7ff", "#ff7eb6", "#ffffff"];

/**
 * A trail of little four-point sparkles behind the mouse, as if everything it
 * passes is freshly polished. Plain DOM nodes with a CSS animation, removed
 * as they finish; at most a couple of dozen at once. Mouse users only.
 */
export function Sparkles() {
  const fine = useFinePointer();
  const reduce = useReducedMotionSafe();
  useEffect(() => {
    if (!fine || reduce) return undefined;
    const box = document.createElement("div");
    box.setAttribute("aria-hidden", "true");
    box.className = "pointer-events-none fixed inset-0 z-[95] overflow-hidden";
    document.body.appendChild(box);
    let last = 0;
    let lx = 0;
    let ly = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      if (now - last < 45 || Math.hypot(e.clientX - lx, e.clientY - ly) < 14) return;
      last = now;
      lx = e.clientX;
      ly = e.clientY;
      if (box.childElementCount > 24) box.firstElementChild?.remove();
      const s = document.createElement("span");
      const size = 8 + Math.random() * 12;
      s.className = "sparkle";
      s.style.left = `${e.clientX + (Math.random() - 0.5) * 18}px`;
      s.style.top = `${e.clientY + (Math.random() - 0.5) * 18}px`;
      s.style.width = s.style.height = `${size}px`;
      s.style.color = COLOURS[Math.floor(Math.random() * COLOURS.length)]!;
      s.innerHTML =
        '<svg viewBox="0 0 20 20" width="100%" height="100%"><path d="M10 0C11 7 13 9 20 10C13 11 11 13 10 20C9 13 7 11 0 10C7 9 9 7 10 0Z" fill="currentColor"/></svg>';
      s.addEventListener("animationend", () => s.remove(), { once: true });
      box.appendChild(s);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      box.remove();
    };
  }, [fine, reduce]);
  return null;
}
