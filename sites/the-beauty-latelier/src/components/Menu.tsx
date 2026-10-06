import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { Check, Plus } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { CATEGORIES, formatPrice, type Service } from "@/site.config";
import { useBooking } from "@/context/booking";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Chapter II — her full price list, as a menu you can build an appointment from. */
export function Menu() {
  const [active, setActive] = useState(CATEGORIES[0]?.id ?? "nails");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = useReducedMotionSafe();
  const cat = CATEGORIES.find((c) => c.id === active) ?? CATEGORIES[0];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = CATEGORIES.findIndex((c) => c.id === active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const n = (next + CATEGORIES.length) % CATEGORIES.length;
    const target = CATEGORIES[n];
    if (!target) return;
    setActive(target.id);
    tabs.current[n]?.focus();
  };

  if (!cat) return null;

  return (
    <section id="menu" className="relative bg-linen pb-24 pt-24 md:pb-36 md:pt-32" aria-labelledby="menu-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <ChapterLabel id="menu" />
            <h2 id="menu-title" className="mt-8 text-[clamp(52px,13vw,150px)] leading-[0.9] text-espresso">
              <MaskLines lines={[<>The <em className="text-bronze">menu</em></>]} />
            </h2>
          </div>
          <Reveal className="max-w-[40ch] lg:pb-4">
            <p className="text-[16px] leading-[1.75] text-mocha">
              Explore the full range of beauty, nail, lash &amp; brow services. Tap <span className="inline-grid h-5 w-5 translate-y-[3px] place-items-center rounded-full bg-espresso text-cream"><Plus size={12} strokeWidth={2.4} /></span> to add a service to your appointment, then send it to Helena in one tap.
            </p>
          </Reveal>
        </div>

        {/* Tabs — sticky under the nav on phones so you can switch while browsing */}
        <div className="sticky top-[66px] z-30 -mx-5 mt-12 border-b border-espresso/10 bg-linen/90 px-5 py-3 backdrop-blur-lg md:static md:border-0 md:mx-0 md:mt-16 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <div role="tablist" aria-label="Service categories" onKeyDown={onKey} data-qa="scroller" className="no-scrollbar flex gap-1.5 overflow-x-auto md:gap-3">
            {CATEGORIES.map((c, i) => {
              const on = c.id === active;
              return (
                <button
                  key={c.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  id={`tab-${c.id}`}
                  aria-selected={on}
                  aria-controls={`panel-${c.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(c.id)}
                  className={`relative min-h-[44px] shrink-0 rounded-full px-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors duration-300 sm:px-5 sm:tracking-[0.18em] md:px-7 md:text-[12px] ${
                    on ? "text-cream" : "border border-espresso/20 text-espresso/75 hover:border-espresso/50 hover:text-espresso"
                  }`}
                >
                  {on && (
                    <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-espresso" transition={{ type: "spring", stiffness: 380, damping: 34 }} />
                  )}
                  {/* the active pill is a sibling, so automated contrast checks can't see it:
                      cream on espresso, 14:1 — checked by hand */}
                  <span className="relative sm:hidden" data-qa="bg-sibling">{c.short}</span>
                  <span className="relative hidden sm:inline" data-qa="bg-sibling">{c.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 md:mt-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={cat.id}
              id={`panel-${cat.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${cat.id}`}
              className="grid gap-8 md:gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -16 }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              <figure className="relative" data-qa="layered">
                <div className="arch relative overflow-hidden bg-champagne">
                  <motion.div
                    initial={reduce ? false : { scale: 1.12 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 1.4, ease: EASE }}
                  >
                    <Img
                      name={cat.image.name}
                      widths={cat.image.widths}
                      sizes="(min-width:1024px) 40vw, 100vw"
                      alt={cat.image.alt}
                      className="aspect-[5/4] w-full object-cover sm:aspect-[4/3] lg:aspect-[4/5]"
                      style={{ objectPosition: cat.image.position }}
                    />
                  </motion.div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-6 pt-20 md:p-8 md:pt-28">
                    <p className="font-display text-[34px] leading-none text-cream md:text-[44px]">{cat.title}</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">{cat.kicker}</p>
                  </div>
                </div>
                {cat.image.credit && <figcaption className="mt-2 text-right text-[10px] uppercase tracking-[0.2em] text-mocha/70">{cat.image.credit}</figcaption>}
              </figure>

              <div>
                <p className="opsz-sm max-w-[44ch] font-display text-[22px] leading-snug text-espresso md:text-[26px]">{cat.blurb}</p>
                <ul className="mt-6 border-t border-espresso/15 md:mt-8">
                  {cat.services.map((s, i) => (
                    <ServiceRow key={s.id} service={s} index={i} />
                  ))}
                </ul>
                <p className="mt-6 text-[13px] leading-relaxed text-mocha">
                  “From” prices depend on length, condition and add-ons. Curious what's in a package? Ask Helena when you book — she'll confirm your quote.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function ServiceRow({ service, index }: { service: Service; index: number }) {
  const { isSelected, toggle } = useBooking();
  const on = isSelected(service.id);
  const reduce = useReducedMotionSafe();
  return (
    <motion.li
      className="border-b border-espresso/15"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.05 + index * 0.045 }}
    >
      <button
        onClick={() => toggle(service.id)}
        aria-pressed={on}
        className={`group grid min-h-[68px] w-full grid-cols-[1fr_auto_auto] items-center gap-4 py-4 text-left transition-colors duration-300 md:gap-6 md:py-5 ${on ? "bg-card/70" : "hover:bg-card/40"}`}
      >
        <span className="min-w-0 pl-1">
          <span className="block text-[12.5px] font-semibold uppercase tracking-[0.16em] text-espresso md:text-[13.5px]">{service.name}</span>
          {service.note && <span className="mt-1 block text-[13.5px] leading-snug text-mocha">{service.note}</span>}
        </span>
        <span className={`opsz-sm whitespace-nowrap font-display text-[20px] leading-none md:text-[24px] ${service.price === null ? "text-[15px] italic text-mocha md:text-[17px]" : "text-espresso"}`}>
          {formatPrice(service)}
        </span>
        <span className="sr-only">Add to your appointment</span>
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            on ? "border-bronze bg-bronze text-ivory" : "border-espresso/25 text-espresso group-hover:border-espresso group-hover:bg-espresso group-hover:text-cream"
          }`}
          aria-hidden="true"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={on ? "on" : "off"} initial={{ scale: 0.4, rotate: -90, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.4, rotate: 90, opacity: 0 }} transition={{ duration: 0.25 }}>
              {on ? <Check size={16} strokeWidth={2.2} /> : <Plus size={16} strokeWidth={2} />}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
    </motion.li>
  );
}
