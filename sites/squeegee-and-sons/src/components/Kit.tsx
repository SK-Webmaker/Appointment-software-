import { Img } from "./Img";
import { SplitText } from "./fx/SplitText";
import { HScroll } from "./fx/HScroll";
import { BUCKET } from "@/site.config";

const STEPS = [
  {
    title: "Get a price",
    text: "Use the calculator or call. The price is per clean, and it doesn't change on the day.",
  },
  {
    title: "Pick a time",
    text: "Choose a day and an arrival time. Regular cleans keep that slot.",
  },
  {
    title: "Let us in",
    text: "Be home, leave a key in a lockbox, or use the concierge. We text on arrival and when we lock up.",
  },
  {
    title: "Check our work",
    text: "Not happy with anything? Tell us within 24 hours and we'll come back and redo it, free.",
  },
];

const TONES = [
  "bg-onyx text-white",
  "bg-candy text-ink",
  "bg-flare text-ink",
  "bg-noir text-white",
] as const;

/**
 * What we bring, as a pinned sideways reel of the kit — then how a booking
 * works, as a stack of cards that pile up as you scroll.
 */
export function Kit() {
  return (
    <>
      <HScroll
        id="kit"
        labelledBy="kit-title"
        className="bg-noir text-white"
        head={
          <div className="flex w-[80vw] shrink-0 flex-col justify-center sm:w-[56vw] lg:w-[34vw]">
            <p className="text-[14px] font-semibold text-pearl">Our kit</p>
            <SplitText
              as="h2"
              id="kit-title"
              text="We bring everything with us"
              className="mt-3 text-[clamp(38px,5.8vw,84px)] font-extrabold leading-[0.98] tracking-[-0.03em]"
            />
            <p className="mt-5 max-w-[36ch] text-[16.5px] leading-relaxed text-white/80">
              Plant-based products, colour-coded cloths and our own equipment — so you don't need to
              buy anything, and nothing from the bathroom goes near the kitchen. Keep scrolling →
            </p>
          </div>
        }
      >
        {BUCKET.map((b, i) => (
          <figure
            key={b.id}
            className={`relative flex h-[66svh] shrink-0 flex-col overflow-hidden rounded-[20px] bg-coal ${i % 2 ? "w-[74vw] sm:w-[42vw] lg:w-[28vw]" : "w-[80vw] sm:w-[50vw] lg:w-[36vw]"}`}
          >
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <Img
                name={b.image}
                widths={[800, 1200]}
                sizes="(min-width:1024px) 36vw, 80vw"
                alt={b.alt}
                className="h-full w-full object-cover"
              />
              <span
                className="absolute right-4 top-3 text-[48px] font-extrabold leading-none tracking-[-0.04em] text-white/90"
                aria-hidden="true"
              >
                0{i + 1}
              </span>
            </div>
            <figcaption className="p-5">
              <span className="block text-[20px] font-bold">{b.name}</span>
              <span className="mt-1 block text-[15px] leading-relaxed text-white/80">{b.text}</span>
            </figcaption>
          </figure>
        ))}
      </HScroll>

      <section className="bg-white py-20 text-ink md:py-28" aria-labelledby="how-title">
        <div className="mx-auto max-w-[1320px] px-5 md:px-8">
          <SplitText
            as="h3"
            id="how-title"
            text="How booking works"
            className="text-[clamp(34px,6vw,64px)] font-extrabold leading-[1.02] tracking-[-0.03em]"
          />
          <ol className="mt-10">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="sticky mb-[16vh] last:mb-0"
                style={{ top: `calc(var(--nav-h) + 20px + ${i * 20}px)` }}
              >
                <div
                  className={`grid min-h-[280px] gap-6 rounded-[24px] p-7 shadow-[0_-20px_50px_-30px_rgba(20,33,61,0.5)] md:grid-cols-[auto_1fr] md:items-center md:gap-12 md:p-12 ${TONES[i % 4]}`}
                >
                  <span className="text-[clamp(96px,17vw,220px)] font-extrabold leading-[0.8] tracking-[-0.06em]">
                    {i + 1}
                  </span>
                  <div>
                    <h4 className="text-[clamp(28px,4vw,50px)] font-extrabold leading-tight tracking-[-0.02em]">
                      {s.title}
                    </h4>
                    <p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed opacity-90">
                      {s.text}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
