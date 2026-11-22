import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MaskLines } from "./Reveal";
import { mix } from "./NailHand";
import { SITE, shadeOf } from "@/site.config";
import { useBooking } from "@/context/booking";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Shared with the preload in routes/index.tsx so both pick the same file. */
export const HERO_SIZES = "(min-width:1024px) 420px, 70vw";

/** The shades the hero nail wears, in order, as you scroll. */
const REEL = ["Ballet", "Cherry Lacquer", "Lilac", "Midnight", "Butter", "Fuchsia"].map((n) =>
  shadeOf(n)!,
);
const REEL_START = 0.2;
const REEL_END = 0.84;
const SEG = (REEL_END - REEL_START) / REEL.length;

// The almond nail, 200 × 320: tall elliptical tip, softly squared cuticle.
const NAIL = "M18 304 V138 C18 62 70 10 100 10 C130 10 182 62 182 138 V304 Q100 288 18 304 Z";

/**
 * Opening scene: one giant nail. It starts as a photo of a fresh set framed
 * in an almond, beside the promise. Scroll, and the photo melts away to bare
 * lacquer; the nail takes the centre and wears six shades in turn while each
 * name sweeps past behind it, like a perfume ad. Then the line settles:
 * "Ten tiny canvases, painted properly." Every layer moves on transform or
 * opacity only, so it glides on a phone. Scroll-driven, so it plays for
 * everyone — "Reduce motion" included.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { openSheet } = useBooking();
  const { scrollYProgress: p } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  // Wide screens start the nail to the right of the words; phones below them.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const move = (v: number) => easeInOut(clamp01(v / 0.24));
  const nailX = useTransform(p, (v) => `${(1 - move(v)) * 23}vw`);
  const nailY = useTransform(p, (v) => `${(1 - move(v)) * 15}svh`);
  const nailScale = useTransform(p, (v) => 0.82 + 0.18 * move(v));
  const photo = useTransform(p, [0.1, 0.24], [1, 0]);
  const intro = useTransform(p, [0, 0.12], [1, 0]);
  const introY = useTransform(p, [0, 0.16], [0, -50]);
  const introEvents = useTransform(p, (v) => (v > 0.1 ? "none" : "auto"));
  const outro = useTransform(p, [0.84, 0.94], [0, 1]);
  const outroY = useTransform(p, [0.84, 0.96], [40, 0]);
  const outroEvents = useTransform(p, (v) => (v > 0.86 ? "auto" : "none"));
  const counter = useTransform(
    p,
    [REEL_START - 0.02, REEL_START + 0.02, REEL_END - 0.02, REEL_END + 0.03],
    [0, 1, 1, 0],
  );

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative isolate h-[340svh] lg:h-[360vh]"
      aria-labelledby="hero-title"
    >
      <div className="sticky top-0 h-[100svh] min-h-[600px] w-full overflow-hidden bg-ivory">
        {/* the room takes on each shade's light */}
        {REEL.map((s, i) => (
          <Wash key={s.name} p={p} i={i} hex={s.hex} />
        ))}

        {/* each shade's name, sweeping past behind the nail */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          {REEL.map((s, i) => (
            <Name key={s.name} p={p} i={i} name={s.name} hex={s.hex} />
          ))}
        </div>

        {/* the nail */}
        <div className="absolute inset-0 flex items-center justify-center" data-qa="layered">
          <motion.div
            className="relative h-[min(46svh,96vw)] w-[calc(min(46svh,96vw)*0.625)] will-change-transform lg:h-[56svh] lg:w-[35svh]"
            style={
              wide ? { x: nailX, y: 0, scale: nailScale } : { x: 0, y: nailY, scale: nailScale }
            }
          >
            <NailLayers p={p} photo={photo} />
          </motion.div>
        </div>

        {/* shade counter */}
        <motion.p
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink/70 will-change-[opacity]"
          style={{ opacity: counter }}
          aria-hidden="true"
        >
          Six shades from the bar · keep scrolling
        </motion.p>

        {/* Opening words */}
        <motion.div
          className="absolute inset-0 z-20 mx-auto flex max-w-[1440px] flex-col justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[88px] will-change-[transform,opacity] md:px-10 lg:justify-center lg:pb-12 lg:pt-24 xl:px-24"
          style={{ opacity: intro, y: introY, pointerEvents: introEvents }}
        >
          <div className="lg:max-w-[46%]">
            <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-onyx md:text-[11.5px]">
              <span className="h-2 w-2 rounded-full bg-rose" />
              {SITE.role} · {SITE.area}, {SITE.city}
            </p>
            <h1
              id="hero-title"
              className="mt-4 text-[clamp(44px,12vw,64px)] leading-[0.98] text-ink lg:mt-7 lg:text-[clamp(64px,6.4vw,112px)]"
            >
              <MaskLines
                animateOnMount
                delay={1.3}
                lines={[<>Nails worth</>, <>showing</>, <em className="text-rose">off.</em>]}
              />
            </h1>
            <p className="mt-5 max-w-[34ch] text-[16px] leading-relaxed text-ash max-lg:hidden lg:text-[18px]">
              Gel, BIAB, Gel-X and nail art in {SITE.area} — and a shade bar where you try the
              colour on before you sit down. From {SITE.from}.
            </p>
            <div className="mt-10 flex flex-wrap gap-4 max-lg:hidden">
              <button onClick={() => openSheet()} className="btn-primary sheen whitespace-nowrap">
                Book now <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <a href="#shades" className="btn-ghost whitespace-nowrap">
                Try a shade
              </a>
            </div>
          </div>
          <div className="flex gap-3 lg:hidden">
            <button onClick={() => openSheet()} className="btn-primary sheen flex-1 px-4">
              Book now
            </button>
            <a href="#shades" className="btn-ghost flex-1 px-4">
              Try a shade
            </a>
          </div>
        </motion.div>

        {/* The line, once the reel has run */}
        <motion.div
          data-qa="scroll-scene"
          className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-w-[1120px] flex-col items-center px-5 pb-[max(2.25rem,env(safe-area-inset-bottom))] text-center will-change-[transform,opacity] lg:pb-12"
          style={{ opacity: outro, y: outroY, pointerEvents: outroEvents }}
        >
          <p className="font-display text-[clamp(34px,9.6vw,52px)] leading-[1.04] text-ink lg:text-[clamp(48px,4.8vw,78px)]">
            Ten tiny canvases, <em className="text-rose">painted properly.</em>
          </p>
          <a href="#shades" className="btn-primary sheen mt-6" tabIndex={-1}>
            Find your shade <ArrowDown size={16} strokeWidth={1.8} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/** When shade i is on: 0 → 1 → 0 across its stretch of the reel (the last one stays). */
function window01(v: number, i: number) {
  const a = REEL_START + i * SEG;
  const fadeIn = clamp01((v - (a - SEG * 0.35)) / (SEG * 0.35));
  const fadeOut = i === REEL.length - 1 ? 1 : 1 - clamp01((v - (a + SEG * 0.8)) / (SEG * 0.35));
  return i === 0 ? Math.min(clamp01((v - 0.08) / 0.12), fadeOut) : Math.min(fadeIn, fadeOut);
}

function Wash({ p, i, hex }: { p: MotionValue<number>; i: number; hex: string }) {
  const o = useTransform(p, (v) => window01(v, i) * 0.9);
  return (
    <motion.div
      className="absolute inset-0 will-change-[opacity]"
      style={{
        opacity: o,
        background: `radial-gradient(60% 55% at 50% 50%, ${mix(hex, "#ffffff", 0.55)}, ${mix(hex, "#f7f2ef", 0.86)} 70%)`,
      }}
      aria-hidden="true"
    />
  );
}

function Name({ p, i, name, hex }: { p: MotionValue<number>; i: number; name: string; hex: string }) {
  const a = REEL_START + i * SEG;
  const x = useTransform(p, [a - SEG * 0.1, a + SEG * 1.05], ["34vw", "-34vw"]);
  // One name at a time: in after the last has gone, out before the next arrives.
  const o = useTransform(p, [a, a + SEG * 0.18, a + SEG * 0.78, a + SEG * 0.95], [0, 1, 1, i === REEL.length - 1 ? 1 : 0]);
  return (
    <motion.span
      className="absolute whitespace-nowrap font-display text-[clamp(84px,24vw,340px)] italic leading-none will-change-[transform,opacity]"
      style={{ x, opacity: o, color: mix(hex, "#24161a", 0.18) }}
    >
      {name}
    </motion.span>
  );
}

/** The nail itself: a photo of a set, then a lacquer layer per shade, then the shine. */
function NailLayers({ p, photo }: { p: MotionValue<number>; photo: MotionValue<number> }) {
  return (
    <>
      {/* soft shadow under the nail */}
      <div
        className="absolute inset-x-[8%] -bottom-[4%] h-[12%] rounded-[50%] bg-ink/25 blur-xl"
        aria-hidden="true"
      />
      {REEL.map((s, i) => (
        <Lacquer key={s.name} p={p} i={i} hex={s.hex} />
      ))}
      <motion.svg
        viewBox="0 0 200 320"
        className="absolute inset-0 h-full w-full will-change-[opacity]"
        style={{ opacity: photo }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id="hero-nail">
            <path d={NAIL} />
          </clipPath>
        </defs>
        <rect width="200" height="320" fill="#ece3df" clipPath="url(#hero-nail)" />
        <image
          href="/images/white-800.webp"
          x="-40"
          y="0"
          width="280"
          height="350"
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#hero-nail)"
        />
      </motion.svg>
      {/* the shine: one long highlight and a rim, the same on every shade */}
      <svg
        viewBox="0 0 200 320"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hero-shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hero-edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000000" stopOpacity="0.22" />
            <stop offset="0.3" stopColor="#000000" stopOpacity="0" />
            <stop offset="0.75" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        <path d={NAIL} fill="url(#hero-edge)" />
        <path
          d="M52 70 C60 44 76 30 88 26 C78 44 70 70 66 120 L60 210 C52 190 46 120 52 70 Z"
          fill="url(#hero-shine)"
        />
        <path d={NAIL} fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
      </svg>
    </>
  );
}

function Lacquer({ p, i, hex }: { p: MotionValue<number>; i: number; hex: string }) {
  // Each coat stays on once painted, so the next simply goes over it.
  const a = REEL_START + i * SEG;
  const o = useTransform(p, (v) => (i === 0 ? 1 : clamp01((v - (a - SEG * 0.35)) / (SEG * 0.35))));
  return (
    <motion.svg
      viewBox="0 0 200 320"
      className="absolute inset-0 h-full w-full will-change-[opacity]"
      style={{ opacity: o }}
      aria-hidden="true"
    >
      <path d={NAIL} fill={hex} />
    </motion.svg>
  );
}
