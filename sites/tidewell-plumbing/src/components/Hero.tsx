import { motion, useScroll, useTransform } from "framer-motion";
import { BadgeCheck, CalendarClock, Phone, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Img } from "./Img";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { openStatus } from "@/lib/slots";

/** The photo fills a portrait screen by its height, so it needs more pixels there. */
export const HERO_SIZES = "(max-aspect-ratio: 1/1) 160vh, 100vw";

const PROMISES = [
  { icon: BadgeCheck, title: "Fixed price, agreed first", text: "No surprises on the invoice." },
  {
    icon: CalendarClock,
    title: "Two-hour arrival windows",
    text: "And a text when we're 20 minutes out.",
  },
  { icon: Zap, title: "Same-day urgent jobs", text: "7 days, 6 am to 10 pm." },
  {
    icon: ShieldCheck,
    title: "12-month workmanship guarantee",
    text: "On every job, big or small.",
  },
];

/**
 * The opening: a full-width photo of the work, the promise in one line, the
 * two things people come for (book, or call), and the four reasons to pick
 * us underneath. The photo drifts a little as you scroll — nothing more.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const { openSheet } = useBooking();
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => setStatus(openStatus().text), []);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  return (
    <>
      <section
        id="top"
        ref={section}
        className="relative isolate flex min-h-[640px] items-end overflow-hidden bg-noir pt-16 text-white h-[88svh] lg:h-[86vh] lg:max-h-[900px]"
        aria-labelledby="hero-title"
      >
        <motion.div className="absolute inset-0 -z-10 will-change-transform" style={{ y }}>
          <Img
            name="hero2"
            widths={[800, 1200, 1600, 2000, 2400]}
            sizes={HERO_SIZES}
            alt="A plumber fitting a new waste pipe under a kitchen sink"
            priority
            className="h-full w-full object-cover object-[78%_50%] lg:object-[62%_50%]"
          />
        </motion.div>
        <div
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(10_28_27/0.92),rgb(10_28_27/0.55)_45%,rgb(10_28_27/0.15)_75%)] lg:bg-[linear-gradient(to_right,rgb(10_28_27/0.9),rgb(10_28_27/0.6)_45%,rgb(10_28_27/0)_75%)]"
          aria-hidden="true"
        />
        <div
          data-qa="layered"
          className="mx-auto w-full max-w-[1320px] px-5 pb-10 md:px-8 lg:pb-20"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[13.5px] font-medium text-white/95 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-[#5fd38d]" />
            {status ?? `${SITE.role} since ${SITE.est}`}
          </p>
          <h1
            id="hero-title"
            className="mt-5 max-w-[14ch] text-[clamp(40px,10.5vw,58px)] leading-[1.02] lg:text-[clamp(56px,5.4vw,84px)]"
          >
            Local plumbers for the Northern Beaches
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-white/90 md:text-[19px]">
            Leaks, blocked drains, hot water and gas — fixed properly by licensed plumbers who live
            here. Family-run since {SITE.est}.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => openSheet()} className="btn-honey px-7 text-[16.5px]">
              Book a plumber
            </button>
            <a href={SITE.phoneHref} className="btn-ghost-light px-6 text-[16.5px]">
              <Phone size={18} /> {SITE.phone}
            </a>
          </div>
        </div>
      </section>

      <div className="border-b border-ink/10 bg-white">
        <ul className="mx-auto grid max-w-[1320px] gap-x-8 gap-y-5 px-5 py-7 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex items-start gap-3">
              <p.icon size={24} strokeWidth={1.8} className="mt-0.5 shrink-0 text-onyx" />
              <span>
                <span className="block text-[15.5px] font-semibold leading-snug">{p.title}</span>
                <span className="block text-[14.5px] text-ash">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
