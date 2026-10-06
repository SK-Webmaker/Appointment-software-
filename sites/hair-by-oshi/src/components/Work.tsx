import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useIsomorphicLayoutEffect, useReducedMotionSafe } from "@/lib/motion";
import { ArrowRight, Instagram } from "lucide-react";
import { useRef, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines } from "./Reveal";
import { SITE, WORK } from "@/site.config";

/**
 * Chapter II — her work. The page pauses and the gallery travels sideways as
 * you scroll down, one look at a time. With reduced motion it is a plain
 * swipeable row.
 */
export function Work() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const [distance, setDistance] = useState(0);
  const [viewH, setViewH] = useState(0);
  const [index, setIndex] = useState(1);
  const distRef = useRef(0);

  useIsomorphicLayoutEffect(() => {
    const measure = () => {
      const t = trackRef.current;
      if (!t) return;
      const d = Math.max(0, t.scrollWidth - window.innerWidth);
      distRef.current = d;
      setDistance(d);
      setViewH(window.innerHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, (v) => -v * distRef.current);
  const bar = useTransform(scrollYProgress, [0, 1], [0.04, 1]);
  useMotionValueEvent(scrollYProgress, "change", (v) => setIndex(Math.min(WORK.length, Math.max(1, Math.round(v * (WORK.length - 1)) + 1))));

  const pinned = !reduce && distance > 0 && viewH > 0;

  return (
    <section
      id="work"
      ref={sectionRef}
      className="relative bg-cream"
      style={pinned ? { height: distance + viewH } : undefined}
      aria-labelledby="work-title"
    >
      <div className={pinned ? "sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden" : "py-24 md:py-32"}>
        <motion.div
          ref={trackRef}
          className={`flex w-max items-end gap-4 px-5 pt-16 md:gap-8 md:px-10 xl:px-24 ${pinned ? "" : "no-scrollbar max-w-[100vw] snap-x snap-mandatory overflow-x-auto"}`}
          style={{ x: pinned ? x : 0 }}
          data-qa="layered"
        >
          {/* The opening panel: the chapter's words */}
          <div className="w-[min(84vw,500px)] shrink-0 snap-start self-center pr-4 md:pr-10">
            <ChapterLabel id="work" />
            <h2 id="work-title" className="mt-6 text-[clamp(40px,10vw,84px)] font-light leading-[0.98] text-ink">
              <MaskLines lines={[<>Real hair,</>, <em className="text-plum">real results.</em>]} />
            </h2>
            <p className="mt-6 max-w-[36ch] text-[16px] leading-[1.75] text-mocha md:text-[17px]">
              “Behind a real colour transformation are hours of work, knowledge and carefully made decisions to keep your hair healthy.”
            </p>
            <p className="mt-6 flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.22em] text-plum">
              {pinned ? "Keep scrolling" : "Swipe"} <ArrowRight size={15} strokeWidth={1.8} />
            </p>
          </div>

          {WORK.map((w, i) => (
            <figure key={w.image} className={`w-[70vw] max-w-[400px] shrink-0 snap-center sm:w-[44vw] lg:w-[29vw] ${i % 2 ? "md:mb-16" : ""}`}>
              <div className="group relative overflow-hidden rounded-t-full bg-sand shadow-[0_30px_60px_-34px_rgba(34,22,31,0.55)]">
                <Img
                  name={w.image}
                  widths={w.widths}
                  sizes="(min-width:1024px) 29vw, (min-width:640px) 44vw, 70vw"
                  alt={w.alt}
                  className="aspect-[3/4] max-h-[56svh] w-full object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                  style={{ objectPosition: w.position ?? "50% 50%" }}
                />
              </div>
              <figcaption className="mt-4 flex items-start gap-4">
                <span className="pt-1.5 font-display text-[14px] italic text-plum">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block font-display text-[23px] font-light leading-tight text-ink md:text-[26px]">{w.title}</span>
                  <span className="mt-1 block text-[14.5px] leading-snug text-mocha">“{w.caption}”</span>
                </span>
              </figcaption>
            </figure>
          ))}

          {/* The closing panel */}
          <div className="flex w-[min(78vw,380px)] shrink-0 snap-end flex-col items-start justify-center self-center pl-2 md:pl-8">
            <p className="font-display text-[clamp(28px,4vw,40px)] font-light leading-[1.1] text-ink">
              More on her <em className="text-plum">Instagram.</em>
            </p>
            <p className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-mocha">Her latest transformations live there. “Save the inspo, girls, but remember your starting point matters.”</p>
            <a href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="btn-ghost mt-7">
              <Instagram size={16} strokeWidth={1.7} /> @{SITE.instagramHandle}
            </a>
          </div>
        </motion.div>

        {pinned && (
          <div className="mx-auto mt-8 flex w-full max-w-[1440px] items-center gap-5 px-5 md:mt-10 md:px-10 xl:px-24" aria-hidden="true">
            <span className="w-14 font-display text-[15px] italic text-plum">
              {String(index).padStart(2, "0")} / {String(WORK.length).padStart(2, "0")}
            </span>
            <span className="relative h-px flex-1 bg-ink/15">
              <motion.span className="absolute inset-0 origin-left bg-plum" style={{ scaleX: bar }} />
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
