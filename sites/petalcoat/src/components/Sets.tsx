import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useRef, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { useIsomorphicLayoutEffect } from "@/lib/motion";
import { SETS, shadeOf, type Finish, type Shape } from "@/site.config";
import { useBooking } from "@/context/booking";

/**
 * Chapter II — the sets: the page turns sideways. Scroll down and recent
 * work slides past right-to-left in tall almond frames, each with its
 * recipe — "Wear this" puts its shade, finish and shape in your booking.
 * The section is exactly as tall as the track is wide, so the wall ends
 * the moment the last set arrives.
 */
export function Sets() {
  const { openSheet } = useBooking();
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, (v) => -dist * v);

  useIsomorphicLayoutEffect(() => {
    const measure = () => {
      const t = track.current;
      if (!t) return;
      setDist(Math.max(0, t.scrollWidth - window.innerWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section
      id="sets"
      ref={section}
      className="sheet bg-noir text-ivory"
      style={{ height: dist ? `calc(${dist}px + 100svh)` : "320svh" }}
      aria-labelledby="sets-title"
    >
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <motion.div
          ref={track}
          data-qa="scroller"
          className="flex w-max items-end gap-5 px-5 will-change-transform md:gap-8 md:px-10 xl:px-24"
          style={{ x }}
        >
          {/* the title is the first panel */}
          <div className="flex w-[min(84vw,520px)] shrink-0 flex-col justify-end self-stretch pb-4">
            <ChapterLabel id="sets" light />
            <h2 id="sets-title" className="mt-6 text-[clamp(44px,12vw,104px)] leading-[0.94]">
              Recent sets, <em className="text-pearl">recipes included.</em>
            </h2>
            <p className="mt-6 max-w-[36ch] text-[15.5px] leading-[1.7] text-ivory/80 md:text-[16.5px]">
              Keep scrolling — the wall slides by. See one you love?{" "}
              <span className="font-semibold text-pearl">Wear this</span> puts its shade, finish and
              shape straight into your booking.
            </p>
          </div>
          {SETS.map((s, i) => {
            const sh = shadeOf(s.shade);
            const tall = i % 2 === 0;
            const wide = "landscape" in s;
            return (
              <figure
                key={s.image}
                className={`group shrink-0 ${tall ? "w-[min(62vw,340px)]" : "w-[min(56vw,300px)]"}`}
              >
                <div
                  className={`relative overflow-hidden rounded-b-[22px] rounded-t-[999px] bg-coal ring-1 ring-ivory/10 ${tall ? "h-[min(54svh,560px)]" : "h-[min(44svh,460px)]"}`}
                >
                  <Img
                    name={s.image}
                    widths={wide ? [480, 800, 1200, 1600, 2000] : [480, 800, 1200]}
                    sizes={
                      wide ? "(min-width:768px) 640px, 110vw" : "(min-width:768px) 340px, 62vw"
                    }
                    alt={s.alt}
                    className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                    style={{ objectPosition: s.position }}
                  />
                </div>
                <figcaption className="mt-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full ring-1 ring-ivory/30"
                      style={{ background: sh?.hex }}
                      aria-hidden="true"
                    />
                    <span className="font-display text-[22px] leading-tight md:text-[26px]">
                      <span className="text-[0.6em] italic text-pearl">
                        №{String(i + 1).padStart(2, "0")}
                      </span>{" "}
                      {s.title}
                    </span>
                  </span>
                  <span className="mt-1 block text-[13.5px] leading-snug text-ivory/75">
                    {s.caption}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openSheet({
                        look: {
                          shade: s.shade,
                          finish: s.finish as Finish,
                          shape: s.shape as Shape,
                        },
                      })
                    }
                    className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-pearl underline decoration-pearl/40 underline-offset-4 hover:decoration-pearl"
                    aria-label={`Wear this: ${s.title} — ${s.shade}, ${s.finish}, ${s.shape}`}
                  >
                    Wear this <ArrowUpRight size={15} strokeWidth={1.8} />
                  </button>
                </figcaption>
              </figure>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
