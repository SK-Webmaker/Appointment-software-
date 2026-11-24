import { motion, useInView } from "framer-motion";
import { CalendarCheck, Phone, RotateCcw, SprayCan, Users } from "lucide-react";
import { useRef, useState } from "react";
import { Bubbles } from "./Bubbles";
import { FogWindow } from "./FogWindow";
import { Magnetic } from "./fx/Magnetic";
import { SplitText } from "./fx/SplitText";
import { useTweened } from "./fx/Tween";
import { useIntroDone } from "./fx/intro";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { quote } from "@/lib/slots";
import { useReducedMotionSafe } from "@/lib/motion";

export const HERO_SIZES = "(min-width:1024px) 56vw, 100vw";
const EASE = [0.22, 1, 0.36, 1] as const;

const PROMISES = [
  { icon: Users, title: "The same cleaners each time", text: "For regular cleans." },
  { icon: CalendarCheck, title: "A fixed price per clean", text: "Worked out before we arrive." },
  { icon: SprayCan, title: "We bring everything", text: "Products, cloths, mops, vacuum." },
  { icon: RotateCcw, title: "24-hour re-clean guarantee", text: "Not happy? We come back free." },
];

const EXAMPLE = quote({
  bedrooms: 2,
  bathrooms: 1,
  clean: "regular",
  freq: "fortnightly",
  extras: [],
});

/**
 * The opening: what we do and where, beside a kitchen behind steamed-up
 * glass that a squeegee wipes clean (and you can wipe too). Soap bubbles
 * drift up and pop; the example price counts up. Four promises underneath.
 */
export function Hero() {
  const { openSheet } = useBooking();
  const intro = useIntroDone();
  const reduce = useReducedMotionSafe();
  const section = useRef<HTMLElement>(null);
  const visible = useInView(section);
  const [wiped, setWiped] = useState(false);
  const price = useTweened(intro || reduce ? EXAMPLE.price : 0, 1.6);
  const up = (d: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 24 } as const),
    animate: intro || reduce ? { opacity: 1, y: 0 } : {},
    transition: { duration: 0.8, ease: EASE, delay: d },
  });
  return (
    <>
      <section
        id="top"
        ref={section}
        className="relative overflow-hidden bg-ivory pt-16 text-ink"
        aria-labelledby="hero-title"
      >
        <Bubbles on={visible && intro && !reduce} />
        <div className="relative z-10 mx-auto grid max-w-[1320px] items-center gap-10 px-5 py-12 md:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:py-16">
          <div>
            <motion.p className="text-[15px] font-semibold text-rose" {...up(0)}>
              House cleaning · {SITE.area} · since {SITE.est}
            </motion.p>
            <SplitText
              as="h1"
              id="hero-title"
              text="A cleaner home, every other Friday"
              accent={["cleaner"]}
              accentClass="text-onyx"
              go={intro}
              delay={0.1}
              className="mt-4 max-w-[13ch] text-[clamp(44px,11vw,60px)] leading-[0.98] tracking-[-0.03em] lg:text-[clamp(60px,5.8vw,92px)]"
            />
            <motion.p
              className="mt-5 hidden max-w-[44ch] text-[17px] leading-relaxed text-ash sm:block md:text-[19px]"
              {...up(0.7)}
            >
              Regular, deep and end-of-lease cleaning across Sydney's {SITE.area}. A family business
              with the same small teams, a fixed price per clean, and everything brought with us.
            </motion.p>
            <motion.div className="mt-7 flex flex-col gap-3 sm:flex-row" {...up(0.85)}>
              <Magnetic>
                <a href="#quote" className="btn-primary w-full px-7 text-[16.5px] sm:w-auto">
                  Get your price
                </a>
              </Magnetic>
              <Magnetic>
                <a href={SITE.phoneHref} className="btn-ghost w-full px-6 text-[16.5px] sm:w-auto">
                  <Phone size={18} /> {SITE.phone}
                </a>
              </Magnetic>
            </motion.div>
            <motion.div {...up(1)}>
              <button
                type="button"
                onClick={() => openSheet()}
                className="mt-4 inline-flex min-h-[44px] items-center text-[15px] font-semibold text-onyx underline underline-offset-4"
              >
                Or book a clean now
              </button>
            </motion.div>
          </div>

          <motion.div
            className="relative"
            initial={reduce ? false : { opacity: 0, scale: 0.94, rotate: 1.5 }}
            animate={intro || reduce ? { opacity: 1, scale: 1, rotate: 0 } : {}}
            transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
          >
            {/* the window: frame, glass, and the bars between the panes */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border-[10px] border-white bg-stone shadow-[0_40px_80px_-40px_rgba(20,33,61,0.55)] lg:aspect-auto lg:h-[min(76vh,720px)]">
              <FogWindow go={intro} onWiped={setWiped} />
              <span
                className="pointer-events-none absolute inset-y-0 left-1/2 w-[8px] -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(20,33,61,0.18)]"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute inset-x-0 top-[44%] h-[8px] bg-white shadow-[0_0_12px_rgba(20,33,61,0.18)]"
                aria-hidden="true"
              />
              {!reduce && (
                <span
                  className="pointer-events-none absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[13.5px] font-semibold text-ink shadow-md transition-opacity duration-500"
                  style={{ opacity: intro ? 1 : 0 }}
                  aria-hidden="true"
                >
                  {wiped ? "Squeaky clean ✦" : "Wipe the glass ↔"}
                </span>
              )}
            </div>
            <div
              data-qa="layered"
              className="absolute -bottom-5 left-4 z-10 rounded-[12px] border border-ink/10 bg-white px-5 py-4 shadow-[0_18px_40px_-20px_rgba(20,33,61,0.35)] sm:left-6"
            >
              <p className="text-[13.5px] text-ash">Fortnightly clean, 2 bed, 1 bath</p>
              <p className="mt-0.5 text-[24px] font-bold leading-none">
                <span className="sr-only">${EXAMPLE.price}</span>
                <span aria-hidden="true" className="tabular-nums">
                  ${Math.round(price)}
                </span>
                <span className="ml-1 text-[14px] font-medium text-ash">per clean</span>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="relative z-10 border-y border-ink/10 bg-white">
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
