import { Img } from "./Img";
import { HScroll } from "./fx/HScroll";
import { SplitText } from "./fx/SplitText";
import { GARDENS } from "@/site.config";

/**
 * Recent gardens as a pinned sideways reel: the section holds while you
 * scroll and the gardens slide past, big, with what we planted in each.
 */
export function Projects() {
  return (
    <HScroll
      id="projects"
      labelledBy="projects-title"
      className="bg-noir text-white"
      head={
        <div className="flex w-[78vw] shrink-0 flex-col justify-center sm:w-[56vw] lg:w-[34vw]">
          <p className="text-[14px] font-semibold text-pearl">Projects</p>
          <SplitText
            as="h2"
            id="projects-title"
            text="Recent gardens around the Hills"
            className="mt-3 text-[clamp(36px,5.6vw,78px)] leading-[1.02]"
          />
          <p className="mt-5 max-w-[34ch] text-[16.5px] leading-relaxed text-white/75">
            Front yards, courtyards and the awkward strip down the side — each one planted for its
            own soil and sun. Keep scrolling →
          </p>
        </div>
      }
    >
      {GARDENS.map((g, i) => (
        <figure
          key={g.image}
          data-cursor="View"
          className={`group relative h-[64svh] shrink-0 overflow-hidden rounded-[18px] bg-coal ${i % 2 ? "w-[72vw] sm:w-[40vw] lg:w-[30vw]" : "w-[84vw] sm:w-[56vw] lg:w-[44vw]"}`}
        >
          <Img
            name={g.image}
            widths={[800, 1200]}
            sizes="(min-width:1024px) 44vw, 84vw"
            alt={g.alt}
            className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          <figcaption data-qa="layered" className="absolute inset-x-5 bottom-5">
            <span className="block font-display text-[clamp(22px,2.2vw,30px)] leading-tight">
              {g.caption}
            </span>
            <span className="mt-1 block text-[14px] text-white/85">{g.plants}</span>
          </figcaption>
          <span
            className="absolute right-5 top-4 font-display text-[44px] leading-none text-white/90"
            aria-hidden="true"
          >
            0{i + 1}
          </span>
        </figure>
      ))}
    </HScroll>
  );
}
