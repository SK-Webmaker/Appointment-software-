import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useRef } from "react";
import { Img } from "./Img";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Shared with the preload in routes/index.tsx so both pick the same file. */
// A landscape photo filling a portrait screen renders at 1.5× the screen height.
export const HERO_SIZES = "(max-aspect-ratio: 3/2) 150vh, 100vw";

/**
 * Opening scene: the polish pass. The car sits in the dark bay looking tired
 * — flat, hazy, swirled. Scroll, and a polishing line of light sweeps across
 * from left to right; behind it the paint comes up deep and wet, and a
 * reflection slides over the finished side. Two layers of the same photo:
 * the dull one is a clipped layer sliding right while its photo slides left
 * by the same amount — transforms only, so the pass is silky on a phone.
 * Scroll-driven, so it plays for everyone — "Reduce motion" included.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const { openSheet } = useBooking();
  const { scrollYProgress: p } = useScroll({ target: section, offset: ["start start", "end end"] });

  const pass = (v: number) => easeInOut(clamp01((v - 0.06) / 0.5));
  const cover = useTransform(p, (v) => `${pass(v) * 100}%`);
  const counter = useTransform(p, (v) => `${-pass(v) * 100}%`);
  const lineOpacity = useTransform(p, [0.02, 0.06, 0.54, 0.6], [0, 1, 1, 0]);
  const streak = useTransform(p, [0.4, 0.85], ["-60%", "160%"]);
  const intro = useTransform(p, [0, 0.1], [1, 0]);
  const introEvents = useTransform(p, (v) => (v > 0.08 ? "none" : "auto"));
  const outro = useTransform(p, [0.58, 0.72], [0, 1]);
  const outroY = useTransform(p, [0.58, 0.74], [40, 0]);
  const outroEvents = useTransform(p, (v) => (v > 0.6 ? "auto" : "none"));
  const shade = useTransform(p, [0.55, 0.72], [0, 1]);

  return (
    <section
      id="top"
      ref={section}
      className="relative isolate h-[260svh] lg:h-[280vh]"
      aria-labelledby="hero-title"
    >
      <div className="sticky top-0 h-[100svh] min-h-[560px] w-full overflow-hidden bg-noir text-ivory">
        {/* after: the finished paint, with a reflection gliding over it */}
        <div className="absolute inset-0" data-qa="layered">
          <Img
            name="hero"
            widths={[800, 1200, 1600, 2000, 2400]}
            sizes={HERO_SIZES}
            priority
            alt="A red sports car under strip lights in a dark garage, its paint deep and glossy"
            className="h-full w-full object-cover"
            style={{ objectPosition: "50% 60%" }}
          />
          <motion.div
            className="pointer-events-none absolute inset-y-0 left-0 w-[45%] -skew-x-[18deg] bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.16)_45%,rgb(255_255_255/0.28)_50%,rgb(255_255_255/0.16)_55%,transparent)] will-change-transform"
            style={{ x: streak }}
            aria-hidden="true"
          />
        </div>

        {/* before: the same car, tired — clipped, and wiped away by the pass */}
        <motion.div
          className="absolute inset-0 overflow-hidden will-change-transform"
          style={{ x: cover }}
          aria-hidden="true"
        >
          <motion.div className="absolute inset-0 will-change-transform" style={{ x: counter }}>
            <Img
              name="hero-dull"
              widths={[800, 1200, 1600, 2000, 2400]}
              sizes={HERO_SIZES}
              alt=""
              className="h-full w-full object-cover"
              style={{
                objectPosition: "50% 60%"
              }}
            />
            {/* haze and swirl marks */}
            <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_45%,rgb(200_205_215/0.22),rgb(8_9_12/0.35))]" />
            <svg
              className="absolute inset-0 h-full w-full opacity-[0.1]"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              {Array.from({ length: 22 }, (_, i) => (
                <circle
                  key={i}
                  cx={30 + ((i * 37) % 45)}
                  cy={35 + ((i * 23) % 40)}
                  r={4 + ((i * 7) % 14)}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="0.08"
                />
              ))}
            </svg>
          </motion.div>
          {/* the polishing line, riding the edge of the pass */}
          <motion.span
            className="absolute inset-y-0 left-0 w-[3px] iri-bg shadow-[0_0_30px_6px_rgb(179_168_255/0.55)]"
            style={{ opacity: lineOpacity }}
          />
          <motion.span
            className="absolute left-3 top-[calc(50%-14px)] rounded-full bg-noir/70 px-3 py-1.5 font-display text-[10px] tracking-[0.2em] text-ivory/80 backdrop-blur-sm"
            style={{ opacity: lineOpacity }}
          >
            Before
          </motion.span>
        </motion.div>

        <motion.div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(8_9_12/0.92)_10%,rgb(8_9_12/0.35)_55%,transparent)] will-change-[opacity]"
          style={{ opacity: shade }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[linear-gradient(to_bottom,rgb(8_9_12/0.8),transparent)]"
          aria-hidden="true"
        />

        {/* opening words */}
        <motion.div
          className="absolute inset-0 z-20 mx-auto flex max-w-[1440px] flex-col justify-between px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[92px] will-change-[opacity] md:px-10 lg:pb-12 lg:pt-28 xl:px-24"
          style={{ opacity: intro, pointerEvents: introEvents }}
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-ivory/75">
              {SITE.role} · {SITE.area}, {SITE.city} · or at your place
            </p>
            <h1
              id="hero-title"
              className="mt-5 max-w-[18ch] text-[clamp(30px,7.6vw,46px)] leading-[1.12] lg:text-[clamp(46px,4.6vw,76px)]"
            >
              <span className="sr-only">{SITE.name}: </span>
              Scroll to <em>polish.</em>
            </h1>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-[34ch] text-[15.5px] leading-relaxed text-ivory/80">
              Paint correction, ceramic coating and interior details in a dark studio built for
              seeing every swirl. From {SITE.from}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => openSheet()}
                className="btn-primary sheen flex-1 whitespace-nowrap px-4 sm:flex-none sm:px-5"
              >
                Book a bay <ArrowRight size={16} strokeWidth={1.8} className="max-sm:hidden" />
              </button>
              <a
                href="#build"
                className="btn-ghost-light flex-1 whitespace-nowrap px-4 sm:flex-none sm:px-5"
              >
                <span className="sm:hidden">Build one</span>
                <span className="max-sm:hidden">Build a detail</span>
              </a>
            </div>
          </div>
        </motion.div>

        {/* after the pass */}
        <motion.div
          data-qa="scroll-scene"
          className="absolute inset-0 z-30 mx-auto flex max-w-[1440px] flex-col justify-end px-5 pb-[max(2.25rem,env(safe-area-inset-bottom))] will-change-[transform,opacity] md:px-10 lg:pb-14 xl:px-24"
          style={{ opacity: outro, y: outroY, pointerEvents: outroEvents }}
        >
          <p className="font-display text-[clamp(13px,3.4vw,20px)] tracking-[0.3em] text-ivory/80">
            {SITE.name}
          </p>
          <p className="mt-4 max-w-[16ch] font-display text-[clamp(34px,9vw,56px)] uppercase leading-[1.08] lg:text-[clamp(56px,5.6vw,96px)]">
            Gloss is a <em>decision.</em>
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a href="#build" className="btn-primary sheen self-start" tabIndex={-1}>
              Build yours <ArrowDown size={16} strokeWidth={1.8} />
            </a>
            <p className="max-w-[44ch] text-[14.5px] leading-relaxed text-ivory/80">
              That's one pass of a polisher, scrolled. Swirls out, depth back, sealed in.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
