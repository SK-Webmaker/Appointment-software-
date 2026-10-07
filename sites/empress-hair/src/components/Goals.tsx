import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { GOALS, SITE } from "@/site.config";

const TONES = [
  { card: "bg-coal text-ivory", accent: "text-pearl", meta: "text-ivory/70", body: "text-ivory/80" },
  { card: "bg-ivory text-ink", accent: "text-onyx", meta: "text-ash", body: "text-ash" },
  { card: "bg-stone text-ink", accent: "text-onyx", meta: "text-ash", body: "text-ash" },
  { card: "bg-onyx text-ivory", accent: "text-pearl", meta: "text-ivory/70", body: "text-ivory/80" },
];

/** Chapter I — "My goals as your stylist", their four goals stacking as you scroll. */
export function Goals() {
  const stack = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stack, offset: ["start start", "end end"] });

  return (
    <section id="goals" className="relative bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36" aria-labelledby="goals-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="goals" light />
        <h2 id="goals-title" className="mt-8 max-w-[16ch] text-[clamp(42px,9vw,104px)] font-light leading-[0.98]">
          <MaskLines lines={[<>My goals</>, <em className="text-pearl">as your stylist.</em>]} />
        </h2>
        <Reveal>
          <p className="mt-8 max-w-[44ch] text-[16.5px] leading-[1.8] text-ivory/80 md:text-[17.5px]">
            Protective styling should protect — your scalp, your length and how you feel when you leave the chair. Four promises, in their own words.
          </p>
        </Reveal>

        <div ref={stack} className="relative mt-16 md:mt-24" data-qa="layered">
          {GOALS.map((g, i) => (
            <Card key={g.title} i={i} total={GOALS.length} progress={scrollYProgress} {...g} />
          ))}
        </div>

        <Reveal className="mt-16 text-center">
          <p className="mx-auto max-w-[24ch] font-display text-[clamp(30px,4.6vw,48px)] font-light leading-[1.15]">
            Quality <em className="text-pearl">&gt;</em> Quantity.
          </p>
          <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.24em] text-silk">— {SITE.name}</p>
        </Reveal>
      </div>
    </section>
  );
}

function Card({
  i,
  total,
  progress,
  title,
  text,
  image,
  widths,
  alt,
  position = "50% 40%",
}: {
  i: number;
  total: number;
  progress: MotionValue<number>;
  title: string;
  text: string;
  image: string;
  widths: readonly number[];
  alt: string;
  position?: string;
}) {
  const reduce = useReducedMotionSafe();
  const tone = TONES[i % TONES.length] ?? TONES[0]!;
  // Each card settles back a touch once the next one starts to cover it.
  const start = i / total;
  const scale = useTransform(progress, [start, 1], [1, 1 - (total - 1 - i) * 0.035]);
  const imgY = useTransform(progress, [start, Math.min(1, start + 1 / total)], ["-6%", "0%"]);
  return (
    <div className="sticky mb-[16svh] last:mb-0 md:mb-[18vh]" style={{ top: `calc(var(--nav-h) + 16px + ${i * 14}px)` }}>
      <motion.article
        style={{ scale: reduce ? 1 : scale, transformOrigin: "50% 0%" }}
        className={`relative grid overflow-hidden rounded-[32px] will-change-transform shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.6)] md:min-h-[62vh] md:grid-cols-[0.85fr_1.15fr] ${tone.card}`}
      >
        <div className="relative h-[24svh] min-h-[150px] overflow-hidden md:h-auto">
          <motion.div className="absolute inset-0 h-[112%] will-change-transform" style={{ y: reduce ? "0%" : imgY }}>
            <Img name={image} widths={[...widths]} sizes="(min-width:768px) 600px, 100vw" alt={alt} className="h-full w-full object-cover" style={{ objectPosition: position }} />
          </motion.div>
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-7 md:gap-6 md:p-14">
          <p className={`text-[11.5px] font-medium uppercase tracking-label ${tone.meta}`}>
            Goal · {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
          <h3 className={`font-script text-[clamp(40px,10vw,52px)] font-normal leading-[1.05] tracking-normal md:text-[clamp(52px,5vw,76px)] ${tone.accent}`}>{title}</h3>
          <p className={`max-w-[54ch] text-[15px] leading-[1.75] md:text-[17px] ${tone.body}`}>{text}</p>
        </div>
      </motion.article>
    </div>
  );
}
