import { ArrowRight, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { BARBERS } from "@/site.config";
import { useBooking } from "@/context/booking";
import { dayLabel, nextFree, pretty } from "@/lib/slots";

type Next = { day: string; time: string; today: boolean } | null;

/**
 * Chapter 02 — the barbers: three chairs, each with who sits behind it, what
 * they're known for and their next free time today (worked out live). Tap a
 * chair to book with that barber — at that time, if you like.
 */
export function Barbers() {
  const { openSheet, service } = useBooking();
  const [next, setNext] = useState<Record<string, Next> | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setNext(Object.fromEntries(BARBERS.map((b) => [b.id, nextFree(b.id, 45, now)])));
    };
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <section
      id="barbers"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36"
      aria-labelledby="barbers-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-56 top-10 h-[760px] w-[760px] bg-[radial-gradient(closest-side,rgb(201_162_90/0.16),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="barbers" light />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <h2 id="barbers-title" className="text-[clamp(52px,11vw,136px)] leading-[0.86]">
            <MaskLines lines={[<>Three chairs.</>, <em className="text-pearl">Pick yours.</em>]} />
          </h2>
          <Reveal className="relative hidden aspect-[16/10] overflow-hidden rounded-[6px] lg:block">
            <Img
              name="tools"
              widths={[480, 800, 1200, 1600]}
              sizes="(min-width:1440px) 560px, 40vw"
              alt="The tools of the trade laid out on slate: clippers, scissors, a comb, pomade and a tonic"
              className="h-full w-full object-cover"
              style={{ objectPosition: "50% 50%" }}
            />
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-4 md:mt-20 md:grid-cols-3 md:gap-5">
          {BARBERS.map((b, i) => {
            const n = next?.[b.id];
            return (
              <Reveal as="li" key={b.id} delay={i * 0.08} className="flex">
                <article className="group relative flex w-full flex-col overflow-hidden rounded-[8px] border border-ivory/10 bg-coal p-6 transition-colors duration-500 hover:border-pearl/40 md:p-8">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-4 -top-10 font-display text-[220px] font-black uppercase leading-none text-ivory/[0.05] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-x-3"
                  >
                    {b.name[0]}
                  </span>
                  <p className="text-[11.5px] font-semibold uppercase tracking-[0.22em] text-pearl">
                    {b.title}
                  </p>
                  <h3 className="mt-3 text-[56px] leading-[0.9] md:text-[64px]">{b.name}</h3>
                  <p className="mt-1 text-[13.5px] text-mist">{b.years} years behind the chair</p>
                  <p className="aside mt-5 text-[22px] leading-snug text-ivory">{b.known}</p>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ivory/70">{b.tools}</p>

                  <div className="mt-auto pt-8">
                    <p
                      className="flex min-h-[44px] items-center gap-2 border-t border-ivory/10 pt-4 text-[14px] text-ivory/80"
                      aria-live="polite"
                    >
                      <Clock size={16} strokeWidth={1.8} className="shrink-0 text-pearl" />
                      {next === null ? (
                        <span className="text-ivory/60">Checking the book…</span>
                      ) : n ? (
                        <span>
                          Next free:{" "}
                          <span className="font-semibold text-ivory">
                            {n.today ? "today" : dayLabel(n.day, { weekday: "short" })}{" "}
                            {pretty(n.time)}
                          </span>
                        </span>
                      ) : (
                        <span>Fully booked this week</span>
                      )}
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row md:flex-col xl:flex-row">
                      {n && (
                        <button
                          type="button"
                          onClick={() => openSheet({ barber: b.id, day: n.day, time: n.time, ...(service ? {} : { service: "Signature Cut" }) })}
                          className="btn-honey flex-1 px-4 text-[11.5px]"
                        >
                          Take {pretty(n.time)}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openSheet({ barber: b.id })}
                        className="btn-ghost-light flex-1 px-4 text-[11.5px]"
                      >
                        Book {b.name} <ArrowRight size={15} strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </ul>
        <Reveal className="mt-8 flex flex-col items-start gap-3 rounded-[8px] border border-dashed border-ivory/20 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <p className="text-[16px] text-ivory/85">
            <span className="font-semibold text-ivory">No preference?</span> We'll put you with
            whoever's free first.
          </p>
          <button
            type="button"
            onClick={() => openSheet({ barber: "any" })}
            className="btn-ghost-light shrink-0 px-6 text-[11.5px]"
          >
            First available <ArrowRight size={15} strokeWidth={1.8} />
          </button>
        </Reveal>
      </div>
    </section>
  );
}
