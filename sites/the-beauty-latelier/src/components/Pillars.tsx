import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";

const PILLARS = [
  { n: "01", lead: "Independent", rest: "in vision.", tone: "bg-champagne text-espresso", accent: "text-[#5C4426]" },
  { n: "02", lead: "Intentional", rest: "in every detail.", tone: "bg-card text-espresso", accent: "text-bronze-deep" },
  { n: "03", lead: "Committed", rest: "to delivering exactly what I say I will.", tone: "bg-espresso text-cream", accent: "text-gold" },
];

/** Chapter V — her three promises, stacking as you scroll. */
export function Pillars() {
  const stack = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stack, offset: ["start start", "end end"] });

  return (
    <section id="promise" className="relative bg-linen pb-24 pt-24 md:pb-32 md:pt-32" aria-labelledby="promise-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="promise" />
        <h2 id="promise-title" className="mt-8 max-w-[16ch] text-[clamp(38px,8vw,92px)] leading-[0.98] text-espresso">
          <MaskLines lines={[<>Every promise is one</>, <em className="text-bronze">I intend to keep.</em>]} />
        </h2>
        <Reveal>
          <p className="mt-8 max-w-[46ch] text-[16px] leading-[1.8] text-mocha md:text-[17px]">
            Every detail is considered. Every service is performed with care. Built with intention, created with purpose — a vision turned into something real.
          </p>
        </Reveal>

        <div ref={stack} className="relative mt-16 md:mt-24" data-qa="layered">
          {PILLARS.map((p, i) => (
            <Card key={p.n} i={i} total={PILLARS.length} progress={scrollYProgress} {...p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Card({
  i,
  total,
  progress,
  n,
  lead,
  rest,
  tone,
  accent,
}: {
  i: number;
  total: number;
  progress: MotionValue<number>;
  n: string;
  lead: string;
  rest: string;
  tone: string;
  accent: string;
}) {
  const reduce = useReducedMotionSafe();
  // Each card shrinks a touch once the next one starts to cover it.
  const start = i / total;
  const scale = useTransform(progress, [start, 1], [1, 1 - (total - 1 - i) * 0.04]);
  return (
    <div className="sticky mb-6 last:mb-0" style={{ top: `calc(var(--nav-h) + 20px + ${i * 18}px)` }}>
      <motion.article
        style={{ scale: reduce ? 1 : scale, transformOrigin: "50% 0%" }}
        className={`relative flex min-h-[52svh] flex-col justify-between overflow-hidden rounded-t-[999px] px-7 pb-10 pt-24 shadow-[0_-20px_50px_-30px_rgba(36,26,20,0.35)] sm:rounded-t-[340px] md:min-h-[62vh] md:px-16 md:pb-14 md:pt-32 ${tone}`}
      >
        <p className={`text-center text-[11px] font-semibold uppercase tracking-label ${accent}`}>Promise {n}</p>
        <p className="mx-auto mt-8 max-w-[18ch] text-center font-display text-[clamp(36px,8.4vw,104px)] leading-[1] md:mt-10">
          <em className={accent}>{lead}</em> {rest}
        </p>
        <p className={`mt-10 text-center text-[10.5px] font-semibold uppercase tracking-[0.3em] ${accent}`}>The Beauty L'atelier</p>
      </motion.article>
    </div>
  );
}
