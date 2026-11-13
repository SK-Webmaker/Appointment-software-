/**
 * The LUMBEND mark: one loop of lit tube on a little base, and the name in
 * wide Syne capitals. `tone` picks bone (on night) or void (on bone).
 */
export function Wordmark({ size = 28, tone = "light" }: { size?: number; tone?: "light" | "dark" }) {
  const ink = tone === "light" ? "text-bone" : "text-void";
  return (
    <span className={`inline-flex items-center gap-2.5 ${ink}`} style={{ fontSize: size * 0.62 }}>
      <Mark size={size * 0.78} />
      <span className="font-display font-extrabold leading-none tracking-[0.08em]">LUMBEND</span>
    </span>
  );
}

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 overflow-visible">
      <path d="M6 18 C 6 13, 18 13, 18 9 C 18 3, 6 3, 7.5 9 C 8.5 13.5, 19 14, 18 18" fill="none" stroke="var(--glow)" strokeWidth="5" strokeOpacity="0.25" strokeLinecap="round" />
      <path d="M6 18 C 6 13, 18 13, 18 9 C 18 3, 6 3, 7.5 9 C 8.5 13.5, 19 14, 18 18" fill="none" stroke="var(--glow)" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="4" y="19.5" width="16" height="3.5" rx="1.2" fill="currentColor" />
    </svg>
  );
}
