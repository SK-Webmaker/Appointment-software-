import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { WORK } from "@/site.config";

const SHOWN = WORK.slice(0, 7);

/** Recent work: a plain photo grid with a caption under each, one large feature. */
export function Work() {
  return (
    <section id="work" className="bg-white py-20 text-ink md:py-28" aria-labelledby="work-title">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="work-title"
          label="Recent work"
          title="Bathrooms, kitchens and everything behind the walls"
          intro="A few recent jobs from around the Beaches — renovations we plumbed from rough-in to the last tap."
        />
        <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {SHOWN.map((w, i) => (
            <Reveal
              as="li"
              key={w.image}
              delay={(i % 4) * 0.04}
              className={i === 0 ? "col-span-2 row-span-2" : ""}
            >
              <figure className="h-full">
                <div
                  className={`overflow-hidden rounded-[12px] bg-stone ${i === 0 ? "aspect-[4/3] md:aspect-auto md:h-[calc(100%-2.25rem)]" : "aspect-[4/3]"}`}
                >
                  <Img
                    name={w.image}
                    widths={[800, 1200]}
                    sizes={
                      i === 0 ? "(min-width:768px) 640px, 92vw" : "(min-width:768px) 320px, 46vw"
                    }
                    alt={w.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="mt-2 text-[14px] text-ash">{w.caption}</figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
