/** An almond nail with a lacquer shine — the studio's mark. */
export function Petal({
  className = "",
  strokeWidth = 1.6,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 29V15C4 8 9 2.5 12 2.5S20 8 20 15v14c-5-2.4-11-2.4-16 0Z" />
      <path d="M8.2 9.5c.6-1.8 1.7-3 2.6-3.6M8 13.5v6" />
    </svg>
  );
}

/** Kept under the shared names so every component that marks a list with it still works. */
export const Heart = Petal;

/**
 * The lockup: "Petalcoat" in Bodoni italic, NAIL STUDIO spaced beneath, the
 * almond mark beside it. `size` is the height of the lockup in px.
 */
export function Wordmark({
  size = 34,
  tone = "dark",
  className = "",
}: {
  size?: number;
  tone?: "dark" | "light";
  className?: string;
}) {
  const ink = tone === "dark" ? "text-ink" : "text-ivory";
  const accent = tone === "dark" ? "text-rose" : "text-pearl";
  return (
    <span
      className={`inline-flex items-center gap-[0.34em] whitespace-nowrap leading-none ${ink} ${className}`}
      style={{ fontSize: size * 0.56 }}
    >
      <Petal className={`h-[1.5em] w-auto shrink-0 ${accent}`} strokeWidth={1.7} />
      <span className="flex flex-col items-start">
        <span className="font-display text-[1.45em] italic leading-[0.85] tracking-[-0.02em]">
          Petalcoat
        </span>
        <span className="mt-[0.3em] text-[0.4em] font-semibold uppercase tracking-[0.46em]">
          Nail studio
        </span>
      </span>
    </span>
  );
}
