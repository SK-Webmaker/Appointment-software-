import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Reveal, ScrollWords } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { SITE } from "@/site.config";

// Loose S-curves across the width — strands of hair with light running down them.
const STRANDS = Array.from({ length: 9 }, (_, i) => {
  const y = 40 + i * 26;
  const a = 70 + (i % 3) * 18;
  return {
    d: `M-40 ${y} C 180 ${y - a}, 330 ${y + a}, 520 ${y} S 860 ${y - a}, 1040 ${y + 10}`,
    color: i % 4 === 1 ? "#D9A05B" : i % 2 === 0 ? "#B8A2D9" : "#6B3FA0",
    width: i % 3 === 0 ? 1.4 : 0.9,
    delay: i * 0.035,
  };
});

/** Chapter I — who she is for, in her own words, with strands of light drawing across. */
export function DarkHair() {
  const strandsRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: strandsRef, offset: ["start end", "end start"] });

  return (
    <section id="dark-hair" className="grain relative overflow-hidden bg-night pb-20 pt-24 text-cream md:pb-28 md:pt-36" aria-labelledby="dark-hair-title">
      <div className="pointer-events-none absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-plum/40 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="dark-hair" light />
        <h2 id="dark-hair-title" className="sr-only">
          A dark hair specialist
        </h2>

        <div className="relative mt-10 md:mt-14">
          <ScrollWords
            className="max-w-[22ch] font-display text-[clamp(31px,7.2vw,76px)] font-light leading-[1.1] text-cream"
            text="“I specialise in dark, thick hair, so I understand that beautiful transformations can take time, patience and sometimes more than one session.”"
          />
          <Reveal className="mt-8 flex items-center gap-4 text-[12.5px] font-medium uppercase tracking-[0.22em] text-lavender">
            <span className="h-px w-12 bg-lavender/60" />
            {SITE.fullName}
          </Reveal>
          <div className="pointer-events-none absolute -top-20 right-0 hidden md:block lg:-top-6 lg:right-4">
            <RoundBadge size={150} tone="cream" text="BEAUTY · SCIENCE · CARE · " />
          </div>
        </div>
      </div>

      {/* Strands that draw themselves as the section passes */}
      <div ref={strandsRef} className="relative mt-16 h-[220px] md:mt-24 md:h-[320px]" aria-hidden="true">
        <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" fill="none">
          {STRANDS.map((s) => (
            <Strand key={s.d} {...s} progress={scrollYProgress} reduce={reduce} />
          ))}
        </svg>
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <dl className="mt-4 grid gap-8 border-t border-cream/15 pt-10 sm:grid-cols-3 md:mt-8">
          {[
            ["Specialist", "Dark, thick hair", "Depth, shine and tone — and lightening that never costs the health of your hair."],
            ["Services", "Colour + Nanoplasty", "Colour, grey blending, colour correction and smoothing that lasts for months."],
            ["Studio", `Private suite, ${SITE.suburbShort}`, `${SITE.daysLong}. Booked by Instagram DM.`],
          ].map(([k, v, d], i) => (
            <Reveal key={k} delay={i * 0.08}>
              <dt className="text-[11px] font-medium uppercase tracking-[0.26em] text-honey">{k}</dt>
              <dd className="mt-3">
                <span className="block font-display text-[26px] font-light leading-tight text-cream md:text-[30px]">{v}</span>
                <span className="mt-2 block max-w-[34ch] text-[15px] leading-relaxed text-cream/75">{d}</span>
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Strand({
  d,
  color,
  width,
  delay,
  progress,
  reduce,
}: {
  d: string;
  color: string;
  width: number;
  delay: number;
  progress: MotionValue<number>;
  reduce: boolean;
}) {
  const length = useTransform(progress, [0.05 + delay, 0.55 + delay], [0, 1]);
  const shift = useTransform(progress, [0, 1], [-30 + delay * 200, 30 - delay * 200]);
  return (
    <motion.path
      d={d}
      stroke={color}
      strokeOpacity={0.7}
      strokeWidth={width}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      style={reduce ? { pathLength: 1, y: 0 } : { pathLength: length, y: shift }}
    />
  );
}
