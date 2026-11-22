import { ArrowUpRight } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { SETS, shadeOf, type Finish, type Shape } from "@/site.config";
import { useBooking } from "@/context/booking";

/**
 * Chapter II — the sets: recent work on a dark wall. Every set carries its
 * recipe (shade, finish, shape), so "Wear this" puts it in your booking.
 */
export function Sets() {
  const { openSheet } = useBooking();
  return (
    <section
      id="sets"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36"
      aria-labelledby="sets-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -left-48 top-1/4 h-[700px] w-[700px] bg-[radial-gradient(closest-side,rgb(226_162_176/0.18),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="sets" light />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="sets-title"
            className="max-w-[12ch] text-[clamp(46px,9.6vw,120px)] leading-[0.94]"
          >
            <MaskLines
              lines={[<>Recent sets,</>, <em className="text-pearl">recipes included.</em>]}
            />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.75] text-ivory/80 md:text-[17px]">
              See one you love? Tap <span className="font-semibold text-pearl">Wear this</span> and
              its shade, finish and shape go straight into your booking.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 columns-2 gap-3 md:mt-20 md:columns-3 md:gap-6 xl:columns-4">
          {SETS.map((s, i) => {
            const tall = i % 3 === 0;
            const sh = shadeOf(s.shade);
            return (
              <Reveal
                as="li"
                key={s.image}
                delay={(i % 4) * 0.06}
                className="mb-8 break-inside-avoid md:mb-12"
              >
                <figure className="group">
                  <div
                    className={`relative overflow-hidden rounded-t-[999px] rounded-b-[18px] bg-coal ring-1 ring-ivory/10 ${tall ? "aspect-[3/4.6]" : "aspect-[3/4]"}`}
                  >
                    <Img
                      name={s.image}
                      // A landscape photo in a portrait frame is cropped from its
                      // full height, so it renders nearly twice the frame's width.
                      widths={"landscape" in s ? [480, 800, 1200, 1600, 2000] : [480, 800, 1200]}
                      sizes={
                        "landscape" in s
                          ? "(min-width:1440px) 640px, (min-width:1280px) 45vw, (min-width:768px) 60vw, 92vw"
                          : "(min-width:1440px) 330px, (min-width:1280px) 23vw, (min-width:768px) 31vw, 47vw"
                      }
                      alt={s.alt}
                      className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                      style={{ objectPosition: s.position }}
                    />
                  </div>
                  <figcaption className="mt-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-1 ring-ivory/30"
                        style={{ background: sh?.hex }}
                        aria-hidden="true"
                      />
                      <span className="font-display text-[22px] leading-tight md:text-[26px]">
                        {s.title}
                      </span>
                    </span>
                    <span className="mt-1 block text-[13.5px] leading-snug text-ivory/75">
                      {s.caption}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        openSheet({
                          look: {
                            shade: s.shade,
                            finish: s.finish as Finish,
                            shape: s.shape as Shape,
                          },
                        })
                      }
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-pearl underline decoration-pearl/40 underline-offset-4 hover:decoration-pearl"
                      aria-label={`Wear this: ${s.title} — ${s.shade}, ${s.finish}, ${s.shape}`}
                    >
                      Wear this <ArrowUpRight size={15} strokeWidth={1.8} />
                    </button>
                  </figcaption>
                </figure>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
