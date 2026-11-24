import { ArrowRight } from "lucide-react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { RevealImg } from "./fx/RevealImg";
import { Tilt } from "./fx/Tilt";
import { VelocityMarquee } from "./fx/VelocityMarquee";
import { SERVICES, problemOf } from "@/site.config";
import { useBooking } from "@/context/booking";

/** What we do: six services, each with a photo, a line, a "from" price and a Book button. */
export function Services() {
  const { openSheet } = useBooking();
  return (
    <section
      id="services"
      className="overflow-hidden bg-ivory py-20 text-ink md:py-28"
      aria-labelledby="services-title"
    >
      <VelocityMarquee
        items={[
          "Leaking taps",
          "Blocked drains",
          "Hot water",
          "Gas fitting",
          "Toilets",
          "Stormwater",
        ]}
        outline
        className="-mt-4 mb-16 font-display text-[clamp(56px,10vw,150px)] font-semibold leading-none text-onyx md:mb-24"
      />
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="services-title"
          label="Services"
          title="Everyday plumbing, done properly"
          intro="From a dripping tap to a new hot water system. Every job gets a fixed price before we start, and we leave the place cleaner than we found it."
        />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => {
            const p = problemOf(s.id);
            return (
              <Reveal as="li" key={s.id} delay={(i % 3) * 0.05}>
                <Tilt className="h-full">
                  <article className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-ink/10 bg-white shadow-[0_30px_60px_-40px_rgba(15,43,42,0.45)]">
                    <RevealImg className="aspect-[3/2] bg-stone" delay={(i % 3) * 0.08}>
                      <Img
                        name={s.image}
                        widths={[800, 1200]}
                        sizes="(min-width:1024px) 420px, (min-width:640px) 46vw, 92vw"
                        alt={s.alt}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                      />
                    </RevealImg>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-sans text-[20px] font-bold tracking-[-0.01em]">
                        {s.name}
                      </h3>
                      <p className="mt-2 flex-1 text-[15.5px] leading-relaxed text-ash">{s.text}</p>
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
                        <p className="text-[14.5px] text-ash">
                          From <span className="font-semibold text-ink">${p?.from}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => openSheet({ problem: s.id })}
                          aria-label={`Book: ${s.name}`}
                          className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-onyx hover:underline"
                        >
                          Book <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                </Tilt>
              </Reveal>
            );
          })}
        </ul>
        <Reveal className="mt-5">
          <div className="flex flex-col gap-4 rounded-[14px] bg-noir p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <h3 className="font-sans text-[20px] font-bold">Bathroom or kitchen renovation?</h3>
              <p className="mt-1 text-[15.5px] text-white/80">
                Rough-in to fit-off, fixed-priced from your plans or a site visit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openSheet({ problem: "reno", urgency: "quote" })}
              className="btn-honey shrink-0"
            >
              Ask for a quote
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
