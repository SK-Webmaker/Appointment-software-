import { ArrowRight, Clock, MapPin, Phone, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { FAQ, HOURS, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { dayLabel, isoDay, jobTimes, openDays, openStatus, pretty } from "@/lib/slots";

type Next = { day: string; times: string[] } | null;

/** Chapter 04 — book a bay: drop off at the studio (next free drop-offs, live) or have the van come to you. */
export function Book() {
  const { openSheet } = useBooking();
  const [status, setStatus] = useState<string | null>(null);
  const [next, setNext] = useState<Next>(null);
  useEffect(() => {
    const now = new Date();
    setStatus(openStatus(now).text);
    for (const d of openDays(8, now)) {
      if (d.closed) continue;
      const t = jobTimes(d.iso, "studio", now);
      if (t.length) {
        setNext({ day: d.iso, times: t.slice(0, 4) });
        return;
      }
    }
  }, []);

  return (
    <section
      id="book"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-32"
      aria-labelledby="book-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[900px] w-[900px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(79_63_214/0.22),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="book" light />
        <h2
          id="book-title"
          className="mt-8 max-w-[18ch] text-[clamp(30px,6.4vw,76px)] leading-[1.08]"
        >
          <MaskLines lines={[<>Book a bay,</>, <em>or bring us to you.</em>]} />
        </h2>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Reveal className="flex flex-col rounded-[20px] border border-ivory/10 bg-coal p-6 md:p-8">
            <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.22em] text-silk">
              <MapPin size={15} /> The studio · {SITE.area}
            </p>
            <h3 className="mt-4 text-[20px] leading-snug">Drop it off in the morning</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ivory/80">
              Every package, under the lights. We text photos as we go and when it's ready.
            </p>
            <p
              className="mt-5 text-[12px] font-medium uppercase tracking-[0.2em] text-mist"
              aria-live="polite"
            >
              {next
                ? `Next drop-offs · ${next.day === isoDay(new Date()) ? "today" : dayLabel(next.day, { weekday: "long" })}`
                : "Checking the bays…"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {next?.times.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => openSheet({ mode: "studio", day: next.day, time: t })}
                  className="min-h-[44px] rounded-full border border-silk/40 px-4 text-[14px] font-medium hover:border-silk hover:bg-silk hover:text-noir"
                  aria-label={`Drop off at ${pretty(t)}, ${dayLabel(next.day, { weekday: "long" })}`}
                >
                  {pretty(t)}
                </button>
              ))}
            </div>
            <ul className="mt-6 space-y-1 border-t border-ivory/10 pt-5 text-[14px] text-ivory/80">
              {HOURS.map((h) => (
                <li key={h.days} className="flex justify-between gap-3">
                  <span>{h.days}</span>
                  <span className="text-ivory">{h.time}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => openSheet({ mode: "studio" })}
              className="btn-primary sheen mt-8 self-start"
            >
              Book a bay <ArrowRight size={16} strokeWidth={1.8} />
            </button>
          </Reveal>

          <Reveal
            delay={0.08}
            className="flex flex-col rounded-[20px] border border-ivory/10 bg-coal p-6 md:p-8"
          >
            <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.22em] text-pearl">
              <Truck size={15} /> Mobile · within 15 km
            </p>
            <h3 className="mt-4 text-[20px] leading-snug">We bring the studio</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ivory/80">
              Express Gloss and Interior Reset at your home or office — our own water, power and
              lights. Correction and ceramic stay in the bay.
            </p>
            <p className="mt-5 flex items-center gap-2 text-[14px] text-ivory/80">
              <Clock size={15} className="text-pearl" /> Start times 8 am – 2 pm, Monday to Saturday
            </p>
            <div className="mt-6 space-y-3 border-t border-ivory/10 pt-5">
              {FAQ.slice(0, 2).map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                    {f.q}
                    <span
                      className="text-[20px] text-pearl transition-transform group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-1 text-[14px] leading-relaxed text-ivory/75">{f.a}</p>
                </details>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openSheet({ mode: "mobile" })}
              className="btn-ghost-light mt-8 self-start"
            >
              Book the van <ArrowRight size={16} strokeWidth={1.8} />
            </button>
          </Reveal>
        </div>

        <Reveal className="mt-8 flex flex-col items-start justify-between gap-4 rounded-[20px] border border-dashed border-ivory/20 p-6 sm:flex-row sm:items-center md:p-8">
          <p className="text-[15px] text-ivory/85">
            <span className="text-ivory">{status ?? "Open Monday to Saturday."}</span> Rather talk
            it through? We'll look at photos of your paint and tell you honestly what it needs.
          </p>
          <a href={SITE.phoneHref} className="btn-ghost-light shrink-0">
            <Phone size={16} /> {SITE.phone}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
