import { Heart } from "./Logo";

const ITEMS = ["Dark hair specialist", "Colour", "Nanoplasty", "Grey blending", "Root touch-ups", "Colour correction", "Softer grow-outs", "Honey blonde", "Cherry red", "Glossy brunette"];

/** A slow band of what she does, separated by her heart. Decorative — the same words are on the page. */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative overflow-hidden border-y border-cocoa/10 bg-latte py-5 text-cocoa" aria-hidden="true">
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap will-change-transform">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-[26px] font-light italic leading-none md:text-[34px]">
            {t}
            <Heart className="h-4 w-[18px] text-mauve" strokeWidth={2} />
          </span>
        ))}
      </div>
    </div>
  );
}
