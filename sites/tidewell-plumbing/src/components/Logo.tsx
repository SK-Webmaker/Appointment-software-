/** A drop with a wave inside it. */
export function Drop({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 36" className={className} aria-hidden="true" focusable="false">
      <path d="M14 1.5S2 16 2 23.5a12 12 0 0 0 24 0C26 16 14 1.5 14 1.5Z" fill="currentColor" />
      <path
        d="M5 24c3-2.4 6-2.4 9 0s6 2.4 9 0"
        fill="none"
        stroke="#f3f6f1"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const Heart = Drop;

/** "Tidewell" in soft Fraunces italic, PLUMBING · SINCE 1998 beneath, the drop beside. */
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
  const accent = tone === "dark" ? "text-onyx" : "text-pearl";
  return (
    <span
      className={`inline-flex items-center gap-[0.32em] whitespace-nowrap leading-none ${ink} ${className}`}
      style={{ fontSize: size * 0.56 }}
    >
      <Drop className={`h-[1.55em] w-auto shrink-0 ${accent}`} />
      <span className="flex flex-col items-start">
        <span className="font-display text-[1.4em] font-semibold leading-[0.85] tracking-[-0.02em]">
          Tidewell
        </span>
        <span className="mt-[0.35em] text-[0.4em] font-bold uppercase tracking-[0.36em]">
          Plumbing · since 1998
        </span>
      </span>
    </span>
  );
}
