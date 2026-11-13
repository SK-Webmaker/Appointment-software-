import { animate, motion, useInView, useMotionValue, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { MANIFESTO, MANIFESTO_GLOW, STATS } from "@/site.config";
import { useReducedMotionSafe } from "@/lib/motion";
import { ChapterLabel } from "./ChapterLabel";

/**
 * Why real neon. A split heading whose halves slide towards each other, the
 * manifesto lighting word by word (the words that matter switch on in amber),
 * and three counters. A stamped strip drifts sideways with the scroll.
 */
export function Studio() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const leftX = useTransform(scrollYProgress, [0, 0.5], ["-6vw", "0vw"]);
  const rightX = useTransform(scrollYProgress, [0, 0.5], ["0vw", "-4vw"]);
  const stripX = useTransform(scrollYProgress, [0, 1], ["0%", "-35%"]);

  return (
    <section ref={ref} id="why" className="sheet overflow-x-clip bg-night pb-28 pt-24 md:pb-40 md:pt-32">
      <div className="glow-clip">
        <div className="absolute -left-[20%] top-[10%] h-[70vh] w-[70vh] rounded-full bg-[radial-gradient(closest-side,rgba(155,107,255,0.16),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-16">
        <ChapterLabel id="why" />

        <h2 className="relative mt-10 flex items-end justify-between gap-4 text-[clamp(40px,11vw,190px)] font-extrabold uppercase">
          <motion.span style={{ x: leftX }}>Real</motion.span>
          <span className="mb-[0.18em] hidden h-[0.6em] w-px bg-bone/20 md:block" aria-hidden="true" />
          <motion.span style={{ x: rightX }} className="font-serif text-[0.8em] font-normal normal-case italic tracking-[-0.02em] text-amber">
            neon
          </motion.span>
        </h2>

        <div className="mt-16 grid gap-12 md:mt-24 md:grid-cols-[1fr_minmax(0,3fr)]">
          <p className="stamp hidden self-start text-haze md:block md:[writing-mode:vertical-rl] md:rotate-180">Why it glows</p>
          <Manifesto />
        </div>

        <ul className="mt-20 grid gap-px overflow-hidden rounded-3xl bg-bone/10 md:mt-28 md:grid-cols-3">
          {STATS.map((s) => (
            <li key={s.label} className="bg-night p-7 md:p-10">
              <Counter to={s.value} suffix={s.suffix} />
              <p className="stamp mt-3 text-haze">{s.label}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-24 overflow-hidden border-y border-bone/10 py-6 md:mt-32" aria-hidden="true">
        <motion.p className="stamp whitespace-nowrap text-[clamp(28px,6vw,74px)] font-light tracking-[0.3em] text-bone/70" style={{ x: stripX }}>
          R E A L · G L A S S · R E A L · G A S · R E A L · G L O W · B E N T · B Y · H A N D
        </motion.p>
      </div>
    </section>
  );
}

function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = MANIFESTO.split(" ");
  return (
    <p ref={ref} className="font-display text-[clamp(30px,4.6vw,68px)] font-semibold leading-[1.08] tracking-[-0.03em]">
      {words.map((w, i) => (
        <Word key={i} p={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} glow={MANIFESTO_GLOW.includes(w)} reduce={reduce}>
          {w}
        </Word>
      ))}
    </p>
  );
}

function Word({ children, p, range, glow, reduce }: { children: string; p: MotionValue<number>; range: [number, number]; glow: boolean; reduce: boolean }) {
  const dim = useTransform(p, range, [1, 0]);
  const lit = useTransform(p, range, [0, 1]);
  return (
    <>
      <span className={`relative inline-block ${glow ? "font-serif font-normal italic" : ""}`}>
        <motion.span aria-hidden="true" className="text-bone/15" style={{ opacity: reduce ? 0 : dim }}>
          {children}
        </motion.span>
        <motion.span className={`absolute inset-0 ${glow ? "neon" : "text-bone"}`} style={{ opacity: reduce ? 1 : lit }}>
          {children}
        </motion.span>
      </span>{" "}
    </>
  );
}

function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const v = useMotionValue(to === 0 ? 99 : 0);
  const text = useTransform(v, (x) => `${String(Math.round(x)).padStart(2, "0")}${suffix}`);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!inView) return undefined;
    const run = animate(v, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onComplete: () => setDone(true) });
    return () => run.stop();
  }, [inView, to, v]);
  const final = `${String(to).padStart(2, "0")}${suffix}`;
  // Counts in plain text (cheap to repaint every frame), then the glow
  // switches on once, around the final number.
  return (
    <span ref={ref} className="relative block font-display text-[clamp(64px,9vw,120px)] font-extrabold leading-none">
      <motion.span className={`block text-bone transition-opacity duration-500 ${done ? "opacity-0" : "opacity-100"}`}>{text}</motion.span>
      <span aria-hidden={!done} className={`neon absolute inset-0 ${done ? "flicker-on" : "invisible"}`}>
        {final}
      </span>
    </span>
  );
}
