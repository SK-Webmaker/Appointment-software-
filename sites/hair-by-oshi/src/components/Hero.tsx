import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useIsomorphicLayoutEffect, useReducedMotionSafe } from "@/lib/motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useReducer, useRef } from "react";
import { Img } from "./Img";
import { MaskLines } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

type Geo = {
  W: number;
  H: number;
  /** the capsule slot, relative to the stage */
  slot: { x: number; y: number; w: number; h: number };
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Her work, dealt out around her like a mood board. Offsets are fractions of
 * the stage (x of its width, y of its height) from where the capsule settles;
 * `wide` ones only appear on wide screens.
 */
const FAN_LANDSCAPE = [
  { image: "honey-roots", widths: [480], x: -0.235, y: -0.13, r: -6 },
  { image: "cherry-red", widths: [480], x: 0.235, y: -0.14, r: 6 },
  { image: "balayage-front", widths: [480], x: -0.215, y: 0.13, r: 5 },
  { image: "summer-tones", widths: [480], x: 0.225, y: 0.11, r: -5 },
  { image: "yours-truly", widths: [480], x: -0.4, y: -0.01, r: 3, wide: true },
  { image: "volume", widths: [480], x: 0.4, y: 0.0, r: -4, wide: true },
] as const;
const FAN_PORTRAIT = [
  { image: "honey-roots", widths: [480], x: -0.33, y: -0.16, r: -7 },
  { image: "cherry-red", widths: [480], x: 0.33, y: -0.11, r: 6 },
  { image: "balayage-front", widths: [480], x: -0.33, y: 0.1, r: 5 },
  { image: "summer-tones", widths: [480], x: 0.33, y: 0.15, r: -6 },
] as const;

/**
 * Opening scene. Oshi herself sits in a capsule beside her tagline. As you
 * scroll, the words step back, the capsule glides to the centre, and her work
 * is dealt out around her — then "Beautiful hair starts with honesty" settles
 * underneath. The capsule starts from a measured layout slot, so the text and
 * buttons never collide with it.
 */
export function Hero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const geo = useRef<Geo | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const reduce = useReducedMotionSafe();
  // Read inside the scroll transforms below, which would otherwise keep the
  // value from their first render (before the preference is known).
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const { openSheet } = useBooking();

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });

  useIsomorphicLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current?.getBoundingClientRect();
      const slot = slotRef.current?.getBoundingClientRect();
      if (!stage || !slot) return;
      geo.current = {
        W: stage.width,
        H: stage.height,
        slot: { x: slot.left - stage.left, y: slot.top - stage.top, w: slot.width, h: slot.height },
      };
      rerender();
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    if (slotRef.current) ro.observe(slotRef.current);
    return () => ro.disconnect();
  }, []);

  const g = geo.current;
  const landscape = !!g && g.W >= g.H;
  // Where the capsule settles, and how big it is there.
  const target = g
    ? landscape
      ? { cx: g.W / 2, cy: g.H * 0.36, h: g.H * 0.46 }
      : { cx: g.W / 2, cy: g.H * 0.36, h: g.H * 0.4 }
    : null;

  // The capsule’s glide to the centre (first third of the scroll).
  const travel = (v: number) => (reduceRef.current ? 0 : easeInOut(clamp01(v / 0.34)));
  const capX = useTransform(scrollYProgress, (v) => {
    const gg = geo.current;
    if (!gg || !target) return 0;
    return (target.cx - (gg.slot.x + gg.slot.w / 2)) * travel(v);
  });
  const capY = useTransform(scrollYProgress, (v) => {
    const gg = geo.current;
    if (!gg || !target) return 0;
    return (target.cy - (gg.slot.y + gg.slot.h / 2)) * travel(v);
  });
  const capScale = useTransform(scrollYProgress, (v) => {
    const gg = geo.current;
    if (!gg || !target) return 1;
    return lerp(1, Math.min(1.08, target.h / gg.slot.h), travel(v));
  });
  const ringOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.25]);

  const introOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const introY = useTransform(scrollYProgress, [0, 0.26], [0, -60]);
  const introEvents = useTransform(scrollYProgress, (v) => (v > 0.15 ? "none" : "auto"));
  const outroOpacity = useTransform(scrollYProgress, [0.5, 0.68], [0, 1]);
  const outroY = useTransform(scrollYProgress, [0.5, 0.72], [40, 0]);
  const outroEvents = useTransform(scrollYProgress, (v) => (v > 0.55 ? "auto" : "none"));
  const glow = useTransform(scrollYProgress, [0.1, 0.6], [0, 1]);

  const fan = landscape ? FAN_LANDSCAPE : FAN_PORTRAIT;
  const cardW = g ? (landscape ? Math.min(g.W * 0.125, g.H * 0.2) : Math.min(g.W * 0.27, 200)) : 0;

  return (
    <section
      id="top"
      ref={sectionRef}
      className={reduce ? "relative" : "relative h-[250svh] lg:h-[260vh]"}
      aria-label="Welcome"
    >
      <div ref={stageRef} className="sticky top-0 h-[100svh] min-h-[600px] w-full overflow-hidden bg-cream">
        {/* soft light in the empty corners */}
        <div className="pointer-events-none absolute -right-32 top-16 h-[460px] w-[460px] rounded-full bg-champagne/50 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-40 bottom-0 h-[360px] w-[360px] rounded-full bg-honey/15 blur-3xl" aria-hidden="true" />
        {/* a warm halo that gathers behind her as the board forms */}
        {!reduce && target && (
          <motion.div
            className="pointer-events-none absolute rounded-full bg-champagne/60 blur-3xl"
            style={{ left: target.cx - target.h * 0.7, top: target.cy - target.h * 0.7, width: target.h * 1.4, height: target.h * 1.4, opacity: glow }}
            aria-hidden="true"
          />
        )}

        {/* Her work, dealt out from behind her */}
        {!reduce && target && g && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {fan.map((c, i) =>
              "wide" in c && c.wide && g.W < 1280 ? null : (
                <FanCard key={c.image} i={i} progress={scrollYProgress} cx={target.cx} cy={target.cy} w={cardW} dx={c.x * g.W} dy={c.y * g.H} r={c.r} image={c.image} widths={[...c.widths]} />
              ),
            )}
          </div>
        )}

        {/* Oshi, in the capsule. Hidden until the slot is measured. */}
        <motion.div
          className={`absolute z-10 ${g ? "" : "invisible"}`}
          style={{
            left: g?.slot.x ?? 0,
            top: g?.slot.y ?? 0,
            width: g?.slot.w ?? 0,
            height: g?.slot.h ?? 0,
            ...(reduce ? { x: 0, y: 0, scale: 1 } : { x: capX, y: capY, scale: capScale }),
          }}
          data-qa="layered"
        >
          <motion.div className="capsule absolute -inset-[10px] border border-cocoa/35" style={{ opacity: reduce ? 1 : ringOpacity }} aria-hidden="true" />
          <div className="capsule relative h-full w-full overflow-hidden bg-sand shadow-[0_40px_80px_-40px_rgba(35,25,21,0.55)]">
            <Img
              name="oshi-hallway"
              widths={[480, 800, 1200, 1320]}
              sizes="(min-width:1024px) 420px, 70vw"
              priority
              alt="Oshi Dias smiling in the hallway outside her suite in Oakleigh, under a glowing brass lamp"
              className="h-full w-full origin-bottom scale-[1.18] object-cover"
              style={{ objectPosition: "50% 62%" }}
            />
          </div>
        </motion.div>

        {/* Opening layout */}
        <motion.div
          className="relative z-20 mx-auto grid h-full max-w-[1440px] grid-rows-[auto_1fr_auto] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[84px] md:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:grid-rows-1 lg:gap-16 lg:pb-12 lg:pt-28 xl:px-24"
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
                    Confident <em className="text-caramel">you.</em>
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
              Colour and Nanoplasty for dark, thick hair by {SITE.fullName} — one client at a time, in her private suite in {SITE.suburbShort}.
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

          {/* The capsule slot: an empty box the capsule starts from. */}
          <div className="relative flex min-h-0 items-stretch justify-center py-5 lg:py-0 lg:pb-4">
            <div ref={slotRef} className="relative h-full w-[min(64%,300px)] sm:w-[min(52%,330px)] lg:h-[min(78vh,780px)] lg:w-[min(100%,400px)] lg:self-end">
              <div className="absolute -bottom-3 -left-14 z-10 hidden sm:block lg:-left-20 lg:bottom-12">
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

        {/* Once the board has formed — a scene that only exists with motion on */}
        {!reduce && (
          <motion.div
            className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-w-[1120px] flex-col items-center px-5 pb-[max(2.25rem,env(safe-area-inset-bottom))] text-center lg:pb-12"
            style={{ opacity: outroOpacity, y: outroY, pointerEvents: outroEvents }}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-caramel">{SITE.values.join(" · ")}</p>
            <p className="mt-3 max-w-[16ch] font-display text-[clamp(32px,8.6vw,44px)] font-light leading-[1.02] text-ink lg:max-w-none lg:whitespace-nowrap lg:text-[clamp(40px,4.2vw,64px)]">
              Beautiful hair starts with <em className="text-caramel">honesty.</em>
            </p>
            <p className="mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-mocha [@media(max-height:760px)]:hidden md:text-[15.5px]">
              “I’ll always explain the process, protect the health of your hair and create a result that works for your lifestyle — not just for the photo.” <span className="whitespace-nowrap text-caramel">— {SITE.founder}</span>
            </p>
            <a href="#oshi" className="btn-primary sheen mt-6" tabIndex={-1}>
              Meet Oshi <ArrowDown size={16} strokeWidth={1.8} />
            </a>
          </motion.div>
        )}

        {/* scroll cue */}
        {!reduce && (
          <motion.div
            className="pointer-events-none absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-2 lg:flex"
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

/** One photo of her work, sliding out from behind the capsule to its place on the board. */
function FanCard({
  i,
  progress,
  cx,
  cy,
  w,
  dx,
  dy,
  r,
  image,
  widths,
}: {
  i: number;
  progress: MotionValue<number>;
  cx: number;
  cy: number;
  w: number;
  dx: number;
  dy: number;
  r: number;
  image: string;
  widths: number[];
}) {
  const h = w * 1.34;
  const start = 0.2 + i * 0.045;
  const t = (v: number) => easeOut(clamp01((v - start) / 0.3));
  // after it lands, a slow drift in towards her so the board never feels frozen
  const drift = (v: number) => clamp01((v - 0.62) / 0.38);
  const pull = -Math.sign(dy || 1) * (12 + (i % 3) * 6);
  const x = useTransform(progress, (v) => dx * t(v));
  const y = useTransform(progress, (v) => dy * t(v) + drift(v) * pull);
  const rotate = useTransform(progress, (v) => r * t(v));
  const scale = useTransform(progress, (v) => lerp(0.55, 1, t(v)));
  const opacity = useTransform(progress, (v) => clamp01(t(v) * 2.5));
  return (
    <motion.div
      className="absolute overflow-hidden rounded-t-full bg-sand shadow-[0_30px_60px_-30px_rgba(35,25,21,0.55)] ring-[5px] ring-cream"
      style={{ left: cx - w / 2, top: cy - h / 2, width: w, height: h, x, y, rotate, scale, opacity }}
    >
      <Img name={image} widths={widths} sizes={`${Math.round(w)}px`} alt="" className="h-full w-full object-cover" />
    </motion.div>
  );
}
