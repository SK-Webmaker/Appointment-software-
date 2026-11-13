import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { SEEN, SITE } from "@/site.config";

const TONES = [
  { card: "bg-noir text-ivory", title: "text-ivory", meta: "text-ivory/70", body: "text-ivory/80" },
  { card: "bg-ivory text-ink", title: "text-ink", meta: "text-ash", body: "text-ash" },
  { card: "bg-coal text-ivory", title: "text-pearl", meta: "text-ivory/70", body: "text-ivory/80" },
  { card: "bg-mint text-ink", title: "text-ink", meta: "text-ash", body: "text-ash" },
];

/** Chapter III — made to be seen: DUO, gifts, teams and the framed piece, as cards that stack as you scroll. */
export function Seen() {
  const stack = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stack, offset: ["start start", "end end"] });

  return (
    <section id="seen" className="sheet bg-candy pb-24 pt-24 text-ink md:pb-32 md:pt-36" aria-labelledby="seen-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="seen" />
        <h2 id="seen-title" className="mt-8 max-w-[14ch] text-[clamp(44px,9.4vw,112px)] leading-[0.95]">
          <MaskLines lines={[<>From screen</>, <em className="text-plum">to wall.</em>]} />
        </h2>
        <Reveal>
          <p className="mt-8 max-w-[46ch] text-[16.5px] leading-[1.8] md:text-[17.5px]">
            Made to be seen. A3 or 50 × 70 cm premium — the digital version is included with every printed order.
          </p>
        </Reveal>

        <div ref={stack} className="relative mt-16 md:mt-24" data-qa="layered">
          {SEEN.map((o, i) => (
            <Card key={o.title} i={i} total={SEEN.length} progress={scrollYProgress} {...o} />
          ))}
        </div>

        <Reveal className="mt-16 text-center">
          <p className="mx-auto max-w-[22ch] font-display text-[clamp(34px,5vw,56px)] leading-[1.05]">
            Today’s passion. <em className="text-plum">Tomorrow’s memories.</em>
          </p>
          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.24em] text-onyx">— {SITE.fullName}</p>
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
        className={`relative grid overflow-hidden rounded-[18px] will-change-transform shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.5)] md:min-h-[62vh] md:grid-cols-[0.95fr_1.05fr] ${tone.card}`}
      >
        <div className="relative h-[34svh] min-h-[200px] overflow-hidden md:h-auto">
          <Img name={image} widths={[...widths]} sizes="(min-width:768px) 660px, 100vw" alt={alt} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-7 md:gap-5 md:p-14">
          <p className={`text-[11.5px] font-semibold uppercase tracking-label ${tone.meta}`}>
            {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
          <h3 className={`text-[clamp(36px,9vw,48px)] leading-[1] md:text-[clamp(48px,4.4vw,68px)] ${tone.title}`}>{title}</h3>
          <p className={`max-w-[48ch] text-[15px] leading-[1.75] md:text-[17px] ${tone.body}`}>{text}</p>
        </div>
      </motion.article>
    </div>
  );
}
