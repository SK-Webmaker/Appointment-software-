import { MARQUEE } from "@/site.config";

const ITEMS = [...MARQUEE];

/** A shimmering band of what we do. Decorative — the same words are on the page. */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div
      className="iri-bg relative overflow-hidden pb-[calc(1.1rem+36px)] pt-5 text-noir md:pb-[calc(1.25rem+48px)]"
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap will-change-transform">
        {row.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-10 font-display text-[20px] uppercase leading-none tracking-[0.06em] md:text-[28px]"
          >
            {t}
            <span className="h-2 w-2 rotate-45 bg-noir" />
          </span>
        ))}
      </div>
    </div>
  );
}
