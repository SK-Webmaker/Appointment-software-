import { Heart } from "./Logo";
import { OCCASIONS, SITE } from "@/site.config";

const ITEMS = [...OCCASIONS, `${SITE.suburb} ${SITE.postcode}`];

/**
 * A slow band of the occasions she dresses people for, separated by the 🩷
 * she signs with — the close of the myths chapter, on its pink. Its bottom
 * padding is what the bond chapter's sheet slides over. Decorative — the same
 * words are on the page.
 */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative overflow-hidden border-t border-onyx/10 bg-candy pb-[calc(1.25rem+36px)] pt-5 text-onyx md:pb-[calc(1.25rem+48px)]" aria-hidden="true">
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
