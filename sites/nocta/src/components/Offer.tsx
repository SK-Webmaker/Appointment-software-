import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Plus } from "lucide-react";
import { useState } from "react";
import { OFFERS } from "@/site.config";
import { useBooking } from "@/context/booking";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines } from "./Reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Commissions: a broadsheet list. Hovering a row slides it along and lights
 * its number; opening one shows what it is and a way straight into the brief.
 */
export function Offer() {
  const [open, setOpen] = useState<number | null>(0);
  const { setOffer, openSheet } = useBooking();
  return (
    <section id="offer" className="sheet bg-void pb-28 pt-24 md:pb-40 md:pt-32">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-[15%] top-[20%] h-[80vh] w-[80vh] rounded-full bg-[radial-gradient(closest-side,rgba(255,181,71,0.10),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-16">
        <ChapterLabel id="offer" />
        <h2 className="mt-8 flex flex-wrap items-end justify-between gap-x-6 text-[clamp(52px,10vw,170px)] font-extrabold uppercase">
          <MaskLines lines={["What we"]} />
          <MaskLines lines={[<span key="l" className="font-serif font-normal normal-case italic text-amber">light.</span>]} delay={0.1} />
        </h2>

        <ul className="mt-14 border-t border-bone/15 md:mt-20">
          {OFFERS.map((o, i) => {
            const on = open === i;
            return (
              <li key={o.name} className="border-b border-bone/15">
                <h3 className="font-sans">
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls={`offer-${i}`}
                    onClick={() => setOpen(on ? null : i)}
                    className="group flex min-h-[88px] w-full items-center gap-5 py-5 text-left md:min-h-[120px] md:gap-10"
                  >
                    <span className={`stamp w-10 shrink-0 transition-colors duration-500 ${on ? "text-amber" : "text-haze group-hover:text-amber"}`}>0{i + 1}</span>
                    <span className="flex-1 font-display text-[clamp(30px,5.4vw,84px)] font-bold uppercase leading-none tracking-[-0.03em] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-4">
                      {o.name}
                    </span>
                    <span
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition-[transform,background-color,border-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:h-16 md:w-16 ${
                        on ? "rotate-45 border-amber bg-amber text-void" : "border-bone/25 text-bone group-hover:border-amber"
                      }`}
                      aria-hidden="true"
                    >
                      <Plus size={22} strokeWidth={1.6} />
                    </span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div
                      id={`offer-${i}`}
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.6, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-6 pb-8 pl-[60px] md:flex-row md:items-end md:justify-between md:pb-10 md:pl-[80px]">
                        <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-haze">{o.detail}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setOffer(o.name);
                            openSheet();
                          }}
                          className="btn-ghost min-h-[48px] self-start"
                        >
                          Brief a {o.name.toLowerCase()} <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
