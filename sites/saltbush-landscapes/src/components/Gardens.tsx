import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { GARDENS } from "@/site.config";

/**
 * Chapter 04 — our gardens, as a pinboard of prints: each one comes in
 * crooked and straightens itself as it reaches the middle of the screen,
 * with what we planted written underneath.
 */
export function Gardens() {
  return (
    <section
      id="gardens"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="gardens-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="gardens" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="gardens-title"
            className="max-w-[12ch] text-[clamp(40px,8.4vw,104px)] leading-[0.96]"
          >
            <MaskLines lines={[<>Gardens</>, <em className="text-rose">we've grown.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.75] text-ash md:text-[17px]">
              Front yards, courtyards and the awkward strip down the side. Every one planted for its
              own soil and sun.
            </p>
          </Reveal>
        </div>
        <ul className="mt-14 grid grid-cols-2 gap-x-3 gap-y-6 md:mt-20 md:grid-cols-3 md:gap-x-8 md:gap-y-12">
          {GARDENS.map((g, i) => (
            <Print key={g.image} g={g} i={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Print({ g, i }: { g: (typeof GARDENS)[number]; i: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [g.tilt * 2.2, g.tilt * 0.35]);
  const y = useTransform(scrollYProgress, [0, 1], [60, 0]);
  return (
    <li ref={ref} data-qa="layered" className={i % 3 === 1 ? "md:mt-16" : i % 3 === 2 ? "md:mt-6" : ""}>
      <motion.figure
        className="rounded-[6px] bg-card p-2 pb-3 shadow-[0_24px_40px_-28px_rgba(35,40,31,0.55)] will-change-transform md:p-3 md:pb-5"
        style={{ rotate, y }}
      >
        <div className="aspect-[4/5] overflow-hidden rounded-[3px] bg-stone">
          <Img
            name={g.image}
            widths={[800, 1200]}
            sizes="(min-width:768px) 30vw, 46vw"
            alt={g.alt}
            className="h-full w-full object-cover"
          />
        </div>
        <figcaption className="px-1 pt-3 md:px-2">
          <span className="block font-display text-[15px] leading-tight md:text-[20px]">
            {g.caption}
          </span>
          <span className="mt-1 block text-[12.5px] italic leading-snug text-ash md:text-[14.5px]">
            {g.plants}
          </span>
        </figcaption>
      </motion.figure>
    </li>
  );
}
