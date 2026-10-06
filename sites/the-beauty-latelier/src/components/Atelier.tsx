import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { Reveal, ScrollWords } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { SITE } from "@/site.config";

/** Chapter I — what the atelier is, in Helena's words. */
export function Atelier() {
  const collage = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: collage, offset: ["start end", "end start"] });
  const ySlow = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const yFast = useTransform(scrollYProgress, [0, 1], [140, -120]);
  const yMid = useTransform(scrollYProgress, [0, 1], [100, -90]);

  return (
    <section id="atelier" className="relative overflow-hidden bg-ivory pb-24 pt-24 md:pb-36 md:pt-36" aria-labelledby="atelier-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="atelier" />
        <h2 id="atelier-title" className="sr-only">
          The atelier
        </h2>

        <div className="relative mt-10 md:mt-14">
          <ScrollWords
            className="max-w-[22ch] font-display text-[clamp(30px,7.4vw,72px)] leading-[1.1] text-espresso"
            text={`${SITE.studio} is more than a beauty space — it is a reflection of dedication, femininity and the belief that every woman deserves to feel effortlessly beautiful in her own skin.`}
          />
          <Reveal className="mt-8 flex items-center gap-4 text-[12px] font-semibold uppercase tracking-[0.22em] text-mocha">
            <span className="h-px w-12 bg-bronze/60" />
            {SITE.founder}, founder
          </Reveal>
          <div className="pointer-events-none absolute -top-16 right-0 hidden md:block lg:-top-6 lg:right-6">
            <RoundBadge size={150} text="BEAUTY · CARE · CONFIDENCE · " />
          </div>
        </div>

        {/* Details from her launch post, drifting at different speeds */}
        <div ref={collage} className="mt-24 grid items-center gap-14 md:mt-36 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div className="relative mx-auto h-[440px] w-full max-w-[560px] sm:h-[560px]" data-qa="layered">
            <motion.figure className="absolute left-0 top-0 w-[54%] overflow-hidden will-change-transform rounded-t-full shadow-[0_30px_60px_-30px_rgba(36,26,20,0.45)]" style={{ y: reduce ? 0 : ySlow }}>
              <Img name="detail-silk" widths={[480, 800, 1200]} sizes="(min-width:1024px) 300px, 54vw" alt="A paisley silk scarf in gold and brown beside an iced matcha" className="aspect-[3/4] w-full object-cover" />
            </motion.figure>
            <motion.figure className="absolute right-0 top-[18%] w-[42%] overflow-hidden will-change-transform rounded-[2px] shadow-[0_30px_60px_-30px_rgba(36,26,20,0.45)]" style={{ y: reduce ? 0 : yFast }}>
              <Img name="detail-coffee" widths={[480, 800]} sizes="(min-width:1024px) 240px, 42vw" alt="Coffee in a white cup with a gold rim and gold-spotted saucer" className="aspect-square w-full object-cover" />
            </motion.figure>
            <motion.figure className="absolute bottom-0 left-[26%] w-[40%] overflow-hidden will-change-transform rounded-t-full border-[6px] border-ivory shadow-[0_30px_60px_-30px_rgba(36,26,20,0.45)]" style={{ y: reduce ? 0 : yMid }}>
              <Img name="detail-heels" widths={[480, 800]} sizes="(min-width:1024px) 220px, 40vw" alt="Black patent pointed heels on a pale stone floor" className="aspect-[3/4] w-full object-cover" />
            </motion.figure>
          </div>

          <div className="max-w-[46ch]">
            <Reveal>
              <p className="eyebrow">The experience</p>
              <h3 className="mt-5 text-[clamp(34px,5vw,56px)] leading-[1.02] text-espresso">
                Elevated, intimate, <em className="text-bronze">yours.</em>
              </h3>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-7 text-[16px] leading-[1.8] text-mocha md:text-[17px]">
                “My goal is simple: to create an elevated, intimate experience where you can take a moment for yourself, feel cared for, and walk out feeling like the most confident version of you.”
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <dl className="mt-10 grid grid-cols-3 border-t border-espresso/15 pt-7">
                {[
                  ["Est.", SITE.established],
                  ["Studio", SITE.suburb],
                  ["Certified", "Beautician"],
                ].map(([k, v]) => (
                  <div key={k} className="pr-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.24em] text-bronze-deep">{k}</dt>
                    <dd className="opsz-sm mt-2 font-display text-[22px] leading-tight text-espresso md:text-[26px]">{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
