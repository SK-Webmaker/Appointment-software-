import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GASES, SHAPES, price } from "@/site.config";
import { useBooking } from "@/context/booking";
import { useIsomorphicLayoutEffect } from "@/lib/motion";
import { ChapterLabel } from "./ChapterLabel";
import { Lamp } from "./Lamp";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Five shapes: the page stops and the lamps travel sideways past you, one
 * per screen of scrolling. Each is bare glass until it reaches you, then
 * catches with a stutter in a different gas, and leans towards the mouse.
 * The travel distance is measured on load and resize, never while scrolling.
 */
export function Shapes() {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -dist]);

  useIsomorphicLayoutEffect(() => {
    const measure = () => {
      const t = track.current;
      if (!t) return;
      setDist(Math.max(0, t.scrollWidth - window.innerWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section ref={ref} id="shapes" className="sheet bg-night" style={{ height: `${SHAPES.length * 85 + 40}vh` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <motion.div ref={track} data-qa="scroller" className="flex w-max items-center gap-6 pl-5 pr-[10vw] will-change-transform md:gap-10 md:pl-10 xl:pl-16" style={{ x }}>
          <header className="flex w-[80vw] shrink-0 flex-col justify-center md:w-[46vw] xl:w-[40vw]">
            <ChapterLabel id="shapes" />
            <h2 className="mt-8 text-[clamp(36px,5.4vw,96px)] font-extrabold uppercase">
              Five
              <br />
              <span className="font-serif font-normal normal-case italic text-amber">shapes.</span>
            </h2>
            <p className="mt-8 max-w-[34ch] text-[14px] leading-relaxed text-haze">
              One lamp, bent five ways. Keep scrolling — each one switches on as it reaches you. Pick the one for your desk.
            </p>
            <p className="stamp mt-8 flex items-center gap-3 text-haze" aria-hidden="true">
              Scroll <span className="inline-block h-px w-16 bg-amber" /> →
            </p>
          </header>
          {SHAPES.map((s, i) => (
            <Panel key={s.name} s={s} i={i} />
          ))}
        </motion.div>

        <div className="absolute inset-x-5 bottom-8 h-px bg-bone/10 md:inset-x-10 xl:inset-x-16" aria-hidden="true">
          <motion.div className="h-full origin-left bg-amber shadow-[0_0_10px_var(--glow)]" style={{ scaleX: scrollYProgress }} />
        </div>
      </div>
    </section>
  );
}

function Panel({ s, i }: { s: (typeof SHAPES)[number]; i: number }) {
  const { shape, setShape, words } = useBooking();
  const card = useRef<HTMLDivElement>(null);
  const box = useRef<DOMRect | null>(null);
  const rx = useSpring(0, { stiffness: 140, damping: 18 });
  const ry = useSpring(0, { stiffness: 140, damping: 18 });
  const [lit, setLit] = useState(false);
  const gas = GASES[i % GASES.length];
  const colour = gas?.colour ?? "#ffb547";
  const on = shape === s.name;

  useEffect(() => {
    const el = card.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setLit(true), { threshold: 0.55 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <article className="w-[82vw] shrink-0 [perspective:1200px] md:w-[52vw] xl:w-[44vw]" aria-label={`The ${s.name}, ${price(s.price)}`}>
      <motion.div
        ref={card}
        data-cursor="tilt"
        className={`relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[28px] border bg-void transition-colors duration-500 md:aspect-[16/12] ${on ? "border-amber" : "border-bone/10"}`}
        style={{ rotateX: rx, rotateY: ry }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") box.current = card.current?.getBoundingClientRect() ?? null;
        }}
        onPointerMove={(e) => {
          const b = box.current;
          if (!b) return;
          ry.set(((e.clientX - b.left) / b.width - 0.5) * 14);
          rx.set(-((e.clientY - b.top) / b.height - 0.5) * 10);
        }}
        onPointerLeave={() => {
          box.current = null;
          rx.set(0);
          ry.set(0);
        }}
      >
        <div className="grain absolute inset-0 bg-[linear-gradient(160deg,#1a1526,#0d0a14)]" />
        <motion.div
          className="absolute inset-0"
          style={{ background: `radial-gradient(55% 50% at 50% 45%, ${colour}44, transparent 70%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: lit ? 1 : 0 }}
          transition={{ duration: 1.4, delay: 0.5, ease: EASE }}
        />
        <div className={`relative h-[78%] aspect-[240/300] ${lit ? "hum" : ""}`}>
          <Lamp shape={s.name} word={words} colour={colour} lit={false} halo={false} className="absolute inset-0" />
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={lit ? { opacity: [0, 1, 0.1, 0.9, 0.2, 1] } : { opacity: 0 }}
            transition={{ duration: 1.1, times: [0, 0.1, 0.18, 0.3, 0.38, 0.55], ease: "linear" }}
          >
            <Lamp shape={s.name} word={words} colour={colour} className="h-full w-full" />
          </motion.div>
        </div>

        <span className="stamp absolute left-6 top-6 text-haze">
          {String(i + 1).padStart(2, "0")} / {String(SHAPES.length).padStart(2, "0")}
        </span>
        <span className="stamp absolute right-6 top-6 flex items-center gap-2 rounded-full border border-bone/15 px-3 py-1.5 text-bone/80">
          <span className="h-2 w-2 rounded-full" style={{ background: colour, boxShadow: `0 0 10px ${colour}` }} />
          Shown in {gas?.name}
        </span>
      </motion.div>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4 px-1">
        <div>
          <h3 className="text-[clamp(28px,3vw,44px)] font-extrabold uppercase">
            The {s.name} <span className="ml-2 font-serif text-[0.8em] font-normal normal-case italic text-amber">{price(s.price)}</span>
          </h3>
          <p className="mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-haze">{s.note}</p>
        </div>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => setShape(on ? "" : s.name)}
          className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border px-5 text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 ${
            on ? "border-amber bg-amber text-void" : "border-bone/25 text-bone hover:border-amber"
          }`}
        >
          {on && <Check size={14} strokeWidth={2.4} />}
          {on ? "Chosen" : `Choose the ${s.name}`}
        </button>
      </div>
    </article>
  );
}
