import { motion } from "framer-motion";
import { Droplets } from "lucide-react";
import { useMemo, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { COATINGS } from "@/site.config";
import { useReducedMotionSafe } from "@/lib/motion";

// Where the drops land on the panel (viewBox 400 × 240), and how big they are.
const DROPS = Array.from({ length: 26 }, (_, i) => ({
  x: 24 + ((i * 97) % 352),
  y: 30 + ((i * 53) % 170),
  r: 6 + ((i * 7) % 9),
}));

/**
 * Chapter 03 — ceramic, demonstrated: water on a paint panel. Choose the
 * protection and drag the months since it went on: tight round beads that
 * roll off when you rinse, or flat puddles that sit and dry into spots.
 */
export function Ceramic() {
  const reduce = useReducedMotionSafe();
  const [coat, setCoat] = useState<(typeof COATINGS)[number]["id"]>("ceramic");
  const [months, setMonths] = useState(3);
  const [rinse, setRinse] = useState(0);
  const c = COATINGS.find((x) => x.id === coat)!;
  // How much protection is left: 1 fresh, 0 gone.
  const p = useMemo(
    () => (c.months ? Math.max(0, Math.min(1, 1 - months / (c.months * 1.15))) : 0),
    [c, months],
  );
  const angle = Math.round(35 + p * 80);
  const rolling = rinse > 0 && p > 0.45;

  return (
    <section
      id="ceramic"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="ceramic-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="ceramic" />
        <h2
          id="ceramic-title"
          className="mt-8 max-w-[18ch] text-[clamp(30px,6.4vw,76px)] leading-[1.08] [&_em]:bg-none [&_em]:text-rose"
        >
          <MaskLines lines={[<>Watch the water.</>, <em>It tells the truth.</em>]} />
        </h2>

        <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
          <Reveal className="relative overflow-hidden rounded-[20px] bg-noir">
            <svg
              viewBox="0 0 400 240"
              className="block h-auto w-full"
              role="img"
              aria-label={`Water on paint with ${c.name.toLowerCase()} after ${months} months: ${p > 0.6 ? "tight round beads" : p > 0.25 ? "loose, flattening beads" : "flat puddles"}`}
            >
              <defs>
                <linearGradient id="paint" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#1c2a4a" />
                  <stop offset="0.45" stopColor="#0d1424" />
                  <stop offset="1" stopColor="#05070d" />
                </linearGradient>
                <linearGradient id="sky" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.08 + p * 0.14} />
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="bead" cx="0.35" cy="0.3" r="0.8">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="0.25" stopColor="#c9e9ff" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#7fb2d9" stopOpacity="0.18" />
                </radialGradient>
              </defs>
              <rect width="400" height="240" fill="url(#paint)" />
              <rect
                x="-60"
                y="40"
                width="300"
                height="34"
                fill="url(#sky)"
                transform="rotate(-12 200 120)"
              />
              {DROPS.map((d, i) => {
                const rx = d.r * (1 + (1 - p) * 1.4);
                const ry = d.r * (0.25 + p * 0.75);
                return (
                  <motion.g
                    key={i}
                    initial={false}
                    animate={{ y: rolling ? 300 + d.y : 0, opacity: rolling ? 0 : 1 }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : rolling
                          ? {
                              duration: 0.7 + (i % 5) * 0.12,
                              ease: [0.55, 0, 0.9, 0.5],
                              delay: (i % 7) * 0.04,
                            }
                          : { duration: 0.01 }
                    }
                  >
                    <motion.ellipse
                      cx={d.x}
                      cy={d.y}
                      initial={false}
                      animate={{ rx, ry }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      fill="url(#bead)"
                    />
                    <motion.ellipse
                      cx={d.x - rx * 0.3}
                      cy={d.y - ry * 0.35}
                      initial={false}
                      animate={{ rx: rx * 0.22, ry: ry * 0.22, opacity: 0.35 + p * 0.6 }}
                      transition={{ duration: 0.6 }}
                      fill="#fff"
                    />
                  </motion.g>
                );
              })}
            </svg>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ivory/10 px-5 py-4 text-ivory">
              <p className="text-[14px]">
                Contact angle <span className="font-display text-[15px] text-pearl">{angle}°</span>
                <span className="ml-3 text-mist">
                  {p > 0.6 ? "beading hard" : p > 0.25 ? "flattening" : "sheeting"}
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setRinse((r) => r + 1);
                  window.setTimeout(() => setRinse(0), 1700);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ivory/30 px-4 text-[13px] font-medium hover:bg-ivory hover:text-noir"
              >
                <Droplets size={16} /> Rinse the panel
              </button>
            </div>
          </Reveal>

          <Reveal delay={0.08} className="space-y-7">
            <fieldset className="min-w-0">
              <legend className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em]">
                Protection
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {COATINGS.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={coat === x.id}
                    onClick={() => setCoat(x.id)}
                    className={`min-h-[52px] rounded-[12px] border-2 px-3 text-[14px] font-semibold transition-colors ${coat === x.id ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-card hover:border-ink/50"}`}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
              <p className="mt-3 min-h-[44px] text-[14.5px] leading-relaxed text-ash">{c.note}</p>
            </fieldset>
            <label className="block">
              <span className="mb-2 flex items-baseline justify-between text-[12px] font-semibold uppercase tracking-[0.2em]">
                Months since it went on{" "}
                <span className="font-display text-[16px] normal-case tracking-normal text-rose">
                  {months}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={36}
                step={1}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="h-11 w-full cursor-pointer accent-[#4f3fd6]"
              />
              <span className="flex justify-between text-[12px] text-ash">
                <span>Today</span>
                <span>1 yr</span>
                <span>2 yrs</span>
                <span>3 yrs</span>
              </span>
            </label>
            <p className="rounded-[14px] bg-stone p-4 text-[14.5px] leading-relaxed text-ink">
              Try it: ceramic at 24 months still beads. Wax at 3 months has already given up. Then
              hit <span className="font-semibold">Rinse</span>.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
