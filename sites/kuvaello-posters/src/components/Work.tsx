import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { WORK } from "@/site.config";

/** Chapter I — their selected work: six posters hung on a dark wall, each captioned "sport · style". */
export function Work() {
  return (
    <section id="work" className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36" aria-labelledby="work-title">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -left-48 top-1/4 h-[700px] w-[700px] bg-[radial-gradient(closest-side,rgb(242_165_65/0.18),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="work" light />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="work-title" className="max-w-[14ch] text-[clamp(44px,9.4vw,112px)] leading-[0.95]">
            <MaskLines lines={[<>Different sports.</>, <em className="text-pearl">The same Kuvaello feeling.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.8] text-ivory/80 md:text-[17px]">
              Every design is built around the athlete and the sport. No one-size-fits-all template — each piece gets its own identity.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid grid-cols-2 gap-x-3 gap-y-8 md:mt-20 md:grid-cols-3 md:gap-x-6 md:gap-y-12">
          {WORK.map((w, i) => (
            <Reveal as="li" key={w.image} delay={(i % 3) * 0.06}>
              <figure className="group">
                <div className="relative aspect-square overflow-hidden rounded-[6px] bg-coal shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-ivory/10">
                  <Img
                    name={w.image}
                    widths={[480, 800, 1200]}
                    sizes="(min-width:1440px) 400px, (min-width:768px) 31vw, 47vw"
                    alt={w.alt}
                    className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                  />
                </div>
                <figcaption className="mt-3 flex items-baseline justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] md:text-[12px]">
                  <span className="text-ivory">{w.sport}</span>
                  <span className="text-pearl">{w.style}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
