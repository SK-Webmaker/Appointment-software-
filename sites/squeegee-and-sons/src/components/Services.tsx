import { ArrowRight } from "lucide-react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { RevealImg } from "./fx/RevealImg";
import { Tilt } from "./fx/Tilt";
import { VelocityMarquee } from "./fx/VelocityMarquee";
import { CLEANS, SERVICES } from "@/site.config";
import { useBooking } from "@/context/booking";
import { quote } from "@/lib/slots";

/** The three kinds of clean, each with a photo, what it's for and a "from" price. */
export function Services() {
  const { openSheet } = useBooking();
  return (
    <section
      id="services"
      className="overflow-hidden bg-white py-20 text-ink md:py-28"
      aria-labelledby="services-title"
    >
      <VelocityMarquee
        items={["Kitchens", "Bathrooms", "Ovens", "Windows", "Skirting", "Fridges", "Floors"]}
        outline
        className="-mt-4 mb-16 font-display text-[clamp(56px,10vw,150px)] font-extrabold leading-none tracking-[-0.03em] text-onyx md:mb-24"
      />
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="services-title"
          label="Services"
          title="Three kinds of clean, one standard"
          intro="Prices below are for a 1-bedroom, 1-bathroom home cleaned once. Add rooms, extras and a regular schedule in the price calculator."
        />
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {SERVICES.map((s, i) => {
            const from = quote({
              bedrooms: 1,
              bathrooms: 1,
              clean: s.id,
              freq: "once",
              extras: [],
            });
            const c = CLEANS.find((x) => x.id === s.id);
            return (
              <Reveal as="li" key={s.id} delay={i * 0.05}>
                <Tilt className="h-full">
                  <article className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-ink/10 bg-white shadow-[0_30px_60px_-40px_rgba(20,33,61,0.5)]">
                    <RevealImg className="aspect-[3/2] bg-stone" delay={i * 0.08}>
                      <Img
                        name={s.image}
                        widths={[800, 1200]}
                        sizes="(min-width:768px) 420px, 92vw"
                        alt={s.alt}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                      />
                    </RevealImg>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="text-[22px] leading-tight">{s.name}</h3>
                      <p className="mt-2 text-[15.5px] leading-relaxed text-ash">{s.text}</p>
                      <p className="mt-2 flex-1 text-[14.5px] text-ash">{c?.note}</p>
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
                        <p className="text-[14.5px] text-ash">
                          From <span className="text-[17px] font-bold text-ink">${from.price}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => openSheet({ clean: s.id, step: 0 })}
                          aria-label={`Book: ${s.name}`}
                          className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-onyx hover:underline"
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
      </div>
    </section>
  );
}
