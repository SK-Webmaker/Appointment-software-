import { ArrowRight, Check, Phone } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { FAQ, MENU, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

/** Chapter IV — the full menu. Tap a service to put it in your booking; the FAQ underneath. */
export function Menu() {
  const { openSheet, service, setService } = useBooking();

  return (
    <section
      id="menu"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36"
      aria-labelledby="menu-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-48 top-1/3 h-[700px] w-[700px] bg-[radial-gradient(closest-side,rgb(226_162_176/0.16),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="menu" light />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="menu-title" className="text-[clamp(48px,10vw,120px)] leading-[0.95]">
            <MaskLines lines={[<>The</>, <em className="text-pearl">menu.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[38ch] text-[16px] leading-[1.8] text-ivory/80 md:text-[17px]">
              Prices in AUD, colour included. Tap a service to add it to your booking.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-10 md:mt-20 lg:grid-cols-2 lg:gap-x-16">
          {MENU.map((g) => (
            <Reveal key={g.group}>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.24em] text-pearl">
                {g.group}
              </h3>
              <ul className="mt-4 border-t border-ivory/10">
                {g.items.map((it) => {
                  const on = service === it.name;
                  const row = (
                    <span className="flex w-full items-start justify-between gap-4">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-display text-[24px] leading-tight md:text-[26px]">
                          {on && <Check size={18} strokeWidth={2.2} aria-hidden="true" />}
                          {it.name}
                        </span>
                        <span
                          className={`mt-1 block text-[13.5px] leading-snug ${on ? "text-noir/80" : "text-ivory/70"}`}
                        >
                          {it.mins} min · {it.note}
                        </span>
                      </span>
                      <span className="shrink-0 font-display text-[26px] leading-tight">
                        ${it.price}
                      </span>
                    </span>
                  );
                  return (
                    <li key={it.name} className="border-b border-ivory/10">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setService(on ? "" : it.name)}
                        className={`w-full rounded-[10px] px-3 py-4 text-left transition-colors duration-300 ${on ? "bg-silk text-noir" : "text-ivory hover:bg-coal"}`}
                      >
                        {row}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button onClick={() => openSheet()} className="btn-honey sheen">
            {service ? `Book ${service}` : "Book now"} <ArrowRight size={16} strokeWidth={1.8} />
          </button>
          <a href={SITE.phoneHref} className="btn-ghost-light">
            <Phone size={16} strokeWidth={1.7} /> {SITE.phone}
          </a>
        </Reveal>

        <div className="mt-20 grid gap-x-12 border-t border-ivory/10 pt-12 md:mt-28 lg:grid-cols-[0.8fr_1.2fr]">
          <h3 className="text-[clamp(34px,4.4vw,52px)] leading-[1]">Before you book</h3>
          <div className="mt-6 lg:mt-0">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-ivory/10 py-4">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-ivory">
                  {f.q}
                  <span
                    className="text-[22px] text-pearl transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ivory/75">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
