import { useId } from "react";
import type { Finish, Length, Shape } from "@/site.config";

/** Mix a hex colour towards another (t = 0 keeps a, 1 gives b). */
export function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x
    .map((v, i) =>
      Math.round(v + ((y[i] ?? v) - v) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const TIP: Record<Length, number> = { Short: 60, Medium: 82, Long: 104 };

/** The nail plate, cuticle at y = 110, 44 wide (x 8–52). */
function nailPath(shape: Shape, length: Length) {
  const T = 110 - TIP[length];
  const base = "V110 Q30 101 8 110 Z";
  switch (shape) {
    case "Square":
      return `M8 110 V${T + 6} Q8 ${T} 14 ${T} H46 Q52 ${T} 52 ${T + 6} ${base}`;
    case "Oval":
      return `M8 110 V${T + 22} C8 ${T - 3} 52 ${T - 3} 52 ${T + 22} ${base}`;
    case "Coffin":
      return `M8 110 V${T + 34} L19.5 ${T + 2.5} Q20.5 ${T} 23 ${T} H37 Q39.5 ${T} 40.5 ${T + 2.5} L52 ${T + 34} ${base}`;
    case "Stiletto":
      return `M8 110 V${T + 44} C8 ${T + 22} 26 ${T + 5} 30 ${T} C34 ${T + 5} 52 ${T + 22} 52 ${T + 44} ${base}`;
    default: // Almond
      return `M8 110 V${T + 36} C8 ${T + 12} 23 ${T} 30 ${T} C37 ${T} 52 ${T + 12} 52 ${T + 36} ${base}`;
  }
}

// Four fingers seen from the back of the hand: centre x, fingertip y, fan angle, size.
const FINGERS = [
  { cx: 92, top: 112, r: -9, s: 0.9 },
  { cx: 160, top: 64, r: -3, s: 1 },
  { cx: 228, top: 70, r: 3, s: 1 },
  { cx: 292, top: 128, r: 10, s: 0.84 },
];

/**
 * A hand, drawn: four fingers with the chosen shade, finish, shape and
 * length on every nail. Colour changes glide (CSS transitions on fill).
 */
export function NailHand({
  hex,
  finish,
  shape,
  length,
  skin,
  className = "",
}: {
  hex: string;
  finish: Finish;
  shape: Shape;
  length: Length;
  skin: string;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const d = nailPath(shape, length);
  const T = 110 - TIP[length];
  const base = finish === "French tip" ? "#f3dfd9" : hex;
  const smile = T + TIP[length] * 0.3;
  return (
    <svg
      viewBox="0 0 384 340"
      className={className}
      role="img"
      aria-label={`A hand with ${length.toLowerCase()} ${shape.toLowerCase()} nails, ${finish.toLowerCase()}`}
    >
      <defs>
        <linearGradient id={`skin-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={mix(skin, "#000000", 0.14)} />
          <stop offset="0.45" stopColor={skin} />
          <stop offset="1" stopColor={mix(skin, "#000000", 0.2)} />
        </linearGradient>
        <linearGradient id={`chrome-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mix(hex, "#000000", 0.35)} />
          <stop offset="0.32" stopColor={mix(hex, "#ffffff", 0.55)} />
          <stop offset="0.5" stopColor={mix(hex, "#ffffff", 0.9)} />
          <stop offset="0.68" stopColor={hex} />
          <stop offset="1" stopColor={mix(hex, "#000000", 0.4)} />
        </linearGradient>
        <linearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`nail-${uid}`}>
          <path d={d} />
        </clipPath>
        {/* the hand fades into the card below the knuckles */}
        <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#ffffff" />
          <stop offset="0.97" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id={`hand-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="384" height="340">
          <rect width="384" height="340" fill={`url(#fade-${uid})`} />
        </mask>
      </defs>
      <g mask={`url(#hand-${uid})`}>
        {FINGERS.map((f, i) => (
          <g key={i} transform={`rotate(${f.r} ${f.cx} 360)`}>
            <rect
              x={f.cx - 30 * f.s}
              y={f.top}
              width={60 * f.s}
              height={360 - f.top}
              rx={30 * f.s}
              fill={`url(#skin-${uid})`}
              className="transition-[fill] duration-500"
            />
            {/* knuckle creases */}
            {[150, 168].map((dy) => (
              <path
                key={dy}
                d={`M${f.cx - 13 * f.s} ${f.top + dy * f.s} q${13 * f.s} ${5 * f.s} ${26 * f.s} 0`}
                fill="none"
                stroke="#000000"
                strokeOpacity="0.12"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            ))}
            <g
              transform={`translate(${f.cx - 30 * f.s} ${f.top + 66 * f.s - 110 * f.s}) scale(${f.s})`}
            >
              {/* soft shadow under the free edge */}
              <path d={d} fill="#000000" opacity="0.12" transform="translate(1.5 3)" />
              <g clipPath={`url(#nail-${uid})`}>
                <rect
                  x="0"
                  y="0"
                  width="60"
                  height="120"
                  fill={finish === "Chrome" ? `url(#chrome-${uid})` : base}
                  style={{ transition: "fill 0.5s ease" }}
                />
                {finish === "French tip" && (
                  <path
                    d={`M0 ${smile} Q30 ${smile + 12} 60 ${smile} V0 H0 Z`}
                    fill={hex}
                    style={{ transition: "fill 0.5s ease" }}
                  />
                )}
                {finish === "Matte" ? (
                  <rect x="0" y="0" width="60" height="120" fill="#ffffff" opacity="0.06" />
                ) : (
                  <rect
                    x="13"
                    y={T + 8}
                    width="7"
                    height={TIP[length] * 0.62}
                    rx="3.5"
                    fill={`url(#gloss-${uid})`}
                    opacity={finish === "Chrome" ? 0.5 : 0.9}
                  />
                )}
                <path
                  d="M6 112 Q30 99 54 112"
                  fill="none"
                  stroke="#000000"
                  strokeOpacity="0.14"
                  strokeWidth="2"
                />
              </g>
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
