import { motion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SHAPES, SITE, price, type Shape } from "@/site.config";
import { useBooking } from "@/context/booking";
import { pointer } from "@/lib/pointer";
import { useReducedMotionSafe } from "@/lib/motion";
import { Lamp } from "./Lamp";
import { Magnetic } from "./Magnetic";

const LETTERS = ["L", "U", "M", "B", "E", "N", "D"];
const CYCLE: Shape[] = ["Loop", "Bolt", "Wave", "Moon"];
const EASE = [0.22, 1, 0.36, 1] as const;
const FROM = Math.min(...SHAPES.map((s) => s.price));

/**
 * The opening scene, pinned and driven by the visitor's own scroll:
 *   1. LUMBEND One floats over its own name on a grid floor, changing shape
 *      every few seconds; it tilts towards the mouse, the letters lean at
 *      their own depths.
 *   2. Scrolling pulls the letters apart while the lamp rises and swells
 *      until its light fills the room.
 *   3. "Real glass. Real gas. Real glow." settles in the light.
 * It plays under reduced motion too: it moves only when the visitor moves.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { openSheet, shape } = useBooking();
  const reduce = useReducedMotionSafe();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [idx, setIdx] = useState(0);

  // The lamp tries on its shapes until the visitor picks one.
  useEffect(() => {
    if (reduce || shape) return undefined;
    // Only while the scene is on screen: off-screen, a crossfade is wasted paint.
    const t = window.setInterval(() => {
      if (p.get() < 0.12) setIdx((i) => (i + 1) % CYCLE.length);
    }, 2600);
    return () => window.clearInterval(t);
  }, [reduce, shape, p]);
  const showing: Shape = shape || CYCLE[idx] || "Loop";

  // Mouse, softened.
  const mx = useSpring(pointer.nx, { stiffness: 60, damping: 20 });
  const my = useSpring(pointer.ny, { stiffness: 60, damping: 20 });
  const tiltY = useTransform(mx, [-1, 1], [-18, 18]);
  const tiltX = useTransform(my, [-1, 1], [12, -12]);
  const spotX = useSpring(pointer.x, { stiffness: 90, damping: 22 });
  const spotY = useSpring(pointer.y, { stiffness: 90, damping: 22 });
  const spotLeft = useTransform(spotX, (v) => v - 320);
  const spotTop = useTransform(spotY, (v) => v - 320);

  // Scroll timeline.
  const intro = useTransform(p, [0, 0.16], [1, 0]);
  const introY = useTransform(p, [0, 0.16], [0, -40]);
  const wordOpacity = useTransform(p, [0.3, 0.5], [1, 0]);
  const lampScale = useTransform(p, [0, 0.62], [1, 3.4]);
  const lampY = useTransform(p, [0, 0.62], ["0vh", "-14vh"]);
  const lampOpacity = useTransform(p, [0.5, 0.68], [1, 0]);
  const orbScale = useTransform(p, [0.12, 0.66], [0.3, 7]);
  const orbOpacity = useTransform(p, [0, 0.12, 0.7, 1], [0.45, 0.9, 1, 0.9]);
  const lineOpacity = useTransform(p, [0.6, 0.74], [0, 1]);
  const lineY = useTransform(p, [0.6, 0.82], [60, 0]);
  const lineScale = useTransform(p, [0.6, 1], [0.92, 1.04]);
  const floorOpacity = useTransform(p, [0, 0.5], [1, 0]);
  const tilt = useTransform(my, [-1, 1], [64, 72]);

  return (
    <section ref={ref} id="top" aria-labelledby="hero-title" className="relative h-[280vh] bg-void md:h-[320vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* haze in the lamp's own colour */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_45%,color-mix(in_oklab,var(--glow)_22%,transparent),transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_30%_at_15%_90%,rgba(155,107,255,0.14),transparent_70%)]" />

        {/* the floor */}
        <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] [perspective:520px]" style={{ opacity: floorOpacity }} aria-hidden="true">
          <motion.div className="absolute -inset-x-[25%] top-0 bottom-[-15%] origin-top" style={{ rotateX: tilt }}>
            <div className="grid-floor absolute inset-0 will-change-transform" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-void via-void/40 to-void/0" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void to-transparent" />
        </motion.div>

        {/* the mouse's own light */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--glow)_18%,transparent),rgba(179,148,255,0.07)_45%,transparent)]"
          style={{ x: spotLeft, y: spotTop }}
        />

        {/* the light that fills the room */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -ml-[30vmax] -mt-[30vmax] h-[60vmax] w-[60vmax] rounded-full bg-[radial-gradient(closest-side,#fff6e6_0%,var(--glow)_20%,color-mix(in_oklab,var(--glow)_55%,transparent)_40%,rgba(155,107,255,0.35)_64%,transparent_100%)] will-change-transform"
          style={{ scale: orbScale, opacity: orbOpacity }}
        />

        {/* top line */}
        <motion.div className="absolute inset-x-0 top-[calc(var(--nav-h)+20px)] flex justify-between px-5 md:px-10 xl:px-16" style={{ opacity: intro, y: introY }}>
          <p className="stamp text-haze">
            <span className="blink mr-2 inline-block h-1.5 w-1.5 rounded-full bg-amber align-middle shadow-[0_0_10px_2px_var(--glow)]" />
            Introducing {SITE.product}
          </p>
          <p className="stamp hidden text-haze md:block">Pre-orders open — from {price(FROM)}</p>
        </motion.div>

        {/* LUMBEND, behind the lamp */}
        <motion.p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[24%] flex justify-center font-display text-[clamp(38px,10.5vw,200px)] font-extrabold leading-[0.8] tracking-[-0.03em] md:top-[26%]"
          style={{ opacity: wordOpacity }}
        >
          {LETTERS.map((l, i) => (
            <Letter key={i} letter={l} i={i} p={p} mx={mx} my={my} />
          ))}
        </motion.p>

        {/* the lamp */}
        <motion.div
          className="absolute left-1/2 top-[13%] h-[40svh] w-[min(32svh,66vw)] -translate-x-1/2 [perspective:900px] md:top-[17%] md:h-[50svh] md:w-[min(40svh,70vw)] will-change-transform"
          style={{ scale: lampScale, y: lampY, opacity: lampOpacity }}
          data-cursor="glow"
        >
          <motion.div className="relative h-full w-full will-change-transform" style={{ rotateY: tiltY, rotateX: tiltX }}>
            <div className="float h-full w-full">
              {CYCLE.concat(shape && !CYCLE.includes(shape) ? [shape] : []).map((s) => (
                <Lamp
                  key={s}
                  shape={s}
                  className={`absolute inset-0 transition-opacity duration-700 ${showing === s ? "opacity-100" : "opacity-0"}`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* the line that settles in the light */}
        <motion.p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center font-serif text-[clamp(44px,8.6vw,140px)] italic leading-[0.95] text-void"
          style={{ opacity: lineOpacity, y: lineY, scale: lineScale }}
        >
          Real glass.
          <br />
          Real gas. Real glow.
        </motion.p>

        {/* bottom: what it is, and the way in */}
        <motion.div
          className="absolute inset-x-0 bottom-0 flex flex-col gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:flex-row md:items-end md:justify-between md:px-10 md:pb-10 xl:px-16"
          style={{ opacity: intro, y: introY }}
        >
          <motion.h1
            id="hero-title"
            className="font-serif text-[clamp(32px,4.8vw,72px)] font-normal normal-case italic leading-[0.95] tracking-[-0.01em] text-bone"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.7, ease: EASE }}
          >
            <span className="sr-only">{SITE.product}: </span>
            The real-glass
            <br />
            <span className="text-amber">neon desk lamp.</span>
          </motion.h1>
          <motion.div
            className="flex flex-col gap-4 md:items-end"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.9, ease: EASE }}
          >
            <p className="hidden max-w-[36ch] text-[13.5px] leading-relaxed text-haze md:block md:text-right">
              A glass tube bent by hand, filled with the gas that makes your colour, on a weighted base. Five shapes. Five colours. From {price(FROM)}.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#inside" className="btn-ghost min-h-[48px]" data-cursor="look">
                See inside <ArrowDown size={15} />
              </a>
              <Magnetic>
                <button onClick={openSheet} className="btn-amber min-h-[48px]">
                  Pre-order <ArrowUpRight size={15} />
                </button>
              </Magnetic>
            </div>
          </motion.div>
        </motion.div>

        {/* scroll cue */}
        <motion.div className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 md:flex" style={{ opacity: intro }} aria-hidden="true">
          <span className="stamp text-[10px] text-haze [writing-mode:vertical-rl]">Scroll to switch on</span>
          <span className="relative h-16 w-px overflow-hidden bg-bone/15">
            <motion.span className="absolute inset-x-0 top-0 h-6 bg-amber" animate={{ y: [-24, 64] }} transition={{ duration: 1.6, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }} />
          </span>
        </motion.div>
      </div>
    </section>
  );
}

/** One letter: bare glass, with the lit tube on top. */
function Letter({ letter, i, p, mx, my }: { letter: string; i: number; p: MotionValue<number>; mx: MotionValue<number>; my: MotionValue<number> }) {
  const depth = [1.4, 0.7, 1.1, 0.5, 1.2, 0.8, 1.3][i] ?? 1;
  const spread = i - 3;
  const x = useTransform([p, mx] as MotionValue<number>[], ([sp = 0, m = 0]: number[]) => `calc(${spread * sp * 34}vw + ${m * depth * 22}px)`);
  const y = useTransform([p, my] as MotionValue<number>[], ([sp = 0, m = 0]: number[]) => `calc(${(i % 2 ? -1 : 1) * sp * 24}vh + ${m * depth * 16}px)`);
  const rotate = useTransform(p, [0, 0.5], [0, (i - 3) * 10]);
  return (
    <motion.span className="relative inline-block opacity-[0.55] will-change-transform" style={{ x, y, rotate }}>
      <span className="tube-off">{letter}</span>
      <span className="neon-soft flicker-on absolute inset-0" style={{ animationDelay: `${1.45 + i * 0.12}s` }}>
        {letter}
      </span>
    </motion.span>
  );
}
