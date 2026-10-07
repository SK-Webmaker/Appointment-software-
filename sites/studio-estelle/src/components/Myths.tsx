import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { MYTHS, SITE } from "@/site.config";

const TONES = [
  { card: "bg-ivory text-ink", accent: "text-ink", script: "text-rose", meta: "text-ash", body: "text-ash" },
  { card: "bg-noir text-ivory", accent: "text-ivory", script: "text-silk", meta: "text-ivory/70", body: "text-ivory/80" },
  { card: "bg-mint text-ink", accent: "text-ink", script: "text-rose", meta: "text-ash", body: "text-ash" },
  { card: "bg-stone text-ink", accent: "text-ink", script: "text-rose", meta: "text-ash", body: "text-ash" },
];

/** Chapter III — her "garment hire myths" carousel: four cards that stack as you scroll. */
export function Myths() {
  const stack = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stack, offset: ["start start", "end end"] });

  return (
    <section id="myths" className="sheet bg-candy pb-24 pt-24 text-ink md:pb-32 md:pt-36" aria-labelledby="myths-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="myths" />
        <h2 id="myths-title" className="mt-8 max-w-[16ch] text-[clamp(38px,8.4vw,96px)] leading-[1]">
          <MaskLines lines={[<>Still believe these</>, <em className="text-plum">garment hire myths?</em>]} />
        </h2>
        <Reveal>
          <p className="mt-8 max-w-[46ch] text-[16.5px] leading-[1.8] md:text-[17.5px]">
            It’s time to clear them up. There’s still a lot of outdated thinking floating around about dress hire — so here are four of the most common myths I hear, and the actual reality behind each one.
          </p>
        </Reveal>

        <div ref={stack} className="relative mt-16 md:mt-24" data-qa="layered">
          {MYTHS.map((m, i) => (
            <Card key={m.myth} i={i} total={MYTHS.length} progress={scrollYProgress} {...m} />
          ))}
        </div>

        <Reveal className="mt-16 text-center">
          <p className="mx-auto max-w-[24ch] font-display text-[clamp(30px,4.6vw,48px)] leading-[1.15]">
            None of these <em className="text-plum">hold up anymore.</em>
          </p>
          <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.24em] text-onyx">— {SITE.founder}</p>
        </Reveal>
      </div>
    </section>
  );
}

function Card({
  i,
  total,
  progress,
  myth,
  reality,
  image,
  widths,
  alt,
  position = "50% 40%",
}: {
  i: number;
  total: number;
  progress: MotionValue<number>;
  myth: string;
  reality: string;
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
        className={`relative grid overflow-hidden rounded-[32px] will-change-transform shadow-[0_-24px_60px_-30px_rgba(46,29,20,0.45)] md:min-h-[62vh] md:grid-cols-[0.85fr_1.15fr] ${tone.card}`}
      >
        <div className="relative h-[24svh] min-h-[150px] overflow-hidden md:h-auto">
          <Img name={image} widths={[...widths]} sizes="(min-width:768px) 600px, 100vw" alt={alt} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-7 md:gap-5 md:p-14">
          <p className={`text-[11.5px] font-medium uppercase tracking-label ${tone.meta}`}>
            Myth · {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
          <h3 className={`font-display text-[clamp(24px,6.4vw,32px)] italic leading-[1.18] md:text-[clamp(30px,2.9vw,44px)] ${tone.accent}`}>{myth}</h3>
          <p className={`font-script text-[34px] leading-none md:text-[42px] ${tone.script}`}>The reality</p>
          <p className={`max-w-[54ch] text-[15px] leading-[1.75] md:text-[17px] ${tone.body}`}>{reality}</p>
        </div>
      </motion.article>
    </div>
  );
}
