/**
 * Hand-drawn (well, hand-coded) native plants, each on its own viewBox with
 * the base of the plant at the bottom edge. Used by the opening garden and
 * by the plant finder for plants we don't have a photo of. Pure geometry, no
 * filters — cheap to scale.
 */
export type PlantKind =
  | "gum"
  | "grasstree"
  | "banksia"
  | "paw"
  | "grevillea"
  | "saltbush"
  | "lomandra"
  | "cushion"
  | "rock"
  | "shrub"
  | "tuft"
  | "carpet";

const VIEW: Record<PlantKind, string> = {
  gum: "0 0 200 400",
  grasstree: "0 0 160 320",
  banksia: "0 0 180 150",
  paw: "0 0 100 220",
  grevillea: "0 0 170 120",
  saltbush: "0 0 160 90",
  lomandra: "0 0 130 80",
  cushion: "0 0 110 50",
  rock: "0 0 140 56",
  shrub: "0 0 170 120",
  tuft: "0 0 130 90",
  carpet: "0 0 170 60",
};

// a tiny deterministic "random"
const r = (i: number, k = 1) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function PlantArt({
  kind,
  className = "",
  leaf,
  flower,
}: {
  kind: PlantKind;
  className?: string;
  leaf?: string | undefined;
  flower?: string | undefined;
}) {
  return (
    <svg viewBox={VIEW[kind]} className={className} aria-hidden="true" focusable="false">
      {kind === "gum" && <Gum />}
      {kind === "grasstree" && <GrassTree />}
      {kind === "banksia" && <Banksia />}
      {kind === "paw" && <Paw colour={flower ?? "#c2271f"} />}
      {kind === "grevillea" && <Shrub leaf="#5d7d48" flower={flower ?? "#d8344e"} curls />}
      {kind === "saltbush" && <Mound colours={["#98a592", "#a9b5a2", "#b9c4b1"]} w={160} h={90} />}
      {kind === "lomandra" && <Tuft />}
      {kind === "cushion" && <Mound colours={["#b3bdb2", "#c3cbc2", "#d3dad1"]} w={110} h={50} />}
      {kind === "rock" && <Rock />}
      {kind === "shrub" && <Shrub leaf={leaf ?? "#4c6a3c"} flower={flower ?? "#d14a3a"} />}
      {kind === "tuft" && <Tuft flower={flower ?? "#4a5bc4"} />}
      {kind === "carpet" && <Carpet flower={flower ?? "#8a6bc4"} />}
    </svg>
  );
}

function Gum() {
  const canopy: [number, number, number, number, string][] = [
    [52, 140, 44, 26, "#8b9a64"],
    [36, 112, 30, 18, "#9aa86f"],
    [84, 96, 52, 32, "#7d8f5a"],
    [132, 78, 52, 34, "#8b9a64"],
    [104, 54, 42, 26, "#9aa86f"],
    [160, 128, 40, 26, "#7d8f5a"],
    [150, 104, 34, 22, "#6f8250"],
    [70, 66, 30, 20, "#6f8250"],
  ];
  return (
    <>
      <path
        d="M90 400 C93 330 89 280 95 232 C80 204 62 182 50 152 L57 148 C69 174 86 194 99 212 C103 172 101 132 109 100 L116 102 C110 142 112 182 108 222 C122 192 140 172 158 150 L164 156 C146 178 125 202 113 238 C110 292 113 344 112 400 Z"
        fill="#e8e0d0"
      />
      <path
        d="M100 400 C102 340 98 290 104 236 L108 238 C104 292 107 344 106 400 Z"
        fill="#c9bfae"
      />
      {canopy.map(([cx, cy, rx, ry, c], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={c} opacity={0.94} />
      ))}
    </>
  );
}

