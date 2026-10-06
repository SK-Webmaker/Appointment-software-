const ITEMS = ["Gel-X", "Acrylic", "BIAB", "Nail art", "Lash lift", "Lash botox", "Brows", "Hydra facial", "Chemical peel", "Keratin", "Blow out"];

export function Marquee({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const row = [...ITEMS, ...ITEMS];
  const dark = tone === "dark";
  return (
    <div className={`relative overflow-hidden border-y py-5 ${dark ? "border-cream/10 bg-espresso text-cream" : "border-espresso/10 bg-linen text-espresso"}`} aria-hidden="true">
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap will-change-transform">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-[26px] italic leading-none md:text-[34px]">
            {t}
            <svg width="10" height="12" viewBox="0 0 10 12" className={dark ? "fill-gold" : "fill-bronze"}>
              <path d="M0 12V5a5 5 0 0 1 10 0v7z" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
