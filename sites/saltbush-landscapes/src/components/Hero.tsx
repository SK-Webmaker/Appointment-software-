import { motion, useInView, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ClipboardList, Leaf, Phone, Shovel, Sprout } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Img } from "./Img";
import { Leaves } from "./Leaves";
import { Magnetic } from "./fx/Magnetic";
import { SplitText } from "./fx/SplitText";
import { useIntroDone } from "./fx/intro";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { useReducedMotionSafe } from "@/lib/motion";

/** The photo ends up filling the screen, so it is sized as full-width. */
export const HERO_SIZES = "(max-aspect-ratio: 1/1) 160vh, 100vw";
const EASE = [0.22, 1, 0.36, 1] as const;
const WORD = "NATIVE";
/** the letter the camera flies through */
const DOOR = 3;
const ZOOM = 90;

const PROMISES = [
  { icon: Shovel, title: "Free site visit", text: "45 minutes, soil tested, no obligation." },
  {
    icon: ClipboardList,
    title: "Drawn plan, fixed price",
    text: "You know the cost before we dig.",
  },
  {
    icon: Sprout,
    title: "Plants that suit your soil",
    text: "Mostly natives, chosen for the Hills.",
  },
  { icon: Leaf, title: "Aftercare included", text: "We check back at six weeks." },
];

