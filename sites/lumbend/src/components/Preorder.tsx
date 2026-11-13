import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import { useRef } from "react";
import { GASES, SHAPES, SHAPE_NAMES, price } from "@/site.config";
import { useBooking } from "@/context/booking";
import { ChapterLabel } from "./ChapterLabel";
import { Lamp } from "./Lamp";
import { Magnetic } from "./Magnetic";
import { MaskLines } from "./Reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Pre-order: a live configurator. Pick a shape and a gas and the lamp on
 * the plinth changes in front of you — the gas recolours the whole page —
 * while the price settles. The big glowing switch opens the order sheet.
 */
export function Preorder() {
  const ref = useRef<HTMLElement>(null);
  const { openSheet, shape, setShape, gas, setGas, words } = useBooking();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const glow = useTransform(scrollYProgress, [0.2, 0.9], [0.25, 1]);
  const glowScale = useTransform(scrollYProgress, [0.2, 0.9], [0.6, 1.1]);
  const showing = shape || "Loop";
  const cost = SHAPES.find((s) => s.name === showing)?.price ?? 0;

  return (
    <section id="preorder" ref={ref} className="sheet overflow-hidden bg-night pb-24 pt-24 md:pb-32 md:pt-32" aria-labelledby="preorder-title">
      <div className="glow-clip" aria-hidden="true">
        <motion.div
          className="absolute left-[30%] top-[50%] -ml-[45vmax] -mt-[45vmax] h-[90vmax] w-[90vmax] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--glow)_24%,transparent),rgba(155,107,255,0.10)_50%,transparent)] will-change-transform"
          style={{ opacity: glow, scale: glowScale }}
        />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-16">
        <ChapterLabel id="preorder" />
        <h2 id="preorder-title" className="mt-8 text-[clamp(52px,10vw,170px)] font-extrabold uppercase">
          <MaskLines
            lines={[
              "Make it",
              <span key="s" className="neon font-serif font-normal normal-case italic">
                yours.
              </span>,
            ]}
          />
        </h2>

        <div className="mt-12 grid items-center gap-12 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* the plinth */}
          <div className="relative mx-auto grid aspect-square w-full max-w-[560px] place-items-center">
            <div className="absolute inset-[8%] rounded-full border border-bone/10" aria-hidden="true" />
            <div className="spin-slow absolute inset-[2%] rounded-full border border-dashed border-bone/10" aria-hidden="true" />
            <div className="absolute bottom-[10%] left-1/2 h-[6%] w-[60%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--glow)_45%,transparent),transparent)]" aria-hidden="true" />
            <AnimatePresence mode="wait">
              <motion.div
                key={showing}
                className="relative h-[78%] aspect-[240/300]"
                initial={{ opacity: 0, y: 30, scale: 0.92 }}
                animate={{ opacity: [0, 1, 0.3, 1], y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 1.04 }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <div className="float h-full w-full">
                  <Lamp shape={showing} word={words} className="h-full w-full" />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* the choices */}
          <div>
            <fieldset>
              <legend className="stamp text-bone">Shape</legend>
              <div className="mt-4 flex flex-wrap gap-2">
                {SHAPE_NAMES.map((s) => {
                  const on = shape === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setShape(on ? "" : s)}
                      className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border px-5 text-[13px] uppercase tracking-[0.12em] transition-colors duration-300 ${
                        on ? "border-amber bg-amber text-void" : "border-bone/20 text-bone hover:border-bone/60"
                      }`}
                    >
                      {on && <Check size={14} strokeWidth={2.2} />}
                      {s}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-8">
              <legend className="stamp text-bone">Light</legend>
              <div className="mt-4 flex flex-wrap gap-2">
                {GASES.map((g) => {
                  const on = gas === g.symbol;
                  return (
                    <button
                      key={g.symbol}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${g.name}, ${g.glow}`}
                      onClick={() => setGas(on ? "" : g.symbol)}
                      className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border px-4 text-[13px] transition-colors duration-300 ${
                        on ? "border-transparent text-void" : "border-bone/20 text-bone hover:border-bone/60"
                      }`}
                      style={on ? { background: g.colour } : undefined}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ background: on ? "#0b0912" : g.colour, boxShadow: on ? "none" : `0 0 10px ${g.colour}` }} aria-hidden="true" />
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-10 flex flex-wrap items-center gap-8 border-t border-bone/10 pt-8">
              <div>
                <p className="stamp text-haze">{shape ? `The ${shape}` : "From"}</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={cost}
                    className="neon font-display text-[clamp(56px,7vw,96px)] font-extrabold leading-none"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    {price(shape ? cost : Math.min(...SHAPES.map((s) => s.price)))}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="relative grid place-items-center">
                <motion.span
                  aria-hidden="true"
                  className="absolute h-40 w-40 rounded-full border border-amber/50"
                  animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: EASE }}
                />
                <Magnetic strength={0.4}>
                  <button
                    type="button"
                    onClick={openSheet}
                    className="relative grid h-40 w-40 place-items-center rounded-full bg-amber text-void shadow-[0_0_0_1px_color-mix(in_oklab,var(--glow)_50%,transparent),0_0_60px_10px_color-mix(in_oklab,var(--glow)_45%,transparent)] transition-colors duration-500 hover:bg-bone"
                  >
                    <span className="flex flex-col items-center gap-1">
                      <span className="stamp text-[10px]">Switch it on</span>
                      <span className="font-serif text-[28px] italic leading-none">Pre-order</span>
                    </span>
                  </button>
                </Magnetic>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
