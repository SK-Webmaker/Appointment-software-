import { ArrowRight, Mail, Phone } from "lucide-react";
import { Img } from "./Img";
import { Wordmark } from "./Logo";
import { Reveal } from "./Reveal";
import { CHAPTERS, HOURS, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

const STRIP = [
  {
    name: "boiler",
    widths: [480, 800],
    alt: "Copper pipes and valves around a boiler",
    position: "50% 50%",
  },
  {
    name: "tap",
    widths: [480, 800],
    alt: "Water running from a tap at night",
    position: "50% 50%",
  },
  { name: "sink2", widths: [480, 800], alt: "Under a blue-lit sink", position: "60% 50%" },
  { name: "roughin", widths: [480, 800], alt: "Pipes inside an open wall", position: "50% 50%" },
];

export function Footer() {
  const { openSheet } = useBooking();
  return (
    <footer className="relative overflow-hidden bg-noir text-ivory" aria-label="Footer">
      <div className="mx-auto max-w-[1440px] px-5 pt-20 md:px-10 md:pt-28 xl:px-24">
        <Reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <Wordmark size={46} tone="light" className="self-start sm:hidden" />
          <Wordmark size={92} tone="light" className="self-start max-sm:hidden" />
          <button onClick={() => openSheet()} className="btn-primary sheen self-start lg:self-auto">
            Book a plumber <ArrowRight size={16} strokeWidth={1.8} />
          </button>
        </Reveal>
        <div className="mt-10 grid grid-cols-4 gap-2 md:gap-4" aria-hidden="true">
          {STRIP.map((f) => (
            <div key={f.name} className="relative overflow-hidden rounded-[6px]">
              <Img
                name={f.name}
                widths={f.widths}
                sizes="(min-width:1440px) 312px, 25vw"
                alt=""
                className="aspect-square w-full object-cover"
                style={{ objectPosition: f.position }}
              />
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-10 border-t border-ivory/10 pt-12 text-[15px] sm:grid-cols-3 md:mt-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-silk">Visit</p>
            <p className="mt-4 leading-relaxed text-ivory/80">
              {SITE.name} · 24/7
              <br />
              {SITE.area}, {SITE.city}
            </p>
            <ul className="mt-3 text-ivory/80">
              <li>
                <a
                  href={SITE.phoneHref}
                  className="inline-flex min-h-[44px] items-center gap-2.5 hover:text-ivory"
                >
                  <Phone size={16} strokeWidth={1.6} /> {SITE.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="inline-flex min-h-[44px] items-center gap-2.5 break-all hover:text-ivory"
                >
                  <Mail size={16} strokeWidth={1.6} className="shrink-0" /> {SITE.email}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-silk">Hours</p>
            <ul className="mt-4 space-y-1.5 text-ivory/80">
              {HOURS.map((h) => (
                <li key={h.days} className="flex justify-between gap-4 sm:block">
                  <span className="sm:mr-2">{h.days}</span>
                  <span className="text-ivory">{h.time}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-silk">
              Explore
            </p>
            <ul className="mt-2 text-ivory/80">
              {CHAPTERS.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center hover:text-ivory"
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* The sign, big — drawn as SVG so it scales to the width and isn't read as text. */}
      <svg
        viewBox="0 0 1000 200"
        className="pointer-events-none mt-8 block w-full select-none"
        aria-hidden="true"
        focusable="false"
      >
        <text
          x="500"
          y="178"
          textAnchor="middle"
          textLength={960}
          lengthAdjust="spacingAndGlyphs"
          fill="#EEF1EC"
          fillOpacity="0.07"
          style={{
            fontFamily: '"Big Shoulders Display", sans-serif',
            fontSize: 230,
            fontWeight: 900,
          }}
        >
          GULLWING
        </text>
      </svg>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-ivory/10 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[12px] tracking-[0.04em] text-ivory/65 md:flex-row md:justify-between md:gap-8 md:px-10 xl:px-24">
        <p className="shrink-0">
          © {__BUILD_YEAR__} {SITE.name} · {SITE.city}
        </p>
        <p className="md:text-right">{SITE.concept} Photography from Unsplash.</p>
      </div>
    </footer>
  );
}
