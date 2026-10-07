import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { OCCASIONS, SITE } from "@/site.config";

const TONES = [
  { card: "bg-ivory text-ink", accent: "text-ink", script: "text-rose", meta: "text-ash", body: "text-ash" },
  { card: "bg-noir text-ivory", accent: "text-ivory", script: "text-silk", meta: "text-ivory/70", body: "text-ivory/80" },
  { card: "bg-mint text-ink", accent: "text-ink", script: "text-rose", meta: "text-ash", body: "text-ash" },
];

/** Chapter III — for any occasion: three of their posts as cards that stack as you scroll. */
export function Occasions() {
  const stack = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stack, offset: ["start start", "end end"] });

  return (
    <section id="occasions" className="sheet bg-candy pb-24 pt-24 text-ink md:pb-32 md:pt-36" aria-labelledby="occasions-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="occasions" />
        <h2 id="occasions-title" className="mt-8 max-w-[16ch] text-[clamp(38px,8.4vw,96px)] leading-[1]">
          <MaskLines lines={[<>Dessert cups</>, <em className="text-plum">for any occasion.</em>]} />
        </h2>
        <Reveal>
          <p className="mt-8 max-w-[46ch] text-[16.5px] leading-[1.8] md:text-[17.5px]">
            Birthdays, baby showers, gender reveals and more — with free customisations, for pickup or delivery.
          </p>
        </Reveal>

        <div ref={stack} className="relative mt-16 md:mt-24" data-qa="layered">
          {OCCASIONS.map((o, i) => (
            <Card key={o.title} i={i} total={OCCASIONS.length} progress={scrollYProgress} {...o} />
          ))}
        </div>

        <Reveal className="mt-16 text-center">
          <p className="mx-auto max-w-[24ch] font-display text-[clamp(30px,4.6vw,48px)] leading-[1.15]">
            Made with <em className="text-plum">insane love.</em>
          </p>
          <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.24em] text-onyx">— {SITE.name}</p>
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
  return (
    <div className="sticky mb-[16svh] last:mb-0 md:mb-[18vh]" style={{ top: `calc(var(--nav-h) + 16px + ${i * 14}px)` }}>
      <motion.article
        style={{ scale: reduce ? 1 : scale, transformOrigin: "50% 0%" }}
        className={`relative grid overflow-hidden rounded-[32px] will-change-transform shadow-[0_-24px_60px_-30px_rgba(58,34,24,0.45)] md:min-h-[62vh] md:grid-cols-[0.85fr_1.15fr] ${tone.card}`}
      >
        <div className="relative h-[30svh] min-h-[180px] overflow-hidden md:h-auto">
          <Img name={image} widths={[...widths]} sizes="(min-width:768px) 600px, 100vw" alt={alt} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-7 md:gap-5 md:p-14">
          <p className={`text-[11.5px] font-medium uppercase tracking-label ${tone.meta}`}>
            {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
          <h3 className={`font-script text-[clamp(38px,10vw,50px)] leading-[1.1] tracking-normal md:text-[clamp(50px,4.6vw,70px)] ${tone.script}`}>{title}</h3>
          <p className={`max-w-[50ch] text-[15px] leading-[1.75] md:text-[17px] ${tone.body}`}>{text}</p>
        </div>
      </motion.article>
    </div>
  );
}
