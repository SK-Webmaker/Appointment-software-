import { ArrowRight, Phone } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
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
      className="sheet bg-candy pb-24 pt-24 text-ink md:pb-32 md:pt-32"
      aria-labelledby="book-title"
    >
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="book" ink />
        <h2
          id="book-title"
          className="mt-8 max-w-[13ch] text-[clamp(44px,9vw,120px)] leading-[0.9]"
        >
          <MaskLines lines={[<>Get your</>, <em className="text-plum">Saturday back.</em>]} />
        </h2>

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="rounded-[30px] bg-noir p-6 text-ivory md:p-8">
            <label
              htmlFor="sq-postcode"
              className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-pearl"
            >
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
                  className="group flex w-full items-center gap-5 rounded-[24px] bg-white p-5 text-left transition-transform duration-500 hover:-translate-y-0.5 md:p-6"
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
            <Reveal className="flex flex-col items-start gap-3 rounded-[24px] border-2 border-dashed border-ink/25 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
              <p className="text-[15.5px] font-medium">Rather talk? Mum answers the phone.</p>
              <a href={SITE.phoneHref} className="btn-primary shrink-0">
                <Phone size={16} /> {SITE.phone}
              </a>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 grid gap-x-12 border-t border-ink/15 pt-12 lg:grid-cols-[0.8fr_1.2fr]">
          <h3 className="text-[clamp(32px,4vw,52px)] leading-[1]">Good to know</h3>
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
