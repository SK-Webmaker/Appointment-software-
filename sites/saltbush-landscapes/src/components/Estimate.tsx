import { ArrowRight, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
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
const jitter = (i: number, k: number) => {
  const x = Math.sin(i * 91.7 + k * 47.3) * 9631.17;
  return x - Math.floor(x) - 0.5;
};

/**
 * Chapter 03 — what it costs. Drag the size of the garden, pick the job and
 * the look; the plan beside it draws your plot from above and fills it with
 * plants in that style's colours while the estimate adds up.
 */
export function Estimate() {
  const { openSheet } = useBooking();
  const [m2, setM2] = useState(80);
  const [project, setProject] = useState<ProjectId>("new");
  const [style, setStyle] = useState<StyleId>("bush");
  const [extras, setExtras] = useState<ExtraId[]>(["mulch"]);
  const est = estimate({ m2, project, style, extras });
  const side = Math.round(Math.sqrt(m2));

  return (
    <section
      id="estimate"
      className="sheet bg-stone pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="estimate-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="estimate" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="estimate-title"
            className="max-w-[12ch] text-[clamp(40px,8.4vw,104px)] leading-[0.96]"
          >
            <MaskLines lines={[<>Dig into</>, <em className="text-rose">the numbers.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[42ch] text-[16px] leading-[1.75] text-ash md:text-[17px]">
              A rough guide before anyone picks up a shovel. The visit is free, and the drawn plan
              fixes the price.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
          <Reveal className="min-w-0 space-y-7 rounded-[26px] bg-card p-6 md:p-8">
            <label className="block">
              <span className="mb-2 flex items-baseline justify-between text-[12px] font-bold uppercase tracking-[0.14em]">
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
              <legend className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.14em]">
                The job
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROJECTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={project === p.id}
                    onClick={() => setProject(p.id)}
                    className={`min-h-[64px] rounded-2xl border-2 px-4 py-3 text-left transition-colors duration-300 ${project === p.id ? "border-onyx bg-onyx text-white" : "border-ink/10 bg-ivory hover:border-ink"}`}
                  >
                    <span className="block text-[16px] font-bold">{p.name}</span>
                    <span className="block text-[13px] opacity-80">{p.note}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.14em]">
                The look
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={style === s.id}
                    onClick={() => setStyle(s.id)}
                    className={`flex min-h-[64px] flex-col items-start justify-center gap-1.5 rounded-2xl border-2 px-4 py-3 text-left transition-colors duration-300 ${style === s.id ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-ivory hover:border-ink"}`}
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
                <legend className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.14em]">
                  Extras
                </legend>
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
            <div className="overflow-hidden rounded-[26px] bg-ink text-ivory">
              <Plan
                m2={m2}
                project={project}
                style={style}
                extras={extras}
                plants={est?.plants ?? 0}
              />
              <div className="p-6 md:p-8" aria-live="polite">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-silk">
                  Roughly
                </p>
                <p className="mt-2 font-display text-[clamp(34px,5vw,54px)] leading-none">
                  {est ? `${money(est.from)} – ${money(est.to)}` : "—"}
                  {est?.perVisit && (
                    <span className="ml-2 font-sans text-[16px] text-ivory/75">a visit</span>
                  )}
                </p>
                <dl className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-coal p-4">
                    <dt className="text-[12.5px] text-mist">
                      {est?.perVisit ? "Visits" : "New plants"}
                    </dt>
                    <dd className="mt-1 font-display text-[26px] leading-none">
                      {est?.perVisit ? "4 a year" : `about ${est?.plants ?? 0}`}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-coal p-4">
                    <dt className="text-[12.5px] text-mist">On site</dt>
                    <dd className="mt-1 font-display text-[26px] leading-none">
                      {est?.days === 1 ? "a day" : `${est?.days ?? 0} days`}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => openSheet({ project, size: sizeFor(m2), style })}
                  className="btn-honey sheen mt-6 w-full"
                >
                  Book a visit with this <ArrowRight size={16} strokeWidth={1.8} />
                </button>
                <p className="mt-3 text-center text-[12.5px] text-ivory/65">
                  A guide for a concept business — not a quote.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Your plot from above, to scale with the slider, planted in the style's colours. */
function Plan({
  m2,
  project,
  style,
  extras,
  plants,
}: {
  m2: number;
  project: ProjectId;
  style: StyleId;
  extras: ExtraId[];
  plants: number;
}) {
  const s = 70 + (Math.sqrt(m2) / 20) * 230;
  const o = (320 - s) / 2;
  const palette = styleOf(style)?.palette ?? STYLES[0]!.palette;
  const n = project === "care" ? Math.round(m2 * 1.2) : plants;
  const shown = Math.min(n, 170);
  const dots = useMemo(() => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(shown)));
    const cell = s / cols;
    return Array.from({ length: shown }, (_, i) => ({
      x: o + ((i % cols) + 0.5 + jitter(i, 1) * 0.6) * cell,
      y: o + (Math.floor(i / cols) + 0.5 + jitter(i, 2) * 0.6) * cell,
      r: Math.min(10, Math.max(2.6, cell * (0.26 + (jitter(i, 3) + 0.5) * 0.16))),
      c: Math.floor((jitter(i, 4) + 0.5) * 5),
    }));
  }, [shown, s, o]);
  return (
    <div className="relative bg-[#2c3527]">
      <svg
        viewBox="0 0 320 320"
        className="block aspect-square w-full max-h-[420px]"
        aria-hidden="true"
      >
        <defs>
          <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0 H0 V16" fill="none" stroke="rgb(244 241 234 / 0.05)" />
          </pattern>
        </defs>
        <rect width="320" height="320" fill="url(#grid)" />
        <rect
          x={o}
          y={o}
          width={s}
          height={s}
          rx="10"
          fill={extras.includes("mulch") || project === "care" ? "#8a6a45" : "#c7b28c"}
          style={{ transition: "all 0.5s cubic-bezier(0.22,1,0.36,1)" }}
        />
        {project !== "care" &&
          extras.includes("drip") &&
          Array.from({ length: 5 }, (_, i) => (
            <path
              key={i}
              d={`M${o + 6} ${o + ((i + 0.5) * s) / 5} H${o + s - 6}`}
              stroke="#8cc4e0"
              strokeWidth="1.4"
              strokeDasharray="3 5"
              opacity="0.8"
            />
          ))}
        {project !== "care" && extras.includes("paths") && (
          <path
            d={`M${o} ${o + s * 0.78} C${o + s * 0.35} ${o + s * 0.7} ${o + s * 0.4} ${o + s * 0.25} ${o + s} ${o + s * 0.2}`}
            stroke="#e3cfa3"
            strokeWidth={Math.max(6, s * 0.08)}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {dots.map((d, i) => (
          <circle
            key={i}
            className="pop"
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill={palette[d.c % palette.length]}
            style={{ animationDelay: `${Math.min(i, 60) * 6}ms` }}
          />
        ))}
      </svg>
      <p
        data-qa="layered"
        className="absolute left-4 top-4 rounded-full bg-noir/70 px-3 py-1 text-[12.5px] text-ivory"
      >
        {Math.round(Math.sqrt(m2))} m × {Math.round(Math.sqrt(m2))} m, from above
      </p>
    </div>
  );
}
