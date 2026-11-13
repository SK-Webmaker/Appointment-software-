import { motion, useScroll, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import { useRef } from "react";
import { OFFER_NAMES } from "@/site.config";
import { useBooking } from "@/context/booking";
import { ChapterLabel } from "./ChapterLabel";
import { Magnetic } from "./Magnetic";
import { MaskLines } from "./Reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Switch it on: the last chapter is a light switch. A big amber button with
 * a breathing halo, pulled towards the mouse, opens the brief; the chips
 * above it start one.
 */
export function Contact() {
  const ref = useRef<HTMLElement>(null);
  const { openSheet, offer, setOffer } = useBooking();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const glow = useTransform(scrollYProgress, [0.2, 0.9], [0.2, 1]);
  const glowScale = useTransform(scrollYProgress, [0.2, 0.9], [0.6, 1.1]);

  return (
    <section id="contact" ref={ref} className="sheet overflow-hidden bg-night pb-24 pt-24 md:pb-32 md:pt-32" aria-labelledby="contact-title">
      <div className="glow-clip" aria-hidden="true">
        <motion.div
          className="absolute left-1/2 top-[55%] -ml-[50vmax] -mt-[50vmax] h-[100vmax] w-[100vmax] rounded-full bg-[radial-gradient(closest-side,rgba(255,181,71,0.22),rgba(155,107,255,0.12)_50%,transparent)] will-change-transform"
          style={{ opacity: glow, scale: glowScale }}
        />
      </div>

      <div className="relative mx-auto flex max-w-[1440px] flex-col items-center px-5 text-center md:px-10 xl:px-16">
        <ChapterLabel id="contact" />
        <h2 id="contact-title" className="mt-10 text-[clamp(56px,12vw,200px)] font-extrabold uppercase">
          <MaskLines
            lines={[
              "Let's light",
              <span key="s" className="neon font-serif font-normal normal-case italic [--tube:#ffb547]">
                something.
              </span>,
            ]}
          />
        </h2>
        <p className="mt-8 max-w-[44ch] text-[14.5px] leading-relaxed text-haze">
          Tell us what we're lighting and the words you want in glass. We'll write it up as a brief you can keep.
        </p>

        <fieldset className="mt-12">
          <legend className="stamp mx-auto text-bone">What are we lighting?</legend>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {OFFER_NAMES.map((o) => {
              const on = offer === o;
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setOffer(on ? "" : o)}
                  className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border px-5 text-[13px] uppercase tracking-[0.12em] transition-colors duration-300 ${
                    on ? "border-amber bg-amber text-void" : "border-bone/20 text-bone hover:border-bone/60"
                  }`}
                >
                  {on && <Check size={14} strokeWidth={2.2} />}
                  {o}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="relative mt-16 grid place-items-center md:mt-20">
          <motion.span
            aria-hidden="true"
            className="absolute h-56 w-56 rounded-full border border-amber/50 md:h-64 md:w-64"
            animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: EASE }}
          />
          <motion.span
            aria-hidden="true"
            className="absolute h-56 w-56 rounded-full border border-amber/40 md:h-64 md:w-64"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 2.4, delay: 1.2, repeat: Infinity, ease: EASE }}
          />
          <Magnetic strength={0.4}>
            <button
              type="button"
              onClick={openSheet}
              className="relative grid h-56 w-56 place-items-center rounded-full bg-amber text-void shadow-[0_0_0_1px_rgba(255,181,71,0.5),0_0_60px_10px_rgba(255,170,50,0.45),0_0_140px_30px_rgba(255,140,40,0.25)] transition-colors duration-500 hover:bg-bone md:h-64 md:w-64"
            >
              <span className="flex flex-col items-center gap-2">
                <span className="stamp text-[11px]">Switch it on</span>
                <span className="font-serif text-[30px] italic leading-[0.95] md:text-[36px]">
                  Start a<br />commission
                </span>
              </span>
            </button>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
