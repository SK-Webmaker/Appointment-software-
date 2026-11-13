import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { PARTS } from "@/site.config";
import { TUBES } from "./Lamp";
import { ChapterLabel } from "./ChapterLabel";

const N = PARTS.length;
// explode 0.12→0.36, name each part 0.38→0.86, snap back together 0.88→1
const KEYS = [0, 0.12, 0.36, 0.86, 0.98];
const TUBE = TUBES.Loop;
// a few motes of gas inside the loop
const MOTES = [
  [92, 172], [120, 160], [150, 150], [176, 120], [168, 70], [128, 56], [90, 70], [84, 110], [104, 140], [140, 176], [180, 190], [70, 196],
] as const;

/** Moves a part out to `to` while the lamp is apart, home again at the end. */
function useApart(p: MotionValue<number>, to: number) {
  return useTransform(p, KEYS, [0, 0, to, to, 0]);
}

/** Caption i owns its slice of the naming stretch; text hands over, never overlaps. */
function useCaption(p: MotionValue<number>, i: number) {
  const span = (0.86 - 0.38) / N;
  const a = 0.38 + i * span;
  const at = [a, a + 0.02, a + span - 0.02, a + span].map((v) => Math.min(1, Math.max(0, v)));
  return useTransform(p, at, [0, 1, 1, 0]);
}

/**
 * What's inside, pinned: LUMBEND One comes apart into its five parts, the
 * glass goes dark while it's open, each part is named in turn, and then it
 * snaps back together and lights up again.
 */
