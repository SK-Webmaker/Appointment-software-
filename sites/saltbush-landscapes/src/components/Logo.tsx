/** A sprig of saltbush: a stem and three round silver leaves. */
export function Sprig({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 36" className={className} aria-hidden="true" focusable="false">
      <path
        d="M15 35 C15 26 14 18 15 8"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="15" cy="8" rx="5.6" ry="7" fill="currentColor" />
      <ellipse cx="8" cy="19" rx="5.4" ry="6.4" fill="currentColor" transform="rotate(-38 8 19)" />
      <ellipse cx="22" cy="23" rx="5.4" ry="6.4" fill="currentColor" transform="rotate(38 22 23)" />
    </svg>
  );
}

export const Heart = Sprig;

/** "Saltbush" in Young Serif, LANDSCAPES · SINCE 2009 beneath, the sprig beside. */
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
      <Sprig className={`h-[1.6em] w-auto shrink-0 ${accent}`} />
      <span className="flex flex-col items-start">
        <span className="font-display text-[1.36em] leading-[0.85] tracking-[-0.01em]">
          Saltbush
        </span>
        <span className="mt-[0.4em] text-[0.4em] font-bold uppercase tracking-[0.3em]">
          Landscapes · since 2009
        </span>
      </span>
    </span>
  );
}
