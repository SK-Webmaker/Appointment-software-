import { useId } from "react";

/** A barber pole, drawn: cap, striped glass, base. */
export function Pole({ className = "" }: { className?: string }) {
  const id = `pole-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 16 40" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={id}>
          <rect x="4" y="7" width="8" height="26" rx="4" />
        </clipPath>
      </defs>
      <rect x="3" y="2" width="10" height="4" rx="2" fill="currentColor" />
      <rect x="3" y="34" width="10" height="4" rx="2" fill="currentColor" />
      <g clipPath={`url(#${id})`}>
        <rect x="4" y="7" width="8" height="26" fill="#f1ebe2" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M2 ${4 + i * 8} l14 -7 v4 l-14 7z`} fill="#a3262a" />
        ))}
      </g>
      <rect
        x="4"
        y="7"
        width="8"
        height="26"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/** Kept under the shared names so every component that marks a list with it still works. */
export const Heart = Pole;

/**
 * The shopfront lockup: HOLLIS & GRAIN in signwriter capitals with a serif
 * ampersand, and BARBERS spaced out beneath. `size` is the lockup height in px.
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
    <span
      className={`inline-flex items-center gap-[0.32em] whitespace-nowrap leading-none ${ink} ${className}`}
      style={{ fontSize: size * 0.56 }}
    >
      <Pole className={`h-[1.7em] w-auto shrink-0 ${ink}`} />
      <span className="flex flex-col items-start">
        <span className="font-display text-[1.2em] font-extrabold uppercase leading-[0.9] tracking-[0.02em]">
          Hollis <span className={`aside text-[1.05em] ${accent}`}>&amp;</span> Grain
        </span>
        <span className="mt-[0.25em] text-[0.4em] font-semibold uppercase tracking-[0.32em]">
          Barbers · Est. 2019
        </span>
      </span>
    </span>
  );
}
