import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { Img } from "./Img";
import { SectionHead } from "./Section";
import { PROCESS, SITE } from "@/site.config";
import { useReducedMotionSafe } from "@/lib/motion";

const TONES = [
  "bg-noir text-white",
  "bg-onyx text-white",
  "bg-candy text-ink",
  "bg-card text-ink",
] as const;

/**
 * How a garden happens: four steps as a stack of cards. Each one pins under
 * the header and the next slides up over it, while the ones beneath shrink
 * back a little — like a pile of plans on a table.
 */
export function Process() {
  const list = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: list, offset: ["start start", "end end"] });
  return (
    <section
      id="process"
      className="bg-white py-20 text-ink md:py-28"
      aria-labelledby="process-title"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="process-title"
          label="How we work"
          title="From a walk around the garden to the first flowers"
          intro={`We're a small team based in the Hills, designing and building gardens here since ${SITE.est}. The same people who draw your plan are the ones who plant it.`}
        />
        <ol ref={list} className="mt-12">
          {PROCESS.map((p, i) => (
            <Step key={p.title} i={i} n={PROCESS.length} step={p} progress={scrollYProgress} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function Step({
  i,
  n,
  step,
  progress,
}: {
  i: number;
  n: number;
  step: (typeof PROCESS)[number];
  progress: MotionValue<number>;
}) {
  const reduce = useReducedMotionSafe();
  const scale = useTransform(progress, [i / n, 1], [1, 1 - (n - 1 - i) * 0.045]);
  return (
    <li
      className="sticky mb-[16vh] last:mb-0"
      style={{ top: `calc(var(--nav-h) + 20px + ${i * 20}px)` }}
    >
      <motion.div
        className={`grid origin-top overflow-hidden rounded-[22px] shadow-[0_-24px_60px_-34px_rgba(30,42,34,0.55)] md:min-h-[420px] md:grid-cols-[1.05fr_1fr] ${TONES[i % 4]}`}
        style={reduce ? {} : { scale }}
      >
        <div className="relative aspect-[16/10] md:aspect-auto">
          <Img
            name={step.image}
            widths={[800, 1200]}
            sizes="(min-width:768px) 640px, 92vw"
            alt={step.alt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-col justify-between gap-6 p-7 md:p-12">
          <span className="font-display text-[clamp(80px,13vw,170px)] leading-[0.8] opacity-90">
            0{i + 1}
          </span>
          <div>
            <h3 className="font-display text-[clamp(28px,3.6vw,46px)] leading-tight">
              {step.title}
            </h3>
            <p className="mt-3 max-w-[44ch] text-[17px] leading-relaxed opacity-85">{step.text}</p>
          </div>
        </div>
      </motion.div>
    </li>
  );
}
