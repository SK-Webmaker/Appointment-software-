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

/**
 * Opening scene. Her Gel-X photograph sits in the arch from her price list;
 * as you scroll, the arch opens out to the full screen and the second line
 * arrives. The arch's position is measured from a layout slot, so the text
 * and buttons never collide with it at any screen size.
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
    return `inset(${lerp(b.top, 0, k)}px ${lerp(b.right, 0, k)}px ${lerp(b.bottom, 0, k)}px ${lerp(b.left, 0, k)}px round ${r}px ${r}px 0 0)`;
  });
  const frameOpacity = useTransform(scrollYProgress, (v) => 1 - clamp01(v / 0.12));

  const imgScale = useTransform(scrollYProgress, [0, 0.7], [1.18, 1]);
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
      <div ref={stageRef} className="sticky top-0 h-[100svh] min-h-[600px] w-full overflow-hidden bg-ivory">
        {/* soft satin in the empty corners */}
        <div className="pointer-events-none absolute -right-24 top-24 h-[420px] w-[420px] rounded-full bg-champagne/40 blur-3xl" aria-hidden="true" />

        {/* The photograph, clipped to the arch */}
        <motion.div className="absolute inset-0 z-0 will-change-[clip-path]" style={{ clipPath }} data-qa="layered">
          <motion.div className="h-full w-full" style={{ scale: reduce ? 1 : imgScale }}>
            <Img
              name="nails-gelx-tier4"
              widths={[480, 800, 1200]}
              sizes="100vw"
              priority
              alt="Helena's Gel-X set, Tier 4 nail art: almond nails with gold bows, tortoiseshell and burgundy, beside a fern and a gold candle"
              className="h-full w-full object-cover"
              style={{ objectPosition: "50% 62%" }}
            />
          </motion.div>
          <motion.div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/35 to-ink/10" style={{ opacity: reduce ? 0 : veil }} aria-hidden="true" />
        </motion.div>

        {/* Opening layout */}
        <motion.div
          className="relative z-10 mx-auto grid h-full max-w-[1440px] grid-rows-[auto_1fr_auto] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[84px] md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-1 lg:gap-16 lg:pb-12 lg:pt-28"
          style={reduce ? { opacity: 1, y: 0, pointerEvents: "auto" } : { opacity: introOpacity, y: introY, pointerEvents: introEvents }}
        >
          <div className="lg:flex lg:flex-col lg:justify-center lg:pb-10">
            <p className="flex items-center gap-2.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-bronze-deep md:text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bronze/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-bronze" />
              </span>
              <span>
                Re-opening {SITE.reopeningShort} · {SITE.suburb}
                <span className="hidden sm:inline">, {SITE.city}</span>
              </span>
            </p>
            <h1 className="mt-4 text-[clamp(42px,11.6vw,60px)] leading-[0.98] text-espresso lg:mt-7 lg:text-[clamp(64px,6.6vw,112px)] lg:leading-[0.95]">
              <MaskLines
                animateOnMount
                delay={1.25}
                lines={[
                  <>Where beauty</>,
                  <>becomes</>,
                  <em className="text-bronze">confidence.</em>,
                ]}
              />
            </h1>
            <motion.p
              className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-mocha [@media(max-height:720px)]:hidden lg:mt-8 lg:max-w-[38ch] lg:text-[17px] [@media(max-height:720px)]:lg:block"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              Nails, lashes, brows, skin and hair by {SITE.founder} — a {SITE.credential.toLowerCase()} — in a private studio built for you.
            </motion.p>
            <motion.div
              className="mt-10 hidden flex-wrap items-center gap-4 lg:flex"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.75, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              <button onClick={openSheet} className="btn-primary sheen whitespace-nowrap">
                Book your appointment <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <a href="#menu" className="btn-ghost whitespace-nowrap">
                View the menu
              </a>
            </motion.div>
          </div>

          {/* The arch slot: an empty box the photograph is clipped to. */}
          <div className="relative flex min-h-0 items-stretch justify-center py-5 lg:py-0 lg:pb-4">
            <div ref={slotRef} className="relative h-full w-[min(76%,340px)] sm:w-[min(60%,360px)] lg:h-[min(76vh,760px)] lg:w-[min(100%,460px)] lg:self-end">
              <motion.div className="arch absolute -inset-[9px] border border-bronze/45" style={{ opacity: reduce ? 1 : frameOpacity }} aria-hidden="true" />
              <div className="absolute -bottom-2 -left-10 hidden sm:block lg:-left-16 lg:bottom-10">
                <RoundBadge size={118} className="drop-shadow-sm" />
              </div>
              <p className="absolute -right-9 bottom-2 hidden rotate-180 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.3em] text-bronze-deep [writing-mode:vertical-rl] lg:block">
                Gel-X set · Tier 4
              </p>
            </div>
          </div>

          <div className="flex gap-3 lg:hidden">
            <button onClick={openSheet} className="btn-primary sheen flex-1 px-4">
              Book now
            </button>
            <a href="#menu" className="btn-ghost flex-1 px-4">
              The menu
            </a>
          </div>
        </motion.div>

        {/* After the arch opens — a second scene that only exists with motion on */}
        {!reduce && (
        <motion.div
          className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-[1440px] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-cream md:px-10 lg:pb-16"
          style={{ opacity: outroOpacity, y: outroY, pointerEvents: outroEvents }}
        >
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-gold">Gel-X set · Tier 4 — by {SITE.founder}</p>
          <p className="mt-4 max-w-[12ch] font-display text-[clamp(44px,12vw,128px)] leading-[0.95]">
            Your beauty, <em className="text-gold">elevated.</em>
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="#menu" className="btn-gold sheen" tabIndex={-1}>
              Explore the menu <ArrowDown size={16} strokeWidth={1.8} />
            </a>
            <p className="max-w-[34ch] text-[14px] leading-relaxed text-cream/80">
              Beauty, nail, lash &amp; brow services, crafted with care, detail and a touch of luxury.
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
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-mocha">Scroll</span>
            <span className="relative h-10 w-px overflow-hidden bg-espresso/15">
              <motion.span
                className="absolute inset-x-0 top-0 h-1/2 bg-bronze"
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
