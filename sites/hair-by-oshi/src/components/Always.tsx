import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { ALWAYS, SITE } from "@/site.config";

const TONES = [
  { card: "bg-plum text-cream", accent: "text-lavender", meta: "text-cream/75" },
  { card: "bg-cream text-ink", accent: "text-plum", meta: "text-mocha" },
  { card: "bg-mist text-ink", accent: "text-violet", meta: "text-mocha" },
  { card: "bg-[#2B1A30] text-cream", accent: "text-honey", meta: "text-cream/75" },
];

/** Chapter IV — "Things I'll ALWAYS do as your hairdresser", stacking as you scroll. */
export function Always() {
  const stack = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stack, offset: ["start start", "end end"] });

  return (
    <section id="always" className="grain relative bg-night pb-24 pt-24 text-cream md:pb-32 md:pt-36" aria-labelledby="always-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="always" light />
        <h2 id="always-title" className="mt-8 max-w-[18ch] text-[clamp(38px,8vw,92px)] font-light leading-[0.98]">
          <MaskLines lines={[<>Things I'll always do</>, <em className="text-lavender">as your hairdresser…</em>]} />
        </h2>
        <Reveal>
          <p className="mt-8 max-w-[46ch] text-[16.5px] leading-[1.8] text-cream/80 md:text-[17.5px]">
            …even if you don't want to hear them. “My goal is never to simply give you what you ask for without considering your hair history, condition and what is realistically achievable.”
          </p>
        </Reveal>

        <div ref={stack} className="relative mt-16 md:mt-24" data-qa="layered">
          {ALWAYS.map((a, i) => (
            <Card key={a.lead} i={i} total={ALWAYS.length} progress={scrollYProgress} {...a} />
          ))}
        </div>

        <Reveal className="mt-16 text-center">
          <p className="mx-auto max-w-[30ch] font-display text-[clamp(26px,4vw,40px)] font-light leading-[1.2]">
            If you value honesty, education and a stylist who genuinely wants the best for your hair, <em className="text-lavender">you're in the right chair ✨</em>
          </p>
          <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.24em] text-honey">— {SITE.founder}</p>
        </Reveal>
      </div>
    </section>
  );
}

function Card({
  i,
  total,
  progress,
  lead,
  rest,
  image,
  widths,
  alt,
}: {
  i: number;
  total: number;
  progress: MotionValue<number>;
  lead: string;
  rest: string;
  image: string;
  widths: readonly number[];
  alt: string;
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
        className={`relative grid overflow-hidden rounded-[32px] shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.6)] md:min-h-[64vh] md:grid-cols-[0.8fr_1.2fr] ${tone.card}`}
      >
        <div className="relative h-[26svh] min-h-[150px] overflow-hidden md:h-auto">
          <motion.div className="absolute inset-0 h-[112%]" style={{ y: reduce ? "0%" : imgY }}>
            <Img name={image} widths={[...widths]} sizes="(min-width:768px) 40vw, 100vw" alt={alt} className="h-full w-full object-cover" style={{ objectPosition: "50% 30%" }} />
          </motion.div>
        </div>
        <div className="flex flex-col justify-between gap-6 p-6 sm:p-7 md:gap-8 md:p-14">
          <p className={`text-[11.5px] font-medium uppercase tracking-label ${tone.meta}`}>
            Always · {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
          <p className="font-display text-[clamp(22px,6.2vw,30px)] font-light leading-[1.12] md:text-[clamp(30px,4.2vw,54px)] md:leading-[1.1]">
            <em className={tone.accent}>{lead}</em> {rest}
          </p>
          <p className={`font-script text-[34px] leading-none [@media(max-height:640px)]:hidden ${tone.accent}`}>Oshi</p>
        </div>
      </motion.article>
    </div>
  );
}
