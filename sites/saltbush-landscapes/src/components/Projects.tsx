import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { GARDENS } from "@/site.config";

/** Recent projects: a plain photo grid, one large feature, with what we planted under each. */
export function Projects() {
  return (
    <section
      id="projects"
      className="bg-ivory py-20 text-ink md:py-28"
      aria-labelledby="projects-title"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="projects-title"
          label="Projects"
          title="Recent gardens around the Hills"
          intro="Front yards, courtyards and the awkward strip down the side — each one planted for its own soil and sun."
        />
        <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {GARDENS.map((g, i) => (
            <Reveal
              as="li"
              key={g.image}
              delay={(i % 4) * 0.04}
              className={i === 0 ? "col-span-2 row-span-2" : ""}
            >
              <figure className="flex h-full flex-col">
                <div
                  className={`overflow-hidden rounded-[12px] bg-stone ${i === 0 ? "aspect-[4/3] md:aspect-auto md:flex-1" : "aspect-[4/3]"}`}
                >
                  <Img
                    name={g.image}
                    widths={[800, 1200]}
                    sizes={
                      i === 0 ? "(min-width:768px) 640px, 92vw" : "(min-width:768px) 320px, 46vw"
                    }
                    alt={g.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="mt-2">
                  <span className="block text-[15px] font-bold">{g.caption}</span>
                  <span className="block text-[13.5px] text-ash">{g.plants}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
