import { Wing } from "./Logo";
import { MARQUEE } from "@/site.config";

const ITEMS = [...MARQUEE];

/** A hi-vis band, like the stripe down a van. Decorative — the same words are on the page. */
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
            className="flex items-center gap-10 font-display text-[26px] font-black uppercase leading-none [font-stretch:125%] md:text-[36px]"
          >
            {t}
            <Wing className="h-7 w-auto text-noir md:h-9" />
          </span>
        ))}
      </div>
    </div>
  );
}
