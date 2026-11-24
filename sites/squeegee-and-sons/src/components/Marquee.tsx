import { Bubble } from "./Logo";
import { MARQUEE } from "@/site.config";

const ITEMS = [...MARQUEE];

/** A sunshine band of what we clean. Decorative — the same words are on the page. */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div
      className="relative overflow-hidden bg-candy pb-[calc(1.1rem+36px)] pt-5 text-ink md:pb-[calc(1.25rem+48px)]"
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap will-change-transform">
        {row.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-10 font-display text-[30px] font-extrabold leading-none tracking-[-0.02em] md:text-[42px]"
          >
            {t}
            <Bubble className="h-8 w-auto text-onyx" />
          </span>
        ))}
      </div>
    </div>
  );
}
