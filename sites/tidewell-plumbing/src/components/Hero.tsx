import { motion, useInView, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { ArrowDown, BadgeCheck, CalendarClock, Phone, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Img } from "./Img";
import { Magnetic } from "./fx/Magnetic";
import { SplitText } from "./fx/SplitText";
import { useIntroDone } from "./fx/intro";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { useReducedMotionSafe } from "@/lib/motion";
import { openStatus } from "@/lib/slots";

/** The photo ends up filling the screen, so it is sized as full-width. */
export const HERO_SIZES = "(max-aspect-ratio: 1/1) 160vh, 100vw";
const EASE = [0.22, 1, 0.36, 1] as const;

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

type Ring = { id: number; x: number; y: number; s: number };

/**
 * The opening scene. The headline types itself in letter by letter while a
 * photo of the work waits as a card beside it. Scroll, and the card grows
 * until it fills the screen and the answer comes up over it. Move (or click)
 * over the photo and ripples spread from the pointer like a drop on still
 * water; on its own it drips every so often too. Transforms only.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const { openSheet } = useBooking();
  const intro = useIntroDone();
  const reduce = useReducedMotionSafe();
  const visible = useInView(stage);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => setStatus(openStatus().text), []);
  const { scrollYProgress: p } = useScroll({ target: section, offset: ["start start", "end end"] });

  // the card: starts small at the right (bottom on phones), grows to full screen
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const u = () => setWide(mq.matches);
    u();
    mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);
  // on narrow screens the card rises from the bottom: start it just below the
  // buttons, as large as the space there allows
  const head = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(0.46);
  useEffect(() => {
    if (wide) return setStart(0.46);
    const fit = () => {
      const st = stage.current;
      const hd = head.current;
      if (!st || !hd) return;
      const H = st.clientHeight;
      const b = hd.offsetTop + hd.offsetHeight;
      setStart(Math.min(0.62, Math.max(0.28, (H - b - 28) / (H + 48))));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [wide]);
  const scale = useTransform(p, [0, 0.55], [start, 1]);
  const shade = useTransform(p, [0.25, 0.6], [0.15, 0.72]);
  const headY = useTransform(p, [0, 0.4], ["0%", "-30%"]);
  const headO = useTransform(p, [0.05, 0.32], [1, 0]);
  const headEvents = useTransform(p, (v) => (v > 0.25 ? "none" : "auto"));
  const outro = useTransform(p, [0.58, 0.72], [0, 1]);
  const outroY = useTransform(p, [0.58, 0.74], [60, 0]);
  const outroEvents = useTransform(p, (v) => (v > 0.6 ? "auto" : "none"));
  const [away, setAway] = useState(false);
  useMotionValueEvent(p, "change", (v) =>
    setAway(v >= 0.999 && window.scrollY > window.innerHeight * 1.5),
  );

  // ripples
  const [rings, setRings] = useState<Ring[]>([]);
  const nextId = useRef(0);
  const last = useRef(0);
  const drop = (x: number, y: number, s = 1) => {
    const id = nextId.current++;
    setRings((r) => [...r.slice(-7), { id, x, y, s }]);
    window.setTimeout(() => setRings((r) => r.filter((k) => k.id !== id)), 1500);
  };
  useEffect(() => {
    if (!visible || reduce || !intro) return undefined;
    const t = window.setInterval(() => {
      const r = stage.current?.getBoundingClientRect();
      if (!r) return;
      drop(r.width * (0.55 + Math.random() * 0.4), r.height * (0.25 + Math.random() * 0.6), 1.3);
    }, 1700);
    return () => window.clearInterval(t);
  }, [visible, reduce, intro]);

  return (
    <>
      <section
        id="top"
        ref={section}
        className="relative isolate h-[230svh] bg-ivory text-ink lg:h-[230vh]"
        aria-labelledby="hero-title"
      >
        <div
          ref={stage}
          className="sticky top-0 h-[100svh] min-h-[620px] overflow-hidden"
          style={{ contentVisibility: away ? "hidden" : "visible" }}
          onPointerMove={(e) => {
            if (reduce) return;
            const now = performance.now();
            if (now - last.current < 90) return;
            last.current = now;
            const r = e.currentTarget.getBoundingClientRect();
            drop(e.clientX - r.left, e.clientY - r.top, 0.7);
          }}
          onPointerDown={(e) => {
            if (reduce) return;
            const r = e.currentTarget.getBoundingClientRect();
            drop(e.clientX - r.left, e.clientY - r.top, 1.6);
          }}
        >
          {/* the photo card */}
          <motion.div
            className="absolute -inset-6 overflow-hidden rounded-[40px] bg-noir will-change-transform"
            style={{
              scale,
              transformOrigin: wide ? "92% 60%" : "50% 100%",
            }}
            initial={reduce ? false : { opacity: 0, y: 80 }}
            animate={intro || reduce ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1.2, ease: EASE, delay: 0.25 }}
          >
            <Img
              name="hero2"
              widths={[800, 1200, 1600, 2000, 2400]}
              sizes={HERO_SIZES}
              alt="A plumber fitting a new waste pipe under a kitchen sink"
              priority
              className="h-full w-full object-cover object-[70%_50%]"
            />
            <motion.div className="absolute inset-0 bg-noir" style={{ opacity: shade }} />
            {rings.map((r) => (
              <span
                key={r.id}
                className="ripple pointer-events-none absolute rounded-full border-2 border-white/70"
                style={{ left: r.x + 24, top: r.y + 24, width: 260 * r.s, height: 260 * r.s }}
                aria-hidden="true"
              />
            ))}
          </motion.div>

          {/* the opening words */}
          <motion.div
            ref={head}
            className="absolute inset-x-0 top-0 z-10 mx-auto max-w-[1320px] px-5 pt-24 will-change-transform md:px-8 lg:pt-32"
            style={{ y: headY, opacity: headO, pointerEvents: headEvents }}
          >
            <motion.p
              className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[13.5px] font-medium text-ink"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={intro || reduce ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5fd38d] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2fb86a]" />
              </span>
              {status ?? `${SITE.role} since ${SITE.est}`}
            </motion.p>
            <SplitText
              as="h1"
              id="hero-title"
              text="Local plumbers for the Northern Beaches"
              accent={["Northern", "Beaches"]}
              accentClass="text-onyx"
              go={intro}
              delay={0.15}
              className="mt-5 max-w-[11ch] text-[clamp(42px,11vw,60px)] leading-[0.98] lg:max-w-[10ch] lg:text-[clamp(64px,6.4vw,108px)]"
            />
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={intro || reduce ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
            >
              <p className="mt-5 hidden max-w-[34ch] text-[16.5px] leading-relaxed text-ash sm:block lg:text-[18px]">
                Leaks, blocked drains, hot water and gas — fixed properly by licensed plumbers who
                live here. Family-run since {SITE.est}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Magnetic>
                  <button onClick={() => openSheet()} className="btn-primary px-7 text-[16.5px]">
                    Book a plumber
                  </button>
                </Magnetic>
                <Magnetic>
                  <a href={SITE.phoneHref} className="btn-ghost px-6 text-[16.5px]">
                    <Phone size={18} /> {SITE.phone}
                  </a>
                </Magnetic>
              </div>
            </motion.div>
          </motion.div>

          {/* over the full-screen photo: the answer */}
          <motion.div
            data-qa="scroll-scene"
            className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-[1320px] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-white will-change-transform md:px-8 lg:pb-20"
            style={{ opacity: outro, y: outroY, pointerEvents: outroEvents }}
          >
            <p className="max-w-[16ch] font-display text-[clamp(40px,10vw,60px)] font-semibold leading-[1] lg:text-[clamp(60px,6vw,100px)]">
              Little leak or big one, <span className="text-silk">we're on our way.</span>
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => openSheet()}
                className="btn-honey px-7 text-[16.5px]"
                tabIndex={-1}
              >
                Book a plumber
              </button>
              <a href="#services" className="btn-ghost-light px-6 text-[16.5px]" tabIndex={-1}>
                See what we fix <ArrowDown size={17} />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="relative z-10 border-b border-ink/10 bg-white">
        <ul className="mx-auto grid max-w-[1320px] gap-x-8 gap-y-5 px-5 py-8 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          {PROMISES.map((p, i) => (
            <motion.li
              key={p.title}
              className="flex items-start gap-3"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint text-onyx">
                <p.icon size={22} strokeWidth={1.9} />
              </span>
              <span>
                <span className="block text-[15.5px] font-semibold leading-snug">{p.title}</span>
                <span className="block text-[14.5px] text-ash">{p.text}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </>
  );
}
