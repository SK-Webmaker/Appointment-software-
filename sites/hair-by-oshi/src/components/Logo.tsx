/** The lavender heart over the "i" in her logo. */
export function Heart({ className = "", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 22" className={className} fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 20.2s-7.6-4.6-9.6-9.2C.9 7.4 3.1 3 6.9 3c2.1 0 3.7 1.3 5.1 3.2C13.4 4.3 15 3 17.1 3c3.8 0 6 4.4 4.5 8-2 4.6-9.6 9.2-9.6 9.2z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Her wordmark, rebuilt in type: "HAIR BY" between two rules over a script
 * "Oshi" with the heart. `size` is the script's font size in px.
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
  const ink = tone === "dark" ? "text-plum" : "text-cream";
  const rule = tone === "dark" ? "bg-ink/25" : "bg-cream/35";
  const small = tone === "dark" ? "text-ink" : "text-cream/85";
  return (
    <span className={`inline-flex flex-col items-center leading-none ${className}`}>
      <span className={`flex items-center gap-[0.35em] font-sans font-medium uppercase ${small}`} style={{ fontSize: Math.max(8.5, size * 0.24), letterSpacing: "0.28em" }}>
        <span className={`h-px w-[1.6em] ${rule}`} />
        Hair by
        <span className={`h-px w-[1.6em] ${rule}`} />
      </span>
      <span className={`relative font-script ${ink}`} style={{ fontSize: size, lineHeight: 0.95, marginTop: size * -0.02 }}>
        Oshi
        <Heart className="absolute -right-[0.26em] top-[0.04em] h-[0.27em] w-[0.3em] text-lavender" strokeWidth={2} />
      </span>
    </span>
  );
}
