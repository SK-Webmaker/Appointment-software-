import { Petal } from "./Logo";
import { MARQUEE } from "@/site.config";

const ITEMS = [...MARQUEE];

/**
 * A slow band of what we do on nude petal, separated by the almond mark. Its
 * bottom padding is what the next chapter's sheet slides over. Decorative —
 * the same words are on the page.
 */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div
      className="relative overflow-hidden bg-candy pb-[calc(1.25rem+36px)] pt-5 text-ink md:pb-[calc(1.25rem+48px)]"
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap will-change-transform">
        {row.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-10 font-display text-[28px] italic leading-none md:text-[38px]"
          >
            {t}
            <Petal className="h-6 w-auto text-plum md:h-7" strokeWidth={1.8} />
          </span>
        ))}
      </div>
    </div>
  );
}
