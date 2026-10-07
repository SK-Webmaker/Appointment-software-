import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowRight, Instagram, MapPin } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Wordmark } from "./Logo";
import { MaskLines, Reveal } from "./Reveal";
import { DAYS, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

const STEPS = [
  { n: "1", t: "Tell us", d: "The style you’re after, your hair now and the days that suit you." },
  { n: "2", t: "Send", d: "Your message is written for you and sent by Instagram DM." },
  { n: "3", t: "Confirm", d: "We reply to talk through your hair and lock in a time." },
];

/** Chapter III — the call to action: an ivory arch rising out of the dark. */
export function Book() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet, started, days, toggleDay } = useBooking();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // The arch rises into place (a translate, so it can glide on the GPU without softening the text).
  const cardY = useTransform(scrollYProgress, [0, 0.4], [80, 0]);
  const glowY = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);

  return (
    <section id="book" ref={ref} className="relative overflow-hidden bg-noir pb-24 pt-24 md:pb-32 md:pt-32" aria-labelledby="book-title">
      <motion.div className="pointer-events-none absolute left-1/2 top-0 h-[1100px] w-[1100px] -translate-x-1/2 will-change-transform bg-[radial-gradient(closest-side,rgb(88_80_70/0.55),transparent)]" style={{ y: reduce ? "0%" : glowY }} aria-hidden="true" />

      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="book" light className="justify-center" />

        <motion.div style={{ y: reduce ? 0 : cardY }} className="relative mx-auto mt-10 max-w-[780px] will-change-transform">
          <div className="rounded-t-[999px] bg-ivory px-6 pb-12 pt-28 text-center shadow-[0_40px_90px_-40px_rgba(0,0,0,0.7)] sm:rounded-t-[400px] sm:px-14 sm:pt-32 md:pb-16">
            <Wordmark size={40} />
            <h2 id="book-title" className="mx-auto mt-8 max-w-[14ch] text-[clamp(40px,9vw,84px)] font-light leading-[0.98] text-ink">
              <MaskLines lines={[<>Your next style,</>, <em className="text-taupe">done properly.</em>]} />
            </h2>
            <Reveal>
              <p className="mx-auto mt-6 max-w-[42ch] text-[16.5px] leading-[1.75] text-ash">
                Bookings are by Instagram DM. Tell us the style you’re after and the days that suit you — your message writes itself.
              </p>
            </Reveal>

            <Reveal delay={0.06} className="mx-auto mt-10 max-w-[560px] text-left">
              <fieldset>
                <legend className="text-[12px] font-medium uppercase tracking-[0.22em] text-ink">Days that suit me</legend>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DAYS.map((d) => {
                    const on = days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(d)}
                        className={`min-h-[48px] rounded-2xl border text-[13.5px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 ${
                          on ? "border-onyx bg-onyx text-ivory" : "border-ink/20 bg-card text-ink hover:border-onyx"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[13px] text-ash">Your preference — we’ll confirm what’s free.</p>
              </fieldset>
            </Reveal>

            <Reveal delay={0.1} className="mt-10 flex flex-col items-center gap-3">
              <button onClick={openSheet} className="btn-primary sheen w-full max-w-[380px] px-5 tracking-[0.16em]">
                {started ? "Write my booking message" : "Book your appointment"} <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-medium uppercase tracking-[0.18em] text-onyx underline decoration-onyx/30 underline-offset-4 hover:decoration-onyx">
                <Instagram size={16} strokeWidth={1.7} /> Or open the DM yourself
              </a>
            </Reveal>

            <ol className="mx-auto mt-12 grid max-w-[620px] gap-6 border-t border-ink/10 pt-10 text-left sm:grid-cols-3 sm:gap-5">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.n} delay={0.06 * i} className="flex gap-4 sm:block">
                  <span className="font-display text-[36px] italic leading-none text-taupe">{s.n}</span>
                  <span className="block">
                    <span className="block text-[12px] font-medium uppercase tracking-[0.2em] text-ink sm:mt-3">{s.t}</span>
                    <span className="mt-1.5 block text-[14.5px] leading-relaxed text-ash">{s.d}</span>
                  </span>
                </Reveal>
              ))}
            </ol>

            <p className="mt-12 flex items-center justify-center gap-2 text-[14px] tracking-[0.02em] text-ash">
              <MapPin size={15} strokeWidth={1.6} className="text-taupe" /> {SITE.city}, {SITE.state} · by appointment
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
