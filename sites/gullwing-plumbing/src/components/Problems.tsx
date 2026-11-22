import { ArrowRight, RotateCw } from "lucide-react";
import { useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { PROBLEMS } from "@/site.config";
import { useBooking } from "@/context/booking";

const WIDE = ["drip", "sink2", "hws"];

/**
 * Chapter 01 — what's wrong: six problems as cards. Tap one and it flips
 * (a real 3D turn) to the signs to look for, the fixed-price range, and
 * buttons to book it or price it exactly on the gauge.
 */
export function Problems() {
  const { openSheet, setProblem } = useBooking();
  const [flipped, setFlipped] = useState<string | null>(null);

  return (
    <section
      id="problems"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="problems-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="problems" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="problems-title"
            className="max-w-[14ch] text-[clamp(40px,8.6vw,108px)] leading-[0.88]"
          >
            <MaskLines
              lines={[<>What's</>, <>going on</>, <em className="text-rose">at your place?</em>]}
            />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.75] text-ash md:text-[17px]">
              Tap the one that sounds like you. Each card turns over to show what to look for and
              what it usually costs — a fixed price, quoted before we start.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 md:mt-20 lg:grid-cols-3 lg:gap-6">
          {PROBLEMS.map((p, i) => {
            const on = flipped === p.id;
            return (
              <Reveal as="li" key={p.id} delay={(i % 3) * 0.07} className="[perspective:1400px]">
                <div
                  className={`relative h-[440px] transition-transform duration-[900ms] ease-[cubic-bezier(0.65,0,0.35,1)] [transform-style:preserve-3d] ${on ? "[transform:rotateY(180deg)]" : ""}`}
                >
                  {/* front */}
                  <div
                    data-qa="layered"
                    className="absolute inset-0 overflow-hidden rounded-[18px] bg-noir text-ivory [backface-visibility:hidden]"
                    aria-hidden={on}
                  >
                    <Img
                      name={p.image}
                      // Landscape photos fill a tall card from their full height, so they
                      // render far wider than the card.
                      widths={WIDE.includes(p.image) ? [480, 800, 1200, 1600, 2000] : [480, 800, 1200]}
                      sizes={
                        WIDE.includes(p.image)
                          ? "(min-width:1440px) 720px, (min-width:1024px) 52vw, (min-width:640px) 80vw, 160vw"
                          : "(min-width:1440px) 420px, (min-width:1024px) 30vw, (min-width:640px) 46vw, 92vw"
                      }
                      alt={p.alt}
                      className="absolute inset-0 h-full w-full object-cover opacity-70"
                      style={{ objectPosition: p.position }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(to_top,#0b1624_15%,rgb(11_22_36/0.2)_65%)]" />
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      {p.urgent && (
                        <span className="mb-3 inline-block rounded-full bg-flare px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-noir">
                          Urgent? 24/7
                        </span>
                      )}
                      <h3 className="text-[34px] leading-[0.9] md:text-[38px]">{p.name}</h3>
                      <p className="mt-2 font-mono text-[14px] text-pearl">from ${p.from}</p>
                      <button
                        type="button"
                        onClick={() => setFlipped(p.id)}
                        tabIndex={on ? -1 : 0}
                        className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ivory/40 px-4 text-[12px] font-semibold uppercase tracking-[0.16em] hover:border-ivory hover:bg-ivory hover:text-noir"
                      >
                        <RotateCw size={14} strokeWidth={2} /> Signs & price
                        <span className="sr-only">for {p.name}</span>
                      </button>
                    </div>
                  </div>
                  {/* back */}
                  <div
                    className="absolute inset-0 flex flex-col rounded-[18px] bg-onyx p-6 text-ivory [backface-visibility:hidden] [transform:rotateY(180deg)]"
                    aria-hidden={!on}
                  >
                    <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-pearl">
                      {p.name} · the signs
                    </p>
                    <ul className="mt-4 space-y-2.5">
                      {p.signs.map((s) => (
                        <li key={s} className="flex gap-3 text-[15.5px] leading-snug">
                          <span className="mt-[0.45em] h-2 w-2 shrink-0 rounded-full bg-flare" />
                          {s}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto">
                      <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-mist">
                        Usually
                      </p>
                      <p className="font-display text-[34px] font-black leading-none [font-stretch:125%]">
                        ${p.from}–${p.to}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          tabIndex={on ? 0 : -1}
                          onClick={() => openSheet({ problem: p.id })}
                          className="btn-honey min-h-[46px] px-5 text-[11.5px]"
                        >
                          Book this <ArrowRight size={15} strokeWidth={2} />
                        </button>
                        <a
                          href="#prices"
                          tabIndex={on ? 0 : -1}
                          onClick={() => setProblem(p.id)}
                          className="btn-ghost-light min-h-[46px] px-5 text-[11.5px]"
                        >
                          Exact price
                        </a>
                        <button
                          type="button"
                          tabIndex={on ? 0 : -1}
                          onClick={() => setFlipped(null)}
                          className="grid h-[46px] w-[46px] place-items-center rounded-full border border-ivory/30 hover:bg-ivory hover:text-noir"
                          aria-label={`Turn the ${p.name} card back`}
                        >
                          <RotateCw size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
