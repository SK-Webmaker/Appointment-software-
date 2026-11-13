import { motion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useRef } from "react";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { pointer } from "@/lib/pointer";
import { Magnetic } from "./Magnetic";

const LETTERS = ["N", "O", "C", "T", "A"];
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The opening scene, pinned and driven by the visitor's own scroll:
 *   1. NOCTA stands in glass on a grid floor that slides towards you; each
 *      letter catches in turn, and leans with the mouse at its own depth.
 *   2. Scrolling pulls the letters apart while a point of light in the
 *      middle swells until it fills the room.
 *   3. "Darkness is our canvas." settles in the glow, and the studio
 *      chapter slides up over it.
 * It plays under reduced motion too: it moves only when the visitor moves.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { openSheet } = useBooking();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // Mouse, softened.
  const mx = useSpring(pointer.nx, { stiffness: 60, damping: 20 });
  const my = useSpring(pointer.ny, { stiffness: 60, damping: 20 });
  const spotX = useSpring(pointer.x, { stiffness: 90, damping: 22 });
  const spotY = useSpring(pointer.y, { stiffness: 90, damping: 22 });
  const spotLeft = useTransform(spotX, (v) => v - 320);
  const spotTop = useTransform(spotY, (v) => v - 320);

  // Scroll timeline.
  const intro = useTransform(p, [0, 0.18], [1, 0]);
  const introY = useTransform(p, [0, 0.18], [0, -40]);
  const wordScale = useTransform(p, [0, 0.55], [1, 1.35]);
  const wordY = useTransform(p, [0, 0.55], ["0vh", "-6vh"]);
  const wordOpacity = useTransform(p, [0.42, 0.6], [1, 0]);
  const orbScale = useTransform(p, [0.08, 0.66], [0.12, 7]);
  const orbOpacity = useTransform(p, [0, 0.08, 0.7, 1], [0.55, 1, 1, 0.85]);
  const lineOpacity = useTransform(p, [0.58, 0.72], [0, 1]);
  const lineY = useTransform(p, [0.58, 0.8], [60, 0]);
  const lineScale = useTransform(p, [0.58, 1], [0.92, 1.04]);
  const floorOpacity = useTransform(p, [0, 0.5], [1, 0]);
  const tilt = useTransform(my, [-1, 1], [64, 72]);

  return (
    <section ref={ref} id="top" aria-label={`${SITE.name} — ${SITE.tagline}`} className="relative h-[280vh] bg-void md:h-[320vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* haze */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_42%,rgba(155,107,255,0.22),transparent_70%),radial-gradient(40%_30%_at_80%_90%,rgba(255,181,71,0.10),transparent_70%)]" />

        {/* the floor */}
        <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] [perspective:520px]" style={{ opacity: floorOpacity }} aria-hidden="true">
          <motion.div className="absolute -inset-x-[60%] -top-[30%] bottom-[-60%] origin-top" style={{ rotateX: tilt }}>
            <div className="grid-floor absolute inset-0 will-change-transform" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-void via-void/40 to-void/0" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void to-transparent" />
        </motion.div>

        {/* the mouse's own light */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(255,181,71,0.16),rgba(179,148,255,0.08)_45%,transparent)]"
          style={{ x: spotLeft, y: spotTop }}
        />

        {/* the point of light that fills the room */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -ml-[30vmax] -mt-[30vmax] h-[60vmax] w-[60vmax] rounded-full bg-[radial-gradient(closest-side,#fff3dc_0%,#ffb547_18%,rgba(255,140,60,0.55)_38%,rgba(155,107,255,0.35)_62%,transparent_100%)] will-change-transform"
          style={{ scale: orbScale, opacity: orbOpacity }}
        />

        {/* top line */}
        <motion.div className="absolute inset-x-0 top-[calc(var(--nav-h)+20px)] flex justify-between px-5 md:px-10 xl:px-16" style={{ opacity: intro, y: introY }}>
          <p className="stamp text-haze">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-amber align-middle shadow-[0_0_10px_2px_rgba(255,181,71,0.8)] blink" />
            {SITE.role}
          </p>
          <p className="stamp hidden text-haze md:block">Open after dark — est. never sleeps</p>
        </motion.div>

        {/* NOCTA */}
        <motion.h1
          className="absolute inset-x-0 top-[26%] flex justify-center px-2 font-display text-[clamp(52px,14.5vw,280px)] font-extrabold leading-[0.8] tracking-[-0.02em] md:top-[20%]"
          style={{ scale: wordScale, y: wordY, opacity: wordOpacity }}
        >
          <span className="sr-only">
            {SITE.name} — {SITE.tagline}
          </span>
          {LETTERS.map((l, i) => (
            <Letter key={l} letter={l} i={i} p={p} mx={mx} my={my} />
          ))}
        </motion.h1>

        {/* the line that settles in the glow */}
        <motion.p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center font-serif text-[clamp(44px,9vw,140px)] italic leading-[0.95] text-void"
          style={{ opacity: lineOpacity, y: lineY, scale: lineScale }}
        >
          Darkness is
          <br />
          our canvas.
        </motion.p>

        {/* bottom: the promise and the way in */}
        <motion.div
          className="absolute inset-x-0 bottom-0 flex flex-col gap-7 px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] md:flex-row md:items-end md:justify-between md:px-10 md:pb-10 xl:px-16"
          style={{ opacity: intro, y: introY }}
        >
          <motion.p
            className="font-serif text-[clamp(34px,5.4vw,76px)] italic leading-[0.95] text-bone"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.7, ease: EASE }}
          >
            We bend light
            <br />
            <span className="text-amber">for a living.</span>
          </motion.p>
          <motion.div
            className="flex flex-col gap-5 md:items-end"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.9, ease: EASE }}
          >
            <p className="max-w-[36ch] text-[13.5px] leading-relaxed text-haze md:text-right">
              Hand-bent neon, light installations and nights that glow — made in glass, gas and a little bit of nerve.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#work" className="btn-ghost min-h-[48px]" data-cursor="view">
                See the glow <ArrowDown size={15} />
              </a>
              <Magnetic>
                <button onClick={openSheet} className="btn-amber min-h-[48px]">
                  Commission <ArrowUpRight size={15} />
                </button>
              </Magnetic>
            </div>
          </motion.div>
        </motion.div>

        {/* scroll cue */}
        <motion.div className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 md:flex" style={{ opacity: intro }} aria-hidden="true">
          <span className="stamp text-[10px] text-haze [writing-mode:vertical-rl]">Scroll to switch on</span>
          <span className="relative h-16 w-px overflow-hidden bg-bone/15">
            <motion.span
              className="absolute inset-x-0 top-0 h-6 bg-amber"
              animate={{ y: [-24, 64] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }}
            />
          </span>
        </motion.div>
      </div>
    </section>
  );
}

