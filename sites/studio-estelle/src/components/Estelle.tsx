import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { Reveal, ScrollWords } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { SITE } from "@/site.config";

// Each line is drawn from her bio, her price guide and her myths carousel.
const POINTS = [
  ["The collection", "Minis to gowns", `Dresses and suits for hire, in sizes ${SITE.sizes}.`],
  ["The care", "Cleaned & steamed", "Every dress is professionally cleaned and steamed before it reaches you."],
  ["The fitting room", "Try it on first", `DM me to book a try on in ${SITE.suburb}.`],
] as const;

/** Chapter I — Estelle, her own little studio, and why she started it. */
export function Estelle() {
  const photoRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: photoRef, offset: ["start end", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <section id="estelle" className="sheet bg-stone pb-24 pt-24 md:pb-32 md:pt-36" aria-labelledby="estelle-title">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-48 top-16 h-[620px] w-[620px] bg-[radial-gradient(closest-side,rgb(249_207_223/0.55),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="estelle" />
        <h2 id="estelle-title" className="sr-only">
          Meet {SITE.founder}
        </h2>

        <div className="mt-10 grid items-center gap-14 md:mt-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div ref={photoRef} className="relative mx-auto w-full max-w-[420px]" data-qa="layered">
            <div className="arch relative aspect-[3/4] overflow-hidden bg-stone shadow-[0_40px_80px_-40px_rgba(46,29,20,0.45)]">
              <motion.div className="absolute inset-x-0 -top-[7%] h-[114%] will-change-transform" style={{ y: reduce ? "0%" : photoY }}>
                <Img
                  name="fitting-room"
                  widths={[480, 720]}
                  sizes="(min-width:1024px) 420px, 88vw"
                  alt="Her fitting room: a pink armchair, an arched mirror and a rail of suits and dresses, with “Welcome to the fitting room” written in pink"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: "50% 45%" }}
                />
              </motion.div>
            </div>
            <div className="absolute -bottom-10 -right-4 sm:-right-10">
              <RoundBadge size={128} />
            </div>
          </div>

          <div>
            <ScrollWords
              className="max-w-[22ch] font-display text-[clamp(30px,6.4vw,64px)] leading-[1.12] text-ink"
              text="“I’ve always loved getting dressed up… not just for the outfits themselves, but for the feeling that comes with it.”"
            />
            <Reveal className="mt-8 flex items-center gap-4">
              <span className="h-px w-12 bg-rose/60" />
              <span className="font-script text-[34px] leading-none text-rose">{SITE.founder}</span>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mt-8 max-w-[52ch] text-[16px] leading-[1.8] text-ash md:text-[17px]">
                The excitement. The confidence. The memories attached to those special moments. My parents let me completely transform a room into my own little studio — now it’s a fitting room full of dresses and suits, ready for your next event.
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
