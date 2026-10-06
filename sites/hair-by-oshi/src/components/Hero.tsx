import { motion, useScroll, useTransform } from "framer-motion";
import { useIsomorphicLayoutEffect, useReducedMotionSafe } from "@/lib/motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useReducer, useRef } from "react";
import { Img } from "./Img";
import { MaskLines } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

type Box = { top: number; right: number; bottom: number; left: number; width: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Her portrait melts into the dark hair beneath it at the bottom of the capsule.
const FADE = "linear-gradient(to bottom, #000 86%, transparent 100%)";

/**
 * Opening scene. Oshi herself sits in a capsule; as you scroll, the capsule
 * opens out to the full screen and she dissolves into her work — glossy dark
 * hair — as her line "Beautiful hair starts with honesty" arrives over it. The capsule's position
 * is measured from a layout slot, so text and buttons never collide with it.
 */
export function Hero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const box = useRef<Box | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const reduce = useReducedMotionSafe();
  // Read inside the scroll transform below, which would otherwise keep the
  // value from its first render (before the preference is known).
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const { openSheet } = useBooking();

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });

  useIsomorphicLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current?.getBoundingClientRect();
      const slot = slotRef.current?.getBoundingClientRect();
      if (!stage || !slot) return;
      box.current = {
        top: slot.top - stage.top,
        left: slot.left - stage.left,
        right: stage.right - slot.right,
        bottom: stage.bottom - slot.bottom,
        width: slot.width,
      };
      rerender(); // recompute the clip path with the new box
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    if (slotRef.current) ro.observe(slotRef.current);
    return () => ro.disconnect();
  }, []);

  // Read the measured box through a ref so the transform never goes stale.
  const clipPath = useTransform(scrollYProgress, (v) => {
    const b = box.current;
    // Until the slot is measured (server render, first client frame) keep the
    // photograph fully clipped rather than full-bleed behind the headline.
    if (!b) return "inset(0 0 100% 0)";
    const k = reduceRef.current ? 0 : easeInOut(clamp01(v / 0.62));
    const r = lerp(b.width / 2, 0, k);
    return `inset(${lerp(b.top, 0, k)}px ${lerp(b.right, 0, k)}px ${lerp(b.bottom, 0, k)}px ${lerp(b.left, 0, k)}px round ${r}px)`;
  });
  const frameOpacity = useTransform(scrollYProgress, (v) => 1 - clamp01(v / 0.12));

  // Oshi's portrait rides the opening capsule exactly, then dissolves into her
  // work: by the time the capsule is full screen, it's all glossy dark hair.
  const edge = (side: "top" | "right" | "bottom" | "left") => (v: number) => {
    const b = box.current;
    if (!b) return 0;
    const k = reduceRef.current ? 0 : easeInOut(clamp01(v / 0.62));
    return lerp(b[side], 0, k);
  };
  const pTop = useTransform(scrollYProgress, edge("top"));
  const pRight = useTransform(scrollYProgress, edge("right"));
  const pBottom = useTransform(scrollYProgress, edge("bottom"));
  const pLeft = useTransform(scrollYProgress, edge("left"));
  const portraitOpacity = useTransform(scrollYProgress, [0.1, 0.42], [1, 0]);
  const portraitScale = useTransform(scrollYProgress, [0, 0.4], [1.18, 1.3]);

  const imgScale = useTransform(scrollYProgress, [0, 0.7], [1.16, 1]);
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "-6%"]);
  const introOpacity = useTransform(scrollYProgress, [0, 0.26], [1, 0]);
  const introY = useTransform(scrollYProgress, [0, 0.3], [0, -70]);
  const introEvents = useTransform(scrollYProgress, (v) => (v > 0.2 ? "none" : "auto"));
  const veil = useTransform(scrollYProgress, [0.3, 0.72], [0, 1]);
  const outroOpacity = useTransform(scrollYProgress, [0.56, 0.8], [0, 1]);
  const outroY = useTransform(scrollYProgress, [0.56, 0.86], [50, 0]);
  const outroEvents = useTransform(scrollYProgress, (v) => (v > 0.6 ? "auto" : "none"));

  return (
    <section
      id="top"
      ref={sectionRef}
      className={reduce ? "relative" : "relative h-[240svh] lg:h-[250vh]"}
      aria-label="Welcome"
    >
      <div ref={stageRef} className="sticky top-0 h-[100svh] min-h-[600px] w-full overflow-hidden bg-cream">
        {/* soft champagne light in the empty corner */}
        <div className="pointer-events-none absolute -right-32 top-16 h-[460px] w-[460px] rounded-full bg-champagne/50 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-40 bottom-0 h-[360px] w-[360px] rounded-full bg-honey/15 blur-3xl" aria-hidden="true" />

        {/* The photograph, clipped to the capsule */}
        <motion.div className="absolute inset-0 z-0 bg-espresso will-change-[clip-path]" style={{ clipPath }} data-qa="layered">
          <motion.div className="h-[112%] w-full" style={reduce ? { scale: 1, y: "0%" } : { scale: imgScale, y: imgY }}>
            <Img
              name="hair-gloss"
              widths={[480, 800, 1200]}
              sizes="100vw"
              alt="Oshi's work: thick, glossy, dark chocolate-brown hair falling straight down the back"
              className="h-full w-full object-cover"
              style={{ objectPosition: "50% 32%" }}
            />
          </motion.div>
          <motion.div
            className="absolute overflow-hidden"
            style={
              reduce
                ? { top: pTop, right: pRight, bottom: pBottom, left: pLeft, opacity: 1 }
                : { top: pTop, right: pRight, bottom: pBottom, left: pLeft, opacity: portraitOpacity }
            }
          >
            <motion.div className="h-full w-full" style={{ scale: reduce ? 1.18 : portraitScale, transformOrigin: "50% 100%", maskImage: FADE, WebkitMaskImage: FADE }}>
              <Img
                name="oshi-hallway"
                widths={[480, 800, 1200, 1320]}
                sizes="(min-width:1024px) 60vw, 100vw"
                priority
                alt="Oshi Dias smiling in the hallway outside her suite in Oakleigh, under a glowing brass lamp"
                className="h-full w-full object-cover"
                style={{ objectPosition: "50% 62%" }}
              />
            </motion.div>
          </motion.div>
          <motion.div className="absolute inset-0 bg-gradient-to-t from-espresso/90 via-espresso/45 to-espresso/10" style={{ opacity: reduce ? 0 : veil }} aria-hidden="true" />
        </motion.div>

        {/* Opening layout */}
        <motion.div
          className="relative z-10 mx-auto grid h-full max-w-[1440px] grid-rows-[auto_1fr_auto] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[84px] md:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:grid-rows-1 lg:gap-16 lg:pb-12 lg:pt-28 xl:px-24"
          style={reduce ? { opacity: 1, y: 0, pointerEvents: "auto" } : { opacity: introOpacity, y: introY, pointerEvents: introEvents }}
        >
          <div className="lg:flex lg:flex-col lg:justify-center lg:pb-10">
            <p className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.24em] text-cocoa md:text-[11.5px]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-caramel/50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-caramel" />
              </span>
              <span>
                {SITE.suburbShort} · {SITE.specialty}
              </span>
            </p>
            <h1 className="mt-4 text-[clamp(46px,12.4vw,64px)] font-light leading-[0.98] text-ink lg:mt-7 lg:text-[clamp(68px,7vw,118px)] lg:leading-[0.94]">
              <MaskLines
                animateOnMount
                delay={1.3}
                lines={[
                  <>Healthy hair.</>,
                  <>
                    Confident <em className="text-cocoa">you.</em>
                  </>,
                ]}
              />
            </h1>
            <motion.p
              className="mt-4 max-w-[32ch] text-[16px] leading-relaxed text-mocha [@media(max-height:720px)]:hidden lg:mt-8 lg:max-w-[40ch] lg:text-[18px] [@media(max-height:720px)]:lg:block"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.65, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              Hi, I'm {SITE.founder} — a colourist who specialises in dark, thick hair. Colour and Nanoplasty, one client at a time, in my private suite in {SITE.suburbShort}.
            </motion.p>
            <motion.div
              className="mt-10 hidden flex-wrap items-center gap-4 lg:flex"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              <button onClick={openSheet} className="btn-primary sheen whitespace-nowrap">
                Book your appointment <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <a href="#work" className="btn-ghost whitespace-nowrap">
                See the work
              </a>
            </motion.div>
            <motion.p
              className="mt-8 hidden text-[12px] font-medium uppercase tracking-[0.24em] text-mocha lg:block"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 1 }}
            >
              {SITE.days.join(" · ")} — DM to book
            </motion.p>
          </div>

          {/* The capsule slot: an empty box the photograph is clipped to. */}
          <div className="relative flex min-h-0 items-stretch justify-center py-5 lg:py-0 lg:pb-4">
            <div ref={slotRef} className="relative h-full w-[min(64%,300px)] sm:w-[min(52%,330px)] lg:h-[min(78vh,780px)] lg:w-[min(100%,400px)] lg:self-end">
              <motion.div className="capsule absolute -inset-[10px] border border-cocoa/35" style={{ opacity: reduce ? 1 : frameOpacity }} aria-hidden="true" />
              <div className="absolute -bottom-3 -left-14 hidden sm:block lg:-left-20 lg:bottom-12">
                <RoundBadge size={124} className="drop-shadow-sm" />
              </div>
              <p className="absolute -right-10 bottom-6 hidden rotate-180 whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.3em] text-cocoa [writing-mode:vertical-rl] lg:block">
                {SITE.fullName} · your colourist
              </p>
            </div>
          </div>

          <div className="flex gap-3 lg:hidden">
            <button onClick={openSheet} className="btn-primary sheen flex-1 px-4">
              Book now
            </button>
            <a href="#work" className="btn-ghost flex-1 px-4">
              The work
            </a>
          </div>
        </motion.div>

        {/* After the capsule opens — a second scene that only exists with motion on */}
        {!reduce && (
          <motion.div
            className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-[1440px] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-cream md:px-10 lg:pb-16 xl:px-24"
            style={{ opacity: outroOpacity, y: outroY, pointerEvents: outroEvents }}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-honey">{SITE.values.join(" · ")}</p>
            <p className="mt-4 max-w-[13ch] font-display text-[clamp(46px,11vw,128px)] font-light leading-[0.95]">
              Beautiful hair starts with <em className="text-champagne">honesty.</em>
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a href="#oshi" className="btn-honey sheen" tabIndex={-1}>
                Begin <ArrowDown size={16} strokeWidth={1.8} />
              </a>
              <p className="max-w-[40ch] text-[15px] leading-relaxed text-cream/85">
                “I'll always explain the process, protect the health of your hair and create a result that works for your lifestyle — not just for the photo.” <span className="whitespace-nowrap text-honey">— {SITE.founder}</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* scroll cue */}
        {!reduce && (
          <motion.div
            className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 lg:flex"
            style={{ opacity: introOpacity }}
            aria-hidden="true"
          >
            <span className="text-[10.5px] font-medium uppercase tracking-[0.3em] text-mocha">Scroll</span>
            <span className="relative h-10 w-px overflow-hidden bg-ink/15">
              <motion.span
                className="absolute inset-x-0 top-0 h-1/2 bg-cocoa"
                animate={{ y: ["-100%", "200%"] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }}
              />
            </span>
          </motion.div>
        )}
      </div>
    </section>
  );
}
