import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { useTweened } from "./fx/Tween";
import {
  EXTRAS,
  PROJECTS,
  STYLES,
  sizeFor,
  styleOf,
  type ExtraId,
  type ProjectId,
  type StyleId,
} from "@/site.config";
import { useBooking } from "@/context/booking";
import { estimate } from "@/lib/slots";

const money = (n: number) => `$${n.toLocaleString("en-AU")}`;
const PHOTO: Record<ProjectId, { image: string; alt: string }> = {
  new: { image: "garden2", alt: "A newly planted garden of shrubs and groundcovers around a lawn" },
  makeover: { image: "paving", alt: "A paved courtyard edged with fresh planting" },
  planting: { image: "planting", alt: "Gloved hands planting seedlings into turned soil" },
  care: { image: "crew", alt: "A gardener pushing a wheelbarrow across a lawn" },
};

/**
 * Pricing: a rough guide before anyone picks up a shovel. Garden size, the
 * job, the look and any extras give a price range, a plant count and days on
 * site. The site visit is free and the drawn plan fixes the price.
 */
export function Estimate() {
  const { openSheet } = useBooking();
  const [m2, setM2] = useState(80);
  const [project, setProject] = useState<ProjectId>("new");
  const [style, setStyle] = useState<StyleId>("bush");
  const [extras, setExtras] = useState<ExtraId[]>(["mulch"]);
  const est = estimate({ m2, project, style, extras });
  const side = Math.round(Math.sqrt(m2));
  const lo = useTweened(est?.from ?? 0);
  const hi = useTweened(est?.to ?? 0);

  return (
    <section
      id="pricing"
      className="bg-ivory py-20 text-ink md:py-28"
      aria-labelledby="estimate-title"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="estimate-title"
          label="Pricing"
          title="What a new garden usually costs"
          intro="A rough guide to help you plan. Every garden is different, so the site visit is free and the drawn plan comes with a fixed price."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
          <Reveal className="min-w-0 space-y-7 rounded-[14px] border border-ink/10 bg-white p-6 md:p-8">
            <label className="block">
              <span className="mb-2 flex items-baseline justify-between text-[15px] font-bold">
                Size of the garden
                <span className="font-display text-[30px] normal-case tracking-normal">
                  {m2} m²
                </span>
              </span>
              <input
                type="range"
                min={10}
                max={400}
                step={5}
                value={m2}
                onChange={(e) => setM2(Number(e.target.value))}
                aria-valuetext={`${m2} square metres`}
                className="h-11 w-full cursor-pointer accent-[#3d5a3f]"
              />
              <span className="mt-1 block text-[13px] text-ash">
                About {side} × {side} m — pace it out, it's close enough.
              </span>
            </label>

            <fieldset className="min-w-0">
              <legend className="mb-2.5 text-[15px] font-bold">The job</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROJECTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={project === p.id}
                    onClick={() => setProject(p.id)}
                    className={`min-h-[64px] rounded-[12px] border-2 px-4 py-3 text-left transition-colors duration-300 ${project === p.id ? "border-onyx bg-onyx text-white" : "border-ink/10 bg-ivory hover:border-ink"}`}
                  >
                    <span className="block text-[16px] font-bold">{p.name}</span>
                    <span className="block text-[13px] opacity-80">{p.note}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="mb-2.5 text-[15px] font-bold">The look</legend>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={style === s.id}
                    onClick={() => setStyle(s.id)}
                    className={`flex min-h-[64px] flex-col items-start justify-center gap-1.5 rounded-[12px] border-2 px-4 py-3 text-left transition-colors duration-300 ${style === s.id ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-ivory hover:border-ink"}`}
                  >
                    <span className="text-[15px] font-bold">{s.name}</span>
                    <span className="flex gap-1" aria-hidden="true">
                      {s.palette.map((c) => (
                        <span
                          key={c}
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {project !== "care" && (
              <fieldset className="min-w-0">
                <legend className="mb-2.5 text-[15px] font-bold">Extras</legend>
                <div className="flex flex-wrap gap-2">
                  {EXTRAS.map((x) => {
                    const on = extras.includes(x.id);
                    return (
                      <button
                        key={x.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setExtras((e) => (on ? e.filter((y) => y !== x.id) : [...e, x.id]))
                        }
                        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium transition-colors duration-300 ${on ? "border-onyx bg-mint text-ink" : "border-ink/15 hover:border-ink"}`}
                      >
                        {on && <Check size={14} strokeWidth={2.6} />} {x.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </Reveal>

          <Reveal delay={0.06} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-[14px] bg-ink text-ivory">
              <div className="relative aspect-[16/9] overflow-hidden bg-coal">
                <Img
                  key={project}
                  name={PHOTO[project].image}
                  widths={[800, 1200]}
                  sizes="(min-width:1024px) 600px, 92vw"
                  alt={PHOTO[project].alt}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6 md:p-8" aria-live="polite">
                <p className="text-[14px] font-bold text-silk">Roughly</p>
                <p className="mt-2 font-display text-[clamp(34px,5vw,54px)] leading-none">
                  {est ? (
                    <>
                      <span className="sr-only">{`${money(est.from)} – ${money(est.to)}`}</span>
                      <span aria-hidden="true" className="tabular-nums">
                        {`${money(Math.round(lo))} – ${money(Math.round(hi))}`}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                  {est?.perVisit && (
                    <span className="ml-2 font-sans text-[16px] text-ivory/75">a visit</span>
                  )}
                </p>
                <dl className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-[12px] bg-coal p-4">
                    <dt className="text-[12.5px] text-mist">
                      {est?.perVisit ? "Visits" : "New plants"}
                    </dt>
                    <dd className="mt-1 font-display text-[26px] leading-none">
                      {est?.perVisit ? "4 a year" : `about ${est?.plants ?? 0}`}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-coal p-4">
                    <dt className="text-[12.5px] text-mist">On site</dt>
                    <dd className="mt-1 font-display text-[26px] leading-none">
                      {est?.days === 1 ? "a day" : `${est?.days ?? 0} days`}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => openSheet({ project, size: sizeFor(m2), style })}
                  className="btn-honey mt-6 w-full"
                >
                  Book a visit with this <ArrowRight size={16} strokeWidth={1.8} />
                </button>
                <p className="mt-3 text-center text-[13px] text-ivory/70">
                  A guide only — the drawn plan fixes the price.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
