import { Instagram } from "lucide-react";
import { Img } from "./Img";
import { Wordmark } from "./Logo";
import { Reveal } from "./Reveal";
import { SITE } from "@/site.config";

const FEED = [
  { name: "honey-roots", alt: "Honey-blonde waves with blended roots" },
  { name: "cherry-red", alt: "Curled cherry-red hair" },
  { name: "balayage-front", alt: "Glossy dark-brown waves with caramel pieces" },
  { name: "summer-tones", alt: "Creamy summer blonde" },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-espresso text-cream" aria-label="Footer">
      <div className="mx-auto max-w-[1440px] px-5 pt-20 md:px-10 md:pt-28 xl:px-24">
        <Reveal className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <Wordmark size={64} tone="light" className="self-start" />
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-label text-honey">Follow along</p>
            <a href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-[48px] items-center gap-3 font-sans text-[clamp(20px,4.6vw,34px)] font-light leading-tight tracking-[0.01em] transition-colors hover:text-champagne">
              <Instagram size={28} strokeWidth={1.4} className="shrink-0" /> @{SITE.instagramHandle}
            </a>
          </div>
        </Reveal>
        <div className="mt-10 grid grid-cols-4 gap-2 md:gap-4">
          {FEED.map((f) => (
            <a key={f.name} href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-full">
              <Img name={f.name} widths={[480]} sizes="25vw" alt="" className="aspect-[9/16] w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105" />
              <span className="absolute inset-0 bg-espresso/0 transition-colors duration-500 group-hover:bg-espresso/25" />
              <span className="sr-only">{f.alt} — view on Instagram</span>
            </a>
          ))}
        </div>

        <div className="mt-16 grid gap-10 border-t border-cream/10 pt-12 text-[15px] sm:grid-cols-3 md:mt-20">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-honey">Studio</p>
            <p className="mt-4 leading-relaxed text-cream/80">
              {SITE.venue}
              <br />
              {SITE.street}, {SITE.suburb} {SITE.state} {SITE.postcode}
              <br />
              {SITE.days.join(" · ")} · by appointment
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-honey">Booking</p>
            <p className="mt-4 leading-relaxed text-cream/80">
              <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center hover:text-cream">
                DM @{SITE.instagramHandle}
              </a>
              <br />
              <a href={SITE.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center hover:text-cream">
                Directions
              </a>
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-honey">Explore</p>
            <ul className="mt-2 text-cream/80">
              {[
                ["#oshi", "Meet Oshi"],
                ["#work", "The work"],
                ["#nanoplasty", "Nanoplasty"],
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

      {/* Decorative script, drawn as SVG so it scales to the width and isn’t read as text. */}
      <svg viewBox="0 0 1000 240" className="pointer-events-none mt-6 block w-full select-none" aria-hidden="true" focusable="false">
        <text x="500" y="185" textAnchor="middle" textLength={940} lengthAdjust="spacingAndGlyphs" fill="#E3CBA8" fillOpacity="0.08" style={{ fontFamily: '"Allura", cursive', fontSize: 190 }}>
          Hair by Oshi
        </text>
      </svg>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-cream/10 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[12px] tracking-[0.06em] text-cream/65 md:flex-row md:justify-between md:px-10 xl:px-24">
        <p>
          © {__BUILD_YEAR__} {SITE.name} · {SITE.tagline}
        </p>
        <p>All photography from @{SITE.instagramHandle}.</p>
      </div>
    </footer>
  );
}
