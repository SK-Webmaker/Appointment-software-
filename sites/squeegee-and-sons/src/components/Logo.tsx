/** A soap bubble with a glint, and a little one floating off. */
export function Bubble({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true" focusable="false">
      <circle cx="16" cy="20" r="13.5" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <path
        d="M9 16.5 A7.5 7.5 0 0 1 15 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="30" cy="6" r="3.6" fill="currentColor" />
    </svg>
  );
}

export const Heart = Bubble;

/** "Squeegee & Sons", chunky and tight, CLEANERS · SINCE 1987 beneath, the bubble beside. */
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
      className={`inline-flex items-center gap-[0.3em] whitespace-nowrap leading-none ${ink} ${className}`}
      style={{ fontSize: size * 0.56 }}
    >
      <Bubble className={`h-[1.6em] w-auto shrink-0 ${accent}`} />
      <span className="flex flex-col items-start">
        <span className="font-display text-[1.36em] font-extrabold leading-[0.85] tracking-[-0.04em] [font-stretch:85%]">
          Squeegee <span className={accent}>&amp;</span> Sons
        </span>
        <span className="mt-[0.4em] text-[0.4em] font-bold uppercase tracking-[0.3em]">
          Cleaners · since 1987
        </span>
      </span>
    </span>
  );
}
