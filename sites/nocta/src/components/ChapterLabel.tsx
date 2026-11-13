import { motion } from "framer-motion";
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
      <motion.span initial={reduce ? false : { opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={VIEW} transition={{ duration: 0.9, delay: 0.2, ease: EASE }}>
        {c.label}
      </motion.span>
    </p>
  );
}
