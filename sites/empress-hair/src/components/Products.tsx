import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { Reveal, ScrollWords } from "./Reveal";
import { RoundBadge } from "./RoundBadge";

// Each line is drawn from their "Clean & low-tox styling" and "Scalp health" goals.
const POINTS = [
  ["Scalp first", "Moisture through oils", "No more gels that leave you with an irritated scalp and dull build up."],
  ["Clean & low-tox", "Every ingredient, researched", "Results without compromising your health and wellbeing."],
  ["Made to last", "The highest quality products", "To protect your scalp while having your style last."],
] as const;

/** Chapter II — the products: what touches your head, and why. */
export function Products() {
  const photoRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: photoRef, offset: ["start end", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <section id="products" className="relative overflow-hidden bg-ivory pb-24 pt-24 md:pb-32 md:pt-36" aria-labelledby="products-title">
      <div className="pointer-events-none absolute -right-48 top-24 h-[620px] w-[620px] bg-[radial-gradient(closest-side,rgb(222_212_196/0.65),transparent)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="products" />
        <h2 id="products-title" className="sr-only">
          Clean, low-tox products
        </h2>

        <div className="mt-10 grid items-center gap-14 md:mt-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div ref={photoRef} className="relative mx-auto w-full max-w-[420px]" data-qa="layered">
            <div className="arch relative aspect-[3/4] overflow-hidden bg-stone shadow-[0_40px_80px_-40px_rgba(20,18,16,0.5)]">
              <motion.div className="absolute inset-x-0 -top-[7%] h-[114%] will-change-transform" style={{ y: reduce ? "0%" : photoY }}>
                <Img
                  name="products"
                  widths={[480, 800, 1080]}
                  sizes="(min-width:1024px) 420px, 88vw"
                  alt="Their styling station: a braid styling gel, heat protection, a rat-tail comb, sectioning clips, scissors and a reed diffuser"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: "50% 55%" }}
                />
              </motion.div>
            </div>
            <div className="absolute -bottom-10 -right-4 sm:-right-10">
              <RoundBadge size={128} />
            </div>
          </div>

          <div>
            <ScrollWords
              className="max-w-[20ch] font-display text-[clamp(32px,7vw,72px)] font-light leading-[1.08] text-ink"
              text="“We research each and every product and ingredient that touches your head.”"
            />
            <Reveal className="mt-8 flex items-center gap-4 text-[12.5px] font-medium uppercase tracking-[0.22em] text-taupe">
              <span className="h-px w-12 bg-taupe/60" />
              Quality over quantity
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mt-8 max-w-[52ch] text-[16px] leading-[1.8] text-ash md:text-[17px]">
                Instead of putting random chemicals on your scalp in the name of effectiveness or price, the aim is to keep the results while promoting clean product options into braiding culture.
              </p>
            </Reveal>
          </div>
        </div>

        <dl className="mt-20 grid gap-8 border-t border-ink/10 pt-10 sm:grid-cols-3 md:mt-28">
          {POINTS.map(([k, v, d], i) => (
            <Reveal key={k} delay={i * 0.08}>
              <dt className="text-[11px] font-medium uppercase tracking-[0.26em] text-taupe">{k}</dt>
              <dd className="mt-3">
                <span className="block font-display text-[27px] font-normal leading-tight text-ink md:text-[31px]">{v}</span>
                <span className="mt-2 block max-w-[34ch] text-[15px] leading-relaxed text-ash">{d}</span>
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