export function Inside() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const tubeY = useApart(p, -26);
  const tubeR = useApart(p, -6);
  const leftX = useApart(p, -34);
  const rightX = useApart(p, 34);
  const gasS = useApart(p, 0.6);
  const baseY = useApart(p, 24);
  const cableX = useApart(p, 26);
  const cableY = useApart(p, 30);
  const supportY = useApart(p, 8);
  const lit = useTransform(p, KEYS, [1, 1, 0.12, 0.12, 1]);
  const gasO = useTransform(p, KEYS, [0, 0, 1, 1, 0]);
  const spin = useTransform(p, [0, 1], [-12, 12]);
  const pct = (v: MotionValue<number>) => useTransform(v, (x) => `${x}%`);

  return (
    <section ref={ref} id="inside" className="sheet bg-void" style={{ height: "380vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_60%_50%,color-mix(in_oklab,var(--glow)_12%,transparent),transparent_70%)]" />
        {/* blueprint grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "linear-gradient(rgba(179,148,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(179,148,255,0.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto flex h-full max-w-[1440px] flex-col px-5 pb-8 pt-[calc(var(--nav-h)+28px)] md:px-10 md:pb-12 xl:px-16">
          <ChapterLabel id="inside" />
          <h2 className="mt-6 max-w-[12ch] text-[clamp(36px,6vw,96px)] font-extrabold uppercase">
            Take it <span className="font-serif font-normal normal-case italic text-amber">apart.</span>
          </h2>

          {/* the lamp, in pieces */}
          <motion.div
            className="pointer-events-none absolute left-1/2 top-[48%] aspect-[240/300] h-[36svh] -translate-x-1/2 -translate-y-1/2 [perspective:1000px] md:left-[62%] md:h-[62svh]"
            aria-hidden="true"
          >
            <motion.div className="relative h-full w-full" style={{ rotateY: spin }}>
              <Part style={{ y: pct(supportY) }}>
                <path d="M96 214 L96 252 M144 214 L144 252" stroke="rgba(242,237,228,0.4)" strokeWidth="2.5" strokeLinecap="round" />
              </Part>
              <Part style={{ y: pct(baseY) }}>
                <rect x="52" y="250" width="136" height="34" rx="10" fill="#1e1830" stroke="rgba(242,237,228,0.3)" />
                <rect x="52" y="250" width="136" height="6" rx="3" fill="rgba(242,237,228,0.14)" />
                <rect x="84" y="258" width="44" height="20" rx="3" fill="none" stroke="rgba(242,237,228,0.35)" strokeDasharray="3 3" />
                <circle cx="168" cy="268" r="4" fill="currentColor" />
                <Dot n={4} x={120} y={300} />
              </Part>
              <Part style={{ x: pct(cableX), y: pct(cableY) }}>
                <path d="M188 274 C 214 278, 222 292, 238 296" stroke="#5f586e" strokeWidth="3" strokeLinecap="round" />
                <rect x="226" y="286" width="22" height="12" rx="4" fill="#2a2340" stroke="rgba(242,237,228,0.3)" />
                <Dot n={5} x={250} y={278} />
              </Part>
              <Part style={{ y: pct(tubeY), rotate: tubeR }}>
                <path d={TUBE} stroke="#f2ede4" strokeOpacity={0.22} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
                <motion.g style={{ opacity: lit }}>
                  <path d={TUBE} stroke="currentColor" strokeOpacity={0.14} strokeWidth={30} strokeLinecap="round" />
                  <path d={TUBE} stroke="currentColor" strokeOpacity={0.32} strokeWidth={16} strokeLinecap="round" />
                  <path d={TUBE} stroke="currentColor" strokeWidth={8} strokeLinecap="round" />
                  <path d={TUBE} stroke="#fffaf0" strokeWidth={2.6} strokeLinecap="round" />
                </motion.g>
                <Dot n={1} x={196} y={56} />
              </Part>
              <Part style={{ y: pct(tubeY), scale: useTransform(gasS, (v) => 1 + v * 0.25), opacity: gasO }}>
                {MOTES.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i % 3 ? 3 : 4.5} fill="currentColor" />
                ))}
                <Dot n={2} x={120} y={108} />
              </Part>
              <Part style={{ x: pct(leftX), y: pct(tubeY) }}>
                <rect x="50" y="204" width="16" height="22" rx="3" fill="#8a8396" />
                <rect x="54" y="226" width="8" height="10" rx="1" fill="#5f586e" />
                <Dot n={3} x={30} y={214} />
              </Part>
              <Part style={{ x: pct(rightX), y: pct(tubeY) }}>
                <rect x="178" y="204" width="16" height="22" rx="3" fill="#8a8396" />
                <rect x="182" y="226" width="8" height="10" rx="1" fill="#5f586e" />
              </Part>
            </motion.div>
          </motion.div>

          {/* one part at a time */}
          <div data-qa="scroll-scene" className="relative mt-auto grid max-w-[30ch] md:max-w-[34ch]">
            {PARTS.map((part, i) => (
              <Caption key={part.id} p={p} i={i} part={part} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Part({ children, style }: { children: ReactNode; style: Record<string, unknown> }) {
  return (
    <motion.svg viewBox="0 0 240 300" className="absolute inset-0 h-full w-full overflow-visible text-amber will-change-transform" fill="none" style={style}>
      {children}
    </motion.svg>
  );
}

function Dot({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" fill="#0b0912" stroke="currentColor" strokeWidth="1.5" />
      <text x={x} y={y + 4} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fill="#f2ede4">
        {n}
      </text>
    </g>
  );
}

function Caption({ p, i, part }: { p: MotionValue<number>; i: number; part: (typeof PARTS)[number] }) {
  const o = useCaption(p, i);
  const y = useTransform(o, [0, 1], [18, 0]);
  const visibility = useTransform(o, (v) => (v < 0.02 ? "hidden" : "visible"));
  return (
    <motion.div className="self-end [grid-area:1/1]" style={{ opacity: o, y, visibility }}>
      <p className="stamp text-amber">
        {String(i + 1).padStart(2, "0")} / {String(N).padStart(2, "0")} — {part.name}
      </p>
      <p className="mt-3 font-serif text-[clamp(22px,2.4vw,34px)] leading-[1.15] text-bone">{part.text}</p>
    </motion.div>
  );
}
