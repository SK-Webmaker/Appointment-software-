import { ArrowRight, Phone } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { PlantArt, type PlantKind } from "./PlantArt";
import { AREA, FAQ, HOURS, PROJECTS, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { suburbOf } from "@/lib/slots";

const ICON: Record<string, PlantKind> = {
  new: "grasstree",
  makeover: "banksia",
  planting: "paw",
  care: "lomandra",
};

/** Chapter 05 — book a visit: check your suburb, then choose the job. Or just call. */
export function Book() {
  const { openSheet, postcode, setPostcode } = useBooking();
  const suburb = suburbOf(postcode);
  return (
    <section
      id="visit"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-32"
      aria-labelledby="visit-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -left-40 top-0 h-[800px] w-[800px] bg-[radial-gradient(closest-side,rgb(201_214_195/0.12),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="visit" light />
        <h2
          id="visit-title"
          className="mt-8 max-w-[14ch] text-[clamp(40px,8.4vw,104px)] leading-[0.96]"
        >
          <MaskLines lines={[<>Let's walk</>, <em className="text-silk">the garden.</em>]} />
        </h2>
        <Reveal>
          <p className="mt-6 max-w-[46ch] text-[16px] leading-[1.75] text-ivory/80 md:text-[17px]">
            A free, 45-minute visit: we look at the light, dig a test hole, hear what you love and
            what you'd happily lose.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="rounded-[26px] bg-coal p-6 md:p-8">
            <label
              htmlFor="sb-postcode"
              className="text-[12px] font-bold uppercase tracking-[0.16em] text-pearl"
            >
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
                  className="group flex h-full w-full flex-col justify-between gap-6 rounded-[22px] bg-ivory p-5 text-left text-ink transition-transform duration-500 hover:-translate-y-0.5 md:p-6"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="grid h-16 w-16 shrink-0 place-items-end justify-center overflow-hidden rounded-2xl bg-mint pb-1">
                      <PlantArt kind={ICON[p.id] ?? "shrub"} className="h-12 w-auto" />
                    </span>
                    <ArrowRight
                      size={22}
                      strokeWidth={1.8}
                      className="mt-1 shrink-0 transition-transform duration-500 group-hover:translate-x-1"
                    />
                  </span>
                  <span>
                    <span className="block font-display text-[clamp(22px,2.6vw,28px)] leading-tight">
                      {p.name}
                    </span>
                    <span className="mt-1.5 block text-[14.5px] text-ash">{p.note}</span>
                  </span>
                </button>
              </Reveal>
            ))}
            <Reveal className="flex flex-col items-start gap-3 rounded-[22px] border border-dashed border-ivory/25 p-5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between md:p-6">
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
          <h3 className="text-[clamp(30px,4vw,48px)] leading-[1]">Good to know</h3>
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
