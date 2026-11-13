import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { Reveal, ScrollWords } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { STEPS } from "@/site.config";

/** Chapter II — three steps, one Kuvaello: from a photo on your phone to a poster on the wall. */
export function How() {
  const photoRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: photoRef, offset: ["start end", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);

  return (
    <section id="how" className="sheet bg-stone pb-24 pt-24 md:pb-32 md:pt-36" aria-labelledby="how-title">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-48 top-16 h-[620px] w-[620px] bg-[radial-gradient(closest-side,rgb(251_250_247/0.9),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="how" />
        <h2 id="how-title" className="sr-only">
          How it works
        </h2>

        <div className="mt-10 grid items-center gap-14 md:mt-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div ref={photoRef} className="relative mx-auto w-full max-w-[420px]" data-qa="layered">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[10px] bg-coal shadow-[0_40px_80px_-40px_rgba(12,12,13,0.6)]">
              <motion.div className="absolute inset-x-0 -top-[6%] h-[112%] will-change-transform" style={{ y: reduce ? "0%" : photoY }}>
                <Img
                  name="karhunen"
                  widths={[480, 800, 1122]}
                  sizes="(min-width:1024px) 420px, 88vw"
                  alt="A framed Kuvaello ice hockey poster, Karhunen #16 City View, on the wall of a warm living room"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: "50% 30%" }}
                />
              </motion.div>
            </div>
            <div className="absolute -bottom-8 -right-4 sm:-right-10">
              <RoundBadge size={128} />
            </div>
          </div>

          <div>
            <ScrollWords
              className="max-w-[18ch] font-display text-[clamp(36px,7.4vw,80px)] leading-[1.02] text-ink"
              text="Do not leave your best moment on your phone."
            />
            <Reveal>
              <p className="mt-8 max-w-[44ch] text-[16px] leading-[1.8] text-ash md:text-[17px]">
                Turn it into something that belongs on the wall. Send a photo — we take care of the rest.
              </p>
            </Reveal>
          </div>
        </div>

        <ol className="mt-20 grid gap-8 border-t border-ink/10 pt-10 sm:grid-cols-3 md:mt-28">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 0.08}>
              <span className="font-display text-[54px] leading-none text-rose">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-[28px] leading-tight text-ink md:text-[32px]">{s.title}</h3>
              <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-ash">{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
