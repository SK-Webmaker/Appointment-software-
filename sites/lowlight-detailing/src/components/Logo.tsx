/** A low sun on a horizon line — light, just above dark. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ll-sun" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9be6ff" />
          <stop offset="0.5" stopColor="#b3a8ff" />
          <stop offset="1" stopColor="#ff9ad5" />
        </linearGradient>
      </defs>
      <path d="M8 17a12 12 0 0 1 24 0Z" fill="url(#ll-sun)" />
      <rect x="2" y="18.5" width="36" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="8" y="21.6" width="24" height="1.2" rx="0.6" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export const Heart = Mark;

/** LOWLIGHT in wide machined capitals, DETAILING beneath, the low sun beside. */
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
  return (
    <span
      className={`inline-flex items-center gap-[0.4em] whitespace-nowrap leading-none ${ink} ${className}`}
      style={{ fontSize: size * 0.5 }}
    >
      <Mark className="h-[1.5em] w-auto shrink-0" />
      <span className="flex flex-col items-start">
        <span className="font-display text-[1em] uppercase tracking-[0.12em]">Lowlight</span>
        <span className="mt-[0.35em] text-[0.46em] font-medium uppercase tracking-[0.62em] opacity-80">
          Detailing
        </span>
      </span>
    </span>
  );
}
