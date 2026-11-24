import { Img } from "./Img";
import { HScroll } from "./fx/HScroll";
import { SplitText } from "./fx/SplitText";
import { WORK } from "@/site.config";

const SHOWN = WORK.slice(0, 7);

/**
 * Recent work as a pinned sideways reel: the section holds while you scroll
 * and the photos slide past, big, each with where it is.
 */
export function Work() {
  return (
    <HScroll
      id="work"
      labelledBy="work-title"
      className="bg-noir text-white"
      head={
        <div className="flex w-[78vw] shrink-0 flex-col justify-center sm:w-[56vw] lg:w-[34vw]">
          <p className="text-[14px] font-semibold text-pearl">Recent work</p>
          <SplitText
            as="h2"
            id="work-title"
            text="Bathrooms, kitchens and everything behind the walls"
            className="mt-3 text-[clamp(34px,5.4vw,72px)] leading-[1.02]"
          />
          <p className="mt-5 max-w-[34ch] text-[16.5px] leading-relaxed text-white/75">
            A few recent jobs from around the Beaches. Keep scrolling →
          </p>
        </div>
      }
    >
      {SHOWN.map((w, i) => (
        <figure
          key={w.image}
          data-cursor="View"
          className={`group relative h-[62svh] shrink-0 overflow-hidden rounded-[18px] bg-coal ${i % 2 ? "w-[70vw] sm:w-[40vw] lg:w-[30vw]" : "w-[82vw] sm:w-[56vw] lg:w-[44vw]"}`}
        >
          <Img
            name={w.image}
            widths={[800, 1200]}
            sizes="(min-width:1024px) 44vw, 82vw"
            alt={w.alt}
            className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
          />
          <figcaption
            data-qa="layered"
            className="absolute bottom-4 left-4 rounded-full bg-white px-4 py-2 text-[14.5px] font-semibold text-ink"
          >
            {w.caption}
          </figcaption>
          <span
            className="absolute right-4 top-4 font-display text-[44px] font-semibold leading-none text-white/90"
            aria-hidden="true"
          >
            0{i + 1}
          </span>
        </figure>
      ))}
    </HScroll>
  );
}
