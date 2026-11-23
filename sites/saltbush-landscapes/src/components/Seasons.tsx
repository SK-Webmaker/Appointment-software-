import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { MONTHS, PLANTS, seasonOf } from "@/site.config";

const EASE = [0.22, 1, 0.36, 1] as const;
const RINGED = PLANTS.filter((p) => p.flowers.length > 0);
const R0 = 64;
const STEP = 10.5;
const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) =>
  `${(r * Math.cos(rad(deg))).toFixed(2)} ${(r * Math.sin(rad(deg))).toFixed(2)}`;
/** an arc on ring r through month m (1–12), January at the top */
const arc = (r: number, m: number, gap = 2.2) => {
  const a1 = (m - 1) * 30 - 90 + gap;
  const a2 = m * 30 - 90 - gap;
  return `M${pt(r, a1)} A${r} ${r} 0 0 1 ${pt(r, a2)}`;
};

/**
 * Chapter 02 — the year in flower: every plant from the finder is a ring,
 * every month it flowers is an arc in its colour. Turn the dial (or tap a
 * month) and the garden for that month lights up — with something in flower
 * all twelve.
 */
export function Seasons() {
  const [month, setMonth] = useState(9);
  useEffect(() => setMonth(new Date().getMonth() + 1), []);
  const inFlower = RINGED.filter((p) => p.flowers.includes(month));
  const go = (d: number) => setMonth((m) => ((m - 1 + d + 12) % 12) + 1);
  const name = MONTHS[month - 1]!;

  return (
    <section
      id="seasons"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36"
      aria-labelledby="seasons-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-40 top-10 h-[760px] w-[760px] bg-[radial-gradient(closest-side,rgb(233_180_90/0.13),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="seasons" light />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="seasons-title"
            className="max-w-[13ch] text-[clamp(40px,8.4vw,104px)] leading-[0.96]"
          >
            <MaskLines
              lines={[<>Something in flower,</>, <em className="text-silk">every month.</em>]}
            />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.75] text-ivory/80 md:text-[17px]">
              Each ring is a plant from the finder; each arc, a month it flowers. Plant a mix and
              the garden never goes quiet.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <Reveal className="relative mx-auto w-full max-w-[560px] will-change-transform">
            <svg viewBox="-215 -215 430 430" className="block w-full" aria-hidden="true">
              {/* the chosen month */}
              <path
                d={`M${pt(R0 - 12, -90)} L${pt(206, -90)} A206 206 0 0 1 ${pt(206, -60)} L${pt(R0 - 12, -60)} A${R0 - 12} ${R0 - 12} 0 0 0 ${pt(R0 - 12, -90)} Z`}
                fill="rgb(233 180 90 / 0.14)"
                style={{
                  transform: `rotate(${(month - 1) * 30}deg)`,
                  transformOrigin: "0px 0px",
                  transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
                }}
              />
              {/* one path per plant for its whole year, one for the chosen month */}
              {RINGED.map((p, i) => {
                const r = R0 + i * STEP;
                const lit = p.flowers.includes(month);
                return (
                  <g key={p.id}>
                    <circle r={r} fill="none" stroke="rgb(244 241 234 / 0.07)" strokeWidth="1" />
                    <path
                      d={p.flowers.map((m) => arc(r, m)).join(" ")}
                      fill="none"
                      stroke={p.colour}
                      strokeWidth="6.5"
                      strokeLinecap="round"
                      opacity={0.4}
                    />
                    {lit && (
                      <path
                        d={arc(r, month)}
                        fill="none"
                        stroke={p.colour}
                        strokeWidth="6.5"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                );
              })}
              {MONTHS.map((m, i) => (
                <text
                  key={m}
                  x={Math.cos(rad(i * 30 - 75)) * 200}
                  y={Math.sin(rad(i * 30 - 75)) * 200 + 4.5}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight={i + 1 === month ? 700 : 500}
                  fill={i + 1 === month ? "#e9b45a" : "rgb(244 241 234 / 0.6)"}
                  fontFamily="Karla, sans-serif"
                >
                  {m[0]}
                </text>
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div aria-live="polite">
                <p className="font-display text-[clamp(18px,4.6vw,30px)] leading-none">{name}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-silk">
                  {seasonOf(month)}
                </p>
              </div>
            </div>
          </Reveal>

          <div>
            <Reveal className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous month"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ivory/25 hover:bg-ivory hover:text-noir"
              >
                <ChevronLeft size={20} />
              </button>
              <label className="flex-1">
                <span className="sr-only">Month</span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  aria-valuetext={name}
                  className="h-11 w-full cursor-pointer accent-[#e9b45a]"
                />
              </label>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next month"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ivory/25 hover:bg-ivory hover:text-noir"
              >
                <ChevronRight size={20} />
              </button>
            </Reveal>
            <div className="mt-4 grid grid-cols-6 gap-1.5" role="group" aria-label="Choose a month">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={i + 1 === month}
                  aria-label={m}
                  onClick={() => setMonth(i + 1)}
                  className={`min-h-[44px] rounded-xl text-[13.5px] font-semibold transition-colors duration-300 ${i + 1 === month ? "bg-silk text-noir" : "bg-coal text-ivory/85 hover:bg-ivory/15"}`}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>

            <div className="mt-8 min-h-[300px] rounded-[24px] bg-coal p-6 md:p-7">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-pearl">
                In flower in {name} · {inFlower.length}
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.ul
                  key={month}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2"
                >
                  {inFlower.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full"
                        style={{ backgroundColor: p.colour }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-[15.5px] font-semibold leading-tight">
                          {p.name}
                        </span>
                        <span className="block text-[13px] italic text-mist">{p.latin}</span>
                      </span>
                    </li>
                  ))}
                </motion.ul>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