const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The opening scene. A sand-coloured page with one huge word cut out of it,
 * and the garden showing through the letters. Scroll, and the camera flies
 * through the "I" until the garden fills the screen, then the answer comes
 * up over it. Leaves drift down the whole time. Transforms only: the cut-out
 * page is a single layer that scales.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const word = useRef<SVGTextElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const { openSheet } = useBooking();
  const intro = useIntroDone();
  const reduce = useReducedMotionSafe();
  const visible = useInView(stage);
  const { scrollYProgress: p } = useScroll({ target: section, offset: ["start start", "end end"] });

  // fit the word to the screen and line it up with the gap left for it in
  // the text; aim the zoom at the middle of the "I"
  const [fit, setFit] = useState({ fs: 0, y: 0, ox: 50, oy: 40, unit: "%" as "%" | "px" });
  useIsoLayout(() => {
    const run = () => {
      const st = stage.current;
      const t = word.current;
      const sl = slot.current;
      if (!st || !t || !sl) return;
      const W = st.clientWidth;
      const H = st.clientHeight;
      let fs = Math.min(W * (W < 640 ? 0.25 : 0.215), H * 0.36);
      t.style.fontSize = `${fs}px`;
      const len = t.getComputedTextLength();
      if (len > W * 0.94) fs *= (W * 0.94) / len;
      t.style.fontSize = `${fs}px`;
      sl.style.height = `${fs * 0.72}px`;
      const sr = sl.getBoundingClientRect();
      const str = st.getBoundingClientRect();
      const want = sr.top - str.top + sr.height / 2;
      t.setAttribute("y", String(want));
      const b = t.getBBox();
      const y = want + (want - (b.y + b.height / 2)) * 0.9;
      t.setAttribute("y", String(y));
      const c = t.getExtentOfChar(DOOR);
      setFit({ fs, y, ox: c.x + c.width / 2, oy: c.y + c.height * 0.55, unit: "px" });
    };
    run();
    // the display font may arrive after first paint
    document.fonts?.ready.then(run).catch(() => {});
    window.addEventListener("resize", run);
    return () => window.removeEventListener("resize", run);
  }, []);

  const zoom = useTransform(p, (v) => {
    const t = Math.min(1, Math.max(0, (v - 0.06) / 0.48));
    return Math.pow(ZOOM, t * t * (3 - 2 * t));
  });
  const coverO = useTransform(p, [0.46, 0.54], [1, 0]);
  const photoS = useTransform(p, [0, 0.6], [1.3, 1]);
  const shade = useTransform(p, [0.35, 0.62], [0, 0.62]);
  const headO = useTransform(p, [0.02, 0.16], [1, 0]);
  const headY = useTransform(p, [0, 0.2], ["0%", "-12%"]);
  const headEvents = useTransform(p, (v) => (v > 0.12 ? "none" : "auto"));
  const outro = useTransform(p, [0.6, 0.74], [0, 1]);
  const outroY = useTransform(p, [0.6, 0.76], [60, 0]);
  const outroEvents = useTransform(p, (v) => (v > 0.62 ? "auto" : "none"));
  const [away, setAway] = useState(false);
  useMotionValueEvent(p, "change", (v) =>
    setAway(v >= 0.999 && window.scrollY > window.innerHeight * 1.5),
  );

  return (
    <>
      <section
        id="top"
        ref={section}
        className="relative isolate h-[240svh] bg-ivory text-ink lg:h-[240vh]"
        aria-labelledby="hero-title"
      >
        <div
          ref={stage}
          className="sticky top-0 h-[100svh] min-h-[620px] overflow-hidden bg-ivory"
          style={{ contentVisibility: away ? "hidden" : "visible" }}
        >
          {/* the garden */}
          <motion.div
            className="absolute inset-0 will-change-transform"
            style={{ scale: photoS }}
            initial={reduce ? false : { opacity: 0 }}
            animate={intro || reduce ? { opacity: 1 } : {}}
            transition={{ duration: 1.4, ease: EASE }}
          >
            <Img
              name="hero2"
              widths={[800, 1200, 1600, 2000, 2400]}
              sizes={HERO_SIZES}
              alt="A native garden of silver shrubs, grasses and boulders along a gravel path"
              priority
              className="h-full w-full object-cover object-[55%_50%]"
            />
            <motion.div className="absolute inset-0 bg-noir" style={{ opacity: shade }} />
          </motion.div>

          {/* the page with the word cut out of it */}
          <motion.div
            className="pointer-events-none absolute inset-0 will-change-transform"
            style={{
              scale: zoom,
              opacity: coverO,
              transformOrigin: `${fit.ox}${fit.unit} ${fit.oy}${fit.unit}`,
            }}
            aria-hidden="true"
          >
            <svg ref={svg} className="h-full w-full" aria-hidden="true">
              <defs>
                <mask id="native-cut">
                  <rect width="100%" height="100%" fill="white" />
                  <text
                    ref={word}
                    x="50%"
                    y={fit.fs ? fit.y : "40%"}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="black"
                    className="font-display"
                    style={{
                      fontSize: fit.fs ? `${fit.fs}px` : "min(21.5vw, 36vh)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {WORD}
                  </text>
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="#f4f1ea" mask="url(#native-cut)" />
            </svg>
          </motion.div>

          <Leaves on={visible && intro && !reduce} />

          {/* the opening words, around the cut-out */}
          <motion.div
            data-qa="layered"
            className="absolute inset-0 z-10 mx-auto flex max-w-[1320px] flex-col px-5 pb-8 pt-[calc(var(--nav-h)+20px)] will-change-transform md:px-8 lg:pb-12"
            style={{ opacity: headO, y: headY, pointerEvents: headEvents }}
          >
            <motion.div
              className="flex items-center justify-between gap-4 text-[14px] font-semibold text-onyx"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={intro || reduce ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <p>Native garden design · {SITE.area}</p>
              <p className="hidden sm:block">Est. {SITE.est}</p>
            </motion.div>
            <div className="flex flex-1 flex-col justify-center">
              <div ref={slot} className="h-[min(15.5vw,26vh)] shrink-0" />
            </div>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <SplitText
                as="h1"
                id="hero-title"
                text="Gardens that suit the Hills, and look after themselves"
                accent={["Hills,"]}
                accentClass="text-onyx"
                go={intro}
                delay={0.2}
                stagger={0.016}
                className="max-w-[16ch] text-[clamp(36px,9.6vw,46px)] leading-[1.02] lg:max-w-[14ch] lg:text-[clamp(48px,4.4vw,72px)]"
              />
              <motion.div
                className="lg:max-w-[48ch]"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={intro || reduce ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, ease: EASE, delay: 0.8 }}
              >
                <p className="hidden text-[17px] leading-relaxed text-ash sm:block">
                  Design, construction and planting with plants chosen for our clay, our summers and
                  our birds.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Magnetic>
                    <button
                      onClick={() => openSheet()}
                      className="btn-primary w-full whitespace-nowrap px-7 text-[16.5px] sm:w-auto"
                    >
                      Book a free site visit
                    </button>
                  </Magnetic>
                  <Magnetic>
                    <a
                      href={SITE.phoneHref}
                      className="btn-ghost w-full whitespace-nowrap px-6 text-[16.5px] sm:w-auto"
                    >
                      <Phone size={18} /> {SITE.phone}
                    </a>
                  </Magnetic>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* over the full-screen garden: the answer */}
          <motion.div
            data-qa="scroll-scene"
            className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-[1320px] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-white will-change-transform md:px-8 lg:pb-20"
            style={{ opacity: outro, y: outroY, pointerEvents: outroEvents }}
          >
            <p className="max-w-[15ch] font-display text-[clamp(40px,10vw,60px)] leading-[1.02] lg:text-[clamp(60px,6vw,100px)]">
              Planted once, <span className="text-silk">looked after by the weather.</span>
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => openSheet()}
                className="btn-honey px-7 text-[16.5px]"
                tabIndex={-1}
              >
                Book a free site visit
              </button>
              <a href="#services" className="btn-ghost-light px-6 text-[16.5px]" tabIndex={-1}>
                See what we do <ArrowDown size={17} />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="relative z-10 border-b border-ink/10 bg-white">
        <ul className="mx-auto grid max-w-[1320px] gap-x-8 gap-y-5 px-5 py-7 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          {PROMISES.map((p, i) => (
            <motion.li
              key={p.title}
              className="flex items-start gap-3"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
            >
              <p.icon size={24} strokeWidth={1.8} className="mt-0.5 shrink-0 text-onyx" />
              <span>
                <span className="block text-[15.5px] font-bold leading-snug">{p.title}</span>
                <span className="block text-[14.5px] text-ash">{p.text}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </>
  );
}
