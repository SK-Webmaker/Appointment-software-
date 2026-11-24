import { ArrowRight, Phone } from "lucide-react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { Spotlight } from "./fx/Spotlight";
import { AREA, FAQ, HOURS, PROJECTS, SERVICES, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { suburbOf } from "@/lib/slots";

const PHOTO = Object.fromEntries(SERVICES.map((x) => [x.id, x.image])) as Record<string, string>;

/** Book a visit: check your suburb, then choose the job. Or just call. */
export function Book() {
  const { openSheet, postcode, setPostcode } = useBooking();
  const suburb = suburbOf(postcode);
  return (
    <section
      id="visit"
      className="relative overflow-hidden bg-noir py-20 text-ivory md:py-28"
      aria-labelledby="visit-title"
    >
      <Spotlight color="rgb(233 180 90 / 0.16)" />
      <div className="relative mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="visit-title"
          label="Book a site visit"
          title="Let's walk the garden together"
          intro="A free, 45-minute visit: we look at the light, dig a test hole, and hear what you love and what you'd happily lose."
          light
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="rounded-[14px] bg-coal p-6 md:p-8">
            <label htmlFor="sb-postcode" className="text-[15px] font-bold text-pearl">
              Are you in the Hills?
            </label>
            <input
              id="sb-postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Your postcode"
              className="mt-3 block h-[64px] w-full rounded-2xl border-2 border-ivory/15 bg-noir px-5 text-[26px] font-semibold tracking-[0.08em] text-ivory placeholder:text-mist focus:border-pearl focus:outline-none"
            />
            <p className="mt-4 min-h-[48px] text-[15.5px] leading-relaxed" aria-live="polite">
              {postcode.length < 4 ? (
                <span className="text-ivory/75">From Carlingford out to Glenorie.</span>
              ) : suburb ? (
                <span>
                  Yes — <span className="font-semibold text-pearl">{suburb}</span>. We're in your
                  part of the Hills most weeks.
                </span>
              ) : (
                <span>
                  That's outside our patch — call anyway and we'll point you to someone good.
                </span>
              )}
            </p>
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Suburbs we cover">
              {Object.values(AREA).map((s) => (
                <li key={s} className="rounded-full bg-noir px-3 py-1 text-[12.5px] text-ivory/80">
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

          <div className="grid gap-3 sm:grid-cols-2">
            {PROJECTS.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.05}>
                <button
                  type="button"
                  onClick={() => openSheet({ project: p.id })}
                  className="group flex h-full w-full flex-col justify-between gap-6 rounded-[14px] bg-ivory p-5 text-left text-ink transition-colors hover:bg-white md:p-6"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-mint">
                      <Img
                        name={PHOTO[p.id] ?? "planting"}
                        widths={[800]}
                        sizes="64px"
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <ArrowRight
                      size={22}
                      strokeWidth={1.8}
                      className="mt-1 shrink-0 transition-transform duration-500 group-hover:translate-x-1"
                    />
                  </span>
                  <span>
                    <span className="block font-sans text-[19px] font-bold leading-tight">
                      {p.name}
                    </span>
                    <span className="mt-1.5 block text-[14.5px] text-ash">{p.note}</span>
                  </span>
                </button>
              </Reveal>
            ))}
            <Reveal className="flex flex-col items-start gap-3 rounded-[14px] border border-ivory/20 p-5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between md:p-6">
              <p className="text-[15px] text-ivory/85">
                Rather talk it through? We answer between gardens.
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
