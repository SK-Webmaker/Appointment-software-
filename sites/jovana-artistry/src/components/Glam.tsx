import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { LOOKS } from "@/site.config";

/**
 * Chapter I — the glam: her looks on a dark wall, each with her own caption.
 * The first is the tall one; the rest fall in beside it.
 */
export function Glam() {
  return (
    <section id="glam" className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36" aria-labelledby="glam-title">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -left-48 top-1/4 h-[700px] w-[700px] bg-[radial-gradient(closest-side,rgb(242_163_182/0.2),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="glam" light />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="glam-title" className="max-w-[13ch] text-[clamp(44px,9vw,108px)] leading-[0.98]">
            <MaskLines lines={[<>Soft glam,</>, <>full glam,</>, <em className="text-pearl">made for your face.</em>]} />
          </h2>
          <Reveal>
            <div className="max-w-[44ch] space-y-4 text-[15.5px] leading-[1.8] text-ivory/80 md:text-[16.5px]">
              <p>
                <span className="font-semibold text-pearl">Full Glam</span> — smokey eyes, glitter eyes, winged liner, a full coverage base with cream contour and complimentary lashes.
              </p>
              <p>
                <span className="font-semibold text-pearl">Soft Glam</span> — soft eyeshadows, winged eyeliner and complimentary lashes, personalised to suit your face.
              </p>
            </div>
          </Reveal>
        </div>

        <ul className="mt-14 grid grid-cols-2 gap-x-3 gap-y-8 md:mt-20 md:grid-cols-3 md:gap-x-6 md:gap-y-12">
          {LOOKS.map((w, i) => (
            <Reveal as="li" key={w.image} delay={(i % 3) * 0.06} className={i === 0 ? "col-span-2 md:col-span-1 md:row-span-2" : ""}>
              <figure className="group h-full">
                <div
                  className={`relative overflow-hidden rounded-[999px_999px_18px_18px] bg-coal shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-ivory/10 ${
                    i === 0 ? "aspect-[3/4] md:aspect-auto md:h-[calc(100%-3rem)]" : "aspect-[3/4]"
                  }`}
                >
                  <Img
                    name={w.image}
                    widths={[...w.widths]}
                    sizes={i === 0 ? "(min-width:1440px) 420px, (min-width:768px) 31vw, 94vw" : "(min-width:1440px) 420px, (min-width:768px) 31vw, 47vw"}
                    alt={w.alt}
                    className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                    style={{ objectPosition: "50% 25%" }}
                  />
                </div>
                <figcaption className="mt-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-pearl md:text-[12px]">{w.title}</span>
                  <span className="mt-1 block text-[14px] text-ivory/80">{w.caption}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
