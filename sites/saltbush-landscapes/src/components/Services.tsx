import { ArrowRight } from "lucide-react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { SERVICES } from "@/site.config";
import { useBooking } from "@/context/booking";

/** What we do: four services, each with a photo, a line, a price guide and a Book button. */
export function Services() {
  const { openSheet } = useBooking();
  return (
    <section
      id="services"
      className="bg-ivory py-20 text-ink md:py-28"
      aria-labelledby="services-title"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="services-title"
          label="Services"
          title="Design, build and planting — one local crew"
          intro="Most of our gardens start with a plan and end with a mulched bed full of natives. We can do the whole thing, or just the part you need."
        />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s, i) => (
            <Reveal as="li" key={s.id} delay={(i % 4) * 0.05}>
              <article className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-ink/10 bg-white">
                <div className="aspect-[4/3] overflow-hidden bg-stone">
                  <Img
                    name={s.image}
                    widths={[800, 1200]}
                    sizes="(min-width:1024px) 310px, (min-width:640px) 46vw, 92vw"
                    alt={s.alt}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-sans text-[20px] font-bold tracking-[-0.01em]">{s.name}</h3>
                  <p className="mt-2 flex-1 text-[15.5px] leading-relaxed text-ash">{s.text}</p>
                  <p className="mt-4 text-[14.5px] font-semibold text-ink">{s.price}</p>
                  <button
                    type="button"
                    onClick={() => openSheet({ project: s.id })}
                    aria-label={`Book a visit: ${s.name}`}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-bold text-onyx hover:underline"
                  >
                    Book a visit <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
