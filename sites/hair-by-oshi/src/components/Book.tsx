import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowRight, Check, Instagram, MapPin, Plus } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Wordmark } from "./Logo";
import { MaskLines, Reveal } from "./Reveal";
import { SERVICES, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

const STEPS = [
  { n: "1", t: "Choose", d: "Pick your services and the days that suit you — or just say hello." },
  { n: "2", t: "Send", d: "Your message is written for you and sent to Oshi by Instagram DM." },
  { n: "3", t: "Confirm", d: "Oshi replies to talk through your hair and lock in a time." },
];

/** Chapter VII — the call to action: a cream capsule rising out of the dark. */
export function Book() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet, selected, isSelected, toggle, days, toggleDay } = useBooking();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const cardScale = useTransform(scrollYProgress, [0, 0.4], [0.93, 1]);
  const glowY = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);
  const correction = isSelected("correction");

  return (
    <section id="book" ref={ref} className="grain relative overflow-hidden bg-espresso pb-24 pt-24 md:pb-32 md:pt-32" aria-labelledby="book-title">
      <motion.div className="pointer-events-none absolute left-1/2 top-0 h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-cocoa/50 blur-[120px]" style={{ y: reduce ? "0%" : glowY }} aria-hidden="true" />

      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="book" light className="justify-center" />

        <motion.div style={{ scale: reduce ? 1 : cardScale }} className="relative mx-auto mt-10 max-w-[780px]">
          <div className="rounded-t-[999px] bg-cream px-6 pb-12 pt-28 text-center shadow-[0_40px_90px_-40px_rgba(0,0,0,0.7)] sm:rounded-t-[400px] sm:px-14 sm:pt-32 md:pb-16">
            <Wordmark size={46} />
            <h2 id="book-title" className="mx-auto mt-8 max-w-[15ch] text-[clamp(38px,8.6vw,80px)] font-light leading-[0.98] text-ink">
              <MaskLines lines={[<>Let's create beautiful hair</>, <em className="text-cocoa">together.</em>]} />
            </h2>
            <Reveal>
              <p className="mx-auto mt-6 max-w-[42ch] text-[16.5px] leading-[1.75] text-mocha">
                Bookings are by Instagram DM. Tell Oshi what you'd love and the days that suit you — your message writes itself.
              </p>
            </Reveal>

            <Reveal delay={0.06} className="mx-auto mt-10 max-w-[560px] text-left">
              <fieldset>
                <legend className="text-[12px] font-medium uppercase tracking-[0.22em] text-ink">I'm interested in</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SERVICES.map((s) => {
                    const on = isSelected(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(s.id)}
                        className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[14px] transition-colors duration-300 ${
                          on ? "border-cocoa bg-cocoa text-cream" : "border-ink/20 bg-card text-ink hover:border-cocoa"
                        }`}
                      >
                        {on ? <Check size={15} strokeWidth={2} /> : <Plus size={15} strokeWidth={2} />}
                        {s.short}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="mt-6">
                <legend className="text-[12px] font-medium uppercase tracking-[0.22em] text-ink">Days that suit me</legend>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {SITE.days.map((d) => {
                    const on = days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(d)}
                        className={`min-h-[48px] rounded-2xl border text-[14px] font-medium uppercase tracking-[0.14em] transition-colors duration-300 ${
                          on ? "border-cocoa bg-cocoa text-cream" : "border-ink/20 bg-card text-ink hover:border-cocoa"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[13px] text-mocha">Oshi works {SITE.daysLong}.</p>
              </fieldset>
              {correction && (
                <p className="mt-6 rounded-2xl bg-latte px-5 py-4 text-[14.5px] leading-relaxed text-ink/85">
                  <span className="font-medium text-cocoa">Booking a colour correction?</span> Expect patience, realistic expectations, a healthy-hair-first approach — and sometimes more than one session. “Healthy hair &gt; rushed results.”
                </p>
              )}
            </Reveal>

            <Reveal delay={0.1} className="mt-10 flex flex-col items-center gap-3">
              <button onClick={openSheet} className="btn-primary sheen w-full max-w-[380px] px-5 tracking-[0.16em]">
                {selected.length ? "Write my booking message" : "Book your appointment"} <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-medium uppercase tracking-[0.18em] text-cocoa underline decoration-cocoa/30 underline-offset-4 hover:decoration-cocoa">
                <Instagram size={16} strokeWidth={1.7} /> Or open the DM yourself
              </a>
            </Reveal>

            <ol className="mx-auto mt-12 grid max-w-[620px] gap-6 border-t border-ink/10 pt-10 text-left sm:grid-cols-3 sm:gap-5">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.n} delay={0.06 * i} className="flex gap-4 sm:block">
                  <span className="font-display text-[34px] italic leading-none text-cocoa">{s.n}</span>
                  <span className="block">
                    <span className="block text-[12px] font-medium uppercase tracking-[0.2em] text-ink sm:mt-3">{s.t}</span>
                    <span className="mt-1.5 block text-[14.5px] leading-relaxed text-mocha">{s.d}</span>
                  </span>
                </Reveal>
              ))}
            </ol>

            <address className="mt-12 flex flex-col items-center gap-1 text-[14px] not-italic tracking-[0.02em] text-mocha">
              <a href={SITE.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 underline decoration-cocoa/30 underline-offset-4 hover:text-ink">
                <MapPin size={15} strokeWidth={1.6} className="text-cocoa" /> {SITE.venue} · {SITE.street}, {SITE.suburb}
              </a>
              <span>{SITE.days.join(" · ")} · by appointment</span>
            </address>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
