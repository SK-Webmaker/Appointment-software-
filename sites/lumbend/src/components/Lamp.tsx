import type { CSSProperties } from "react";
import type { Shape } from "@/site.config";

/** The glass tube for each shape, drawn in a 240 × 300 box above the base. */
export const TUBES: Record<Exclude<Shape, "Word">, string> = {
  Loop: "M58 208 C 58 150, 182 150, 182 98 C 182 36, 66 36, 78 100 C 88 160, 196 168, 186 208",
  Bolt: "M152 24 L82 128 L136 128 L88 212",
  Wave: "M22 128 C 48 62, 82 62, 104 126 S 158 192, 180 126 S 214 72, 222 96",
  Moon: "M152 28 A 92 92 0 1 0 152 212 A 74 74 0 1 1 152 28 Z",
};

/**
 * LUMBEND One, drawn: a hand-bent tube on two glass supports above a
 * weighted base. The glow is four stacked strokes (wide and faint → thin and
 * white), so it reads as light without any blur filter. `colour` defaults to
 * the page's current light (--glow); `lit={false}` shows bare glass.
 */
export function Lamp({
  shape,
  word = "",
  colour = "var(--glow)",
  lit = true,
  halo = true,
  className = "",
  style,
}: {
  shape: Shape;
  word?: string;
  colour?: string;
  lit?: boolean;
  halo?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const text = (word.trim() || "hello").slice(0, 12);
  const size = text.length > 8 ? 44 : text.length > 5 ? 54 : 66;
  const layers = lit
    ? [
        { w: 30, o: 0.12 },
        { w: 16, o: 0.3 },
        { w: 8, o: 1 },
        { w: 2.6, o: 1, core: true },
      ]
    : [{ w: 8, o: 0.16, glass: true }];

  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} ${className}`} style={{ color: colour, ...style }} aria-hidden="true">
      {halo && lit && (
        <div
          className="pointer-events-none absolute left-1/2 top-[38%] h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, color-mix(in oklab, currentColor 42%, transparent), transparent)" }}
        />
      )}
      <svg viewBox="0 0 240 300" className="relative h-full w-full overflow-visible" fill="none">
        {/* glass supports */}
        <path d="M96 214 L96 252 M144 214 L144 252" stroke="rgba(242,237,228,0.28)" strokeWidth="2.5" strokeLinecap="round" />
        {/* tube */}
        {layers.map((l, i) => {
          const stroke = "core" in l && l.core ? "#fffaf0" : "glass" in l && l.glass ? "#f2ede4" : "currentColor";
          return shape === "Word" ? (
            <text
              key={i}
              x="120"
              y="140"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="Instrument Serif, serif"
              fontStyle="italic"
              fontSize={size}
              stroke={stroke}
              strokeOpacity={l.o}
              strokeWidth={l.w / 3}
              strokeLinejoin="round"
              fill={"core" in l && l.core ? "#fffaf0" : "none"}
            >
              {text}
            </text>
          ) : (
            <path key={i} d={TUBES[shape]} stroke={stroke} strokeOpacity={l.o} strokeWidth={l.w} strokeLinecap="round" strokeLinejoin="round" />
          );
        })}
        {/* base */}
        <rect x="52" y="250" width="136" height="34" rx="10" fill="#1e1830" stroke="rgba(242,237,228,0.22)" />
        <rect x="52" y="250" width="136" height="6" rx="3" fill="rgba(242,237,228,0.12)" />
        <circle cx="168" cy="268" r="4" fill={lit ? "currentColor" : "#5f586e"} />
        <path d="M188 274 C 214 278, 222 292, 238 296" stroke="#5f586e" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
