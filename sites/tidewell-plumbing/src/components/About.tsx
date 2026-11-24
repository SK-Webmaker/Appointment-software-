import { Check } from "lucide-react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
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
            <div className="aspect-[4/5] overflow-hidden rounded-[14px] bg-stone">
              <Img
                name="plumber"
                widths={[800, 1200]}
                sizes="(min-width:1024px) 520px, 92vw"
                alt="A plumber in work gear fitting a bathroom basin, with a toilet beside him"
                className="h-full w-full object-cover"
              />
            </div>
            <div data-qa="layered" className="absolute -bottom-6 right-4 hidden w-[46%] overflow-hidden rounded-[12px] border-[6px] border-ivory sm:block">
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
              {[
                [SITE.est, "Family-run since"],
                [String(Object.keys(AREA).length), "Suburbs we cover"],
                ["7 days", "For urgent jobs"],
              ].map(([v, k]) => (
                <div key={k}>
                  <dt className="text-[13.5px] text-ash">{k}</dt>
                  <dd className="mt-1 font-display text-[28px] font-semibold leading-none">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <div className="mt-24">
          <Reveal>
            <h3 className="text-[clamp(26px,4vw,36px)] leading-tight">How a job works</h3>
          </Reveal>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.05}>
                <div className="h-full rounded-[14px] border border-ink/10 bg-white p-6">
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
