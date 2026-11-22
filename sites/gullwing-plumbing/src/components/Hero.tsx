import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, Phone, Siren } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Img } from "./Img";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { openStatus, vansOut } from "@/lib/slots";

/** Shared with the preload in routes/index.tsx so both pick the same file. */
export const HERO_SIZES = "(min-width:1024px) 50vw, 100vw";

const LINES = ["Leaks", "don't", "wait."];
const BUBBLES = [
  { left: "8%", size: 10, delay: 0 },
  { left: "21%", size: 6, delay: 1.4 },
  { left: "37%", size: 14, delay: 2.6 },
  { left: "55%", size: 8, delay: 0.8 },
  { left: "68%", size: 12, delay: 3.2 },
  { left: "83%", size: 7, delay: 1.9 },
  { left: "93%", size: 11, delay: 2.2 },
];

/**
 * Opening scene: the flood. LEAKS DON'T WAIT. stands in outline — empty pipe
 * — over a night shot of a tap gone wild. Scroll, and water rises up the
 * screen with a rolling surface and bubbles; every letter it passes fills
 * solid. When the room is three-quarters under, the answer surfaces:
 * "Neither do we." Transforms only (the water is a clipped layer sliding up,
 * its contents sliding down the same amount), so it glides on a phone.
 * Scroll-driven, so it plays for everyone — "Reduce motion" included.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const { openSheet, setEmergency } = useBooking();
  const live = useLive();
  const { scrollYProgress: p } = useScroll({ target: section, offset: ["start start", "end end"] });

  // How much of the screen is under water, 0 → 0.86.
  const level = useTransform(p, [0.04, 0.6], [0, 0.86], { clamp: true });
  const waterY = useTransform(level, (l) => `${(1 - l) * 100}%`);
  const innerY = useTransform(level, (l) => `${-(1 - l) * 100}%`);
  const intro = useTransform(p, [0, 0.12], [1, 0]);
  const introEvents = useTransform(p, (v) => (v > 0.1 ? "none" : "auto"));
  const outro = useTransform(p, [0.63, 0.76], [0, 1]);
  const outroY = useTransform(p, [0.63, 0.78], [50, 0]);
  const outroEvents = useTransform(p, (v) => (v > 0.65 ? "auto" : "none"));
  const words = useTransform(p, [0.5, 0.62], [1, 0]);

  return (
    <section
      id="top"
      ref={section}
      className="relative isolate h-[280svh] lg:h-[300vh]"
      aria-labelledby="hero-title"
    >
      <div className="sticky top-0 h-[100svh] min-h-[600px] w-full overflow-hidden bg-noir text-ivory">
        {/* the tap, at night */}
        <div
          className="absolute inset-y-0 right-0 w-full opacity-35 lg:w-[52%] lg:opacity-70"
          data-qa="layered"
        >
          <Img
            name="splash"
            widths={[800, 1200, 1600, 2000]}
            sizes={HERO_SIZES}
            priority
            alt="A kitchen tap left running, water bursting out of an overflowing glass"
            className="h-full w-full object-cover"
            style={{ objectPosition: "50% 30%" }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0b1624_0%,rgb(11_22_36/0.6)_35%,transparent_80%)] max-lg:bg-[linear-gradient(to_bottom,rgb(11_22_36/0.5),rgb(11_22_36/0.9))]" />
        </div>
        {/* blueprint grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#8fdcec_1px,transparent_1px),linear-gradient(90deg,#8fdcec_1px,transparent_1px)] [background-size:48px_48px]"
          aria-hidden="true"
        />

        {/* dry: the outline */}
        <motion.div className="absolute inset-0 will-change-[opacity]" style={{ opacity: words }}>
          <Headline>
            <h1 id="hero-title" className="outline-text" data-qa="bg-sibling">
              <span className="sr-only">{SITE.name}: </span>
              {LINES.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </h1>
          </Headline>
        </motion.div>

        {/* wet: the water, rising */}
        <motion.div
          className="absolute inset-0 overflow-hidden will-change-transform"
          style={{ y: waterY }}
          aria-hidden="true"
        >
          <div className="absolute inset-x-0 top-0 h-6 overflow-hidden">
            <div className="flex h-full w-[200%] animate-wave will-change-transform">
              {[0, 1].map((k) => (
                <svg
                  key={k}
                  viewBox="0 0 1200 24"
                  preserveAspectRatio="none"
                  className="h-full w-1/2"
                >
                  <path
                    d="M0 12 C150 0 300 0 450 12 S750 24 900 12 S1100 0 1200 12 V24 H0 Z"
                    fill="#2f8fae"
                  />
                </svg>
              ))}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 top-[22px] bg-[linear-gradient(to_bottom,#2f8fae,#0f4c6b_45%,#0b2a44)]">
            {BUBBLES.map((b) => (
              <span
                key={b.left}
                className="absolute bottom-0 animate-rise rounded-full border border-pearl/60 will-change-transform"
                style={{
                  left: b.left,
                  width: b.size,
                  height: b.size,
                  animationDelay: `${b.delay}s`,
                }}
              />
            ))}
          </div>
          <motion.div
            className="absolute inset-0 will-change-transform"
            style={{ y: innerY, opacity: words }}
          >
            <Headline>
              <p className="text-ivory">
                {LINES.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </p>
            </Headline>
          </motion.div>
        </motion.div>

        {/* opening: status, then the two ways in */}
        <motion.div
          className="absolute inset-0 z-20 mx-auto flex max-w-[1440px] flex-col justify-between px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[88px] will-change-[opacity] md:px-10 lg:pb-12 lg:pt-28 xl:px-24"
          style={{ opacity: intro, pointerEvents: introEvents }}
        >
          <p className="flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-pearl md:text-[12.5px]">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5fd38a]/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#5fd38a]" />
            </span>
            <span>
              {live.status}
              <span className="max-sm:hidden" data-og-hide>
                {live.vans ? ` · ${live.vans} vans out now` : ""}
              </span>
            </span>
          </p>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-[36ch] text-[15.5px] leading-relaxed text-ivory/85 md:text-[17px]">
              Plumbers for Sydney's {SITE.area}. Burst pipes, blocked drains, hot water — a fixed
              price before we start, 24 hours a day.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={SITE.phoneHref} className="btn-honey sheen whitespace-nowrap px-6">
                <Phone size={16} strokeWidth={2} /> {SITE.phone}
              </a>
              <button
                onClick={() => openSheet()}
                className="btn-ghost-light whitespace-nowrap px-6"
              >
                Book a plumber
              </button>
              <button
                onClick={() => setEmergency(true)}
                className="btn border border-flare/60 px-5 text-flare hover:bg-flare hover:text-noir sm:hidden"
              >
                <Siren size={16} strokeWidth={2} /> Water everywhere?
              </button>
            </div>
          </div>
        </motion.div>

        {/* surfaced: the answer */}
        <motion.div
          data-qa="scroll-scene"
          className="absolute inset-0 z-30 mx-auto flex max-w-[1440px] flex-col justify-end px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] will-change-[transform,opacity] md:px-10 lg:pb-16 xl:px-24"
          style={{ opacity: outro, y: outroY, pointerEvents: outroEvents }}
        >
          <p className="font-display text-[clamp(56px,16vw,96px)] font-black uppercase leading-[0.86] [font-stretch:125%] lg:text-[clamp(96px,9.6vw,180px)]">
            Neither
            <br />
            <span className="text-flare">do we.</span>
          </p>
          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a href="#problems" className="btn-honey sheen self-start" tabIndex={-1}>
              What's wrong? <ArrowDown size={16} strokeWidth={2} />
            </a>
            <p className="max-w-[44ch] text-[14.5px] leading-relaxed text-ivory/85">
              A real person answers, day or night. A fixed price before we touch anything. Twelve
              months' guarantee after.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/** The headline's box — identical for the dry outline and the wet fill, so they line up exactly. */
function Headline({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 mx-auto flex max-w-[1440px] items-start px-5 pt-[max(19svh,150px)] md:px-10 lg:items-center lg:pt-0 xl:px-24">
      <div className="font-display text-[length:min(17vw,20svh,230px)] font-black uppercase leading-[0.84] tracking-[-0.02em] [font-stretch:125%] [&_h1]:font-black [&_h1]:leading-[0.84] [&_h1]:tracking-[-0.02em]">
        {children}
      </div>
    </div>
  );
}

function useLive() {
  const [live, setLive] = useState<{ status: string; vans: number | null }>({
    status: "On call 24/7",
    vans: null,
  });
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setLive({ status: openStatus(now).text, vans: vansOut(now) });
    };
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, []);
  return live;
}
