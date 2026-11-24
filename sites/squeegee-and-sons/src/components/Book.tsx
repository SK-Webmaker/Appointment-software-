import { ArrowRight, Phone } from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { Spotlight } from "./fx/Spotlight";
import { AREA, CLEANS, FAQ, HOURS, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { suburbOf } from "@/lib/slots";

/** Chapter 04 — book a clean: check your suburb, pick the clean. Or just call. */
export function Book() {
  const { openSheet, postcode, setPostcode } = useBooking();
  const suburb = suburbOf(postcode);
  return (
    <section
      id="book"
      className="relative overflow-hidden bg-candy py-20 text-ink md:py-28"
      aria-labelledby="book-title"
    >
      <Spotlight color="rgb(255 255 255 / 0.5)" />
      <div className="relative mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="book-title"
          label="Book a clean"
          title="Check we cover your suburb"
          intro="We clean across the Eastern Suburbs, from Paddington down to Maroubra. Book online or call — Mum answers the phone."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="rounded-[14px] bg-noir p-6 text-ivory md:p-8">
            <label htmlFor="sq-postcode" className="text-[15px] font-bold text-pearl">
              Are we in your area?
            </label>
            <input
              id="sq-postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Your postcode"
              className="mt-3 block h-[64px] w-full rounded-2xl border-2 border-ivory/15 bg-coal px-5 text-[26px] font-bold tracking-[0.08em] text-ivory placeholder:text-mist focus:border-pearl focus:outline-none"
            />
            <p className="mt-4 min-h-[48px] text-[15.5px] leading-relaxed" aria-live="polite">
              {postcode.length < 4 ? (
                <span className="text-ivory/75">Paddington down to Maroubra.</span>
              ) : suburb ? (
                <span>
                  Yes — <span className="font-bold text-silk">{suburb}</span>. We're there every day
                  of the week.
                </span>
              ) : (
                <span>
                  That's outside our patch — call anyway and we'll point you to someone good.
                </span>
              )}
            </p>
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Suburbs we cover">
              {Object.values(AREA).map((s) => (
                <li key={s} className="rounded-full bg-coal px-3 py-1 text-[12.5px] text-ivory/85">
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-ivory/10 pt-5 text-center">
              {HOURS.map((h) => (
                <div key={h.days}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-mist">
                    {h.days}
                  </p>
                  <p className="mt-1 text-[13.5px] font-semibold">{h.time}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <div className="grid gap-3">
            {CLEANS.map((c, i) => (
              <Reveal key={c.id} delay={i * 0.05}>
                <button
                  type="button"
                  onClick={() => openSheet({ clean: c.id, step: 0 })}
                  className="group flex w-full items-center gap-5 rounded-[14px] bg-white p-5 text-left transition-colors hover:bg-ivory md:p-6"
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-onyx text-[20px] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[clamp(22px,3vw,30px)] font-extrabold leading-none tracking-[-0.02em]">
                      {c.name} clean
                    </span>
                    <span className="mt-1.5 block text-[14.5px] text-ash">{c.note}</span>
                  </span>
                  <ArrowRight
                    size={22}
                    strokeWidth={2}
                    className="shrink-0 transition-transform duration-500 group-hover:translate-x-1"
                  />
                </button>
              </Reveal>
            ))}
            <Reveal className="flex flex-col items-start gap-3 rounded-[14px] border-2 border-ink/20 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
              <p className="text-[15.5px] font-medium">
                Rather talk it through? Call us, 8 am – 5 pm.
              </p>
              <a href={SITE.phoneHref} className="btn-primary shrink-0">
                <Phone size={16} /> {SITE.phone}
              </a>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 grid gap-x-12 border-t border-ink/15 pt-12 lg:grid-cols-[0.8fr_1.2fr]">
          <h3 className="text-[clamp(28px,4vw,40px)] leading-[1.1]">Frequently asked questions</h3>
          <div className="mt-6 lg:mt-0">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-ink/15 py-4">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-bold">
                  {f.q}
                  <span
                    className="text-[24px] transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-[60ch] text-[15.5px] leading-relaxed text-ink/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
