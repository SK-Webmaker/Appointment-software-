import { Check } from "lucide-react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { Counter } from "./fx/Counter";
import { RevealImg } from "./fx/RevealImg";
import { SplitText } from "./fx/SplitText";
import { AREA, SITE } from "@/site.config";

const POINTS = [
  "Licensed for water, drainage and gas",
  "Fixed price agreed before any work starts",
  "Drop sheets, shoe covers and a proper clean-up",
  "Compliance certificate where one's needed",
];

const STEPS = [
  {
    title: "Tell us what's wrong",
    text: "Book online in a minute or call. A photo helps us bring the right parts.",
  },
  {
    title: "We confirm a time",
    text: "A two-hour window for booked jobs; urgent jobs the same day. We text before we arrive.",
  },
  {
    title: "Fixed price, then the fix",
    text: "We look, explain the options and agree the price. Nothing starts until you say yes.",
  },
  {
    title: "Tidy up and guarantee",
    text: "We test it, clean up and leave the paperwork. Every job carries a 12-month guarantee.",
  },
];

/** Who we are, what we promise, and how a job runs from call to clean-up. */
export function About() {
  return (
    <section id="about" className="bg-ivory py-20 text-ink md:py-28" aria-labelledby="about-title">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal className="relative">
            <RevealImg className="aspect-[4/5] rounded-[14px] bg-stone">
              <Img
                name="plumber"
                widths={[800, 1200]}
                sizes="(min-width:1024px) 520px, 92vw"
                alt="A plumber in work gear fitting a bathroom basin, with a toilet beside him"
                className="h-full w-full object-cover"
              />
            </RevealImg>
            <div
              data-qa="layered"
              className="absolute -bottom-6 right-4 hidden w-[46%] overflow-hidden rounded-[12px] border-[6px] border-ivory sm:block"
            >
              <Img
                name="tools"
                widths={[800]}
                sizes="260px"
                alt="A workshop wall of neatly hung plumbing tools"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <p className="text-[14px] font-semibold text-onyx">About us</p>
            <h2
              id="about-title"
              className="mt-2 max-w-[18ch] text-[clamp(32px,6vw,52px)] leading-[1.06]"
            >
              A family business, not a call centre
            </h2>
            <p className="mt-5 max-w-[54ch] text-[16.5px] leading-relaxed text-ash">
              Tidewell started in {SITE.est} with one van and a lot of Manly bathrooms. We're still
              family-run and still local — the person who answers the phone knows the plumber who'll
              turn up, and both of them know the Beaches.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[15.5px]">
                  <Check size={19} strokeWidth={2.4} className="mt-0.5 shrink-0 text-onyx" /> {p}
                </li>
              ))}
            </ul>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-ink/10 pt-6">
              {(
                [
                  [Number(SITE.est), "Family-run since", ""],
                  [Object.keys(AREA).length, "Suburbs we cover", ""],
                  [7, "Days a week for urgent jobs", ""],
                ] as const
              ).map(([v, k, suffix]) => (
                <div key={k}>
                  <dt className="text-[13.5px] text-ash">{k}</dt>
                  <dd className="mt-1 font-display text-[34px] font-semibold leading-none">
                    <Counter to={v} />
                    {suffix}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <div className="mt-24">
          <SplitText
            as="h3"
            text="How a job works"
            className="text-[clamp(30px,5vw,52px)] leading-tight"
          />
          <ol className="mt-10">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="sticky mb-[18vh] last:mb-0"
                style={{ top: `calc(var(--nav-h) + 24px + ${i * 22}px)` }}
              >
                <div
                  className={`grid min-h-[300px] gap-6 rounded-[22px] p-7 shadow-[0_-20px_50px_-30px_rgba(15,43,42,0.5)] md:grid-cols-[auto_1fr] md:items-center md:gap-12 md:p-12 ${["bg-noir text-white", "bg-onyx text-white", "bg-candy text-ink", "bg-white text-ink"][i % 4]}`}
                >
                  <span className="font-display text-[clamp(90px,16vw,200px)] font-semibold leading-[0.8] opacity-90">
                    0{i + 1}
                  </span>
                  <div>
                    <h4 className="font-display text-[clamp(28px,4vw,48px)] font-semibold leading-tight">
                      {s.title}
                    </h4>
                    <p className="mt-3 max-w-[48ch] text-[17px] leading-relaxed opacity-85">
                      {s.text}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
