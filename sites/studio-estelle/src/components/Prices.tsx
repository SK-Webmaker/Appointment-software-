import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowRight, Instagram } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { PRICES, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

/** Chapter II — her price guide, set like a boutique price list, beside her rail. */
export function Prices() {
  const photoRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet } = useBooking();
  const { scrollYProgress } = useScroll({ target: photoRef, offset: ["start end", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <section id="prices" className="sheet overflow-hidden bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36" aria-labelledby="prices-title">
      <div className="pointer-events-none absolute -left-48 top-1/4 h-[680px] w-[680px] bg-[radial-gradient(closest-side,rgb(151_69_95/0.32),transparent)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="prices" light />

        <div className="mt-8 grid gap-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-24">
          <div>
            <h2 id="prices-title" className="text-[clamp(42px,9vw,104px)] leading-[0.98]">
              <MaskLines lines={[<>The price</>, <em className="text-pearl">guide.</em>]} />
            </h2>
            <Reveal>
              <p className="mt-8 max-w-[44ch] text-[16.5px] leading-[1.8] text-ivory/80 md:text-[17.5px]">
                {SITE.tagline} — here’s what a hire starts from. Every piece is professionally cleaned and steamed before it reaches you.
              </p>
            </Reveal>

            <ul className="mt-12 max-w-[600px] border-t border-ivory/15">
              {PRICES.map((p, i) => {
                const from = p.price.startsWith("from ");
                return (
                  <Reveal as="li" key={p.item} delay={i * 0.05} className="flex items-baseline gap-4 border-b border-ivory/15 py-5">
                    <span className="font-display text-[clamp(22px,5.6vw,32px)] leading-tight">{p.item}</span>
                    <span className="h-px min-w-6 flex-1 translate-y-[-0.3em] border-b border-dotted border-ivory/35" aria-hidden="true" />
                    <span className="whitespace-nowrap">
                      {from && <span className="mr-2 text-[11.5px] font-medium uppercase tracking-[0.2em] text-silk">from</span>}
                      <span className="font-display text-[clamp(24px,5.8vw,34px)] leading-none text-pearl">{from ? p.price.slice(5) : p.price}</span>
                    </span>
                  </Reveal>
                );
              })}
            </ul>
            <Reveal>
              <p className="mt-6 max-w-[56ch] text-[14px] leading-relaxed text-ivory/75">
                Sizes {SITE.sizes} · A fully refundable bond is held while you have the dress or suit · T&amp;Cs apply
              </p>
            </Reveal>

            <Reveal delay={0.05} className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button onClick={openSheet} className="btn-honey sheen">
                Book a try-on <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="btn-ghost-light">
                <Instagram size={16} strokeWidth={1.7} /> Ask about a piece
              </a>
            </Reveal>
          </div>

          <div ref={photoRef} className="relative mx-auto w-full max-w-[400px]" data-qa="layered">
            <div className="arch relative aspect-[3/4] overflow-hidden bg-coal shadow-[0_40px_90px_-40px_rgba(0,0,0,0.7)]">
              <motion.div className="absolute inset-x-0 -top-[7%] h-[114%] will-change-transform" style={{ y: reduce ? "0%" : photoY }}>
                <Img
                  name="rack"
                  widths={[480, 720]}
                  sizes="(min-width:1024px) 400px, 88vw"
                  alt="Her rail: navy and black suits beside red, pink and sequinned dresses"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: "50% 40%" }}
                />
              </motion.div>
            </div>
            <div className="absolute -bottom-10 -left-4 sm:-left-10">
              <RoundBadge size={128} tone="cream" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