/** One letter: bare glass underneath, the lit tube on top. */
function Letter({ letter, i, p, mx, my }: { letter: string; i: number; p: MotionValue<number>; mx: MotionValue<number>; my: MotionValue<number> }) {
  const depth = [1.4, 0.7, 1.1, 0.6, 1.3][i] ?? 1;
  const spread = (i - 2) * 1;
  const x = useTransform([p, mx] as MotionValue<number>[], ([sp = 0, m = 0]: number[]) => `calc(${spread * sp * 46}vw + ${m * depth * 18}px)`);
  const y = useTransform([p, my] as MotionValue<number>[], ([sp = 0, m = 0]: number[]) => `calc(${(i % 2 ? -1 : 1) * sp * 22}vh + ${m * depth * 14}px)`);
  const rotate = useTransform(p, [0, 0.55], [0, (i - 2) * 9]);
  return (
    <motion.span aria-hidden="true" className="relative inline-block will-change-transform" style={{ x, y, rotate }}>
      <span className="tube-off">{letter}</span>
      <span className="neon flicker-hum absolute inset-0 [--tube:#ffb547]" style={{ animationDelay: `${1.45 + i * 0.14}s, ${3 + i * 1.3}s` }}>
        {letter}
      </span>
    </motion.span>
  );
}
