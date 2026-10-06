import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { Check, Plus } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { NAIL_ART_TIERS, formatPrice } from "@/site.config";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

/** Chapter III — nail art, priced by tier, with her Tier 4 set as the reference. */
export function NailArt() {
  const ref = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.75", "end 0.6"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const { scrollYProgress: photoP } = useScroll({ target: photo, offset: ["start end", "end start"] });
  const photoY = useTransform(photoP, [0, 1], ["-8%", "8%"]);

  return (
    <section id="nail-art" className="grain relative overflow-hidden bg-espresso pb-24 pt-24 text-cream md:pb-36 md:pt-32" aria-labelledby="nail-art-title">
      <div className="pointer-events-none absolute -left-40 top-1/3 h-[520px] w-[520px] rounded-full bg-bronze/20 blur-[120px]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[1440px] gap-14 px-5 md:px-10 xl:px-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ChapterLabel id="nail-art" light />
          <h2 id="nail-art-title" className="mt-8 text-[clamp(48px,11vw,112px)] leading-[0.92]">
            <MaskLines lines={[<>Nail art,</>, <em className="text-gold">by tier.</em>]} />
          </h2>

          <div ref={photo} className="arch relative mt-10 overflow-hidden lg:mt-12" data-qa="layered">
            <motion.div style={{ y: reduce ? "0%" : photoY }} className="scale-[1.18]">
              <Img
                name="nails-gelx-tier4-b"
                widths={[480, 800, 1200]}
                sizes="(min-width:1024px) 38vw, 100vw"
                alt="Helena's Gel-X Tier 4 set held over dried roses — gold bow charms, rhinestones and burgundy tortoiseshell"
                className="aspect-[4/5] w-full object-cover"
                style={{ objectPosition: "50% 60%" }}
              />
            </motion.div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-6 pt-24 md:p-8">
              <p className="opsz-sm font-display text-[21px] italic leading-snug text-cream md:text-[24px]">
                “The art of understated luxury. Timeless nails, perfected down to every detail.”
              </p>
              <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold">Gel-X set · Tier 4 · by {SITE.founder}</p>
            </div>
          </div>
        </div>

        <div className="lg:pt-48">
          <Reveal>
            <p className="max-w-[44ch] text-[16px] leading-[1.8] text-cream/80 md:text-[17px]">
              Any set can be finished with art, priced by tier — rising with the detail, from a subtle accent to a full statement. Not sure which tier your inspiration is? Send it to Helena and ask.
            </p>
          </Reveal>

          <div ref={ref} className="relative mt-12 pl-8 md:pl-12">
            <span className="absolute bottom-3 left-[11px] top-3 w-px bg-cream/15 md:left-[15px]" aria-hidden="true" />
            <motion.span className="absolute bottom-3 left-[11px] top-3 w-px origin-top bg-gold md:left-[15px]" style={{ scaleY: reduce ? 1 : fill }} aria-hidden="true" />
            <ol className="space-y-3">
              {NAIL_ART_TIERS.map((t, i) => (
                <TierRow key={t.id} id={t.id} index={i} name={t.name} price={formatPrice(t)} />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function TierRow({ id, index, name, price }: { id: string; index: number; name: string; price: string }) {
  const { isSelected, toggle } = useBooking();
  const on = isSelected(id);
  const label = index === 0 ? "Subtle" : index === 3 ? "As pictured" : index === 4 ? "Statement" : null;
  return (
    <Reveal as="li" delay={index * 0.06} className="relative">
      <span className={`absolute -left-[25px] top-1/2 h-[9px] w-[9px] -translate-y-1/2 rounded-full border transition-colors duration-500 md:-left-[38px] md:h-[11px] md:w-[11px] ${on ? "border-gold bg-gold" : "border-gold/70 bg-espresso"}`} aria-hidden="true" />
      <button
        onClick={() => toggle(id)}
        aria-pressed={on}
        className={`group grid min-h-[84px] w-full grid-cols-[auto_1fr_auto_auto] items-center gap-4 rounded-[2px] border px-4 py-4 text-left transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:gap-6 md:px-6 ${
          on ? "border-gold/70 bg-cream/[0.07]" : "border-cream/10 hover:border-cream/30 hover:bg-cream/[0.04]"
        }`}
      >
        <span className="font-display text-[34px] italic leading-none text-gold md:text-[42px]" aria-hidden="true">{index + 1}</span>
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-cream md:text-[13px]">
            <span className="sr-only">Nail art </span>
            {name}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, k) => (
                <svg key={k} width="9" height="11" viewBox="0 0 10 12" className={k <= index ? "fill-gold" : "fill-cream/15"}>
                  <path d="M0 12V5a5 5 0 0 1 10 0v7z" />
                </svg>
              ))}
            </span>
            {label && <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.16em] text-cream/55">{label}</span>}
          </span>
        </span>
        <span className="font-display text-[24px] leading-none text-cream md:text-[30px]">{price}</span>
        <span className="sr-only">Add to your appointment</span>
        <span
          className={`grid h-10 w-10 place-items-center rounded-full border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "border-gold bg-gold text-ink" : "border-cream/30 text-cream group-hover:border-cream group-hover:bg-cream group-hover:text-espresso"}`}
          aria-hidden="true"
        >
          {on ? <Check size={16} strokeWidth={2.2} /> : <Plus size={16} strokeWidth={2} />}
        </span>
      </button>
    </Reveal>
  );
}
