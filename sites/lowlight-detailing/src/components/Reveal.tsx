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

/**
 * Each line arrives cut in two: a pole-red slash sweeps across, then the top
 * and bottom halves slide in from opposite sides and close the cut. The
 * halves are clip-paths over two copies of the line (the second is hidden
 * from screen readers); only transforms and opacity animate.
 */
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
  // The trigger sits on the container, so every line plays in order.
  const trigger = animateOnMount
    ? { animate: "show" }
    : { whileInView: "show", viewport: { once: true, margin: "0px 0px -10% 0px" } };
  return (
    <motion.span
      className={`block ${className ?? ""}`}
      initial={reduce ? false : "hidden"}
      {...trigger}
    >
      {lines.map((line, i) => {
        const d = delay + i * 0.12;
        return (
          <span key={i} className="relative block pb-[0.06em]">
            <motion.span
              className={`block [clip-path:inset(-20%_-6%_50%_-6%)] ${lineClassName}`}
              variants={{
                hidden: { x: "-7%", opacity: 0 },
                show: {
                  x: "0%",
                  opacity: 1,
                  transition: { duration: 0.9, ease: EASE, delay: d + 0.28 },
                },
              }}
            >
              {line}
            </motion.span>
            <motion.span
              aria-hidden="true"
              className={`absolute inset-0 block [clip-path:inset(50%_-6%_-20%_-6%)] ${lineClassName}`}
              variants={{
                hidden: { x: "7%", opacity: 0 },
                show: {
                  x: "0%",
                  opacity: 1,
                  transition: { duration: 0.9, ease: EASE, delay: d + 0.28 },
                },
              }}
            >
              {line}
            </motion.span>
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-[46%] block h-[3px] w-full origin-left bg-rose"
              variants={{
                hidden: { scaleX: 0, opacity: 0 },
                show: {
                  scaleX: [0, 1, 1],
                  opacity: [1, 1, 0],
                  transition: { duration: 0.95, ease: EASE, delay: d, times: [0, 0.45, 1] },
                },
              }}
            />
          </span>
        );
      })}
    </motion.span>
  );
}

/** Words that brighten from faint to full as the block scrolls through the viewport. */
export function ScrollWords({
  text,
  className,
  wordClassName = "",
}: {
  text: string;
  className?: string;
  wordClassName?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.88", "end 0.5"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <Word
          key={i}
          progress={scrollYProgress}
          range={[i / words.length, (i + 1) / words.length]}
          reduce={!!reduce}
          className={wordClassName}
        >
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
      <motion.span style={{ opacity: reduce ? 1 : opacity }} className={className}>
        {children}
      </motion.span>{" "}
    </>
  );
}
