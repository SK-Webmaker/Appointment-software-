import { useId } from "react";

/**
 * The NOCTA mark: a lit filament (a ring with a glowing core) and the name in
 * wide Syne capitals. `tone` picks bone (on night) or void (on bone).
 */
export function Wordmark({ size = 28, tone = "light" }: { size?: number; tone?: "light" | "dark" }) {
  const ink = tone === "light" ? "text-bone" : "text-void";
  return (
    <span className={`inline-flex items-center gap-2.5 ${ink}`} style={{ fontSize: size * 0.62 }}>
      <Mark size={size * 0.78} />
      <span className="font-display font-extrabold leading-none tracking-[0.08em]">NOCTA</span>
    </span>
  );
}

export function Mark({ size = 22 }: { size?: number }) {
  const id = `nc${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 overflow-visible">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" fill="#ffb547" />
      <circle cx="12" cy="12" r="8" fill={`url(#${id})`} />
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="#ffb547" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
