import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { CARE } from "@/site.config";
import { useBooking } from "@/context/booking";

const TONES = [
  { card: "bg-noir text-ivory", title: "text-ivory", meta: "text-pearl", body: "text-ivory/80" },
  { card: "bg-candy text-ink", title: "text-ink", meta: "text-plum", body: "text-ink" },
  { card: "bg-coal text-ivory", title: "text-pearl", meta: "text-ivory/70", body: "text-ivory/80" },
  { card: "bg-rose text-ivory", title: "text-ivory", meta: "text-ivory/85", body: "text-ivory" },
];

/** Chapter III — the care: how we look after your nails, as four cards that stack as you scroll. */
export function Care() {
  const { openSheet } = useBooking();
  const stack = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stack, offset: ["start start", "end end"] });

  return (
    <section
      id="care"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="care-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="care" />
        <h2
          id="care-title"
          className="mt-8 max-w-[13ch] text-[clamp(46px,9.6vw,120px)] leading-[0.94]"
        >
          <MaskLines
            lines={[<>Pretty is easy.</>, <em className="text-rose">Healthy takes care.</em>]}
          />
        </h2>
        <Reveal>
          <p className="mt-8 max-w-[46ch] text-[16.5px] leading-[1.8] text-ash md:text-[17.5px]">
            What happens to your nails between the first file and the last coat — and why your next
            set will go on just as well.
          </p>
        </Reveal>

        <div ref={stack} className="relative mt-16 md:mt-24" data-qa="layered">
          {CARE.map((o, i) => (
            <Card key={o.title} i={i} total={CARE.length} progress={scrollYProgress} {...o} />
          ))}
        </div>

        <Reveal className="mt-16 text-center">
          <p className="mx-auto max-w-[20ch] font-display text-[clamp(40px,6vw,72px)] leading-[1]">
            Your seat is <em className="text-rose">saved.</em>
          </p>
          <button
            type="button"
            onClick={() => openSheet({ service: "Gel Manicure" })}
            className="btn-primary sheen mt-10"
          >
            Book a Gel Manicure <ArrowRight size={16} strokeWidth={1.8} />
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
        className={`relative grid overflow-hidden rounded-[28px] will-change-transform shadow-[0_-24px_60px_-30px_rgba(60,20,32,0.45)] md:min-h-[62vh] md:grid-cols-[0.95fr_1.05fr] ${tone.card}`}
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
            className={`text-[clamp(36px,9vw,48px)] leading-[1] md:text-[clamp(48px,4.4vw,68px)] ${tone.title}`}
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
