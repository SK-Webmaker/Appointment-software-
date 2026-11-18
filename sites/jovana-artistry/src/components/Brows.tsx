import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { Check } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { Reveal, ScrollWords } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { BROWS } from "@/site.config";
import { useBooking } from "@/context/booking";

const STRIP = [
  { image: "brows-close", widths: [480, 800], alt: "Close-up of freshly shaped, tinted HD brows" },
  { image: "brow-lami", widths: [480, 720], alt: "HD brow lamination: lifted, brushed-up brows" },
  { image: "brows-wax", widths: [480, 800], alt: "Freshly done brows, brushed and styled" },
] as const;

/** Chapter II — brows: her four brow services, exactly as her menu describes them. */
export function Brows() {
  const photoRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { setService, openSheet } = useBooking();
  const { scrollYProgress } = useScroll({ target: photoRef, offset: ["start end", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);

  return (
    <section id="brows" className="sheet bg-stone pb-24 pt-24 md:pb-32 md:pt-36" aria-labelledby="brows-title">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-48 top-16 h-[620px] w-[620px] bg-[radial-gradient(closest-side,rgb(255_250_249/0.9),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="brows" />
        <h2 id="brows-title" className="sr-only">
          Brows
        </h2>

        <div className="mt-10 grid items-center gap-14 md:mt-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div ref={photoRef} className="relative mx-auto w-full max-w-[420px]" data-qa="layered">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[999px_999px_18px_18px] bg-coal shadow-[0_40px_80px_-40px_rgba(90,30,45,0.5)]">
              <motion.div className="absolute inset-x-0 -top-[6%] h-[112%] will-change-transform" style={{ y: reduce ? "0%" : photoY }}>
                <Img
                  name="hd-brows"
                  widths={[480, 800, 1080]}
                  sizes="(min-width:1024px) 420px, 88vw"
                  alt="HD brows: defined, fuller brows with a soft tint, styled and finished"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: "50% 35%" }}
                />
              </motion.div>
            </div>
            <div className="absolute -bottom-8 -right-4 sm:-right-10">
              <RoundBadge size={128} />
            </div>
          </div>

          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-label text-rose">HD Brows — now available 🫧🤍</p>
            <ScrollWords
              className="mt-5 max-w-[18ch] font-display text-[clamp(34px,6.6vw,74px)] leading-[1.05] text-ink"
              text="Lifted, fuller, structured brows that still look soft and natural."
            />
            <Reveal>
              <p className="mt-8 max-w-[44ch] text-[16px] leading-[1.8] text-ash md:text-[17px]">
                Mapped, shaped and styled for your face — here is exactly what each one includes.
              </p>
            </Reveal>
          </div>
        </div>

        <ul className="mt-20 grid gap-4 sm:grid-cols-2 md:mt-28 lg:grid-cols-4">
          {BROWS.map((b, i) => (
            <Reveal as="li" key={b.name} delay={i * 0.06}>
              <article className="flex h-full flex-col rounded-[18px] border border-ink/10 bg-card p-6 shadow-[0_24px_50px_-36px_rgba(90,30,45,0.45)]">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[26px] leading-tight text-ink">{b.name}</h3>
                  <span className="font-display text-[28px] leading-none text-rose">${b.price}</span>
                </div>
                <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-ash">{b.time}</p>
                <p className="mt-4 text-[15px] leading-relaxed text-ink">{b.creates}</p>
                <ul className="mt-4 space-y-1.5">
                  {b.includes.map((x) => (
                    <li key={x} className="flex items-start gap-2 text-[14px] leading-snug text-ash">
                      <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
                      {x}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setService(b.name);
                    openSheet();
                  }}
                  className="btn-ghost mt-6 min-h-[48px] w-full px-4 text-[11.5px]"
                >
                  Book {b.name}
                </button>
              </article>
            </Reveal>
          ))}
        </ul>

        <ul className="mt-6 grid grid-cols-3 gap-3 md:gap-4" aria-label="More brows">
          {STRIP.map((s, i) => (
            <Reveal as="li" key={s.image} delay={i * 0.06}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-coal">
                <Img name={s.image} widths={[...s.widths]} sizes="(min-width:1440px) 420px, 31vw" alt={s.alt} className="h-full w-full object-cover" style={{ objectPosition: "50% 35%" }} />
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
