/** An outline heart — the 🤍 they sign their posts with. */
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
 * Their wordmark, rebuilt in type: "EMPRESS HAIR" in widely spaced serif
 * capitals, as on their profile picture. `size` sets the scale (the caps are
 * half of it, in px), so it lines up with the other marks on the site.
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
  return (
    <span
      className={`inline-block whitespace-nowrap font-display font-medium uppercase leading-none ${ink} ${className}`}
      style={{ fontSize: Math.round(size * 0.5), letterSpacing: "0.32em", marginRight: "-0.32em" }}
    >
      Empress Hair
    </span>
  );
}
