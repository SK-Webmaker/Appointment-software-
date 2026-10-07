import { Instagram } from "lucide-react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SITE } from "@/site.config";
import { telHref } from "@/lib/booking";

const FEED = [
  { name: "nails-gelx-tier4", widths: [480, 800], alt: "Gel-X Tier 4 nails beside a fern" },
  { name: "detail-coffee", widths: [480, 800], alt: "Coffee in a gold-rimmed cup" },
  { name: "nails-gelx-tier4-b", widths: [480, 800], alt: "Gel-X Tier 4 nails over dried roses" },
  { name: "detail-silk", widths: [480, 800], alt: "Paisley silk and iced matcha" },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-espresso text-cream" aria-label="Footer">
      <div className="mx-auto max-w-[1440px] px-5 pt-20 md:px-10 md:pt-28">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-label text-gold">Follow the journey</p>
            <a href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-[48px] items-center gap-3 font-sans text-[clamp(19px,4.6vw,36px)] font-light leading-tight tracking-[0.01em] transition-colors hover:text-gold">
              {/* in the sans: Bodoni's underscore is a hairline that vanishes */}
              <Instagram size={28} strokeWidth={1.4} className="shrink-0" /> @{SITE.instagramHandle}
            </a>
          </div>
        </Reveal>
        <div className="mt-8 grid grid-cols-4 gap-2 md:gap-4">
          {FEED.map((f) => (
            <a key={f.name} href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-t-full" aria-label={`${f.alt} — view on Instagram`}>
              <Img name={f.name} widths={f.widths} sizes="(min-width:1440px) 312px, 25vw" alt="" className="aspect-[3/4] w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105" />
              <span className="absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/25" />
            </a>
          ))}
        </div>

        <div className="mt-16 grid gap-10 border-t border-cream/10 pt-12 text-[14px] sm:grid-cols-3 md:mt-20">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-gold">Studio</p>
            <p className="mt-4 leading-relaxed text-cream/80">
              {SITE.studio}
              <br />
              {SITE.suburb}, {SITE.city} {SITE.state}
              <br />
              Re-opening {SITE.reopening}
            </p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-gold">Contact</p>
            <p className="mt-4 leading-relaxed text-cream/80">
              <a href={telHref} className="inline-block py-2.5 hover:text-cream">{SITE.phoneDisplay}</a>
              <br />
              <a href={`mailto:${SITE.email}`} className="inline-block break-all py-2.5 hover:text-cream">{SITE.email}</a>
              <br />
              <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="inline-block py-2.5 hover:text-cream">DM to book or enquire</a>
            </p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-gold">Explore</p>
            <ul className="mt-2 text-cream/80">
              {[
                ["#menu", "The menu"],
                ["#nail-art", "Nail art tiers"],
                ["#helena", "Meet Helena"],
                ["#book", "Book"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="inline-flex min-h-[44px] min-w-[44px] items-center hover:text-cream">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Decorative wordmark, drawn as SVG so it scales to the width and isn't read as text. */}
      <svg viewBox="0 0 1000 250" className="pointer-events-none mt-10 block w-full select-none" aria-hidden="true" focusable="false">
        <text x="500" y="205" textAnchor="middle" fill="#F3EBDD" fillOpacity="0.06" style={{ fontFamily: '"Bodoni Moda", serif', fontStyle: "italic", fontSize: 250, fontVariationSettings: '"opsz" 24' }}>
          L'atelier
        </text>
      </svg>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-cream/10 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[11px] tracking-[0.08em] text-cream/55 md:flex-row md:justify-between md:px-10">
        <p>© {__BUILD_YEAR__} {SITE.name} · {SITE.pillars.join(" · ")} · Est. {SITE.established}</p>
        <p>Photography from @{SITE.instagramHandle}; service imagery via Unsplash.</p>
      </div>
    </footer>
  );
}
