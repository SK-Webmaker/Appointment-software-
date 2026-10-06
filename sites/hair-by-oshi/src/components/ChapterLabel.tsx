import { CHAPTERS, type ChapterId } from "@/site.config";

/** "IV —— ALWAYS". `light` on night and plum grounds. */
export function ChapterLabel({ id, light = false, className = "" }: { id: ChapterId; light?: boolean; className?: string }) {
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) return null;
  return (
    <p className={`flex items-center gap-4 text-[11.5px] font-medium uppercase tracking-label ${light ? "text-lavender" : "text-plum"} ${className}`}>
      <span className="font-display text-[16px] normal-case italic tracking-normal">{c.numeral}</span>
      <span className={`h-px w-10 ${light ? "bg-lavender/50" : "bg-plum/40"}`} />
      {c.label}
    </p>
  );
}
