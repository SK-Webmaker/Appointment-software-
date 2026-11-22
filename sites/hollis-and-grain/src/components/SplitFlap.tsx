import { useEffect, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/lib/motion";

const CHARS = "ABCDEFGHIJKLMNOPRSTUVWXYZ0123456789:";

/**
 * A departure-board word: one tile per letter. When the board scrolls into
 * view (or the word changes), every tile clatters through random letters and
 * lands on its own, left to right. The real text is for screen readers; the
 * tiles are decoration.
 */
export function SplitFlap({
  text,
  size = "md",
  className = "",
}: {
  text: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const reduce = useReducedMotionSafe();
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  const [shown, setShown] = useState(text);
  const target = text.toUpperCase();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setSeen(true), {
      rootMargin: "0px 0px -10% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || reduce) {
      setShown(target);
      return undefined;
    }
    let frame = 0;
    const settle = (i: number) => 5 + i * 2;
    const last = settle(target.length - 1);
    const t = window.setInterval(() => {
      frame++;
      setShown(
        [...target]
          .map((ch, i) =>
            ch === " " || frame >= settle(i) ? ch : CHARS[Math.floor(Math.random() * CHARS.length)],
          )
          .join(""),
      );
      if (frame >= last) window.clearInterval(t);
    }, 55);
    return () => window.clearInterval(t);
  }, [seen, target, reduce]);

  const tile = size === "sm" ? "h-[28px] w-[18px] text-[17px] md:h-[30px] md:w-[21px] md:text-[19px]" : "h-[44px] w-[30px] text-[30px]";
  return (
    <span ref={ref} className={`inline-flex gap-[3px] ${className}`}>
      <span className="sr-only">{text}</span>
      {[...shown.padEnd(target.length)].map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`relative grid place-items-center overflow-hidden rounded-[3px] bg-[#0d0a09] font-display font-extrabold leading-none text-ivory shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)] ${tile} ${ch === " " ? "bg-transparent shadow-none" : ""}`}
        >
          {ch === " " ? "" : ch}
          {ch !== " " && <span className="absolute inset-x-0 top-1/2 h-px bg-black/70" />}
        </span>
      ))}
    </span>
  );
}
