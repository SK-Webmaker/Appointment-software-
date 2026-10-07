import { motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { CHAPTERS, type ChapterId } from "@/site.config";

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEW = { once: true, margin: "0px 0px -10% 0px" } as const;

/** "I —— MEET ESTELLE": the rule draws itself in as the chapter arrives, then the name follows. `light` on the dark grounds. */
export function ChapterLabel({ id, light = false, className = "" }: { id: ChapterId; light?: boolean; className?: string }) {
  const reduce = useReducedMotionSafe();
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) return null;
  return (
    <p className={`flex items-center gap-4 text-[11.5px] font-medium uppercase tracking-label ${light ? "text-pearl" : "text-onyx"} ${className}`}>
      <span className="font-display text-[16px] normal-case italic tracking-normal">{c.numeral}</span>
      <motion.span
        className={`h-px w-10 origin-left ${light ? "bg-pearl/50" : "bg-onyx/40"}`}
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={VIEW}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <motion.span initial={reduce ? false : { opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={VIEW} transition={{ duration: 0.9, delay: 0.2, ease: EASE }}>
        {c.label}
      </motion.span>
    </p>
  );
}
