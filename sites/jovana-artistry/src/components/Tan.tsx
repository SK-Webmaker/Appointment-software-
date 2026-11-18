import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowRight } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { Heart } from "./Logo";
import { SITE, priceOf } from "@/site.config";
import { useBooking } from "@/context/booking";

/** Chapter III — spray tans, on her babydoll pink: the tan gun drifts in its arch as you scroll. */
export function Tan() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { setService, openSheet } = useBooking();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <section id="tan" className="sheet bg-candy pb-24 pt-24 text-ink md:pb-32 md:pt-36" aria-labelledby="tan-title">
      <div className="mx-auto grid max-w-[1440px] items-center gap-14 px-5 md:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 xl:px-24">
        <div>
          <ChapterLabel id="tan" />
          <h2 id="tan-title" className="mt-8 max-w-[12ch] text-[clamp(48px,10vw,120px)] leading-[0.95]">
            <MaskLines lines={[<>Spray tans,</>, <em className="text-plum">now available.</em>]} />
          </h2>
          <Reveal>
            <p className="mt-8 flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.22em] text-plum">
              <Heart className="h-4 w-4" />
              ${priceOf("Spray Tan")} · 30 minutes · in studio, {SITE.area}
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="mt-6 max-w-[40ch] text-[16.5px] leading-[1.8] md:text-[17.5px]">
              Pair it with your glam or your brows, or book it on its own.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <button
              type="button"
              onClick={() => {
                setService("Spray Tan");
                openSheet();
              }}
              className="btn-primary sheen mt-10"
            >
              Book a spray tan <ArrowRight size={16} strokeWidth={1.8} />
            </button>
          </Reveal>
        </div>

        <div ref={ref} className="relative mx-auto w-full max-w-[400px]" data-qa="layered">
          <div className="relative aspect-[9/14] overflow-hidden rounded-[999px_999px_18px_18px] bg-coal shadow-[0_40px_80px_-40px_rgba(90,30,45,0.55)] ring-[6px] ring-ivory/70">
            <motion.div className="absolute inset-x-0 -top-[7%] h-[114%] will-change-transform" style={{ y: reduce ? "0%" : y }}>
              <Img name="spray-tan" widths={[480, 800, 1016]} sizes="(min-width:1024px) 400px, 88vw" alt="A spray tan gun, held ready to go" className="h-full w-full object-cover" style={{ objectPosition: "50% 45%" }} />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
