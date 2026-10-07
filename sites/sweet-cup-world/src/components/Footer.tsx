import { Instagram } from "lucide-react";
import { Img } from "./Img";
import { Wordmark } from "./Logo";
import { Reveal } from "./Reveal";
import { SITE } from "@/site.config";

const FEED = [
  { name: "party-cups", widths: [480, 720], alt: "Biscoff cheesecake cups with Winnie-the-Pooh toppers", position: "50% 55%" },
  { name: "honey-jars", widths: [480, 800], alt: "Bee honey jars on a gold stand", position: "50% 60%" },
  { name: "prep", widths: [480, 720], alt: "Biscoff spread and a piping bag, ready to fill the cups", position: "50% 40%" },
  { name: "logo", widths: [480, 1080], alt: "The Sweet Cup World badge", position: "50% 50%" },
]

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-noir text-ivory" aria-label="Footer">
      <div className="mx-auto max-w-[1440px] px-5 pt-20 md:px-10 md:pt-28 xl:px-24">
        <Reveal className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <Wordmark size={72} tone="light" className="self-start sm:hidden" />
          <Wordmark size={96} tone="light" className="self-start max-sm:hidden" />
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-label text-silk">Follow along</p>
            <a href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-[48px] items-center gap-3 font-sans text-[clamp(20px,4.6vw,34px)] font-light leading-tight tracking-[0.01em] transition-colors hover:text-pearl">
              <Instagram size={28} strokeWidth={1.4} className="shrink-0" /> @{SITE.instagramHandle}
            </a>
          </div>
        </Reveal>
        <div className="mt-10 grid grid-cols-4 gap-2 md:gap-4">
          {FEED.map((f) => (
            <a key={f.name} href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-full">
              <Img name={f.name} widths={f.widths} sizes="(min-width:1440px) 312px, 25vw" alt="" className="aspect-[9/16] w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105" style={{ objectPosition: f.position }} />
              <span className="absolute inset-0 bg-noir/0 transition-colors duration-500 group-hover:bg-noir/25" />
              <span className="sr-only">{f.alt} — view on Instagram</span>
            </a>
          ))}
        </div>

        <div className="mt-16 grid gap-10 border-t border-ivory/10 pt-12 text-[15px] sm:grid-cols-3 md:mt-20">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-silk">Dessert cups</p>
            <p className="mt-4 leading-relaxed text-ivory/80">
              {SITE.role}, made fresh to order
              <br />
              {SITE.suburb}, {SITE.city} {SITE.state}
              <br />
              Pickup or delivery
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-silk">Order</p>
            <ul className="mt-2 text-ivory/80">
              <li>
                <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2.5 hover:text-ivory">
                  <Instagram size={16} strokeWidth={1.6} /> DM @{SITE.instagramHandle}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-silk">Explore</p>
            <ul className="mt-2 text-ivory/80">
              {[
                ["#story", "Our story"],
                ["#flavours", "Flavours"],
                ["#occasions", "For any occasion"],
                ["#order", "Order"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="inline-flex min-h-[44px] min-w-[44px] items-center hover:text-ivory">
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
        <text x="500" y="175" textAnchor="middle" textLength={940} lengthAdjust="spacingAndGlyphs" fill="#F9CFDF" fillOpacity="0.1" style={{ fontFamily: '"Bodoni Moda", serif', fontSize: 150, letterSpacing: "0.12em" }}>
          SWEET CUP
        </text>
      </svg>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-ivory/10 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[12px] tracking-[0.06em] text-ivory/65 md:flex-row md:justify-between md:px-10 xl:px-24">
        <p>
          © {__BUILD_YEAR__} {SITE.name} · {SITE.tagline}
        </p>
        <p>All photography from @{SITE.instagramHandle}.</p>
      </div>
    </footer>
  );
}