function GrassTree() {
  const crown = Array.from({ length: 30 }, (_, i) => {
    const a = (-172 + (i / 29) * 164) * (Math.PI / 180);
    const len = 54 + r(i) * 22;
    const ex = 80 + Math.cos(a) * len;
    const ey = 196 + Math.sin(a) * len * 0.78 + 10;
    const cx = 80 + Math.cos(a) * len * 0.5;
    const cy = 196 + Math.sin(a) * len * 0.9 - 6;
    return { d: `M80 198 Q${cx} ${cy} ${ex} ${ey}`, c: i % 3 ? "#6f8a4a" : "#8aa05a" };
  });
  const skirt = Array.from({ length: 16 }, (_, i) => {
    const x = 60 + i * 2.6 + (r(i, 2) - 0.5) * 4;
    return `M80 202 Q${x - (80 - x) * 0.6} 214 ${x - (80 - x) * 0.9} ${236 + r(i, 3) * 14}`;
  });
  return (
    <>
      <path d="M69 320 C67 282 71 244 71 204 L89 204 C89 244 93 282 91 320 Z" fill="#2e2a24" />
      {skirt.map((d, i) => (
        <path key={i} d={d} stroke="#8a7a55" strokeWidth="2" fill="none" strokeLinecap="round" />
      ))}
      <rect x="78" y="34" width="4" height="168" rx="2" fill="#5b4a33" />
      <rect x="76" y="30" width="8" height="92" rx="4" fill="#c9b27a" />
      {crown.map((c, i) => (
        <path key={i} d={c.d} stroke={c.c} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      ))}
    </>
  );
}

function Banksia() {
  const leaves: [number, number, number, number, string][] = [
    [90, 118, 84, 34, "#3f5a33"],
    [54, 96, 44, 30, "#4c6a3c"],
    [126, 92, 46, 32, "#4c6a3c"],
    [90, 76, 48, 34, "#5d7d48"],
    [40, 120, 34, 22, "#5d7d48"],
    [142, 120, 32, 22, "#5d7d48"],
  ];
  const cones: [number, number, number][] = [
    [56, 52, -10],
    [96, 34, 4],
    [134, 56, 12],
  ];
  return (
    <>
      {leaves.map(([cx, cy, rx, ry, c], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={c} />
      ))}
      {cones.map(([x, y, a], i) => (
        <g key={i} transform={`rotate(${a} ${x} ${y + 20})`}>
          <rect x={x - 8} y={y} width="16" height="40" rx="8" fill="#d9711c" />
          {[8, 16, 24, 32].map((dy) => (
            <path key={dy} d={`M${x - 7} ${y + dy} H${x + 7}`} stroke="#a84f12" strokeWidth="1.6" />
          ))}
        </g>
      ))}
    </>
  );
}

function Paw({ colour }: { colour: string }) {
  const blades = Array.from({ length: 8 }, (_, i) => {
    const dx = (i - 3.5) * 9;
    const len = 60 + r(i, 4) * 34;
    return `M50 220 Q${50 + dx * 0.25} ${220 - len * 0.6} ${50 + dx} ${220 - len}`;
  });
  const tops: [number, number][] = [
    [28, 44],
    [47, 20],
    [66, 34],
    [82, 62],
  ];
  return (
    <>
      {blades.map((d, i) => (
        <path key={i} d={d} stroke="#4f6b3a" strokeWidth="5" fill="none" strokeLinecap="round" />
      ))}
      {tops.map(([x, y], i) => (
        <g key={i}>
          <path
            d={`M50 220 Q${(50 + x) / 2} ${y + 90} ${x} ${y + 10}`}
            stroke="#7a3a26"
            strokeWidth="2.6"
            fill="none"
          />
          {[-34, -12, 10, 30].map((a, k) => (
            <ellipse
              key={k}
              cx={x}
              cy={y}
              rx="3.4"
              ry="10"
              fill={colour}
              transform={`rotate(${a} ${x} ${y + 10})`}
            />
          ))}
        </g>
      ))}
    </>
  );
}

