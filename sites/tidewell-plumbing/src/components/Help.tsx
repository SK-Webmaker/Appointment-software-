import { ArrowRight, Phone } from "lucide-react";
import { useState } from "react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { CHECKS, SITE, WATER } from "@/site.config";
import { useBooking } from "@/context/booking";

const PRESETS = [
  { label: "Slow", dpm: 10 },
  { label: "Steady", dpm: 30 },
  { label: "Fast", dpm: 90 },
];

/**
 * Before you call: honest quick checks people can try themselves, and what a
 * dripping tap actually wastes in a year.
 */
export function Help() {
  const { openSheet } = useBooking();
  const [dpm, setDpm] = useState(30);
  const perYear = ((dpm * 60 * 24 * WATER.dropMl) / 1000) * 365;
  const baths = perYear / WATER.bathL;
  const dollars = (perYear / 1000) * WATER.dollarsPerKl;

  return (
    <section id="help" className="bg-ivory py-20 text-ink md:py-28" aria-labelledby="help-title">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="help-title"
          label="Before you call"
          title="Some things you can check yourself"
          intro="Sometimes it's a switch or a kettle of hot water — we'd rather you knew. If these don't do it, we're a call away."
        />
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <Reveal>
            <div className="divide-y divide-ink/10 rounded-[14px] border border-ink/10 bg-white px-5 md:px-7">
              {CHECKS.map((c) => (
                <details key={c.q} className="group py-4">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-semibold">
                    {c.q}
                    <span
                      className="text-[22px] text-onyx transition-transform group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-1 max-w-[62ch] pb-1 text-[15.5px] leading-relaxed text-ash">
                    {c.a}
                  </p>
                </details>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[15px] text-ash">
              <Phone size={16} className="text-onyx" /> Burst pipe or gas smell? Call{" "}
              <a href={SITE.phoneHref} className="font-semibold text-ink underline">
                {SITE.phone}
              </a>
            </p>
          </Reveal>

          <Reveal
            delay={0.05}
            className="overflow-hidden rounded-[14px] border border-ink/10 bg-white"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-stone">
              <Img
                name="drip"
                widths={[800, 1200]}
                sizes="(min-width:1024px) 520px, 92vw"
                alt="A drop of water about to fall from a chrome tap"
                className="h-full w-full object-cover"
              />
              {/* drops falling from the tap at the speed you set */}
              <span
                key={dpm}
                className="absolute left-[52.5%] top-[30%] h-4 w-3 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-[linear-gradient(160deg,#ffffff,#9fe3d4)] shadow-[0_0_10px_rgba(159,227,212,0.8)] will-change-transform [animation-iteration-count:infinite] [animation-name:fall] [animation-timing-function:cubic-bezier(0.55,0,1,0.45)] motion-reduce:hidden"
                style={{ animationDuration: `${Math.max(0.45, 60 / dpm)}s` }}
                aria-hidden="true"
              />
            </div>
            <div className="p-6 md:p-7" id="drip">
              <h3 className="font-sans text-[20px] font-bold">What does a dripping tap cost?</h3>
              <label className="mt-4 block">
                <span className="flex items-baseline justify-between text-[14.5px] text-ash">
                  Drips per minute
                  <span className="text-[20px] font-bold text-ink">{dpm}</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={120}
                  value={dpm}
                  onChange={(e) => setDpm(Number(e.target.value))}
                  className="mt-1 h-10 w-full cursor-pointer accent-[#0f5c56]"
                />
              </label>
              <div className="flex gap-2">
                {PRESETS.map((x) => (
                  <button
                    key={x.label}
                    type="button"
                    aria-pressed={dpm === x.dpm}
                    onClick={() => setDpm(x.dpm)}
                    className={`min-h-[40px] rounded-full border px-4 text-[14px] font-medium ${dpm === x.dpm ? "border-onyx bg-onyx text-white" : "border-ink/15 hover:border-ink/40"}`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-center" aria-live="polite">
                {[
                  [`${Math.round(perYear).toLocaleString("en-AU")} L`, "a year"],
                  [`${baths < 10 ? baths.toFixed(1) : Math.round(baths)}`, "bathtubs"],
                  [`$${dollars.toFixed(dollars < 10 ? 2 : 0)}`, "on the bill"],
                ].map(([v, k]) => (
                  <div key={k} className="flex flex-col-reverse rounded-[10px] bg-ivory p-3">
                    <dt className="mt-1 text-[13px] text-ash">{k}</dt>
                    <dd className="text-[19px] font-bold leading-none">{v}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => openSheet({ problem: "tap" })}
                className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 text-[15.5px] font-semibold text-onyx hover:underline"
              >
                Book a tap repair — usually $140–$260 <ArrowRight size={16} />
              </button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
