import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { CARE } from "@/site.config";
import { useBooking } from "@/context/booking";

const EASE = [0.22, 1, 0.36, 1] as const;
const minutesAt = (v: number) => Math.min(60, Math.max(0, ((v - 0.04) / 0.9) * 60));

/**
 * Chapter III — the care: your sixty minutes, on a clock. The chapter pins
 * and the scroll winds the clock through a gel manicure: the hand sweeps,
 * the ring fills, and each step arrives with its photo as its minute comes.
 */
export function Care() {
  const { openSheet } = useBooking();
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const [min, setMin] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setMin(Math.floor(minutesAt(v))));
  const step = CARE.reduce((acc, c, i) => (min >= c.at ? i : acc), 0);
  const c = CARE[step]!;
  const hand = useTransform(scrollYProgress, (v) => (minutesAt(v) / 60) * 360);
  const ring = useTransform(scrollYProgress, (v) => minutesAt(v) / 60);

  return (
    <section
      id="care"
      ref={section}
      className="sheet h-[420svh] bg-ivory text-ink"
      aria-labelledby="care-title"
    >
      <div className="sticky top-0 flex h-[100svh] min-h-[620px] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-[1440px] items-center gap-6 px-5 pt-[calc(var(--nav-h)+8px)] md:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pt-0 xl:px-24">
          <div className="flex items-center gap-5 lg:block">
            <div className="min-w-0 flex-1">
              <ChapterLabel id="care" />
              <h2
                id="care-title"
                className="mt-4 text-[clamp(34px,9vw,56px)] leading-[0.98] lg:mt-8 lg:text-[clamp(56px,6vw,104px)]"
              >
                Your sixty <em className="text-rose">minutes.</em>
              </h2>
              <p className="mt-6 max-w-[36ch] text-[16.5px] leading-[1.75] text-ash max-lg:hidden">
                A gel manicure, minute by minute — keep scrolling and the clock runs.
              </p>
            </div>
            {/* the clock */}
            <div
              className="relative aspect-square w-[34vw] max-w-[150px] shrink-0 lg:mt-12 lg:w-[min(30vw,46svh)] lg:max-w-[420px]"
              aria-hidden="true"
            >
              <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
                <circle
                  cx="100"
                  cy="100"
                  r="92"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeWidth="6"
                />
                <motion.circle
                  cx="100"
                  cy="100"
                  r="92"
                  fill="none"
                  stroke="#9e1c3a"
                  strokeWidth="6"
                  strokeLinecap="round"
                  style={{ pathLength: ring }}
                />
                {Array.from({ length: 60 }, (_, i) => (
                  <line
                    key={i}
                    x1="100"
                    y1={i % 5 ? 14 : 18}
                    x2="100"
                    y2="22"
                    stroke="currentColor"
                    strokeOpacity={i % 5 ? 0.15 : 0.45}
                    strokeWidth={i % 5 ? 1 : 2}
                    transform={`rotate(${i * 6} 100 100)`}
                  />
                ))}
                {CARE.map((s) => (
                  <circle
                    key={s.at}
                    cx="100"
                    cy="8"
                    r="4"
                    fill={min >= s.at ? "#9e1c3a" : "#ece3df"}
                    stroke="#9e1c3a"
                    strokeWidth="1.5"
                    transform={`rotate(${s.at * 6} 100 100)`}
                  />
                ))}
              </svg>
              <motion.div
                className="absolute inset-0 will-change-transform"
                style={{ rotate: hand }}
              >
                <span className="absolute left-1/2 top-[16%] h-[36%] w-[3px] -translate-x-1/2 rounded-full bg-ink" />
              </motion.div>
              <div className="absolute inset-0 grid place-items-center">
                <span className="rounded-full bg-ivory px-2 font-display text-[clamp(22px,5vw,56px)] leading-none tabular-nums">
                  {String(min).padStart(2, "0")}
                  <span className="text-[0.45em] italic text-ash"> min</span>
                </span>
              </div>
            </div>
          </div>

          {/* the step: its photo in an almond, and its words */}
          <div className="grid items-center gap-5 sm:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <div className="relative mx-auto aspect-[3/4] h-[min(36svh,360px)] overflow-hidden rounded-b-[26px] rounded-t-[999px] bg-stone shadow-[0_30px_60px_-30px_rgba(60,20,32,0.5)] sm:h-auto sm:w-full lg:h-auto lg:w-[min(100%,44svh)]">
              {CARE.map((s, i) => (
                <motion.div
                  key={s.image}
                  aria-hidden={i !== step}
                  className="absolute inset-0 will-change-[opacity]"
                  initial={false}
                  animate={{ opacity: i === step ? 1 : 0 }}
                  transition={{ duration: 0.7, ease: EASE }}
                >
                  <Img
                    name={s.image}
                    widths={[480, 800, 1200]}
                    sizes="(min-width:1024px) 420px, (min-width:640px) 40vw, 60vw"
                    alt={i === step ? s.alt : ""}
                    className="h-full w-full object-cover"
                    style={{ objectPosition: s.position }}
                  />
                </motion.div>
              ))}
            </div>
            <div className="min-h-[200px] text-center sm:text-left" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-rose">
                    Minute {String(c.at).padStart(2, "0")} · {step + 1} of {CARE.length}
                  </p>
                  <h3 className="mt-3 text-[clamp(30px,7.6vw,40px)] leading-[1.04] lg:text-[clamp(40px,3.6vw,56px)]">
                    {c.title}
                  </h3>
                  <p className="mx-auto mt-3 max-w-[38ch] text-[15.5px] leading-[1.7] text-ash sm:mx-0 md:text-[16.5px]">
                    {c.text}
                  </p>
                </motion.div>
              </AnimatePresence>
              <button
                type="button"
                onClick={() => openSheet({ service: "Gel Manicure" })}
                className="btn-primary sheen mt-6 max-lg:hidden"
              >
                Book a Gel Manicure <ArrowRight size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
