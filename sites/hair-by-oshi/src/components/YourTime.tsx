import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowUpRight, Coffee, Headphones, Laptop, MapPin, MessageCircleHeart, Tv } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { SITE, VIBES, type VibeId } from "@/site.config";
import { useBooking } from "@/context/booking";

const ICONS: Record<VibeId, typeof Coffee> = {
  chat: MessageCircleHeart,
  work: Laptop,
  unwind: Tv,
  quiet: Headphones,
};

/**
 * Chapter VI — her suite, and her promise that the appointment is your time.
 * Choosing a vibe here carries into the booking message.
 */
export function YourTime() {
  const { vibe, setVibe } = useBooking();
  const chosen = VIBES.find((v) => v.id === vibe);
  const gallery = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: gallery, offset: ["start end", "end start"] });
  const yA = useTransform(scrollYProgress, [0, 1], [70, -70]);
  const yB = useTransform(scrollYProgress, [0, 1], [150, -110]);

  return (
    <section id="your-time" className="relative overflow-hidden bg-sand pb-24 pt-24 md:pb-36 md:pt-36" aria-labelledby="time-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="your-time" />
        <div className="mt-8 grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div>
            <h2 id="time-title" className="max-w-[17ch] text-[clamp(36px,7vw,84px)] font-light leading-[1] text-ink">
              <MaskLines lines={[<>More than getting</>, <>your hair done…</>, <em className="text-plum">it's your time.</em>]} />
            </h2>
            <Reveal>
              <p className="mt-8 max-w-[44ch] text-[16.5px] leading-[1.8] text-mocha md:text-[17.5px]">
                “My suite is your space for a few hours. Whether you want to chat the whole appointment, work, read, watch Netflix, or enjoy a peaceful silent appointment, I'll match your vibe.”
              </p>
            </Reveal>

            {/* Choose your vibe */}
            <Reveal delay={0.08} className="mt-10">
              <fieldset>
                <legend className="text-[12px] font-medium uppercase tracking-[0.22em] text-ink">Choose your vibe</legend>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {VIBES.map((v) => {
                    const Icon = ICONS[v.id];
                    const on = vibe === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setVibe(on ? null : v.id)}
                        className={`flex min-h-[64px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14.5px] leading-snug transition-colors duration-300 ${
                          on ? "border-plum bg-plum text-cream" : "border-ink/15 bg-card text-ink hover:border-plum"
                        }`}
                      >
                        <Icon size={20} strokeWidth={1.6} className={`shrink-0 ${on ? "text-lavender" : "text-plum"}`} />
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="mt-5 min-h-[96px] rounded-2xl border border-dashed border-plum/25 px-5 py-4" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={chosen?.id ?? "none"}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                    className="text-[15.5px] leading-relaxed text-ink/85"
                  >
                    {chosen ? (
                      <>
                        <span className="font-display text-[19px] italic text-plum">“{chosen.line}”</span>
                        <span className="mt-1.5 block text-[13px] text-mocha">Saved — it'll be in your booking message.</span>
                      </>
                    ) : (
                      <>
                        <Coffee size={16} strokeWidth={1.7} className="mr-2 inline align-[-2px] text-plum" />
                        “Grab a coffee, help yourself to some snacks, get comfortable…” Pick one and Oshi will know before you arrive.
                      </>
                    )}
                  </motion.p>
                </AnimatePresence>
              </div>
            </Reveal>
          </div>

          {/* The suite */}
          <div ref={gallery} className="relative min-h-[430px] sm:min-h-[720px] lg:min-h-[720px]" data-qa="layered">
            <motion.figure className="absolute left-0 top-0 w-[58%] overflow-hidden rounded-t-full shadow-[0_30px_60px_-30px_rgba(34,22,31,0.55)]" style={{ y: reduce ? 0 : yA }}>
              <Img name="your-time" widths={[480, 720]} sizes="(min-width:1024px) 340px, 62vw" alt="A quiet appointment: the stylist works with headphones on while the client types on her laptop" className="aspect-[3/4] w-full object-cover" />
            </motion.figure>
            <motion.figure className="absolute bottom-0 right-0 w-[48%] overflow-hidden rounded-[24px] border-[6px] border-sand shadow-[0_30px_60px_-30px_rgba(34,22,31,0.55)]" style={{ y: reduce ? 0 : yB }}>
              <Img name="suite-doors" widths={[480, 720]} sizes="(min-width:1024px) 300px, 52vw" alt="The suites' kitchenette: black cabinetry, brass taps, hanging plants and an arched cobalt-blue door" className="aspect-[4/5] w-full object-cover" />
            </motion.figure>
          </div>
        </div>

        {/* Where */}
        <div className="mt-20 grid overflow-hidden rounded-[32px] bg-night text-cream md:mt-28 md:grid-cols-[1fr_1fr]">
          <div className="relative min-h-[260px] md:min-h-[420px]">
            <Img name="suite-hall" widths={[480, 720]} sizes="(min-width:768px) 50vw, 100vw" alt="The hallway at Freedom Suites in Oakleigh: terrazzo floor, gallery wall, round brass mirror and a velvet sofa" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "50% 45%" }} />
          </div>
          <div className="flex flex-col justify-center p-7 md:p-14">
            <p className="text-[11.5px] font-medium uppercase tracking-label text-honey">Located in {SITE.suburbShort}</p>
            <p className="mt-4 font-display text-[clamp(30px,4vw,46px)] font-light leading-[1.08]">
              A private suite at <em className="text-lavender">{SITE.venue}.</em>
            </p>
            <address className="mt-6 text-[16px] not-italic leading-relaxed text-cream/80">
              {SITE.street}, {SITE.suburb} {SITE.state} {SITE.postcode}
              <br />
              {SITE.daysLong} · by appointment
            </address>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={SITE.mapsUrl} target="_blank" rel="noreferrer" className="btn-ghost-light">
                <MapPin size={16} strokeWidth={1.7} /> Open in Maps <ArrowUpRight size={15} strokeWidth={1.8} />
              </a>
            </div>
            <p className="mt-6 text-[13.5px] leading-relaxed text-cream/75">Oshi no longer works in Glen Waverley or Doncaster — every appointment is in {SITE.suburbShort}.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
