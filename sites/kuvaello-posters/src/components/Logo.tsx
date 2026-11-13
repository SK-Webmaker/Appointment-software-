/** Their mark's face: a round head with crossed-out eyes and a small "o" of a mouth. */
export function Face({ className = "", strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="13.5" />
      <path d="M9.5 10.5l4 4M13.5 10.5l-4 4M18.5 10.5l4 4M22.5 10.5l-4 4" />
      <circle cx="16" cy="21.5" r="2.4" />
    </svg>
  );
}

/** Kept under the shared name so every component that marks a list with it still works. */
export const Heart = Face;

/**
 * Their wordmark, rebuilt: the face and "Kuvaello" in heavy sans, as on their
 * profile picture. `size` is the height of the lockup in px.
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
    <span className={`inline-flex items-center gap-[0.22em] whitespace-nowrap leading-none ${ink} ${className}`} style={{ fontSize: size * 0.62 }}>
      <Face className="h-[1.05em] w-[1.05em] shrink-0" strokeWidth={2.4} />
      <span className="font-sans font-bold tracking-[-0.01em]">Kuvaello</span>
    </span>
  );
}
