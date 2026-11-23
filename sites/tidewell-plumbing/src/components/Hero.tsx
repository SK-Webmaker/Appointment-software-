import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { openStatus } from "@/lib/slots";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const HERO_SIZES = "100vw";

const IMPACT = 0.34;
const SPLASH = [
  { x: -46, y: -90, s: 1 },
  { x: -18, y: -130, s: 0.8 },
  { x: 12, y: -150, s: 0.9 },
  { x: 40, y: -110, s: 0.7 },
  { x: 64, y: -70, s: 0.6 },
  { x: -70, y: -50, s: 0.6 },
];

/**
 * Opening scene: one drop. It swells at the spout of a tap, then — as you
 * scroll — lets go, stretches as it falls and hits the water with a crown
 * of spray and rings that spread to the edges. The answer comes up out of
 * the water: "Little leak or big one, we're on our way." Transforms and
 * opacity only. Scroll-driven, so it plays for everyone.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const { openSheet } = useBooking();
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => setStatus(openStatus().text), []);
  const { scrollYProgress: p } = useScroll({ target: section, offset: ["start start", "end end"] });
  // How far the drop falls from the spout to the water: the layout differs on wide screens.
  const dist = useRef(19);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => (dist.current = mq.matches ? 34 : 19);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const fall = (v: number) => clamp01((v - 0.04) / (IMPACT - 0.04));
  const dropY = useTransform(p, (v) => `${Math.pow(fall(v), 2) * dist.current}svh`);
  const dropStretch = useTransform(p, (v) => 1 + Math.sin(Math.PI * fall(v)) * 0.35);
  const dropOpacity = useTransform(p, (v) => (v < IMPACT ? 1 : 0));
  const intro = useTransform(p, [0.02, 0.14], [1, 0]);
  const introEvents = useTransform(p, (v) => (v > 0.1 ? "none" : "auto"));
  const outro = useTransform(p, [0.5, 0.64], [0, 1]);
  const outroY = useTransform(p, [0.5, 0.66], [50, 0]);
  const outroEvents = useTransform(p, (v) => (v > 0.52 ? "auto" : "none"));
  const rise = useTransform(p, [IMPACT, 0.7], ["0svh", "-14svh"]);

  return (
    <section
      id="top"
      ref={section}
      className="relative isolate h-[250svh] lg:h-[260vh]"
      aria-labelledby="hero-title"
    >
      <div className="sticky top-0 h-[100svh] min-h-[600px] w-full overflow-hidden bg-[linear-gradient(to_bottom,#f3f6f1,#e9f1ec)]">
        {/* the sun on the water */}
        <div
          className="pointer-events-none absolute right-[-10%] top-[8%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(closest-side,rgb(255_181_159/0.45),transparent)]"
          aria-hidden="true"
        />

        {/* headline, in the air */}
        <motion.div
          className="absolute inset-x-0 top-0 z-20 mx-auto max-w-[1440px] px-5 pt-[96px] will-change-[opacity] md:px-10 lg:pt-32 xl:px-24"
          style={{ opacity: intro, pointerEvents: introEvents }}
        >
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-onyx">
            <span className="h-2 w-2 rounded-full bg-onyx" />{" "}
            {status ?? `${SITE.role} since ${SITE.est}`}
          </p>
          <h1
            id="hero-title"
            className="mt-4 max-w-[12ch] text-[clamp(40px,11vw,64px)] leading-[0.98] text-ink lg:max-w-[11ch] lg:text-[clamp(64px,6.6vw,112px)]"
          >
            Plumbing for the <em className="text-rose">Northern Beaches.</em>
          </h1>
        </motion.div>

        {/* the tap and its drop */}
        <div
          className="pointer-events-none absolute left-[72%] top-[16%] z-10 -translate-x-1/2 max-lg:left-[78%] max-lg:top-[38%]"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 160 120"
            className="relative -left-[54px] h-[min(18vh,130px)] w-auto max-lg:h-[90px]"
          >
            <defs>
              <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e9f1ec" />
                <stop offset="0.45" stopColor="#93aaa6" />
                <stop offset="1" stopColor="#4a625f" />
              </linearGradient>
            </defs>
            <rect x="0" y="18" width="36" height="34" rx="8" fill="url(#chrome)" />
            <path
              d="M30 26 H110 Q138 26 138 54 V92 H118 V58 Q118 48 108 48 H30 Z"
              fill="url(#chrome)"
            />
            <rect x="114" y="90" width="28" height="10" rx="3" fill="#4a625f" />
            <rect x="8" y="2" width="20" height="18" rx="4" fill="#4a625f" />
          </svg>
          <motion.div
            className="absolute left-[30px] top-[min(13.5vh,98px)] origin-top will-change-transform max-lg:top-[68px]"
            style={{ y: dropY, scaleY: dropStretch, opacity: dropOpacity }}
          >
            <svg viewBox="0 0 40 56" className="h-11 w-8">
              <defs>
                <radialGradient id="drop" cx="0.35" cy="0.6" r="0.7">
                  <stop offset="0" stopColor="#9fe3d4" />
                  <stop offset="1" stopColor="#0f5c56" />
                </radialGradient>
              </defs>
              <path
                d="M20 2 C20 2 4 26 4 36 a16 16 0 0 0 32 0 C36 26 20 2 20 2Z"
                fill="url(#drop)"
              />
              <ellipse cx="14" cy="34" rx="4" ry="6" fill="#fff" opacity="0.6" />
            </svg>
          </motion.div>
        </div>

        {/* the water */}
        <motion.div
          className="absolute inset-x-0 bottom-0 top-[62%] will-change-transform max-lg:top-[66%]"
          style={{ y: rise }}
          aria-hidden="true"
        >
          <div className="absolute inset-x-0 -top-5 h-6 overflow-hidden">
            <div className="flex h-full w-[200%] animate-wave will-change-transform">
              {[0, 1].map((k) => (
                <svg
                  key={k}
                  viewBox="0 0 1200 24"
                  preserveAspectRatio="none"
                  className="h-full w-1/2"
                >
                  <path d="M0 14 C200 4 400 4 600 14 S1000 24 1200 14 V24 H0 Z" fill="#0f5c56" />
                </svg>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 top-0 h-[140%] bg-[linear-gradient(to_bottom,#0f5c56,#0f2b2a_70%)]" />
          {/* rings and spray where the drop lands */}
          <div className="absolute left-[72%] top-0 max-lg:left-[78%]">
            {[0, 1, 2].map((i) => (
              <Ring key={i} p={p} i={i} />
            ))}
            {SPLASH.map((d, i) => (
              <Spray key={i} p={p} {...d} />
            ))}
          </div>
        </motion.div>

        {/* in the water: the opening buttons, then the answer */}
        <motion.div
          className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-[1440px] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-10 lg:pb-12 xl:px-24"
          style={{ opacity: intro, pointerEvents: introEvents }}
        >
          <p className="max-w-[34ch] text-[15.5px] leading-relaxed text-ivory/90 md:text-[17px]">
            Taps, drains, toilets, hot water and gas — fixed-price, tidy, and on the Beaches since{" "}
            {SITE.est}.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => openSheet()} className="btn-honey sheen px-6">
              Book a plumber
            </button>
            <a href={SITE.phoneHref} className="btn-ghost-light px-6">
              <Phone size={16} /> {SITE.phone}
            </a>
          </div>
        </motion.div>
        <motion.div
          data-qa="scroll-scene"
          className="absolute inset-x-0 bottom-0 z-30 mx-auto max-w-[1440px] px-5 pb-[max(2.25rem,env(safe-area-inset-bottom))] text-ivory will-change-[transform,opacity] md:px-10 lg:pb-14 xl:px-24"
          style={{ opacity: outro, y: outroY, pointerEvents: outroEvents }}
        >
          <p className="max-w-[16ch] font-display text-[clamp(40px,11vw,64px)] font-semibold leading-[0.98] [font-variation-settings:'SOFT'_100,'WONK'_1] lg:text-[clamp(64px,6.4vw,108px)]">
            Little leak or big one, <em className="text-silk">we're on our way.</em>
          </p>
          <a href="#house" className="btn-honey sheen mt-6" tabIndex={-1}>
            Where's the problem? <ArrowDown size={16} strokeWidth={1.8} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function Ring({ p, i }: { p: MotionValue<number>; i: number }) {
  const start = IMPACT + i * 0.05;
  const scale = useTransform(p, [start, start + 0.3], [0.1, 6 + i * 2]);
  const opacity = useTransform(p, [start, start + 0.02, start + 0.3], [0, 0.8, 0]);
  return (
    <motion.span
      className="absolute -left-[60px] -top-[14px] h-[28px] w-[120px] rounded-[50%] border-2 border-pearl will-change-transform"
      style={{ scale, opacity }}
    />
  );
}

function Spray({ p, x, y, s }: { p: MotionValue<number>; x: number; y: number; s: number }) {
  const t = (v: number) => clamp01((v - IMPACT) / 0.12);
  const tx = useTransform(p, (v) => x * t(v));
  const ty = useTransform(p, (v) => y * Math.sin(Math.PI * t(v)));
  const opacity = useTransform(p, (v) => (t(v) > 0 && t(v) < 1 ? 1 : 0));
  return (
    <motion.span
      className="absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full bg-pearl will-change-transform"
      style={{ x: tx, y: ty, scale: s, opacity }}
    />
  );
}
