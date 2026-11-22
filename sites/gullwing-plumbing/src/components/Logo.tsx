/** A gull's wing over a drop of water — the van-door mark. */
export function Wing({
  className = "",
  strokeWidth = 2.4,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 40 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 12c5-6 11-6 17 1 6-7 12-7 17-1" />
      <path
        d="M20 17c-3 4.2-4.5 6.8-4.5 9a4.5 4.5 0 0 0 9 0c0-2.2-1.5-4.8-4.5-9Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export const Heart = Wing;

/** GULLWING in expanded capitals, PLUMBING spaced beneath, the wing beside. */
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
  const accent = tone === "dark" ? "text-rose" : "text-flare";
  return (
    <span
      className={`inline-flex items-center gap-[0.36em] whitespace-nowrap leading-none ${ink} ${className}`}
      style={{ fontSize: size * 0.56 }}
    >
      <Wing className={`h-[1.5em] w-auto shrink-0 ${accent}`} />
      <span className="flex flex-col items-start">
        <span className="font-display text-[1.05em] font-black uppercase leading-[0.9] tracking-[-0.01em] [font-stretch:125%]">
          Gullwing
        </span>
        <span className="mt-[0.3em] text-[0.42em] font-semibold uppercase tracking-[0.5em]">
          Plumbing
        </span>
      </span>
    </span>
  );
}
