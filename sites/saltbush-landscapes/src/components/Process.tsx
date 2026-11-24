import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { PROCESS, SITE } from "@/site.config";

/** How a garden happens: four steps, each with a photo, from site visit to aftercare. */
export function Process() {
  return (
    <section
      id="process"
      className="bg-white py-20 text-ink md:py-28"
      aria-labelledby="process-title"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="process-title"
          label="How we work"
          title="From a walk around the garden to the first flowers"
          intro={`We're a small team based in the Hills, designing and building gardens here since ${SITE.est}. The same people who draw your plan are the ones who plant it.`}
        />
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((p, i) => (
            <Reveal as="li" key={p.title} delay={i * 0.05}>
              <div className="aspect-[4/3] overflow-hidden rounded-[14px] bg-stone">
                <Img
                  name={p.image}
                  widths={[800, 1200]}
                  sizes="(min-width:1024px) 310px, (min-width:640px) 46vw, 92vw"
                  alt={p.alt}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-5 text-[14px] font-bold text-onyx">Step {i + 1}</p>
              <h3 className="mt-1 font-sans text-[20px] font-bold">{p.title}</h3>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ash">{p.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
