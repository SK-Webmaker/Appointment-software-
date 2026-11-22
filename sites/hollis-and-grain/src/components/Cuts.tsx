import { ArrowUpRight } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { CUTS, serviceOf } from "@/site.config";
import { useBooking } from "@/context/booking";

/**
 * Chapter 01 — the cuts: six things we do, each a photo card with its price
 * and time. Tap one and it goes straight into your booking.
 */
export function Cuts() {
  const { openSheet } = useBooking();
  return (
    <section
      id="cuts"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="cuts-title"
    >
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="cuts" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="cuts-title" className="max-w-[12ch] text-[clamp(52px,11vw,136px)] leading-[0.86]">
            <MaskLines
              lines={[<>Every cut starts</>, <em className="text-rose">with a conversation.</em>]}
            />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.75] text-ash md:text-[17px]">
              Tell us how you wear it, how fast it grows and how long until you're back. Then we cut
              for that — not for the photo on the wall.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 md:mt-20 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
          {CUTS.map((c, i) => {
            const s = serviceOf(c.service);
            return (
              <Reveal
                as="li"
                key={c.service}
                delay={(i % 3) * 0.07}
                className={i % 3 === 1 ? "lg:translate-y-16" : ""}
              >
                <button
                  type="button"
                  onClick={() => openSheet({ service: c.service })}
                  className="group block w-full text-left"
                  aria-label={`Book a ${c.service} — $${s?.price}, ${s?.mins} minutes`}
                >
                  <span className="relative block aspect-[4/5] overflow-hidden rounded-[6px] bg-stone">
                    <Img
                      name={c.image}
                      widths={[...c.widths]}
                      // A landscape photo in a portrait card is cropped from its full
                      // height, so it renders ~1.9x wider than the card.
                      sizes={
                        c.widths.length > 4
                          ? "(min-width:1440px) 750px, (min-width:1024px) 56vw, (min-width:640px) 86vw, 172vw"
                          : "(min-width:1440px) 400px, (min-width:1024px) 30vw, (min-width:640px) 46vw, 92vw"
                      }
                      alt={c.alt}
                      className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                      style={{ objectPosition: c.position }}
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-noir/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory backdrop-blur-sm">
                      {s?.mins} min
                    </span>
                    <span aria-hidden="true" className="absolute bottom-3 right-3 flex h-12 w-12 translate-y-2 items-center justify-center rounded-full bg-rose text-ivory opacity-0 transition-[opacity,transform] duration-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 max-lg:translate-y-0 max-lg:opacity-100">
                      <ArrowUpRight size={20} strokeWidth={1.8} />
                    </span>
                  </span>
                  <span className="mt-4 flex items-baseline justify-between gap-4 border-b border-ink/15 pb-3">
                    <span className="font-display text-[30px] font-extrabold uppercase leading-none md:text-[34px]">
                      {c.service}
                    </span>
                    <span className="font-display text-[30px] font-bold leading-none text-rose md:text-[34px]">
                      ${s?.price}
                    </span>
                  </span>
                  <span className="aside mt-2 block text-[19px] leading-snug text-ash">
                    {c.line}
                  </span>
                </button>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
