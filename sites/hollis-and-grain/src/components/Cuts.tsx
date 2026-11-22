import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { Scissors } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines } from "./Reveal";
import { useIsomorphicLayoutEffect } from "@/lib/motion";
import { CUTS, serviceOf } from "@/site.config";
import { useBooking } from "@/context/booking";

/**
 * Chapter 01 — the cuts: the shop's window display, sliding sideways as you
 * scroll down. Six cuts on tall cards with their price and time; tap one and
 * it goes straight into your booking. On desktop the pointer turns into a
 * pair of scissors over the cards. The section is exactly as tall as the
 * track is wide, so the run ends as the last card arrives.
 */
export function Cuts() {
  const { openSheet } = useBooking();
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, (v) => -dist * v);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useIsomorphicLayoutEffect(() => {
    const measure = () => {
      const t = track.current;
      if (t) setDist(Math.max(0, t.scrollWidth - window.innerWidth));
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
    <section
      id="cuts"
      ref={section}
      className="sheet bg-ivory text-ink"
      style={{ height: dist ? `calc(${dist}px + 100svh)` : "360svh" }}
      aria-labelledby="cuts-title"
    >
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <motion.div
          ref={track}
          data-qa="scroller"
          className="flex w-max items-end gap-5 px-5 will-change-transform md:gap-8 md:px-10 xl:px-24"
          style={{ x }}
        >
          <div className="flex w-[min(86vw,600px)] shrink-0 flex-col justify-end self-stretch pb-6">
            <ChapterLabel id="cuts" />
            <h2 id="cuts-title" className="mt-6 text-[clamp(48px,12vw,120px)] leading-[0.86]">
              <MaskLines
                lines={[
                  <>Every cut</>,
                  <>starts with</>,
                  <em className="text-rose">a conversation.</em>,
                ]}
              />
            </h2>
            <p className="mt-6 max-w-[38ch] text-[15.5px] leading-[1.7] text-ash md:text-[17px]">
              Tell us how you wear it and how fast it grows — then we cut for that. Keep scrolling:
              the window slides by. Tap a cut to book it.
            </p>
          </div>
          {CUTS.map((c, i) => {
            const s = serviceOf(c.service);
            const wide = c.widths.length > 4;
            return (
              <button
                key={c.service}
                type="button"
                data-cursor="scissors"
                onClick={() => openSheet({ service: c.service })}
                className={`group shrink-0 text-left ${i % 2 ? "w-[min(66vw,360px)]" : "w-[min(74vw,420px)]"}`}
                aria-label={`Book a ${c.service} — $${s?.price}, ${s?.mins} minutes`}
              >
                <span
                  className={`relative block overflow-hidden rounded-[6px] bg-stone ${i % 2 ? "h-[min(46svh,460px)]" : "h-[min(56svh,560px)]"}`}
                >
                  <Img
                    name={c.image}
                    widths={[...c.widths]}
                    sizes={
                      wide ? "(min-width:768px) 760px, 140vw" : "(min-width:768px) 420px, 74vw"
                    }
                    alt={c.alt}
                    className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                    style={{ objectPosition: c.position }}
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-noir/80 px-3 py-1.5 font-display text-[15px] font-bold uppercase tracking-[0.06em] text-ivory">
                    {String(i + 1).padStart(2, "0")} · {s?.mins} min
                  </span>
                </span>
                <span className="mt-4 flex items-baseline justify-between gap-4 border-b border-ink/15 pb-3">
                  <span className="font-display text-[30px] font-extrabold uppercase leading-none md:text-[36px]">
                    {c.service}
                  </span>
                  <span className="font-display text-[30px] font-bold leading-none text-rose md:text-[36px]">
                    ${s?.price}
                  </span>
                </span>
                <span className="aside mt-2 block text-[19px] leading-snug text-ash">{c.line}</span>
              </button>
            );
          })}
        </motion.div>
        {/* how far along the window you are */}
        <div
          className="absolute inset-x-5 bottom-6 h-[3px] overflow-hidden rounded-full bg-ink/10 md:inset-x-10 xl:inset-x-24"
          aria-hidden="true"
        >
          <motion.div
            className="h-full origin-left bg-rose will-change-transform"
            style={{ scaleX: bar }}
          />
        </div>
      </div>
      <ScissorsCursor />
    </section>
  );
}

/** On a mouse, the pointer becomes scissors that snip on click over the cut cards. */
function ScissorsCursor() {
  const [on, setOn] = useState(false);
  const [fine, setFine] = useState(false);
  const [snip, setSnip] = useState(0);
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const x = useSpring(mx, { stiffness: 500, damping: 40 });
  const y = useSpring(my, { stiffness: 500, damping: 40 });

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setFine(mq.matches);
    if (!mq.matches) return undefined;
    const move = (e: PointerEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      setOn(!!(e.target as Element | null)?.closest?.('[data-cursor="scissors"]'));
    };
    const down = () => setSnip((n) => n + 1);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
    };
  }, [mx, my]);

  if (!fine) return null;
  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[70] will-change-transform"
      style={{ x, y }}
      aria-hidden="true"
    >
      <motion.div
        className="-ml-9 -mt-9 flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-rose text-ivory shadow-[0_10px_30px_-10px_rgba(110,26,29,0.6)]"
        initial={false}
        animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.span
          key={snip}
          initial={{ rotate: -35 }}
          animate={{ rotate: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 12 }}
        >
          <Scissors size={24} strokeWidth={2} />
        </motion.span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em]">Book</span>
      </motion.div>
    </motion.div>
  );
}
