import { Pole } from "./Logo";
import { MARQUEE } from "@/site.config";

const ITEMS = [...MARQUEE];

/**
 * A slow brass band of what we do, separated by little barber poles. Its
 * bottom padding is what the next chapter's sheet slides over. Decorative —
 * the same words are on the page.
 */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div
      className="relative overflow-hidden bg-candy pb-[calc(1.1rem+36px)] pt-5 text-noir md:pb-[calc(1.25rem+48px)]"
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap will-change-transform">
        {row.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-10 font-display text-[30px] font-extrabold uppercase leading-none md:text-[42px]"
          >
            {t}
            <Pole className="h-9 w-auto text-noir md:h-11" />
          </span>
        ))}
      </div>
    </div>
  );
}
