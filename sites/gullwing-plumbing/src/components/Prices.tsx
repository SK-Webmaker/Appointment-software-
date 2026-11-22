import { motion } from "framer-motion";
import { ArrowRight, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { FAQ, GAUGE, PROBLEMS, problemOf } from "@/site.config";
import { useBooking } from "@/context/booking";
import { estimate, isAfterHours } from "@/lib/slots";
import { useReducedMotionSafe } from "@/lib/motion";

const R = 118;
const CX = 150;
const CY = 160;
/** Square-root scale, so a $150 tap and a $2,600 hot water system both read on one dial. */
const angle = (v: number) => -120 + 240 * Math.sqrt(Math.min(v, GAUGE.max) / GAUGE.max);
const polar = (a: number, r = R) =>
  [CX + r * Math.sin((a * Math.PI) / 180), CY - r * Math.cos((a * Math.PI) / 180)] as const;
const arc = (a0: number, a1: number, r = R) => {
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};
const TICKS = [0, 100, 250, 500, 1000, 2000, 3000];

/**
 * Chapter 02 — fixed prices, on a pressure gauge. Pick the problem, how much
 * of it there is, and whether it's after hours: the needle swings to the
 * fixed-price range and the readout gives it in dollars. Book at that price.
 */
export function Prices() {
  const { problem, setProblem, openSheet } = useBooking();
  const reduce = useReducedMotionSafe();
  const [qty, setQty] = useState(0);
  const [late, setLate] = useState(false);
  useEffect(() => setLate(isAfterHours()), []);
  const id = problem || "drain";
  const p = problemOf(id)!;
  const est = estimate(id, qty, late)!;
  const mid = (est.from + est.to) / 2;

  return (
    <section
      id="prices"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36"
      aria-labelledby="prices-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-56 top-20 h-[760px] w-[760px] bg-[radial-gradient(closest-side,rgb(79_182_204/0.14),transparent)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(#8fdcec_1px,transparent_1px),linear-gradient(90deg,#8fdcec_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="prices" light />
        <h2
          id="prices-title"
          className="mt-8 max-w-[16ch] text-[clamp(40px,8.6vw,108px)] leading-[0.88]"
        >
          <MaskLines
            lines={[<>The price,</>, <em className="text-pearl">before the spanner.</em>]}
          />
        </h2>

        <div className="mt-14 grid items-center gap-10 md:mt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* the gauge */}
          <Reveal className="relative mx-auto w-full max-w-[640px]">
            <div className="relative aspect-[3/2]">
              <svg
                viewBox="0 0 300 200"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <circle
                  cx={CX}
                  cy={CY}
                  r={R + 22}
                  fill="#12213a"
                  stroke="#8d9aa6"
                  strokeOpacity="0.35"
                  strokeWidth="2"
                />
                <path
                  d={arc(-120, 120)}
                  fill="none"
                  stroke="#eef1ec"
                  strokeOpacity="0.12"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <motion.path
                  key={`${est.from}-${est.to}`}
                  d={arc(angle(est.from), Math.max(angle(est.to), angle(est.from) + 2))}
                  fill="none"
                  stroke="#ff6a2b"
                  strokeWidth="10"
                  strokeLinecap="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
                {TICKS.map((t) => {
                  const a = angle(t);
                  const [x0, y0] = polar(a, R - 16);
                  const [x1, y1] = polar(a, R - 8);
                  const [lx, ly] = polar(a, R - 30);
                  return (
                    <g key={t}>
                      <line
                        x1={x0}
                        y1={y0}
                        x2={x1}
                        y2={y1}
                        stroke="#eef1ec"
                        strokeOpacity="0.6"
                        strokeWidth="1.5"
                      />
                      <text
                        x={lx}
                        y={ly + 3}
                        textAnchor="middle"
                        fill="#8d9aa6"
                        style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8.5 }}
                      >
                        {t >= 1000 ? `${t / 1000}k` : t}
                      </text>
                    </g>
                  );
                })}
                <text
                  x={CX}
                  y={CY + 30}
                  textAnchor="middle"
                  fill="#8d9aa6"
                  style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 7, letterSpacing: 2 }}
                >
                  AUD · FIXED PRICE
                </text>
              </svg>
              {/* the needle */}
              <motion.div
                className="absolute left-[calc(50%-2px)] top-[27.5%] h-[52.5%] w-1 origin-bottom rounded-full bg-flare shadow-[0_0_0_1px_rgb(11_22_36/0.4)]"
                initial={false}
                animate={{ rotate: angle(mid) }}
                transition={
                  reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 9 }
                }
                aria-hidden="true"
              />
              <span
                className="absolute left-1/2 top-[80%] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-flare bg-noir"
                aria-hidden="true"
              />
            </div>
            <p
              className="-mt-2 text-center font-mono text-[clamp(30px,6vw,52px)] font-bold tabular-nums text-ivory"
              aria-live="polite"
            >
              ${est.from.toLocaleString("en-AU")}–${est.to.toLocaleString("en-AU")}
            </p>
            <p className="mt-1 text-center text-[14px] text-mist">
              {p.name} · {GAUGE.quantities[qty]?.toLowerCase()} ·{" "}
              {late ? "after hours" : "business hours"}
            </p>
          </Reveal>

          {/* the controls */}
          <Reveal delay={0.08} className="flex flex-col gap-7">
            <fieldset className="min-w-0">
              <legend className="mb-3 font-mono text-[12px] uppercase tracking-[0.16em] text-pearl">
                The problem
              </legend>
              <div className="flex flex-wrap gap-2">
                {PROBLEMS.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={id === x.id}
                    onClick={() => setProblem(x.id)}
                    className={`min-h-[44px] rounded-full border px-4 text-[14px] font-medium transition-colors duration-300 ${id === x.id ? "border-flare bg-flare text-noir" : "border-ivory/20 text-ivory hover:border-ivory/60"}`}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-3 font-mono text-[12px] uppercase tracking-[0.16em] text-pearl">
                How much of it
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {GAUGE.quantities.map((q, i) => (
                  <button
                    key={q}
                    type="button"
                    aria-pressed={qty === i}
                    onClick={() => setQty(i)}
                    className={`min-h-[48px] rounded-xl border px-2 text-[14px] font-medium transition-colors duration-300 ${qty === i ? "border-pearl bg-pearl text-noir" : "border-ivory/20 text-ivory hover:border-ivory/60"}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              role="switch"
              aria-checked={late}
              onClick={() => setLate((l) => !l)}
              className="flex min-h-[56px] items-center justify-between gap-4 rounded-xl border border-ivory/20 px-4 text-left hover:border-ivory/60"
            >
              <span className="flex items-center gap-3 text-[15px]">
                <Moon size={18} strokeWidth={1.8} className="text-pearl" /> After hours, Sundays &
                holidays
              </span>
              <span
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${late ? "bg-flare" : "bg-ivory/20"}`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-ivory transition-transform duration-300 ${late ? "translate-x-6" : "translate-x-1"}`}
                />
              </span>
            </button>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openSheet({ problem: id })}
                className="btn-honey sheen flex-1"
              >
                Book at this price <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
            <p className="text-[13.5px] leading-relaxed text-mist">
              A guide from the jobs we do most. Your exact fixed price is confirmed on site, before
              any work starts — and that's the price you pay.
            </p>
          </Reveal>
        </div>

        <div className="mt-20 grid gap-x-12 border-t border-ivory/10 pt-12 md:mt-28 lg:grid-cols-[0.8fr_1.2fr]">
          <h3 className="text-[clamp(32px,4.4vw,52px)] leading-[0.92]">Straight answers</h3>
          <div className="mt-6 lg:mt-0">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-ivory/10 py-4">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
                  {f.q}
                  <span
                    className="text-[22px] text-flare transition-transform group-open:rotate-45"
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
