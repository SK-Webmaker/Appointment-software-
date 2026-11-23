import { motion } from "framer-motion";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { STAGES } from "@/site.config";
import { useReducedMotionSafe } from "@/lib/motion";

// Bento: which tiles span two columns / rows on wide screens.
const LAYOUT = ["lg:col-span-2 lg:row-span-2", "", "", "lg:row-span-2", "", "lg:col-span-2"];
const TALL = [true, false, false, true, false, false];

/**
 * Chapter 02 — the stages: six steps of a correction on a dark wall, each
 * tile's edge drawn in the ceramic shimmer as it arrives.
 */
export function Stages() {
  const reduce = useReducedMotionSafe();
  return (
    <section
      id="stages"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36"
      aria-labelledby="stages-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -left-40 top-40 h-[700px] w-[700px] bg-[radial-gradient(closest-side,rgb(179_168_255/0.14),transparent)]" />
        <div className="absolute -right-40 bottom-0 h-[600px] w-[600px] bg-[radial-gradient(closest-side,rgb(155_230_255/0.1),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="stages" light />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="stages-title"
            className="max-w-[16ch] text-[clamp(30px,6.4vw,76px)] leading-[1.08]"
          >
            <MaskLines lines={[<>Six stages.</>, <em>No shortcuts.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.75] text-ivory/80">
              The studio is dark on purpose: under our lights every swirl shows, so every swirl
              goes.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid auto-rows-[minmax(220px,auto)] gap-4 sm:grid-cols-2 md:mt-20 lg:grid-cols-4 lg:auto-rows-[260px]">
          {STAGES.map((s, i) => (
            <Reveal
              as="li"
              key={s.n}
              delay={(i % 3) * 0.06}
              className={`group relative overflow-hidden rounded-[16px] bg-coal ${LAYOUT[i]} ${TALL[i] ? "min-h-[440px] lg:min-h-0" : "min-h-[260px]"}`}
            >
              <div data-qa="layered" className="absolute inset-0">
                <Img
                  name={s.image}
                  widths={[800, 1200, 1600]}
                  sizes={
                    i === 0 || i === 5
                      ? "(min-width:1024px) 50vw, (min-width:640px) 50vw, 100vw"
                      : "(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                  }
                  alt={s.alt}
                  className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                  style={{ objectPosition: s.position }}
                />
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(to_top,#08090c_8%,rgb(8_9_12/0.25)_60%,transparent)]" />
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={`edge-${s.n}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#9be6ff" />
                    <stop offset="0.4" stopColor="#b3a8ff" />
                    <stop offset="0.7" stopColor="#ff9ad5" />
                    <stop offset="1" stopColor="#ffe29f" />
                  </linearGradient>
                </defs>
                <motion.rect
                  x="1.5"
                  y="1.5"
                  rx="15"
                  style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)" }}
                  fill="none"
                  stroke={`url(#edge-${s.n})`}
                  strokeWidth="1.5"
                  initial={reduce ? false : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, margin: "0px 0px -15% 0px" }}
                  transition={{
                    duration: 1.6,
                    delay: 0.2 + (i % 3) * 0.1,
                    ease: [0.65, 0, 0.35, 1],
                  }}
                />
              </svg>
              <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                <p className="font-display text-[12px] tracking-[0.2em] text-silk">{s.n}</p>
                <h3 className="mt-2 break-words text-[clamp(15px,1.6vw,20px)] leading-tight">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[40ch] text-[14px] leading-relaxed text-ivory/80">
                  {s.text}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