function Shrub({ leaf, flower, curls }: { leaf: string; flower: string; curls?: boolean }) {
  const mound: [number, number, number, number][] = [
    [85, 92, 80, 30],
    [50, 74, 42, 30],
    [120, 72, 44, 32],
    [85, 56, 44, 30],
  ];
  const blooms = Array.from({ length: 9 }, (_, i) => [22 + r(i, 5) * 126, 32 + r(i, 6) * 66]);
  return (
    <>
      {mound.map(([cx, cy, rx, ry], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={leaf} opacity={i % 2 ? 0.86 : 1} />
      ))}
      {blooms.map(([x, y], i) =>
        curls ? (
          <path
            key={i}
            d={`M${x! - 7} ${y! + 4} q 4 -12 12 -8 q 6 4 0 10`}
            stroke={flower}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          <circle key={i} cx={x} cy={y} r={4.5} fill={flower} />
        ),
      )}
    </>
  );
}

function Mound({ colours, w, h }: { colours: string[]; w: number; h: number }) {
  // a low dome of overlapping leaf clusters: a back row, a front row, then highlights
  const rows = [
    { n: 7, y: 0.52, r: 0.3, from: 0.2, to: 0.8 },
    { n: 9, y: 0.72, r: 0.28, from: 0.1, to: 0.9 },
  ];
  return (
    <>
      {rows.map((row, k) =>
        Array.from({ length: row.n }, (_, i) => {
          const t = i / (row.n - 1);
          const x = w * (row.from + (row.to - row.from) * t);
          const arch = Math.sin(Math.PI * t);
          const rad = h * row.r * (0.8 + 0.35 * arch);
          return (
            <circle
              key={`${k}-${i}`}
              cx={x}
              cy={h * row.y - arch * h * (k ? 0.1 : 0.22) + 2}
              r={rad}
              fill={colours[(i + k) % colours.length]}
            />
          );
        }),
      )}
      {Array.from({ length: 10 }, (_, i) => (
        <circle
          key={`h${i}`}
          cx={w * (0.2 + r(i, 12) * 0.6)}
          cy={h * (0.3 + r(i, 13) * 0.4)}
          r={h * 0.045}
          fill="#e4e9df"
          opacity="0.7"
        />
      ))}
    </>
  );
}

function Tuft({ flower }: { flower?: string }) {
  const n = 15;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        const ex = 6 + t * 118;
        const ey = 30 + Math.abs(t - 0.5) * 70 + r(i, 7) * 8;
        const cx = 65 + (ex - 65) * 0.3;
        const cy = 4 + r(i, 8) * 10;
        return (
          <path
            key={i}
            d={`M65 ${flower ? 90 : 80} Q${cx} ${cy} ${ex} ${ey}`}
            stroke={i % 2 ? "#6f8a4a" : "#8aa05a"}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
      {flower &&
        Array.from({ length: 7 }, (_, i) => (
          <circle key={i} cx={40 + i * 8} cy={14 + r(i, 9) * 14} r={3.6} fill={flower} />
        ))}
    </>
  );
}

function Carpet({ flower }: { flower: string }) {
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => (
        <ellipse
          key={i}
          cx={10 + i * 10}
          cy={44 + r(i, 10) * 8}
          rx="9"
          ry="7"
          fill={i % 2 ? "#4c6a3c" : "#5d7d48"}
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i} transform={`translate(${16 + i * 19} ${32 + r(i, 11) * 6})`}>
          <circle r="4" cx="-3" fill={flower} />
          <circle r="4" cx="3" fill={flower} />
          <circle r="2" cy="3" fill="#f4f1ea" />
        </g>
      ))}
    </>
  );
}

function Rock() {
  return (
    <>
      <path d="M6 56 C2 40 14 22 36 16 C60 8 92 4 116 14 C134 22 140 40 134 56 Z" fill="#c99a5b" />
      <path d="M18 30 C50 24 92 22 128 30" stroke="#b3854a" strokeWidth="2" fill="none" />
      <path d="M10 44 C50 38 96 38 134 44" stroke="#b3854a" strokeWidth="2" fill="none" />
    </>
  );
}
