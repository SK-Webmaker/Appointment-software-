import { CHAPTERS, type ChapterId } from "@/site.config";

/** "IV —— HELENA". `light` for dark sections; `ink` where the ground is champagne, which bronze can't pass AA on. */
export function ChapterLabel({ id, light = false, ink = false, className = "" }: { id: ChapterId; light?: boolean; ink?: boolean; className?: string }) {
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) return null;
  return (
    <p className={`flex items-center gap-4 text-[11px] font-semibold uppercase tracking-label ${light ? "text-gold" : ink ? "text-espresso" : "text-bronze-deep"} ${className}`}>
      <span className="font-display text-[15px] normal-case italic tracking-normal">{c.numeral}</span>
      <span className={`h-px w-10 ${light ? "bg-gold/50" : ink ? "bg-espresso/40" : "bg-bronze/50"}`} />
      {c.label}
    </p>
  );
}
