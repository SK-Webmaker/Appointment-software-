import { CHAPTERS, type ChapterId } from "@/site.config";

/** "I —— OUR GOALS". `light` on the dark grounds. */
export function ChapterLabel({ id, light = false, className = "" }: { id: ChapterId; light?: boolean; className?: string }) {
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) return null;
  return (
    <p className={`flex items-center gap-4 text-[11.5px] font-medium uppercase tracking-label ${light ? "text-pearl" : "text-onyx"} ${className}`}>
      <span className="font-display text-[16px] normal-case italic tracking-normal">{c.numeral}</span>
      <span className={`h-px w-10 ${light ? "bg-pearl/50" : "bg-onyx/40"}`} />
      {c.label}
    </p>
  );
}
