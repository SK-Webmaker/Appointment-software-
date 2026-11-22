import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { RITUAL } from "@/site.config";
import { useBooking } from "@/context/booking";

const TONES = [
  { card: "bg-noir text-ivory", title: "text-ivory", meta: "text-pearl", body: "text-ivory/80" },
  { card: "bg-candy text-noir", title: "text-noir", meta: "text-plum", body: "text-noir" },
  { card: "bg-coal text-ivory", title: "text-pearl", meta: "text-ivory/70", body: "text-ivory/80" },
  { card: "bg-rose text-ivory", title: "text-ivory", meta: "text-ivory/85", body: "text-ivory" },
];

/** Chapter 03 — the ritual: what happens in the chair, as four cards that stack as you scroll. */
export function Ritual() {
  const { openSheet } = useBooking();
  const stack = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stack, offset: ["start start", "end end"] });

  return (
    <section
      id="ritual"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="ritual-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="ritual" />
        <h2
          id="ritual-title"
          className="mt-8 max-w-[13ch] text-[clamp(52px,11vw,136px)] leading-[0.86]"
        >
          <MaskLines
            lines={[<>Forty-five minutes,</>, <em className="text-rose">start to finish.</em>]}
          />
        </h2>
        <Reveal>
          <p className="mt-8 max-w-[46ch] text-[16.5px] leading-[1.8] text-ash md:text-[17.5px]">
            Every booking gets its own time, so nobody's watching the clock. Here's what happens in
            it.
          </p>
        </Reveal>

        <div ref={stack} className="relative mt-16 md:mt-24" data-qa="layered">
          {RITUAL.map((o, i) => (
            <Card key={o.title} i={i} total={RITUAL.length} progress={scrollYProgress} {...o} />
          ))}
        </div>

        <Reveal className="mt-16 text-center">
          <p className="mx-auto max-w-[20ch] font-display text-[clamp(40px,6vw,72px)] font-extrabold uppercase leading-[0.9]">
            Your chair is <em className="text-rose">waiting.</em>
          </p>
          <button
            type="button"
            onClick={() => openSheet({ service: "Signature Cut" })}
            className="btn-primary sheen mt-10"
          >
            Book a Signature Cut <ArrowRight size={16} strokeWidth={1.8} />
          </button>
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
    <div
      className="sticky mb-[16svh] last:mb-0 md:mb-[18vh]"
      style={{ top: `calc(var(--nav-h) + 16px + ${i * 14}px)` }}
    >
      <motion.article
        style={{ scale: reduce ? 1 : scale, transformOrigin: "50% 0%" }}
        className={`relative grid overflow-hidden rounded-[10px] will-change-transform shadow-[0_-24px_60px_-30px_rgba(20,14,10,0.55)] md:min-h-[62vh] md:grid-cols-[0.95fr_1.05fr] ${tone.card}`}
      >
        <div className="relative h-[34svh] min-h-[200px] overflow-hidden md:h-auto">
          <Img
            name={image}
            widths={[...widths]}
            sizes="(min-width:768px) 660px, 100vw"
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: position }}
          />
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-7 md:gap-5 md:p-14">
          <p className={`text-[11.5px] font-semibold uppercase tracking-label ${tone.meta}`}>
            {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
          <h3
            className={`text-[clamp(44px,11vw,60px)] leading-[0.9] md:text-[clamp(60px,5.4vw,92px)] ${tone.title}`}
          >
            {title}
          </h3>
          <p className={`max-w-[48ch] text-[15px] leading-[1.75] md:text-[17px] ${tone.body}`}>
            {text}
          </p>
        </div>
      </motion.article>
    </div>
  );
}
