import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Img } from "./Img";
import { MARQUEE, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { dayLabel, nextFree, openStatus, pretty } from "@/lib/slots";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Shared with the preload in routes/index.tsx so both pick the same file. */
export const HERO_SIZES = "100vw";

/**
 * Opening scene: the shop doors. Two dark doors carry the sign — HOLLIS on
 * one, GRAIN on the other — with a sliver of the lamp-lit shop between them,
 * edged by turning barber-pole stripes. Scroll and the doors swing apart,
 * the shop settles into view, and the welcome comes up from the floor.
 * Transforms and opacity only, so it glides on a phone. It is driven by the
 * visitor's own scrolling, so it plays for everyone, "Reduce motion" included.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { openSheet } = useBooking();
  const live = useLive();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });

  const open = (v: number) => easeInOut(clamp01((v - 0.03) / 0.5));
  const leftX = useTransform(scrollYProgress, (v) => `${-101 * open(v)}%`);
  const rightX = useTransform(scrollYProgress, (v) => `${101 * open(v)}%`);
  const photoScale = useTransform(scrollYProgress, [0, 0.62], [1.22, 1]);
  const ampOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const introOpacity = useTransform(scrollYProgress, [0, 0.14], [1, 0]);
  const introY = useTransform(scrollYProgress, [0, 0.2], [0, 40]);
  const introEvents = useTransform(scrollYProgress, (v) => (v > 0.12 ? "none" : "auto"));
  const shade = useTransform(scrollYProgress, [0.42, 0.66], [0, 1]);
  const outroOpacity = useTransform(scrollYProgress, [0.52, 0.7], [0, 1]);
  const outroY = useTransform(scrollYProgress, [0.52, 0.74], [48, 0]);
  const outroEvents = useTransform(scrollYProgress, (v) => (v > 0.56 ? "auto" : "none"));

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative isolate h-[250svh] lg:h-[260vh]"
      aria-labelledby="hero-title"
    >
      <h1 id="hero-title" className="sr-only">
        {SITE.name} — barbers in {SITE.area}, {SITE.city}
      </h1>
      <div className="sticky top-0 h-[100svh] min-h-[560px] w-full overflow-hidden bg-noir">
        {/* The shop, behind the doors */}
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{ scale: photoScale }}
          data-qa="layered"
        >
          <Img
            name="shop"
            widths={[800, 1280, 1920, 2400]}
            sizes={HERO_SIZES}
            priority
            alt="Inside the shop: three leather barber chairs under pendant lamps, a long mirror and exposed brick"
            className="h-full w-full object-cover"
            style={{ objectPosition: "50% 45%" }}
          />
        </motion.div>
        <div className="pointer-events-none absolute inset-0 bg-noir/25" aria-hidden="true" />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(21_17_15/0.94)_8%,rgb(21_17_15/0.55)_45%,rgb(21_17_15/0.1)_80%)] will-change-[opacity]"
          style={{ opacity: shade }}
          aria-hidden="true"
        />

        {/* The doors */}
        <Door side="left" x={leftX} word="Hollis" />
        <Door side="right" x={rightX} word="Grain" />
        <motion.span
          className="aside pointer-events-none absolute left-1/2 top-[46%] z-20 -translate-x-1/2 -translate-y-1/2 text-[clamp(64px,min(11vw,20vh),190px)] leading-none text-pearl will-change-[opacity] [text-shadow:0_4px_30px_rgb(0_0_0/0.6)]"
          style={{ opacity: ampOpacity }}
          aria-hidden="true"
        >
          &amp;
        </motion.span>

        {/* shade for the bar and the words: top and bottom of the stage */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-[linear-gradient(to_bottom,rgb(21_17_15/0.7),transparent)]"
          aria-hidden="true"
        />
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[46%] bg-[linear-gradient(to_top,rgb(21_17_15/0.92)_30%,transparent)] will-change-[opacity]"
          style={{ opacity: introOpacity }}
          aria-hidden="true"
        />

        {/* Opening words, over the doors */}
        <motion.div
          className="absolute inset-0 z-30 mx-auto flex max-w-[1440px] flex-col justify-between px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[88px] text-ivory will-change-[transform,opacity] md:px-10 lg:pb-12 lg:pt-28 xl:px-24"
          style={{ opacity: introOpacity, y: introY, pointerEvents: introEvents }}
        >
          <p className="flex items-center justify-center gap-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-ivory/85 md:text-[12px]">
            <span className="relative flex h-2 w-2 shrink-0">
              {live.open && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5fbf7a]/60" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${live.open ? "bg-[#5fbf7a]" : "bg-silk"}`}
              />
            </span>
            <span>
              {SITE.role} · {SITE.area}, {SITE.city}
              <span className="max-sm:hidden" data-og-hide> · {live.status ?? `Est. ${SITE.est}`}</span>
            </span>
          </p>
          <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-6 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
            <p className="max-w-[34ch] text-[15.5px] leading-relaxed text-ivory/85 md:text-[17px]">
              Fades, scissor cuts, beards and hot-towel shaves — booked to the minute, never rushed.
              Cuts from {SITE.from}.
            </p>
            <div className="flex w-full max-w-[420px] gap-3 lg:w-auto">
              <button
                onClick={() => openSheet()}
                className="btn-primary sheen flex-1 whitespace-nowrap px-4 sm:px-5 lg:flex-none"
              >
                Book a chair <ArrowRight size={16} strokeWidth={1.8} className="max-sm:hidden" />
              </button>
              <a
                href="#cuts"
                className="btn-ghost-light shrink-0 whitespace-nowrap px-4 sm:flex-1 sm:px-5 lg:flex-none"
              >
                The cuts
              </a>
            </div>
          </div>
        </motion.div>

        {/* Once the doors are open — revealed by scrolling */}
        <motion.div
          data-qa="scroll-scene"
          className="absolute inset-x-0 bottom-0 z-30 mx-auto max-w-[1440px] px-5 pb-[max(2.25rem,env(safe-area-inset-bottom))] text-ivory will-change-[transform,opacity] md:px-10 lg:pb-14 xl:px-24"
          style={{ opacity: outroOpacity, y: outroY, pointerEvents: outroEvents }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-pearl md:text-[12px]">
            {MARQUEE.slice(0, 4).join(" · ")}
          </p>
          <p className="mt-3 font-display text-[clamp(52px,15vw,84px)] font-extrabold uppercase leading-[0.88] tracking-[-0.01em] lg:text-[clamp(84px,8.4vw,150px)]">
            Sharp cuts.
            <br />
            Hot towels. <em className="text-pearl">No rush.</em>
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a href="#cuts" className="btn-primary sheen self-start" tabIndex={-1}>
              Come in <ArrowDown size={16} strokeWidth={1.8} />
            </a>
            <p className="max-w-[44ch] text-[14.5px] leading-relaxed text-ivory/80 [@media(max-height:700px)]:hidden">
              {live.next ? (
                <>
                  Next free chair: <span className="font-semibold text-pearl">{live.next}</span>.
                  Walk-ins welcome when a chair is free.
                </>
              ) : (
                <>Walk-ins welcome whenever a chair is free.</>
              )}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/** One shop door: the sign's word on its face and turning pole stripes down its inner edge. */
function Door({ side, x, word }: { side: "left" | "right"; x: MotionValue<string>; word: string }) {
  const left = side === "left";
  return (
    <motion.div
      className={`absolute inset-y-0 z-10 flex w-[calc(50%-8vw)] items-center bg-noir will-change-transform sm:w-[calc(50%-7vw)] ${left ? "left-0 justify-end" : "right-0 justify-start"}`}
      style={{ x }}
      aria-hidden="true"
    >
      {/* lamp light falling on the door */}
      <div
        className={`pointer-events-none absolute inset-y-0 w-[70%] ${left ? "right-0 bg-[radial-gradient(60%_50%_at_100%_46%,rgb(201_162_90/0.16),transparent)]" : "left-0 bg-[radial-gradient(60%_50%_at_0%_46%,rgb(201_162_90/0.16),transparent)]"}`}
      />
      <span
        className={`relative font-display font-black uppercase leading-[0.82] tracking-[-0.01em] text-ivory ${left ? "pr-[3vw] text-right" : "pl-[3vw] text-left"} text-[clamp(38px,min(11vw,26vh),250px)] sm:text-[clamp(56px,min(12.5vw,26vh),250px)]`}
      >
        {word}
      </span>
      {/* the pole, down the door's inner edge */}
      <span
        className={`absolute inset-y-0 w-[10px] overflow-hidden md:w-[14px] ${left ? "right-0" : "left-0"}`}
      >
        <span className="absolute -top-[57px] bottom-0 left-0 right-0 animate-pole bg-[repeating-linear-gradient(135deg,#a3262a_0_10px,#f1ebe2_10px_20px,#1f3a5f_20px_30px,#f1ebe2_30px_40px)] bg-[length:100%_56.57px] will-change-transform" />
      </span>
    </motion.div>
  );
}

/** Today's status and the next free chair, worked out in the visitor's browser after it loads. */
function useLive() {
  const [live, setLive] = useState<{ open: boolean; status: string | null; next: string | null }>({
    open: false,
    status: null,
    next: null,
  });
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const s = openStatus(now);
      const n = nextFree("any", 45, now);
      const next = n
        ? `${n.today ? "today" : dayLabel(n.day, { weekday: "long" })} at ${pretty(n.time)}`
        : null;
      setLive({ open: s.open, status: s.text, next });
    };
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, []);
  return live;
}
