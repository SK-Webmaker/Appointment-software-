import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowRight, Clock, MapPin, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { SplitFlap } from "./SplitFlap";
import { MaskLines, Reveal } from "./Reveal";
import { BARBERS, HOURS, QUICK, SITE, priceOf, serviceOf } from "@/site.config";
import { useBooking } from "@/context/booking";
import { dayLabel, freeTimes, isoDay, nextFree, openStatus, pretty } from "@/lib/slots";

type Board = {
  status: { open: boolean; text: string };
  rows: { id: string; name: string; day: string; times: string[]; today: boolean }[];
};

/**
 * Chapter 05 — book: today's board. Whether we're open, the next free times
 * in each chair (tap one to take it), the quick picks, and how to find us.
 */
export function Book() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet, service, setService } = useBooking();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const cardY = useTransform(scrollYProgress, [0, 0.4], [80, 0]);
  const [board, setBoard] = useState<Board | null>(null);
  const mins = serviceOf(service)?.mins ?? 45;

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const rows = BARBERS.map((b) => {
        const n = nextFree(b.id, mins, now);
        const times = n ? freeTimes(n.day, b.id, mins, now).slice(0, 3) : [];
        return { id: b.id, name: b.name, day: n?.day ?? isoDay(now), times, today: !!n?.today };
      });
      setBoard({ status: openStatus(now), rows });
    };
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, [mins]);

  return (
    <section
      id="book"
      ref={ref}
      className="sheet bg-stone pb-24 pt-24 md:pb-32 md:pt-32"
      aria-labelledby="book-title"
    >
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="book" className="justify-center" />
        <h2
          id="book-title"
          className="mx-auto mt-8 max-w-[12ch] text-center text-[clamp(60px,13vw,160px)] leading-[0.84] text-ink"
        >
          <MaskLines lines={[<>Grab a</>, <em className="text-rose">chair.</em>]} />
        </h2>

        <motion.div
          style={{ y: reduce ? 0 : cardY }}
          className="relative mx-auto mt-12 max-w-[920px] will-change-transform"
        >
          <div className="overflow-hidden rounded-[14px] bg-noir text-ivory shadow-[0_40px_90px_-40px_rgba(20,14,10,0.8)]">
            {/* the board's header: open or closed, right now */}
            <p className="border-b border-ivory/10 px-6 pt-5 font-display text-[13px] font-bold uppercase tracking-[0.4em] text-pearl md:px-10">
              Next chairs · departures
            </p>
            <div className="flex flex-col gap-2 border-b border-ivory/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-10">
              <p
                className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.18em]"
                aria-live="polite"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${board?.status.open ? "bg-[#5fbf7a]" : "bg-silk"}`}
                />
                {board ? board.status.text : "Today at the shop"}
              </p>
              <p className="text-[13px] text-mist">
                Times for a {mins}-minute {service || "cut"} · live from the book
              </p>
            </div>

            <ul className="divide-y divide-ivory/10">
              {(
                board?.rows ??
                BARBERS.map((b) => ({
                  id: b.id,
                  name: b.name,
                  day: "",
                  times: [] as string[],
                  today: true,
                }))
              ).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center md:px-10"
                >
                  <p className="flex w-[13rem] shrink-0 items-center gap-3">
                    <SplitFlap text={r.name.padEnd(4)} />
                    {board && (
                      <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-mist">
                        {r.today ? "Today" : dayLabel(r.day, { weekday: "short" })}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {!board ? (
                      <span className="font-mono text-[14px] text-ivory/60">
                        Checking the book…
                      </span>
                    ) : r.times.length ? (
                      r.times.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            openSheet({
                              barber: r.id,
                              day: r.day,
                              time: t,
                              ...(service ? {} : { service: "Signature Cut" }),
                            })
                          }
                          className="group min-h-[44px] rounded-[6px] p-1 ring-1 ring-pearl/30 transition-[box-shadow,background-color] duration-300 hover:bg-pearl/15 hover:ring-pearl"
                          aria-label={`Book ${r.name} at ${pretty(t)}${r.today ? " today" : ` on ${dayLabel(r.day, { weekday: "long" })}`}`}
                        >
                          <SplitFlap text={pretty(t).replace(" ", "").padStart(6)} size="sm" />
                        </button>
                      ))
                    ) : (
                      <span className="text-[14px] text-ivory/60">Fully booked this week</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-ivory/10 px-6 py-7 md:px-10">
              <Reveal>
                <fieldset>
                  <legend className="text-[12px] font-semibold uppercase tracking-[0.2em] text-pearl">
                    What are we doing?
                  </legend>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {QUICK.map((name) => {
                      const on = service === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setService(on ? "" : name)}
                          className={`flex min-h-[56px] items-center justify-between gap-2 rounded-[10px] border px-4 text-left text-[14px] font-semibold transition-colors duration-300 ${
                            on
                              ? "border-pearl bg-pearl text-noir"
                              : "border-ivory/15 bg-coal text-ivory hover:border-pearl/60"
                          }`}
                        >
                          {name}{" "}
                          <span className={on ? "text-plum" : "text-pearl"}>${priceOf(name)}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </Reveal>
              <button
                onClick={() => openSheet()}
                className="btn-primary sheen mt-7 w-full sm:w-auto sm:px-10"
              >
                Book now <ArrowRight size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Reveal className="rounded-[12px] bg-ivory p-6">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-rose">
                <MapPin size={15} strokeWidth={1.8} /> Find us
              </p>
              <p className="mt-3 font-display text-[26px] font-bold uppercase leading-none text-ink">
                {SITE.area}, {SITE.city}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-ash">
                Two minutes from the station. Look for the pole.
              </p>
            </Reveal>
            <Reveal delay={0.06} className="rounded-[12px] bg-ivory p-6">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-rose">
                <Clock size={15} strokeWidth={1.8} /> Hours
              </p>
              <ul className="mt-3 space-y-1 text-[14px] text-ash">
                {HOURS.map((h) => (
                  <li key={h.days} className="flex justify-between gap-3">
                    <span>{h.days}</span>
                    <span className="text-ink">{h.time}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.12} className="rounded-[12px] bg-ivory p-6">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-rose">
                <Phone size={15} strokeWidth={1.8} /> Call the shop
              </p>
              <a
                href={SITE.phoneHref}
                className="mt-2 flex min-h-[44px] items-center font-display text-[26px] font-bold leading-none text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-ink"
              >
                {SITE.phone}
              </a>
              <p className="mt-2 text-[14px] leading-relaxed text-ash">
                Quicker to book here — but we'll always pick up.
              </p>
            </Reveal>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
