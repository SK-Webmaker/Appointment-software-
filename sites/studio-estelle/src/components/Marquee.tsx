import { Heart } from "./Logo";
import { OCCASIONS, SITE } from "@/site.config";

const ITEMS = [...OCCASIONS, `${SITE.suburb} ${SITE.postcode}`];

/**
 * A slow band of the occasions she dresses people for, separated by the 🩷
 * she signs with — the close of the myths chapter, on its pink. Decorative —
 * the same words are on the page.
 */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    // contain: paint — the endless scroll is a running animation; contained, it never promotes the bond chapter to a layer
    <div className="relative overflow-hidden border-t border-onyx/10 bg-candy py-5 text-onyx [contain:paint]" aria-hidden="true">
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap will-change-transform">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-[24px] italic leading-none md:text-[32px]">
            {t}
            <Heart className="h-4 w-[18px] text-plum" strokeWidth={2} />
          </span>
        ))}
      </div>
    </div>
  );
}
