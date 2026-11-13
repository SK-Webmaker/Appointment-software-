import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { WORKS } from "@/site.config";
import { useIsomorphicLayoutEffect } from "@/lib/motion";
import { ChapterLabel } from "./ChapterLabel";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Selected glow: the page stops and the pieces travel sideways past you, one
 * per screen of scrolling. Each sign is unlit glass until it reaches you, then
 * catches with a stutter in its own gas colour, and leans towards the mouse.
 * The travel distance is measured on load and resize, never while scrolling.
 */
export function Work() {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.0005 });
  const x = useTransform(smooth, [0, 1], [0, -dist]);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);

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
    <section ref={ref} id="work" className="sheet bg-void" style={{ height: `${WORKS.length * 85 + 40}vh` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <motion.div ref={track} data-qa="scroller" className="flex w-max items-center gap-6 pl-5 pr-[10vw] will-change-transform md:gap-10 md:pl-10 xl:pl-16" style={{ x }}>
          <header className="flex w-[80vw] shrink-0 flex-col justify-center md:w-[46vw] xl:w-[40vw]">
            <ChapterLabel id="work" />
            <h2 className="mt-8 text-[clamp(36px,5.4vw,96px)] font-extrabold uppercase">
              Selected
              <br />
              <span className="font-serif font-normal normal-case italic text-amber">glow.</span>
            </h2>
            <p className="mt-8 max-w-[34ch] text-[14px] leading-relaxed text-haze">
              Five pieces, five gases. Keep scrolling — each one switches on as it reaches you.
            </p>
            <p className="stamp mt-8 flex items-center gap-3 text-haze" aria-hidden="true">
              Scroll <span className="inline-block h-px w-16 bg-amber" /> →
            </p>
          </header>
          {WORKS.map((w, i) => (
            <Panel key={w.words} w={w} i={i} />
          ))}
        </motion.div>

        <div className="absolute inset-x-5 bottom-8 h-px bg-bone/10 md:inset-x-10 xl:inset-x-16" aria-hidden="true">
          <motion.div className="h-full origin-left bg-amber shadow-[0_0_10px_rgba(255,181,71,0.8)]" style={{ scaleX: bar }} />
        </div>
      </div>
    </section>
  );
}

function Panel({ w, i }: { w: (typeof WORKS)[number]; i: number }) {
  const card = useRef<HTMLDivElement>(null);
  const box = useRef<DOMRect | null>(null);
  const rx = useSpring(0, { stiffness: 140, damping: 18 });
  const ry = useSpring(0, { stiffness: 140, damping: 18 });
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const el = card.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setLit(true), { threshold: 0.55 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <article className="w-[82vw] shrink-0 [perspective:1200px] md:w-[58vw] xl:w-[50vw]" aria-label={`"${w.words}" — ${w.place}`}>
      <motion.div
        ref={card}
        data-cursor="glow"
        className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[28px] border border-bone/10 bg-night md:aspect-[16/11]"
        style={{ rotateX: rx, rotateY: ry, ["--tube" as string]: w.colour }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") box.current = card.current?.getBoundingClientRect() ?? null;
        }}
        onPointerMove={(e) => {
          const b = box.current;
          if (!b) return;
          ry.set(((e.clientX - b.left) / b.width - 0.5) * 12);
          rx.set(-((e.clientY - b.top) / b.height - 0.5) * 10);
        }}
        onPointerLeave={() => {
          box.current = null;
          rx.set(0);
          ry.set(0);
        }}
      >
        {/* the wall, washed in the tube's own light once it's on */}
        <div className="grain absolute inset-0 bg-[linear-gradient(160deg,#1a1526,#0d0a14)]" />
        <motion.div
          className="absolute inset-0"
          style={{ background: `radial-gradient(60% 55% at 50% 50%, ${w.colour}55, transparent 70%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: lit ? 1 : 0 }}
          transition={{ duration: 1.4, delay: 0.5, ease: EASE }}
        />
        {/* mounting hardware */}
        {["left-[8%] top-[10%]", "right-[8%] top-[10%]", "left-[8%] bottom-[10%]", "right-[8%] bottom-[10%]"].map((pos) => (
          <span key={pos} className={`absolute ${pos} h-2.5 w-2.5 rounded-full border border-bone/30 bg-dusk`} aria-hidden="true" />
        ))}
        <span className="absolute bottom-0 left-1/2 h-[12%] w-px bg-bone/20" aria-hidden="true" />

        <p className={`relative px-6 text-center font-serif ${lit ? "hum" : ""} text-[clamp(52px,9vw,140px)] italic leading-[0.9] tracking-[-0.01em]`}>
          <span className="sr-only">{w.words}</span>
          <span className="tube-off" aria-hidden="true">{w.words}</span>
          <motion.span
            className="neon absolute inset-0 px-6"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={lit ? { opacity: [0, 1, 0.1, 0.9, 0.2, 1] } : { opacity: 0 }}
            transition={{ duration: 1.1, times: [0, 0.1, 0.18, 0.3, 0.38, 0.55], ease: "linear" }}
          >
            {w.words}
          </motion.span>
        </p>

        <span className="stamp absolute left-6 top-6 text-haze">
          {String(i + 1).padStart(2, "0")} / {String(WORKS.length).padStart(2, "0")}
        </span>
        <span className="stamp absolute right-6 top-6 flex items-center gap-2 rounded-full border border-bone/15 px-3 py-1.5 text-bone/80">
          <span className="h-2 w-2 rounded-full" style={{ background: w.colour, boxShadow: `0 0 10px ${w.colour}` }} />
          {w.gas}
        </span>
      </motion.div>
      <div className="mt-5 flex items-baseline justify-between gap-4 px-1">
        <p className="text-[14px] text-bone">{w.place}</p>
        <p className="stamp text-haze">{w.year}</p>
      </div>
    </article>
  );
}
