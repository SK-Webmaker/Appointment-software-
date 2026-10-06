import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its children in once, as they enter the viewport. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "p" | "span";
}) {
  const reduce = useReducedMotionSafe();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 1.1, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

/** Each line rises out of a mask, staggered. Pass lines as an array. */
export function MaskLines({
  lines,
  className,
  lineClassName = "",
  delay = 0,
  animateOnMount = false,
}: {
  lines: ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  animateOnMount?: boolean;
}) {
  const reduce = useReducedMotionSafe();
  // The trigger sits on the container: a line that wraps is hidden entirely by
  // its own mask, so an observer on the line itself would never fire.
  const trigger = animateOnMount ? { animate: "show" } : { whileInView: "show", viewport: { once: true, margin: "0px 0px -10% 0px" } };
  return (
    <motion.span className={`block ${className ?? ""}`} initial={reduce ? false : "hidden"} {...trigger}>
      {lines.map((line, i) => (
        // Padding + negative margin give descenders and italic overhang room inside the mask.
        <span key={i} className="block overflow-hidden pb-[0.14em] -mb-[0.14em] pr-[0.08em]">
          <motion.span
            className={`block ${lineClassName}`}
            variants={{
              hidden: { y: "110%" },
              show: { y: "0%", transition: { duration: 1.15, ease: EASE, delay: delay + i * 0.09 } },
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/** Words that brighten from faint to full as the block scrolls through the viewport. */
export function ScrollWords({ text, className, wordClassName = "" }: { text: string; className?: string; wordClassName?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.88", "end 0.5"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} reduce={!!reduce} className={wordClassName}>
          {w}
        </Word>
      ))}
    </p>
  );
}

function Word({
  children,
  progress,
  range,
  reduce,
  className,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
  reduce: boolean;
  className: string;
}) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <>
      {/* Bodoni's em dash is a hairline that disappears at display sizes; set it in the sans. */}
      <motion.span style={{ opacity: reduce ? 1 : opacity }} className={children === "—" ? `font-sans font-light ${className}` : className}>
        {children}
      </motion.span>{" "}
    </>
  );
}
