import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { Reveal, ScrollWords } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { SITE } from "@/site.config";

// Each line is drawn from their bio, their welcome post and their business card.
const POINTS = [
  ["Made by", "Two sisters", "Freshly handcrafted dessert cups made with love by two inspired sisters."],
  ["Made when", "Fresh to order", "Every dessert cup is made with insane love & fresh to order."],
  ["Made for you", "Free customisations", `Free customisations and discounts — pickup or delivery from ${SITE.suburb}, ${SITE.city}.`],
] as const;

/** Chapter I — the two sisters and how Sweet Cup World began. */
export function Story() {
  const photoRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: photoRef, offset: ["start end", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);

  return (
    <section id="story" className="sheet bg-stone pb-24 pt-24 md:pb-32 md:pt-36" aria-labelledby="story-title">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-48 top-16 h-[620px] w-[620px] bg-[radial-gradient(closest-side,rgb(255_241_214/0.9),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="story" />
        <h2 id="story-title" className="sr-only">
          Our story
        </h2>

        <div className="mt-10 grid items-center gap-14 md:mt-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div ref={photoRef} className="relative mx-auto w-full max-w-[420px]" data-qa="layered">
            <div className="relative aspect-square overflow-hidden rounded-full bg-card shadow-[0_40px_80px_-40px_rgba(58,34,24,0.45)]">
              <motion.div className="absolute inset-0 will-change-transform" style={{ scale: 1.06, y: reduce ? "0%" : photoY }}>
                <Img
                  name="logo"
                  widths={[480, 1080]}
                  sizes="(min-width:1024px) 420px, 88vw"
                  alt="The Sweet Cup World badge: smiling Biscoff, pistachio, Dubai chocolate and coconut cups around their name, with pink roses"
                  className="h-full w-full object-cover"
                />
              </motion.div>
            </div>
            <div className="absolute -bottom-6 -right-4 sm:-right-10">
              <RoundBadge size={128} />
            </div>
          </div>

          <div>
            <ScrollWords
              className="max-w-[22ch] font-display text-[clamp(30px,6.4vw,64px)] leading-[1.12] text-ink"
              text="“What started as a passion for baking between two sisters has turned into something we are so proud of.”"
            />
            <Reveal className="mt-8 flex items-center gap-4">
              <span className="h-px w-12 bg-rose/60" />
              <span className="font-script text-[34px] leading-none text-rose">the sisters</span>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mt-8 max-w-[52ch] text-[16px] leading-[1.8] text-ash md:text-[17px]">
                Welcome to our dessert cup world! We are so excited to finally share our dream with you — and we can’t wait for you to be a part of our journey.
              </p>
            </Reveal>
          </div>
        </div>

        <dl className="mt-20 grid gap-8 border-t border-ink/10 pt-10 sm:grid-cols-3 md:mt-28">
          {POINTS.map(([k, v, d], i) => (
            <Reveal key={k} delay={i * 0.08}>
              <dt className="text-[11px] font-medium uppercase tracking-[0.26em] text-rose">{k}</dt>
              <dd className="mt-3">
                <span className="block font-display text-[27px] leading-tight text-ink md:text-[31px]">{v}</span>
                <span className="mt-2 block max-w-[34ch] text-[15px] leading-relaxed text-ash">{d}</span>
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
