import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { STEPS } from "@/site.config";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines } from "./Reveal";

// One line drawing per step, drawn by the scroll.
const ART: { d: string; glow?: boolean }[][] = [
  // sketch: a word written in one stroke, and the pencil
  [
    { d: "M20 120 C 40 60, 70 60, 70 110 S 100 160, 120 100 S 150 50, 170 110 S 210 150, 230 90 S 260 60, 280 110" },
    { d: "M250 40 L290 20 L300 30 L262 52 Z" },
  ],
  // bend: a tube curving over the flame
  [
    { d: "M20 70 L120 70 C 160 70, 170 110, 170 140 C 170 170, 190 180, 280 180" },
    { d: "M150 205 C 140 185, 160 175, 155 160 C 170 172, 175 190, 165 205 Z" },
    { d: "M178 205 C 170 190, 186 182, 182 170 C 194 180, 196 194, 190 205 Z" },
  ],
  // fill: the tube and the gas arriving
  [
    { d: "M30 110 C 30 70, 90 70, 110 110 S 190 150, 210 110 S 270 70, 280 110" },
    { d: "M60 150 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 M120 160 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 M180 150 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0 M240 165 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0" },
  ],
  // ignite: the same tube, lit
  [{ d: "M30 110 C 30 70, 90 70, 110 110 S 190 150, 210 110 S 270 70, 280 110", glow: true }],
];

/**
 * How light is made: four cards that stick and stack as you scroll, each
 * drawing its own line art. The last one is lit.
 */
export function Process() {
  return (
    <section id="made" className="sheet bg-bone pb-28 pt-24 text-void md:pb-40 md:pt-32">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-5 md:px-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:px-16">
        <div className="lg:sticky lg:top-[calc(var(--nav-h)+40px)] lg:self-start">
          <ChapterLabel id="made" dark />
          <h2 className="mt-8 text-[clamp(48px,7.4vw,120px)] font-extrabold uppercase">
            <MaskLines
              lines={[
                "How it's",
                <>
                  <span className="font-serif font-normal normal-case italic text-ember">made.</span>
                </>,
              ]}
            />
          </h2>
          <p className="mt-8 max-w-[38ch] text-[14px] leading-relaxed text-smoke">
            Every LUMBEND One is made the way neon signs have always been made — four steps that haven't changed much in a hundred years.
          </p>
        </div>

        <ol className="relative">
          {STEPS.map((s, i) => (
            <Card key={s.title} i={i} title={s.title} text={s.text} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function Card({ i, title, text }: { i: number; title: string; text: string }) {
  const ref = useRef<HTMLLIElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "start 0.25"] });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const last = i === STEPS.length - 1;
  return (
    <li
      ref={ref}
      className="sticky mb-[18vh] last:mb-0"
      style={{ top: `calc(var(--nav-h) + 28px + ${i * 18}px)` }}
    >
      <article
        className={`relative overflow-hidden rounded-[28px] border p-7 shadow-[0_30px_60px_-30px_rgba(40,20,80,0.45)] md:p-10 ${
          last ? "border-void bg-void text-bone" : "border-void/10 bg-paper"
        }`}
      >
        <div className="flex items-start justify-between gap-6">
          <span
            aria-hidden="true"
            data-n={String(i + 1).padStart(2, "0")}
            className={`font-display text-[clamp(64px,8vw,112px)] font-extrabold leading-none before:content-[attr(data-n)] ${last ? "neon [--tube:#ffb547]" : "text-void/15"}`}
          />
          <span className={`stamp mt-3 ${last ? "text-amber" : "text-ember"}`}>Step {i + 1} of {STEPS.length}</span>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_minmax(0,300px)] md:items-end">
          <div>
            <h3 className="text-[clamp(34px,4vw,56px)] font-extrabold uppercase">{title}</h3>
            <p className={`mt-4 max-w-[40ch] text-[14px] leading-relaxed ${last ? "text-haze" : "text-smoke"}`}>{text}</p>
          </div>
          <svg viewBox="0 0 310 220" className="h-auto w-full" fill="none" aria-hidden="true">
            {(ART[i] ?? []).map((a, k) => (
              <g key={k}>
                {a.glow && <motion.path d={a.d} stroke="#ffb547" strokeOpacity={0.35} strokeWidth={16} strokeLinecap="round" style={{ pathLength: draw }} />}
                <motion.path
                  d={a.d}
                  stroke={a.glow ? "#fff3dc" : "currentColor"}
                  strokeWidth={a.glow ? 4 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pathLength: draw }}
                />
              </g>
            ))}
          </svg>
        </div>
      </article>
    </li>
  );
}
