import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { WORK } from "@/site.config";

/**
 * Chapter 04 — our work: two rows of finished bathrooms and kitchens that
 * drift in opposite directions as you scroll past, like the tide going
 * two ways.
 */
export function Work() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const a = useTransform(scrollYProgress, [0, 1], ["4%", "-30%"]);
  const b = useTransform(scrollYProgress, [0, 1], ["-30%", "4%"]);
  const half = Math.ceil(WORK.length / 2);

  return (
    <section
      id="work"
      ref={ref}
      className="sheet overflow-hidden bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="work-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="work" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="work-title"
            className="max-w-[14ch] text-[clamp(40px,8.4vw,104px)] leading-[0.96]"
          >
            <MaskLines lines={[<>Fixed, fitted,</>, <em className="text-rose">finished.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.75] text-ash md:text-[17px]">
              Renovations from rough-in to the last tap, and every job left cleaner than we found
              it.
            </p>
          </Reveal>
        </div>
      </div>
      <div className="mt-14 space-y-4 md:mt-20 md:space-y-6">
        <Row x={a} items={WORK.slice(0, half)} />
        <Row x={b} items={WORK.slice(half)} />
      </div>
    </section>
  );
}

function Row({ x, items }: { x: MotionValue<string>; items: readonly (typeof WORK)[number][] }) {
  return (
    <motion.ul
      data-qa="scroller"
      className="flex w-max gap-4 will-change-transform md:gap-6"
      style={{ x }}
    >
      {[...items, ...items].map((w, i) => (
        <li
          key={`${w.image}-${i}`}
          className="relative h-[min(46vw,300px)] w-[min(68vw,440px)] shrink-0 overflow-hidden rounded-[22px] bg-stone"
          aria-hidden={i >= items.length || undefined}
        >
          <Img
            name={w.image}
            widths={[800, 1200]}
            sizes="(min-width:768px) 440px, 68vw"
            alt={i >= items.length ? "" : w.alt}
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-semibold text-ink">
            {w.caption}
          </span>
        </li>
      ))}
    </motion.ul>
  );
}
