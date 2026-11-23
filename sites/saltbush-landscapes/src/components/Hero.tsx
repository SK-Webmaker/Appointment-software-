import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowDown, Phone } from "lucide-react";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { openStatus } from "@/lib/slots";
import { PlantArt, type PlantKind } from "./PlantArt";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** The garden, back to front. left = centre (% of width), h = % of the bed's height. */
const BED: {
  kind: PlantKind;
  left: number;
  h: number;
  start: number;
  seed: number;
  phone?: boolean;
}[] = [
  { kind: "gum", left: 76, h: 100, start: 0.05, seed: 0.06 },
  { kind: "grasstree", left: 13, h: 64, start: 0.1, seed: 0.1 },
  { kind: "banksia", left: 42, h: 36, start: 0.18, seed: 0.12 },
  { kind: "paw", left: 27, h: 48, start: 0.14, seed: 0.1 },
  { kind: "grevillea", left: 63, h: 30, start: 0.22, seed: 0.12 },
  { kind: "paw", left: 55, h: 40, start: 0.26, seed: 0.1, phone: false },
  { kind: "saltbush", left: 3, h: 22, start: 0.2, seed: 0.2 },
  { kind: "saltbush", left: 90, h: 26, start: 0.3, seed: 0.2 },
  { kind: "lomandra", left: 20, h: 18, start: 0.12, seed: 0.3 },
  { kind: "lomandra", left: 49, h: 16, start: 0.28, seed: 0.3 },
  { kind: "lomandra", left: 97, h: 20, start: 0.34, seed: 0.3, phone: false },
  { kind: "cushion", left: 34, h: 11, start: 0.3, seed: 0.3 },
  { kind: "cushion", left: 82, h: 12, start: 0.36, seed: 0.3 },
  { kind: "rock", left: 46, h: 9, start: -1, seed: 1 },
  { kind: "rock", left: 9, h: 7, start: -1, seed: 1 },
];
const GROW = 0.26;

const STARS = Array.from({ length: 36 }, (_, i) => ({
  x: (i * 37.7) % 100,
  y: (i * 23.3) % 44,
  s: 1 + (i % 3) * 0.6,
}));

