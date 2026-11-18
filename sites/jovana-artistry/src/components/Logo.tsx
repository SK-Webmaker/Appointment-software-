/** Her bow 🎀, drawn: two loops, a knot and two tails. */
export function Bow({ className = "", strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 15.5C10 10 4 9.5 4.2 13.6c.2 4 6.3 4.6 9.8 2.3" />
      <path d="M18 15.5c4-5.5 10-6 9.8-1.9-.2 4-6.3 4.6-9.8 2.3" />
      <ellipse cx="16" cy="15.8" rx="2.2" ry="2.6" />
      <path d="M14.6 18.1 11 26.5M17.4 18.1 21 26.5" />
    </svg>
  );
}

/** Kept under the shared names so every component that marks a list with it still works. */
export const Heart = Bow;
export const Face = Bow;

/**
 * Her wordmark: "Jovana" signed in script, "Artistry" in small spaced
 * capitals beneath, and her bow. `size` is the height of the lockup in px.
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
    <span className={`inline-flex items-center gap-[0.3em] whitespace-nowrap leading-none ${ink} ${className}`} style={{ fontSize: size * 0.62 }}>
      <Bow className={`h-[1.15em] w-[1.15em] shrink-0 ${accent}`} strokeWidth={2} />
      <span className="flex flex-col items-start">
        <span className="font-script text-[1.5em] leading-[0.8]">Jovana</span>
        <span className="mt-[0.2em] text-[0.42em] font-semibold uppercase tracking-[0.42em]">Artistry</span>
      </span>
    </span>
  );
}
