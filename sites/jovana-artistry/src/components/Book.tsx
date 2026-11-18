import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowRight, ArrowUpRight, Instagram, MapPin } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Wordmark } from "./Logo";
import { MaskLines, Reveal } from "./Reveal";
import { HOURS, POLICY, QUICK, SITE, priceOf } from "@/site.config";
import { useBooking } from "@/context/booking";

/**
 * Chapter VI — the call to action: an arched mirror card rising out of the
 * dark. Pick what you'd like; book in studio on her booking page, or by DM
 * for mobile — exactly the two routes her bio gives.
 */
export function Book() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet, started, service, setService } = useBooking();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // The card rises into place (a translate, so it glides on the GPU without softening the text).
  const cardY = useTransform(scrollYProgress, [0, 0.4], [80, 0]);
  const glowY = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);

  return (
    <section id="book" ref={ref} className="sheet bg-coal pb-24 pt-24 md:pb-32 md:pt-32" aria-labelledby="book-title">
      <div className="glow-clip" aria-hidden="true">
        <motion.div className="absolute left-1/2 top-0 h-[1100px] w-[1100px] -translate-x-1/2 will-change-transform bg-[radial-gradient(closest-side,rgb(242_163_182/0.26),transparent)]" style={{ y: reduce ? "0%" : glowY }} />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="book" light className="justify-center" />

        <motion.div style={{ y: reduce ? 0 : cardY }} className="relative mx-auto mt-10 max-w-[780px] will-change-transform">
          <div className="rounded-[999px_999px_28px_28px] border-[10px] border-noir bg-ivory px-6 pb-12 pt-24 text-center shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] sm:px-14 sm:pt-28 md:pb-16">
            <Wordmark size={64} />
            <h2 id="book-title" className="mx-auto mt-8 max-w-[14ch] text-[clamp(44px,9.4vw,92px)] leading-[0.98] text-ink">
              <MaskLines lines={[<>Book your</>, <em className="text-rose">glam.</em>]} />
            </h2>
            <Reveal>
              <p className="mx-auto mt-6 max-w-[42ch] text-[16px] leading-[1.75] text-ash">
                In studio in {SITE.area}, booked online — or mobile, booked by DM.
              </p>
            </Reveal>

            <Reveal delay={0.06} className="mx-auto mt-10 max-w-[600px] text-left">
              <fieldset>
                <legend className="text-[12px] font-semibold uppercase tracking-[0.22em] text-ink">What would you like?</legend>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {QUICK.map((name) => {
                    const on = service === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setService(on ? "" : name)}
                        className={`flex min-h-[56px] items-center justify-between gap-2 rounded-[12px] border px-4 text-left text-[13.5px] font-semibold transition-colors duration-300 ${
                          on ? "border-onyx bg-onyx text-ivory" : "border-ink/20 bg-card text-ink hover:border-onyx"
                        }`}
                      >
                        {name} <span className={on ? "text-pearl" : "text-rose"}>${priceOf(name)}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[13px] text-ash">More on the menu above · not sure yet? Leave it blank.</p>
              </fieldset>
            </Reveal>

            <Reveal delay={0.1} className="mt-10 flex flex-col items-center gap-3">
              <button onClick={openSheet} className="btn-primary sheen w-full max-w-[380px] px-5 tracking-[0.16em]">
                {started ? "Write my booking" : "Book now"} <ArrowRight size={16} strokeWidth={1.8} />
              </button>
            </Reveal>

            <div className="mx-auto mt-12 grid max-w-[620px] gap-4 border-t border-ink/10 pt-10 text-left sm:grid-cols-2">
              <Reveal className="rounded-[16px] bg-card p-5">
                <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-rose">
                  <MapPin size={15} strokeWidth={1.8} /> In studio
                </p>
                <p className="mt-2 text-[15px] font-semibold text-ink">{SITE.area}</p>
                <ul className="mt-2 space-y-1 text-[14px] text-ash">
                  {HOURS.map((h) => (
                    <li key={h.days} className="flex justify-between gap-3">
                      <span>{h.days}</span>
                      <span className="text-ink">{h.time}</span>
                    </li>
                  ))}
                </ul>
                <a href={SITE.bookingUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-onyx underline decoration-onyx/30 underline-offset-4 hover:decoration-onyx">
                  <ArrowUpRight size={16} strokeWidth={1.8} /> Book online
                  <span className="sr-only">(opens her booking page in a new tab)</span>
                </a>
              </Reveal>
              <Reveal delay={0.06} className="rounded-[16px] bg-card p-5">
                <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-rose">
                  <Instagram size={15} strokeWidth={1.8} /> Mobile
                </p>
                <p className="mt-2 text-[15px] font-semibold text-ink">I come to you</p>
                <p className="mt-2 text-[14px] leading-relaxed text-ash">Mobile bookings are made by DM — send me your date and what you'd like.</p>
                <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-onyx underline decoration-onyx/30 underline-offset-4 hover:decoration-onyx">
                  <Instagram size={16} strokeWidth={1.7} /> DM @{SITE.instagramHandle}
                  <span className="sr-only">(opens Instagram in a new tab)</span>
                </a>
              </Reveal>
            </div>

            <p className="mx-auto mt-8 max-w-[52ch] text-[13.5px] leading-relaxed text-ash">{POLICY}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
