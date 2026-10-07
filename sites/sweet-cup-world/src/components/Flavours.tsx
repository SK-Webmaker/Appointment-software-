import { ArrowRight, Instagram } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { FLAVOURS, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

/** Chapter II — their six flavours, set like the arched frames of their flavour menu. */
export function Flavours() {
  const { openSheet, flavours, toggleFlavour } = useBooking();

  return (
    <section id="flavours" className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36" aria-labelledby="flavours-title">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -left-48 top-1/4 h-[680px] w-[680px] bg-[radial-gradient(closest-side,rgb(161_25_79/0.32),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="flavours" light />

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="flavours-title" className="text-[clamp(42px,9vw,104px)] leading-[0.98]">
            <MaskLines lines={[<>Dessert cup</>, <em className="text-pearl">flavours.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16.5px] leading-[1.8] text-ivory/80 md:text-[17.5px]">
              Six flavours, layered by hand — {SITE.price} a cup. Tap the ones you’d like and they’ll go straight into your order message.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-20 md:grid-cols-3 md:gap-x-8 md:gap-y-14">
          {FLAVOURS.map((f, i) => {
            const on = flavours.includes(f.name);
            return (
              <Reveal as="li" key={f.name} delay={(i % 3) * 0.06}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFlavour(f.name)}
                  className="group block w-full text-left"
                >
                  <span className={`relative block aspect-square overflow-hidden rounded-t-full bg-stone ring-2 transition-[box-shadow,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 ${on ? "ring-silk" : "ring-transparent"}`}>
                    <Img name={f.image} widths={[290]} sizes="(min-width:768px) 290px, 45vw" alt="" className="h-full w-full object-cover" />
                    <span className={`absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[13px] font-medium transition-colors ${on ? "bg-silk text-noir" : "bg-noir/70 text-ivory"}`} aria-hidden="true">
                      {on ? "✓" : i + 1}
                    </span>
                  </span>
                  <span className="mt-4 flex items-baseline justify-between gap-3">
                    <span className="font-display text-[clamp(21px,5.2vw,30px)] leading-tight">{f.name}</span>
                    <span className="shrink-0 text-[13px] font-medium tracking-[0.12em] text-silk">{SITE.price}</span>
                  </span>
                  {f.note && <span className="mt-1 block text-[14px] leading-snug text-ivory/75">{f.note}</span>}
                  <span className="sr-only">{on ? " (chosen)" : " (tap to choose)"}</span>
                </button>
              </Reveal>
            );
          })}
        </ul>

        <Reveal className="mt-14 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button onClick={openSheet} className="btn-honey sheen">
            Order {flavours.length ? `${flavours.length} flavour${flavours.length > 1 ? "s" : ""}` : "now"} <ArrowRight size={16} strokeWidth={1.8} />
          </button>
          <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="btn-ghost-light">
            <Instagram size={16} strokeWidth={1.7} /> Ask about a flavour
          </a>
          <p className="text-[14px] text-ivory/75 sm:ml-4">Free customisations · pickup or delivery</p>
        </Reveal>
      </div>
    </section>
  );
}
