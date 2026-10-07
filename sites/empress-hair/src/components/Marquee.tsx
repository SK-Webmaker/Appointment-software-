import { Heart } from "./Logo";

const ITEMS = ["Protective styling", "Braids", "Scalp health", "Clean & low-tox", "Length retention", "Comfort & confidence", "Quality > Quantity", "Melbourne"];

/** A slow band of what they stand for, separated by the 🤍 they sign with. Decorative — the same words are on the page. */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative overflow-hidden border-y border-onyx/10 bg-linen py-5 text-onyx" aria-hidden="true">
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap will-change-transform">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-[26px] font-light italic leading-none md:text-[34px]">
            {t}
            <Heart className="h-4 w-[18px] text-mist" strokeWidth={2} />
          </span>
        ))}
      </div>
    </div>
  );
}
