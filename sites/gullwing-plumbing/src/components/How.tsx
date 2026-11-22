import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { HOW } from "@/site.config";

const PHOTOS = [
  {
    name: "torch",
    alt: "A plumber at work with a blowtorch on a copper fitting",
    position: "50% 40%",
  },
  { name: "sink", alt: "A plumber reaching up under a blue-lit sink", position: "50% 40%" },
  {
    name: "bath",
    alt: "A plumber arriving with a toolbox in a clean bathroom",
    position: "50% 50%",
  },
  { name: "tools", alt: "A rack of pipe wrenches and pliers in a van", position: "50% 50%" },
];

/**
 * Chapter 04 — how it works: a pipe runs down the page beside the four
 * steps and fills with water as you read, valve by valve.
 */
export function How() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.6", "end 0.6"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  const scaleY = useTransform(fill, [0, 1], [0, 1]);

  return (
    <section
      id="how"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36"
      aria-labelledby="how-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="how" light />
        <h2
          id="how-title"
          className="mt-8 max-w-[15ch] text-[clamp(40px,8.6vw,108px)] leading-[0.88]"
        >
          <MaskLines lines={[<>Call to</>, <em className="text-pearl">all fixed.</em>]} />
        </h2>

        <div
          ref={ref}
          className="relative mt-14 grid grid-cols-[44px_1fr] gap-5 md:mt-20 md:grid-cols-[90px_1fr] md:gap-12"
        >
          {/* the pipe */}
          <div className="relative">
            <div
              className="sticky top-[calc(var(--nav-h)+24px)] h-[calc(100svh-var(--nav-h)-48px)]"
              aria-hidden="true"
            >
              <div className="absolute inset-y-0 left-1/2 w-5 -translate-x-1/2 overflow-hidden rounded-full border-2 border-ivory/25 bg-coal md:w-8">
                <motion.div
                  className="absolute inset-0 origin-top bg-[linear-gradient(to_bottom,#8fdcec,#2f8fae_60%,#0f4c6b)] will-change-transform"
                  style={{ scaleY }}
                />
              </div>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="absolute left-1/2 h-4 w-9 -translate-x-1/2 rounded-[4px] border-2 border-ivory/30 bg-onyx md:h-5 md:w-14"
                  style={{ top: `${8 + i * 28}%` }}
                />
              ))}
            </div>
          </div>

          <ol className="space-y-[18vh] pb-[10vh]">
            {HOW.map((h, i) => {
              const ph = PHOTOS[i]!;
              return (
                <li
                  key={h.title}
                  className="grid items-center gap-6 md:grid-cols-[1fr_0.8fr] md:gap-12"
                >
                  <Reveal>
                    <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-flare">
                      Step {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-3 text-[clamp(32px,6vw,72px)] leading-[0.9]">{h.title}</h3>
                    <p className="mt-4 max-w-[40ch] text-[16px] leading-[1.75] text-ivory/80 md:text-[17px]">
                      {h.text}
                    </p>
                  </Reveal>
                  <Reveal
                    delay={0.08}
                    className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-coal"
                  >
                    <Img
                      name={ph.name}
                      widths={[480, 800, 1200, 1600]}
                      sizes="(min-width:1440px) 520px, (min-width:768px) 36vw, 82vw"
                      alt={ph.alt}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: ph.position }}
                    />
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
