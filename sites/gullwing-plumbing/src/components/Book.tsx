import { ArrowRight, CalendarClock, FileText, Phone, Siren } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { HOURS, SITE } from "@/site.config";
import { useBooking, type Urgency } from "@/context/booking";

const ROUTES: { urgency: Urgency; title: string; text: string; icon: typeof Siren }[] = [
  {
    urgency: "now",
    title: "Send someone now",
    text: "Water, gas or no toilet — a van heads your way.",
    icon: Siren,
  },
  {
    urgency: "booked",
    title: "Book a time",
    text: "Pick a day and a two-hour window that suits you.",
    icon: CalendarClock,
  },
  {
    urgency: "quote",
    title: "Get a quote",
    text: "Renovation or new fit-out? Tell us, add photos.",
    icon: FileText,
  },
];

/** Chapter 05 — book: call (the fastest), or pick how soon you need us. */
export function Book() {
  const { openSheet, setEmergency } = useBooking();
  return (
    <section
      id="book"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-32"
      aria-labelledby="book-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="book" />
        <h2 id="book-title" className="mt-8 text-[clamp(44px,10vw,140px)] leading-[0.86]">
          <MaskLines lines={[<>Get a</>, <em className="text-rose">plumber.</em>]} />
        </h2>

        <div className="mt-12 grid gap-5 md:mt-16 lg:grid-cols-[1fr_1.2fr]">
          <Reveal className="flex flex-col justify-between gap-8 rounded-[22px] bg-noir p-7 text-ivory md:p-10">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-pearl">
                Fastest · 24/7
              </p>
              <a
                href={SITE.phoneHref}
                className="mt-3 block font-display text-[clamp(34px,6.4vw,68px)] font-black leading-none [font-stretch:125%] hover:text-flare"
              >
                {SITE.phone}
              </a>
              <p className="mt-4 max-w-[34ch] text-[15.5px] leading-relaxed text-ivory/80">
                A real person answers — day, night, Sunday. Tell us what's happening and we'll give
                you a time and a price on the call.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={SITE.phoneHref} className="btn-honey sheen">
                <Phone size={16} strokeWidth={2} /> Call now
              </a>
              <button type="button" onClick={() => setEmergency(true)} className="btn-ghost-light">
                <Siren size={16} strokeWidth={2} /> Emergency mode
              </button>
            </div>
          </Reveal>

          <div className="grid gap-3">
            {ROUTES.map((r, i) => (
              <Reveal key={r.urgency} delay={i * 0.06}>
                <button
                  type="button"
                  onClick={() => openSheet({ urgency: r.urgency })}
                  className="group flex w-full items-center gap-5 rounded-[18px] border-2 border-ink/10 bg-card p-5 text-left transition-colors duration-300 hover:border-ink md:p-7"
                >
                  <span
                    className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${r.urgency === "now" ? "bg-flare text-noir" : "bg-ink text-ivory"}`}
                  >
                    <r.icon size={24} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[clamp(20px,3vw,30px)] font-black uppercase leading-none [font-stretch:115%]">
                      {r.title}
                    </span>
                    <span className="mt-1.5 block text-[14.5px] text-ash">{r.text}</span>
                  </span>
                  <ArrowRight
                    size={22}
                    strokeWidth={1.8}
                    className="shrink-0 transition-transform duration-500 group-hover:translate-x-1"
                  />
                </button>
              </Reveal>
            ))}
            <Reveal className="mt-2 grid grid-cols-3 gap-3 rounded-[18px] bg-stone p-5 text-center md:p-6">
              {HOURS.map((h) => (
                <div key={h.days}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
                    {h.days}
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-ink">{h.time}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
