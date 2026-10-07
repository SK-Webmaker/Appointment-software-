/** An outline heart — the 🩷 she signs her posts with. */
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
 * Her logo, rebuilt in type: "Studio" in a flowing script resting on
 * "ESTELLE" in high-contrast serif capitals, as on her profile picture.
 * `size` is the height of the lockup in px.
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
  const script = tone === "dark" ? "text-rose" : "text-pearl";
  return (
    <span className={`inline-flex flex-col items-center whitespace-nowrap leading-none ${className}`} style={{ fontSize: size }}>
      <span className={`font-script ${script}`} style={{ fontSize: "0.6em", lineHeight: 1, marginBottom: "-0.16em" }}>
        Studio
      </span>
      <span className={`font-display font-medium uppercase ${ink}`} style={{ fontSize: "0.5em", lineHeight: 1, letterSpacing: "0.2em", marginRight: "-0.2em" }}>
        Estelle
      </span>
    </span>
  );
}
