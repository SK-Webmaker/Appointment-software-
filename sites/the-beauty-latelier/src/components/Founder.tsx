import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { SITE } from "@/site.config";

const MILESTONES = [
  { when: "Age 15", what: "Opens her very first nail salon — with a dream, determination and a genuine love for beauty." },
  { when: SITE.established, what: `${SITE.studio} is established. Beauty · Care · Confidence.` },
  { when: SITE.reopeningShort, what: `The atelier re-opens in ${SITE.suburb}. This is only the beginning.` },
];

/** Chapter IV — the girl behind the atelier, in her own words. */
export function Founder() {
  const portrait = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: portrait, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);
  const frameY = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const { scrollYProgress: lineP } = useScroll({ target: line, offset: ["start 0.85", "end 0.55"] });
  const draw = useTransform(lineP, [0, 1], [0, 1]);

  return (
    <section id="helena" className="relative overflow-hidden bg-ivory pb-24 pt-24 md:pb-36 md:pt-36" aria-labelledby="helena-title">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-5 md:px-10 xl:px-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24">
        <div className="order-2 lg:order-1">
          <ChapterLabel id="helena" />
          <h2 id="helena-title" className="mt-8 text-[clamp(44px,10.5vw,84px)] leading-[0.95] text-espresso">
            <MaskLines lines={[<>The girl behind</>, <em className="text-bronze">the atelier.</em>]} />
          </h2>

          <Reveal>
            <blockquote className="opsz-sm mt-10 max-w-[30ch] border-l border-bronze/50 pl-6 font-display text-[clamp(22px,3vw,30px)] leading-[1.35] text-espresso">
              “My journey started at just 15 years old, when I opened my very first nail salon.”
            </blockquote>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-8 max-w-[52ch] text-[16px] leading-[1.8] text-mocha md:text-[17px]">
              What started as a small beginning has grown into something I'm incredibly proud of. Every step, every lesson and every challenge has shaped the businesswoman I'm becoming today. Now, I'm continuing to grow, learn and build The Beauty L'atelier into the vision I've always had — a space centred around beauty, confidence, femininity and making every woman feel her absolute best.
            </p>
          </Reveal>

          <ol ref={line} className="relative mt-14 grid gap-8 md:grid-cols-3 md:gap-6">
            <span className="absolute left-[5px] top-2 h-[calc(100%-16px)] w-px bg-espresso/15 md:left-0 md:top-[5px] md:h-px md:w-full" aria-hidden="true" />
            <motion.span
              className="absolute left-[5px] top-2 h-[calc(100%-16px)] w-px origin-top bg-bronze md:hidden"
              style={{ scaleY: reduce ? 1 : draw }}
              aria-hidden="true"
            />
            <motion.span className="absolute left-0 top-[5px] hidden h-px w-full origin-left bg-bronze md:block" style={{ scaleX: reduce ? 1 : draw }} aria-hidden="true" />
            {MILESTONES.map((m, i) => (
              <Reveal as="li" key={m.when} delay={0.1 + i * 0.12} className="relative pl-8 md:pl-0 md:pt-9">
                <span className="absolute left-0 top-[3px] h-[11px] w-[11px] rounded-full border border-bronze bg-ivory md:top-0" aria-hidden="true" />
                <p className="font-display text-[30px] italic leading-none text-bronze">{m.when}</p>
                <p className="mt-3 text-[14.5px] leading-relaxed text-mocha">{m.what}</p>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={0.1} className="mt-14 flex items-end gap-5">
            <p className="font-script text-[54px] leading-none text-bronze md:text-[64px]">With love, Helena</p>
          </Reveal>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-label text-mocha">Founder · {SITE.credential}</p>
        </div>

        <div ref={portrait} className="relative order-1 mx-auto w-full max-w-[520px] lg:order-2 lg:mt-24">
          <motion.div className="arch absolute -inset-3 border border-bronze/40 md:-inset-5" style={{ y: reduce ? 0 : frameY }} aria-hidden="true" />
          <div className="arch relative overflow-hidden bg-espresso" data-qa="layered">
            <motion.div style={{ y: reduce ? "0%" : imgY }} className="scale-[1.16]">
              <Img
                name="helena"
                widths={[480, 800, 1080]}
                sizes="(min-width:1024px) 520px, 92vw"
                alt="Helena, founder of The Beauty L'atelier, in a black tailored suit with pearl earrings"
                className="aspect-[3/4] w-full object-cover"
                style={{ objectPosition: "50% 20%" }}
              />
            </motion.div>
          </div>
          <div className="absolute -bottom-10 -right-2 md:-right-10">
            <RoundBadge size={128} text="HELENA · FOUNDER · EST. 2024 · " />
          </div>
        </div>
      </div>
    </section>
  );
}
