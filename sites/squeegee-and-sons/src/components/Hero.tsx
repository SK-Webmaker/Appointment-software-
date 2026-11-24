import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { ArrowDown, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Img } from "./Img";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { openStatus } from "@/lib/slots";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
/** The photo fills a portrait screen by its height, so it needs more pixels there. */
export const HERO_SIZES = "(max-aspect-ratio: 3/2) 150vh, 100vw";
const WIDTHS = [800, 1200, 1600, 2000, 2400];

const SUDS = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 61.8) % 100,
  y: 6 + ((i * 37) % 22),
  s: 8 + ((i * 13) % 20),
}));
const SPARKLES = [
  { x: 18, y: 24, s: 1, at: 0.6 },
  { x: 72, y: 18, s: 0.7, at: 0.63 },
  { x: 84, y: 52, s: 1.1, at: 0.66 },
  { x: 40, y: 44, s: 0.6, at: 0.68 },
  { x: 58, y: 30, s: 0.9, at: 0.7 },
];

/**
 * Opening scene: a kitchen seen through a filthy window — fogged, streaked,
 * someone's written CLEAN ME in the grime. Scroll and a squeegee pulls down
 * the glass, a wave of suds on its blade, leaving it so clear the window
 * seems to vanish; a few glints, then "So clean, you'll walk into it."
 * Two baked photos and a moving clip (an outer layer slides down while the
 * inner counter-slides): transforms and opacity only. Scroll-driven, so it
 * plays for everyone.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const { openSheet } = useBooking();
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => setStatus(openStatus().text), []);
  const { scrollYProgress: p } = useScroll({ target: section, offset: ["start start", "end end"] });

  const wipe = (v: number) => ease(clamp01((v - 0.05) / 0.52));
  const down = useTransform(p, (v) => `${wipe(v) * 100}%`);
  const up = useTransform(p, (v) => `${-wipe(v) * 100}%`);
  const tilt = useTransform(p, (v) => Math.sin(v * 26) * 1.4);
  const bladeOpacity = useTransform(p, [0.04, 0.07, 0.54, 0.6], [0, 1, 1, 0]);
  const intro = useTransform(p, [0.02, 0.12], [1, 0]);
  const introEvents = useTransform(p, (v) => (v > 0.1 ? "none" : "auto"));
  const outro = useTransform(p, [0.64, 0.76], [0, 1]);
  const outroY = useTransform(p, [0.64, 0.78], [40, 0]);
  const outroEvents = useTransform(p, (v) => (v > 0.66 ? "auto" : "none"));
  // Once the scene has scrolled away, stop rendering it.
  const [away, setAway] = useState(false);
  useMotionValueEvent(p, "change", (v) =>
    setAway(v >= 0.999 && window.scrollY > window.innerHeight * 2),
  );

  return (
    <section
      id="top"
      ref={section}
      className="relative isolate h-[260svh] lg:h-[260vh]"
      aria-labelledby="hero-title"
    >
      <div
        className="sticky top-0 h-[100svh] min-h-[600px] w-full overflow-hidden bg-stone"
        style={{ contentVisibility: away ? "hidden" : "visible" }}
      >
        {/* the clean kitchen */}
        <Img
          name="kitchen2"
          widths={WIDTHS}
          sizes={HERO_SIZES}
          alt="A bright, spotless kitchen with a marble island, timber stools and tall windows"
          priority
          className="absolute inset-0 h-full w-full object-cover object-[42%_50%]"
        />

        {/* the dirty glass, wiped away from the top */}
        <motion.div
          className="absolute inset-0 overflow-hidden will-change-transform"
          style={{ y: down }}
          aria-hidden="true"
        >
          <motion.div className="absolute inset-0 will-change-transform" style={{ y: up }}>
            <Img
              name="kitchen2-fog"
              widths={WIDTHS}
              sizes={HERO_SIZES}
              alt=""
              priority
              className="absolute inset-0 h-full w-full object-cover object-[42%_50%]"
            />
            <div className="absolute -bottom-40 -left-40 h-[80vmin] w-[120vmin] bg-[radial-gradient(closest-side,rgb(255_255_255/0.7),transparent)]" />
            <svg
              viewBox="0 0 560 140"
              className="absolute right-[6%] top-[14%] w-[min(56vw,520px)] -rotate-[7deg] max-lg:top-[11%]"
            >
              <text
                x="280"
                y="96"
                textAnchor="middle"
                fontFamily="'Bricolage Grotesque', sans-serif"
                fontWeight="800"
                fontSize="92"
                letterSpacing="4"
                fill="rgb(255 255 255 / 0.55)"
                stroke="rgb(255 255 255 / 0.35)"
                strokeWidth="6"
                strokeLinejoin="round"
              >
                CLEAN ME
              </text>
            </svg>
          </motion.div>
        </motion.div>

        {/* the squeegee, riding the wipe edge */}
        <motion.div
          className="pointer-events-none absolute inset-0 will-change-transform"
          style={{ y: down, opacity: bladeOpacity }}
          aria-hidden="true"
        >
          <motion.div className="absolute inset-x-[-2%] top-0" style={{ rotate: tilt }}>
            {/* handle */}
            <div className="absolute bottom-[10px] left-[61%] h-[34svh] w-[22px] origin-bottom rotate-[10deg] rounded-full bg-[linear-gradient(90deg,#e8b81f,#ffd23f_40%,#ffe58a_55%,#e8b81f)] shadow-[0_10px_20px_-8px_rgba(15,26,51,0.5)] md:w-[28px]" />
            {/* holder and rubber */}
            <div className="absolute -top-[14px] left-0 right-0 h-[16px] rounded-[6px] bg-[linear-gradient(180deg,#5b7cff,#1f45d6_60%,#16329e)] shadow-[0_8px_18px_-6px_rgba(15,26,51,0.55)]" />
            <div className="absolute left-0 right-0 top-[2px] h-[8px] rounded-b-[4px] bg-ink" />
            {/* suds pushed ahead of the blade */}
            {SUDS.map((b, i) => (
              <span
                key={i}
                className="absolute rounded-full border border-white/80 bg-[radial-gradient(circle_at_30%_30%,#fff,rgb(154_215_255/0.55)_45%,rgb(255_255_255/0.25))]"
                style={{ left: `${b.x}%`, top: b.y, width: b.s, height: b.s }}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* glints on the clean glass */}
        {SPARKLES.map((s, i) => (
          <Sparkle key={i} p={p} {...s} />
        ))}

        {/* the opening words, on the dirty glass */}
        <motion.div
          data-qa="layered"
          className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-[1440px] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] will-change-[opacity] md:px-10 lg:pb-14 xl:px-24"
          style={{ opacity: intro, pointerEvents: introEvents }}
        >
          <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-rose">
            <span className="h-2 w-2 rounded-full bg-rose" />{" "}
            {status ?? `Family cleaners since ${SITE.est}`}
          </p>
          <h1
            id="hero-title"
            className="mt-3 max-w-[12ch] text-[clamp(44px,12vw,68px)] leading-[0.92] text-ink lg:text-[clamp(68px,7vw,120px)]"
          >
            Spotless homes, <em className="text-onyx">Eastern Suburbs.</em>
          </h1>
          <p className="mt-4 max-w-[38ch] text-[16px] font-medium leading-relaxed text-ink md:text-[18px]">
            Regular, deep and end-of-lease cleans — and a squeegee for every window. Same family
            since {SITE.est}.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="#quote" className="btn-primary sheen px-6">
              Get a price
            </a>
            <a href={SITE.phoneHref} className="btn-ghost bg-white/60 px-6">
              <Phone size={16} /> {SITE.phone}
            </a>
          </div>
        </motion.div>

        {/* and through the clean glass, the answer */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[linear-gradient(to_top,rgb(15_26_51/0.85),rgb(15_26_51/0.45)_45%,transparent)] will-change-[opacity]"
          style={{ opacity: outro }}
          aria-hidden="true"
        />
        <motion.div
          data-qa="scroll-scene"
          className="absolute inset-x-0 bottom-0 z-30 mx-auto max-w-[1440px] px-5 pb-[max(2.25rem,env(safe-area-inset-bottom))] text-ivory will-change-[transform,opacity] md:px-10 lg:pb-14 xl:px-24"
          style={{ opacity: outro, y: outroY, pointerEvents: outroEvents }}
        >
          <p className="max-w-[13ch] font-display text-[clamp(44px,12vw,68px)] font-extrabold leading-[0.92] tracking-[-0.035em] [font-stretch:88%] lg:text-[clamp(68px,6.8vw,116px)]">
            So clean, you'll <em className="not-italic text-silk">walk into it.</em>
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="#quote" className="btn-honey sheen" tabIndex={-1}>
              Get a price <ArrowDown size={16} strokeWidth={1.8} />
            </a>
            <button
              type="button"
              onClick={() => openSheet()}
              className="btn-ghost-light"
              tabIndex={-1}
            >
              Book a clean
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Sparkle({
  p,
  x,
  y,
  s,
  at,
}: {
  p: ReturnType<typeof useScroll>["scrollYProgress"];
  x: number;
  y: number;
  s: number;
  at: number;
}) {
  const scale = useTransform(p, [at - 0.02, at + 0.02, at + 0.08], [0, s * 1.2, 0]);
  const rotate = useTransform(p, [at - 0.02, at + 0.08], [0, 90]);
  return (
    <motion.svg
      viewBox="0 0 40 40"
      className="pointer-events-none absolute h-12 w-12 will-change-transform"
      style={{ left: `${x}%`, top: `${y}%`, scale, rotate }}
      aria-hidden="true"
    >
      <path
        d="M20 0 C22 14 26 18 40 20 C26 22 22 26 20 40 C18 26 14 22 0 20 C14 18 18 14 20 0Z"
        fill="#fff"
      />
    </motion.svg>
  );
}
