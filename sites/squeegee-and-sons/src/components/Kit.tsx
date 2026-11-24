import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
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

/** What we bring (photos of the kit) and how a booking works, in four steps. */
export function Kit() {
  return (
    <section id="kit" className="bg-white py-20 text-ink md:py-28" aria-labelledby="kit-title">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="kit-title"
          label="Our kit"
          title="We bring everything with us"
          intro="Plant-based products, colour-coded cloths and our own equipment — so you don't need to buy anything, and nothing from the bathroom goes near the kitchen."
        />
        <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
          {BUCKET.map((b, i) => (
            <Reveal as="li" key={b.id} delay={(i % 3) * 0.04}>
              <figure>
                <div className="aspect-[4/3] overflow-hidden rounded-[12px] bg-stone">
                  <Img
                    name={b.image}
                    widths={[800, 1200]}
                    sizes="(min-width:768px) 410px, 46vw"
                    alt={b.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="mt-3">
                  <span className="block text-[17px] font-bold">{b.name}</span>
                  <span className="mt-1 hidden text-[15px] leading-relaxed text-ash sm:block">
                    {b.text}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>

        <div className="mt-24">
          <Reveal>
            <h3 className="text-[clamp(26px,4vw,36px)] leading-tight">How booking works</h3>
          </Reveal>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.05}>
                <div className="h-full rounded-[14px] border border-ink/10 bg-ivory p-6">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-onyx text-[15px] font-bold text-white">
                    {i + 1}
                  </span>
                  <h4 className="mt-4 text-[18px] font-bold">{s.title}</h4>
                  <p className="mt-2 text-[15px] leading-relaxed text-ash">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
