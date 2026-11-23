import { ArrowRight, Bath } from "lucide-react";
import { useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { WATER } from "@/site.config";
import { useBooking } from "@/context/booking";

const PRESETS = [
  { label: "Slow", dpm: 10 },
  { label: "Steady", dpm: 30 },
  { label: "Fast", dpm: 90 },
];

/**
 * Chapter 02 — that drip: set how fast your tap drips and the drawing drips
 * at that speed while the numbers add up — litres a year, baths a year and
 * what it adds to the water bill. Then fix it.
 */
export function Drip() {
  const { openSheet } = useBooking();
  const [dpm, setDpm] = useState(30);
  const perDay = (dpm * 60 * 24 * WATER.dropMl) / 1000;
  const perYear = perDay * 365;
  const baths = perYear / WATER.bathL;
  const dollars = (perYear / 1000) * WATER.dollarsPerKl;
  const shown = Math.min(30, Math.round(baths));

  return (
    <section
      id="drip"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36"
      aria-labelledby="drip-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -left-40 top-20 h-[700px] w-[700px] bg-[radial-gradient(closest-side,rgb(159_227_212/0.14),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="drip" light />
        <h2
          id="drip-title"
          className="mt-8 max-w-[14ch] text-[clamp(40px,8.4vw,104px)] leading-[0.96]"
        >
          <MaskLines lines={[<>Drip, drip,</>, <em className="text-silk">drip.</em>]} />
        </h2>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          {/* the tap, dripping at your speed */}
          <Reveal className="relative mx-auto h-[340px] w-full max-w-[360px]" aria-hidden="true">
            <svg viewBox="0 0 200 120" className="absolute left-0 top-0 w-[72%]">
              <rect x="0" y="20" width="40" height="36" rx="8" fill="#93aaa6" />
              <path
                d="M34 28 H130 Q160 28 160 58 V96 H138 V62 Q138 50 126 50 H34 Z"
                fill="#93aaa6"
              />
              <rect x="134" y="94" width="30" height="10" rx="3" fill="#4a625f" />
            </svg>
            <span
              className="absolute left-[52.5%] top-[38%] h-5 w-3.5 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-pearl will-change-transform [animation-name:drip] [animation-iteration-count:infinite] [animation-timing-function:cubic-bezier(0.55,0,1,0.45)]"
              style={{ animationDuration: `${Math.max(0.5, 60 / dpm)}s` }}
            />
            <div className="absolute inset-x-6 bottom-6 h-3 rounded-[50%] bg-pearl/25" />
          </Reveal>

          <div>
            <Reveal>
              <label className="block">
                <span className="mb-2 flex items-baseline justify-between text-[12px] font-semibold uppercase tracking-[0.18em] text-pearl">
                  Drips per minute{" "}
                  <span className="font-display text-[28px] normal-case tracking-normal text-ivory">
                    {dpm}
                  </span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={120}
                  value={dpm}
                  onChange={(e) => setDpm(Number(e.target.value))}
                  className="h-11 w-full cursor-pointer accent-[#ffb59f]"
                />
              </label>
              <div className="mt-3 flex gap-2">
                {PRESETS.map((x) => (
                  <button
                    key={x.label}
                    type="button"
                    aria-pressed={dpm === x.dpm}
                    onClick={() => setDpm(x.dpm)}
                    className={`min-h-[44px] rounded-full border px-4 text-[14px] font-medium transition-colors ${dpm === x.dpm ? "border-silk bg-silk text-noir" : "border-ivory/25 hover:border-ivory/60"}`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.06} className="mt-8 grid grid-cols-3 gap-3" aria-live="polite">
              {[
                [`${Math.round(perYear).toLocaleString("en-AU")} L`, "a year"],
                [`${baths < 10 ? baths.toFixed(1) : Math.round(baths)}`, "baths a year"],
                [`$${dollars.toFixed(dollars < 10 ? 2 : 0)}`, "on the bill"],
              ].map(([v, k]) => (
                <div key={k} className="rounded-[18px] bg-coal p-4">
                  <p className="font-display text-[clamp(22px,4.4vw,36px)] leading-none text-ivory">
                    {v}
                  </p>
                  <p className="mt-1 text-[13px] text-mist">{k}</p>
                </div>
              ))}
            </Reveal>

            <Reveal delay={0.1} className="mt-6" aria-hidden="true">
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 30 }, (_, i) => (
                  <Bath
                    key={i}
                    size={22}
                    strokeWidth={1.6}
                    className={`transition-colors duration-300 ${i < shown ? "text-pearl" : "text-ivory/15"}`}
                  />
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.12} className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => openSheet({ problem: "tap" })}
                className="btn-honey sheen"
              >
                Fix that drip <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <p className="max-w-[40ch] text-[14px] leading-relaxed text-ivory/75">
                Cheap water, sure — but a drip never gets slower. A new washer or cartridge is
                usually $140–$260, done in one visit.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