/**
 * Opening scene: a day in a garden. It's dawn over the Hills and the bed is
 * bare dirt and a couple of sandstone rocks. Scroll and the sun crosses the
 * sky while a native garden grows — tufts of mat rush, kangaroo paws,
 * a banksia in flower, a grass tree, a gum — until it's dusk and the first
 * stars are out. Transforms and opacity only. Scroll-driven, so it plays
 * for everyone.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const { openSheet } = useBooking();
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => setStatus(openStatus().text), []);
  const { scrollYProgress: p } = useScroll({ target: section, offset: ["start start", "end end"] });

  const day = (v: number) => clamp01(v / 0.72);
  const sunX = useTransform(p, (v) => `${6 + day(v) * 80}vw`);
  const sunY = useTransform(p, (v) => `${-Math.sin(Math.PI * day(v)) * 46}svh`);
  const noon = useTransform(p, [0.06, 0.3], [0, 1]);
  const dusk = useTransform(p, [0.46, 0.7], [0, 1]);
  const shade = useTransform(p, [0.52, 0.76], [0, 0.45]);
  const stars = useTransform(p, [0.64, 0.8], [0, 1]);
  const intro = useTransform(p, [0.02, 0.13], [1, 0]);
  const introEvents = useTransform(p, (v) => (v > 0.1 ? "none" : "auto"));
  const outro = useTransform(p, [0.62, 0.74], [0, 1]);
  const outroY = useTransform(p, [0.62, 0.76], [40, 0]);
  const outroEvents = useTransform(p, (v) => (v > 0.64 ? "auto" : "none"));
  // Once the scene has scrolled away, skip rendering it: its twenty-odd
  // layers would otherwise be re-layered on every frame further down the page.
  const [away, setAway] = useState(false);
  useMotionValueEvent(p, "change", (v) =>
    setAway(v >= 0.999 && window.scrollY > window.innerHeight * 2.5),
  );

  return (
    <section
      id="top"
      ref={section}
      className="relative isolate h-[300svh] lg:h-[300vh]"
      aria-labelledby="hero-title"
    >
      <div
        className="sticky top-0 h-[100svh] min-h-[600px] w-full overflow-hidden bg-[linear-gradient(to_bottom,#efcfae,#f5e4cc_45%,#f4f1ea_72%)]"
        style={{ contentVisibility: away ? "hidden" : "visible" }}
      >
        {/* the sky: dawn underneath, then midday, then dusk over the top */}
        <Layer
          o={noon}
          className="bg-[linear-gradient(to_bottom,#c9dcd8,#e8ece2_55%,#f4f1ea_75%)]"
        />
        <Layer
          o={dusk}
          className="bg-[linear-gradient(to_bottom,#1f2536,#3e3449_34%,#a9634a_62%,#e3a65a_76%)]"
        />
        <motion.div
          className="pointer-events-none absolute inset-0 will-change-[opacity]"
          style={{ opacity: stars }}
          aria-hidden="true"
        >
          {STARS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-[#fff6dc]"
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s * 2, height: s.s * 2 }}
            />
          ))}
        </motion.div>

        {/* the sun */}
        <motion.div
          className="pointer-events-none absolute left-0 top-[66svh] -ml-[11vmin] -mt-[11vmin] h-[22vmin] w-[22vmin] rounded-full bg-[radial-gradient(closest-side,#fff3c8,#ffe1a0_38%,rgb(255_210_140/0.35)_60%,transparent)] will-change-transform"
          style={{ x: sunX, y: sunY }}
          aria-hidden="true"
        />

        {/* the ridge of the Hills, then the bed */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[22svh] h-[14svh] lg:bottom-[20svh]"
          aria-hidden="true"
        >
          <Ridge fill="#a5b096" />
          <Layer o={dusk}>
            <Ridge fill="#3a3647" />
          </Layer>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[26svh] lg:h-[24svh]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 1440 300" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="earth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#b98a55" />
                <stop offset="1" stopColor="#6e4826" />
              </linearGradient>
            </defs>
            <path d="M0 34 C260 12 520 40 760 26 S1200 10 1440 30 V300 H0 Z" fill="url(#earth)" />
            <path
              d="M0 120 C300 100 640 132 980 112 S1300 104 1440 116"
              stroke="#a0733f"
              strokeWidth="5"
              fill="none"
              opacity="0.55"
            />
            <path
              d="M0 196 C360 182 700 210 1040 190 S1340 186 1440 194"
              stroke="#8a5f32"
              strokeWidth="6"
              fill="none"
              opacity="0.55"
            />
            {Array.from({ length: 26 }, (_, i) => (
              <ellipse
                key={i}
                cx={(i * 211) % 1440}
                cy={60 + ((i * 97) % 220)}
                rx={6 + (i % 4) * 3}
                ry={3 + (i % 3)}
                fill={i % 2 ? "#c99a5b" : "#7d5530"}
                opacity="0.6"
              />
            ))}
          </svg>
        </div>

        {/* the garden */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[21svh] h-[50svh] lg:bottom-[19svh] lg:h-[62svh]"
          aria-hidden="true"
        >
          {BED.map((b, i) => (
            <Grow key={i} p={p} away={away} {...b} />
          ))}
        </div>

        {/* dusk settles over the garden */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-noir will-change-[opacity]"
          style={{ opacity: shade }}
          aria-hidden="true"
        />

        {/* the opening words, at dawn */}
        <motion.div
          className="absolute inset-x-0 top-0 z-20 mx-auto max-w-[1440px] px-5 pt-[96px] will-change-[opacity] md:px-10 lg:pt-32 xl:px-24"
          style={{ opacity: intro, pointerEvents: introEvents }}
        >
          <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-rose">
            <span className="h-2 w-2 rounded-full bg-rose" />{" "}
            {status ?? `${SITE.role} since ${SITE.est}`}
          </p>
          <h1
            id="hero-title"
            className="mt-4 max-w-[13ch] text-[clamp(42px,11.5vw,66px)] leading-[0.98] text-ink lg:text-[clamp(64px,6.8vw,116px)]"
          >
            Gardens that <em className="text-rose">belong here.</em>
          </h1>
          <p className="mt-5 max-w-[36ch] text-[16px] leading-relaxed text-ink md:text-[18px]">
            Native gardens for Sydney's {SITE.area} — planted for our clay, our summers and our
            birds.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => openSheet()} className="btn-primary sheen px-6">
              Book a free visit
            </button>
            <a href={SITE.phoneHref} className="btn-ghost px-6">
              <Phone size={16} /> {SITE.phone}
            </a>
          </div>
        </motion.div>

        {/* and at dusk, the answer */}
        <motion.div
          data-qa="scroll-scene"
          className="absolute inset-x-0 top-0 z-30 mx-auto max-w-[1440px] px-5 pt-[104px] text-ivory will-change-[transform,opacity] md:px-10 lg:pt-36 xl:px-24"
          style={{ opacity: outro, y: outroY, pointerEvents: outroEvents }}
        >
          <p className="max-w-[15ch] font-display text-[clamp(40px,11vw,64px)] leading-[0.98] lg:text-[clamp(64px,6.4vw,108px)]">
            Plant it once. <em className="text-silk">Let the weather do the rest.</em>
          </p>
          <a href="#plants" className="btn-honey sheen mt-7" tabIndex={-1}>
            Find your plants <ArrowDown size={16} strokeWidth={1.8} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function Layer({
  o,
  className = "",
  children,
}: {
  o: MotionValue<number>;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <motion.div
      className={`pointer-events-none absolute inset-0 will-change-[opacity] ${className}`}
      style={{ opacity: o }}
      aria-hidden="true"
    >
      {children}
    </motion.div>
  );
}

function Ridge({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="h-full w-full">
      <path
        d="M0 120 C40 96 70 104 96 88 C120 70 150 84 170 74 C200 58 230 80 262 70 C300 56 320 30 360 44 C392 56 410 40 440 50 C480 64 500 92 540 86 C580 80 600 58 640 62 C680 66 700 96 744 92 C790 88 800 60 840 56 C880 52 900 72 936 70 C980 66 990 40 1030 36 C1070 32 1090 60 1124 64 C1160 68 1180 50 1216 56 C1252 62 1270 86 1310 84 C1350 82 1370 64 1404 70 C1424 74 1434 80 1440 82 V200 H0 Z"
        fill={fill}
      />
    </svg>
  );
}

function Grow({
  p,
  kind,
  left,
  h,
  start,
  seed,
  phone = true,
  away,
}: {
  p: MotionValue<number>;
  kind: PlantKind;
  left: number;
  h: number;
  start: number;
  seed: number;
  phone?: boolean;
  away: boolean;
}) {
  const t = (v: number) =>
    start < 0 ? 1 : seed + (1 - seed) * easeOut(clamp01((v - start) / GROW));
  const scaleY = useTransform(p, t);
  const scaleX = useTransform(p, (v) => 0.55 + 0.45 * t(v));
  return (
    <div
      className={`absolute bottom-0 -translate-x-1/2 ${phone ? "" : "max-md:hidden"}`}
      style={{ left: `${left}%`, height: `${h}%` }}
    >
      <motion.div
        className={`h-full origin-bottom ${away ? "" : "will-change-transform"}`}
        style={start < 0 ? {} : { scaleY, scaleX }}
      >
        <PlantArt kind={kind} className="h-full w-auto" />
      </motion.div>
    </div>
  );
}
