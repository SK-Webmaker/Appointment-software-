import { motion, useScroll, useTransform } from "framer-motion";
import { ClipboardList, Leaf, Phone, Shovel, Sprout } from "lucide-react";
import { useRef } from "react";
import { Img } from "./Img";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

/** The photo fills a portrait screen by its height, so it needs more pixels there. */
export const HERO_SIZES = "(max-aspect-ratio: 1/1) 160vh, 100vw";

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

/**
 * The opening: a full-width photo of a finished native garden, what we do in
 * one line, Book and Call, and four promises underneath. The photo drifts a
 * little as you scroll — nothing more.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const { openSheet } = useBooking();
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  return (
    <>
      <section
        id="top"
        ref={section}
        className="relative isolate flex h-[88svh] min-h-[640px] items-end overflow-hidden bg-noir pt-16 text-white lg:h-[86vh] lg:max-h-[900px]"
        aria-labelledby="hero-title"
      >
        <motion.div className="absolute inset-0 -z-10 will-change-transform" style={{ y }}>
          <Img
            name="hero2"
            widths={[800, 1200, 1600, 2000, 2400]}
            sizes={HERO_SIZES}
            alt="A native garden of silver shrubs, grasses and boulders along a gravel path"
            priority
            className="h-full w-full object-cover object-[55%_50%]"
          />
        </motion.div>
        <div
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(20_28_22/0.92),rgb(20_28_22/0.72)_55%,rgb(20_28_22/0.35)_85%)] lg:bg-[linear-gradient(to_right,rgb(20_28_22/0.85),rgb(20_28_22/0.55)_45%,rgb(20_28_22/0)_75%)]"
          aria-hidden="true"
        />
        <div
          data-qa="layered"
          className="mx-auto w-full max-w-[1320px] px-5 pb-10 md:px-8 lg:pb-20"
        >
          <p className="text-[15px] font-semibold text-silk">Native garden design · {SITE.area}</p>
          <h1
            id="hero-title"
            className="mt-4 max-w-[15ch] text-[clamp(40px,10.5vw,58px)] leading-[1.04] lg:text-[clamp(56px,5.4vw,84px)]"
          >
            Gardens that suit the Hills, and look after themselves
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-white/90 md:text-[19px]">
            Design, construction and planting for Sydney's {SITE.area} — with plants chosen for our
            clay, our summers and our birds. Since {SITE.est}.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => openSheet()} className="btn-honey px-7 text-[16.5px]">
              Book a free site visit
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
                <span className="block text-[15.5px] font-bold leading-snug">{p.title}</span>
                <span className="block text-[14.5px] text-ash">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
