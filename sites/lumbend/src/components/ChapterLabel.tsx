import { motion, useInView } from "framer-motion";
import { useEffect, useRef } from "react";
import { useReducedMotionSafe } from "@/lib/motion";
import { CHAPTERS, type ChapterId } from "@/site.config";

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEW = { once: true, margin: "0px 0px -10% 0px" } as const;

/** "[01] ——— THE STUDIO": a stamped label whose rule draws in as the chapter arrives. `dark` on bone grounds. */
export function ChapterLabel({ id, dark = false, className = "" }: { id: ChapterId; dark?: boolean; className?: string }) {
  const reduce = useReducedMotionSafe();
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) return null;
  return (
    <p className={`stamp flex items-center gap-4 ${dark ? "text-smoke" : "text-haze"} ${className}`}>
      <span className={dark ? "text-ember" : "text-amber"}>[{c.numeral}]</span>
      <motion.span
        className={`h-px w-12 origin-left ${dark ? "bg-void/40" : "bg-bone/40"}`}
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={VIEW}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <Scramble text={c.label} reduce={reduce} />
    </p>
  );
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#*/+";

/** The label types itself in: random glyphs settle into the words, left to right. */
function Scramble({ text, reduce }: { text: string; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, VIEW);
  useEffect(() => {
    const el = ref.current;
    if (!inView || reduce || !el) return undefined;
    let frame = 0;
    const total = 22;
    const t = window.setInterval(() => {
      frame += 1;
      const done = Math.floor((frame / total) * text.length);
      el.textContent = [...text]
        .map((ch, i) => (i < done || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
        .join("");
      if (frame >= total) {
        el.textContent = text;
        window.clearInterval(t);
      }
    }, 32);
    return () => {
      window.clearInterval(t);
      el.textContent = text;
    };
  }, [inView, reduce, text]);
  return (
    <span ref={ref}>
      {text}
    </span>
  );
}
