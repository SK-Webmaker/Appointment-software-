import { ArrowRight, CalendarClock, FileText, Phone, Siren } from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { Spotlight } from "./fx/Spotlight";
import { AREA, FAQ, HOURS, SITE } from "@/site.config";
import { useBooking, type Urgency } from "@/context/booking";
import { etaNow, suburbOf } from "@/lib/slots";

const ROUTES: { urgency: Urgency; title: string; text: string; icon: typeof Siren }[] = [
  {
    urgency: "now",
    title: "Today, please",
    text: "Something's leaking or not working. We'll be there today.",
    icon: Siren,
  },
  {
    urgency: "booked",
    title: "Pick a time",
    text: "A day and a two-hour window that suits you.",
    icon: CalendarClock,
  },
  {
    urgency: "quote",
    title: "Quote my reno",
    text: "Bathroom, kitchen or laundry — send plans or photos.",
    icon: FileText,
  },
];

/** Chapter 05 — book: check your suburb, then choose how soon. Or just call. */
export function Book() {
  const { openSheet, postcode, setPostcode } = useBooking();
  const suburb = suburbOf(postcode);
  return (
    <section
      id="book"
      className="relative overflow-hidden bg-noir py-20 text-ivory md:py-28"
      aria-labelledby="book-title"
    >
      <Spotlight />
      <div className="relative mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="book-title"
          label="Book a plumber"
          title="Check you're in our area, then pick a time"
          intro="We cover the Northern Beaches from Manly to Palm Beach. Book online, or call and talk to a real person."
          light
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="rounded-[14px] bg-coal p-6 md:p-8">
            <label htmlFor="tw-postcode" className="text-[15px] font-semibold text-pearl">
              Are you on the Beaches?
            </label>
            <input
              id="tw-postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Your postcode"
              className="mt-3 block h-[64px] w-full rounded-2xl border-2 border-ivory/15 bg-noir px-5 text-[26px] font-semibold tracking-[0.08em] text-ivory placeholder:text-mist focus:border-pearl focus:outline-none"
            />
            <p className="mt-4 min-h-[48px] text-[15.5px] leading-relaxed" aria-live="polite">
              {postcode.length < 4 ? (
                <span className="text-ivory/75">
                  From Manly to Palm Beach and back up to Terrey Hills.
                </span>
              ) : suburb ? (
                <span>
                  Yes — <span className="font-semibold text-pearl">{suburb}</span>. Urgent jobs
                  there are usually reached in about {etaNow(postcode)} minutes.
                </span>
              ) : (
                <span>
                  That's outside our patch — call anyway and we'll point you to someone good.
                </span>
              )}
            </p>
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Suburbs we cover">
              {Object.values(AREA)
                .slice(0, 10)
                .map((s) => (
                  <li
                    key={s}
                    className="rounded-full bg-noir px-3 py-1 text-[12.5px] text-ivory/80"
                  >
                    {s}
                  </li>
                ))}
              <li className="rounded-full px-3 py-1 text-[12.5px] text-mist">
                + {Object.keys(AREA).length - 10} more
              </li>
            </ul>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-ivory/10 pt-5 text-center">
              {HOURS.map((h) => (
                <div key={h.days}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mist">
                    {h.days}
                  </p>
                  <p className="mt-1 text-[13.5px] font-semibold">{h.time}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <div className="grid gap-3">
            {ROUTES.map((r, i) => (
              <Reveal key={r.urgency} delay={i * 0.06}>
                <button
                  type="button"
                  onClick={() => openSheet({ urgency: r.urgency })}
                  className="group flex w-full items-center gap-5 rounded-[14px] bg-ivory p-5 text-left text-ink transition-colors hover:bg-white md:p-6"
                >
                  <span
                    className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${r.urgency === "now" ? "bg-candy text-ink" : "bg-onyx text-white"}`}
                  >
                    <r.icon size={24} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-sans text-[19px] font-bold leading-tight">
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
            <Reveal className="flex flex-col items-start gap-3 rounded-[14px] border border-ivory/20 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
              <p className="text-[15px] text-ivory/85">
                Rather chat? A real person answers, 7 days.
              </p>
              <a href={SITE.phoneHref} className="btn-honey shrink-0">
                <Phone size={16} /> {SITE.phone}
              </a>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 grid gap-x-12 border-t border-ivory/10 pt-12 lg:grid-cols-[0.8fr_1.2fr]">
          <h3 className="text-[clamp(28px,4vw,40px)] leading-[1.1]">Frequently asked questions</h3>
          <div className="mt-6 lg:mt-0">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-ivory/10 py-4">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
                  {f.q}
                  <span
                    className="text-[22px] text-silk transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ivory/75">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
