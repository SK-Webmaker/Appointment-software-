import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { GASES } from "@/site.config";
import { useBooking } from "@/context/booking";
import { ChapterLabel } from "./ChapterLabel";

const N = GASES.length;

/** Fully on while gas i owns the scroll, crossfading into its neighbours. */
function useGas(p: MotionValue<number>, i: number, handOver = false) {
  const a = (i + 0.5) / N;
  const w = 0.5 / N;
  const out = i === 0 ? [1, 1, 1, 0] : i === N - 1 ? [0, 1, 1, 1] : [0, 1, 1, 0];
  // Light crossfades softly across each boundary; text hands over instead —
  // the outgoing words are gone before the next arrive, so two never overlap.
  const at = handOver ? [a - w + 0.002, a - w + 0.03, a + w - 0.03, a + w - 0.002] : [a - w - 0.015, a - w + 0.015, a + w - 0.015, a + w + 0.015];
  // Scroll-linked values run as browser animations, whose offsets must stay within 0…1.
  return useTransform(p, at.map((v) => Math.min(1, Math.max(0, v))), out);
}

/**
 * Five colours, pinned. One glass tube runs across the room; as you scroll it
 * changes gas — neon, argon, helium, krypton, xenon — and the whole chapter
 * takes on that light. The element tile and its note change with it.
 */
export function Spectrum() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const tubeScale = useTransform(p, [0, 0.12], [0.2, 1]);

  return (
    <section ref={ref} id="colours" className="sheet bg-void" style={{ height: `${N * 70 + 60}vh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {GASES.map((g, i) => (
          <Wash key={g.symbol} p={p} i={i} colour={g.colour} />
        ))}

        <div className="relative mx-auto flex h-full max-w-[1440px] flex-col px-5 pb-8 pt-[calc(var(--nav-h)+28px)] md:px-10 md:pb-12 xl:px-16">
          <ChapterLabel id="colours" />
          <h2 className="mt-6 max-w-[14ch] text-[clamp(32px,5.6vw,88px)] font-extrabold uppercase">
            Pick your <span className="font-serif font-normal normal-case italic text-amber">colour.</span>
          </h2>

          {/* the tube */}
          <div className="relative my-auto py-6">
            <motion.div className="relative mx-auto h-5 w-full origin-center md:h-7" style={{ scaleX: tubeScale }}>
              <span className="absolute -left-2 top-1/2 h-9 w-4 -translate-y-1/2 rounded-sm bg-dusk ring-1 ring-bone/20 md:h-11" aria-hidden="true" />
              <span className="absolute -right-2 top-1/2 h-9 w-4 -translate-y-1/2 rounded-sm bg-dusk ring-1 ring-bone/20 md:h-11" aria-hidden="true" />
              <span className="absolute inset-0 rounded-full border border-bone/15 bg-bone/5" aria-hidden="true" />
              {GASES.map((g, i) => (
                <Tube key={g.symbol} p={p} i={i} colour={g.colour} />
              ))}
            </motion.div>
          </div>

          <div data-qa="scroll-scene" className="relative grid gap-6 md:grid-cols-[auto_1fr] md:items-end md:gap-14">
            <div className="relative h-[150px] w-[140px] md:h-[200px] md:w-[190px] [@media(max-height:740px)]:hidden">
              {GASES.map((g, i) => (
                <Tile key={g.symbol} p={p} i={i} g={g} />
              ))}
            </div>
            <div className="grid">
              {GASES.map((g, i) => (
                <Note key={g.symbol} p={p} i={i} g={g} />
              ))}
            </div>
          </div>

          <ol className="mt-8 grid grid-cols-5 gap-2 md:gap-4" aria-label="The five noble gases">
            {GASES.map((g, i) => (
              <Tick key={g.symbol} p={p} i={i} g={g} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Wash({ p, i, colour }: { p: MotionValue<number>; i: number; colour: string }) {
  const o = useGas(p, i);
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 will-change-[opacity]"
      style={{ opacity: o, background: `radial-gradient(80% 50% at 50% 50%, ${colour}38, transparent 72%)` }}
    />
  );
}

function Tube({ p, i, colour }: { p: MotionValue<number>; i: number; colour: string }) {
  const o = useGas(p, i);
  return (
    <motion.span
      aria-hidden="true"
      className="absolute inset-0 rounded-full will-change-[opacity]"
      style={{
        opacity: o,
        background: `linear-gradient(to bottom, #fff 0%, ${colour} 55%, ${colour} 100%)`,
        boxShadow: `0 0 8px ${colour}, 0 0 28px ${colour}, 0 0 70px ${colour}, 0 0 140px ${colour}99`,
      }}
    />
  );
}

function Tile({ p, i, g }: { p: MotionValue<number>; i: number; g: (typeof GASES)[number] }) {
  const o = useGas(p, i, true);
  const y = useTransform(o, [0, 1], [24, 0]);
  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-between rounded-2xl border p-4 md:p-5"
      style={{ opacity: o, y, borderColor: `${g.colour}88`, background: `linear-gradient(160deg, ${g.colour}22, transparent)` }}
      aria-hidden={i !== 0 ? true : undefined}
    >
      <span className="stamp text-bone/80">{g.number}</span>
      <span className="neon font-display text-[52px] font-extrabold leading-none md:text-[68px]" style={{ ["--tube" as string]: g.colour }}>
        {g.symbol}
      </span>
      <span className="stamp text-bone">{g.name}</span>
    </motion.div>
  );
}

function Note({ p, i, g }: { p: MotionValue<number>; i: number; g: (typeof GASES)[number] }) {
  const { gas, setGas } = useBooking();
  const o = useGas(p, i, true);
  const y = useTransform(o, [0, 1], [18, 0]);
  // Hidden notes can't be clicked or tabbed to.
  const visibility = useTransform(o, (v) => (v < 0.02 ? "hidden" : "visible"));
  const on = gas === g.symbol;
  return (
    <motion.div className="self-end [grid-area:1/1]" style={{ opacity: o, y, visibility }}>
      <p className="stamp" style={{ color: g.colour }}>
        {g.name} — glows {g.glow}
      </p>
      <p className="mt-3 max-w-[46ch] font-serif text-[clamp(20px,2.2vw,32px)] leading-[1.15] text-bone">{g.note}</p>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setGas(on ? "" : g.symbol)}
        className="mt-5 inline-flex min-h-[46px] items-center gap-2 rounded-full border px-5 text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300"
        style={on ? { background: g.colour, borderColor: g.colour, color: "#0b0912" } : { borderColor: `${g.colour}88`, color: "#f2ede4" }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? "#0b0912" : g.colour, boxShadow: on ? "none" : `0 0 8px ${g.colour}` }} aria-hidden="true" />
        {on ? `Your lamp glows ${g.name.toLowerCase()}` : `Light mine in ${g.name}`}
      </button>
    </motion.div>
  );
}

function Tick({ p, i, g }: { p: MotionValue<number>; i: number; g: (typeof GASES)[number] }) {
  const o = useGas(p, i);
  const glow = useTransform(o, [0, 1], [0.25, 1]);
  return (
    <li className="relative">
      <motion.span className="block h-[3px] rounded-full" style={{ opacity: glow, background: g.colour, boxShadow: `0 0 10px ${g.colour}` }} />
      <span className="stamp mt-3 block text-haze">
        {g.symbol} <span className="hidden md:inline">· {g.name}</span>
      </span>
    </li>
  );
}
