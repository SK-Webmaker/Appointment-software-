import { ArrowRight, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { AREA, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { etaNow, suburbOf } from "@/lib/slots";

// Van routes across the drawing (viewBox 600 × 400).
const ROUTES = [
  { d: "M60 330 L180 330 L180 230 L320 230 L320 150", dur: "11s" },
  { d: "M560 300 L460 300 L460 200 L360 200 L360 280 L250 280", dur: "14s" },
  { d: "M120 180 L240 180 L240 300 L400 300 L400 360", dur: "12.5s" },
];
const STREETS = [
  "M0 330 H600",
  "M0 280 H600",
  "M0 230 H600",
  "M0 180 H520",
  "M60 120 V400",
  "M180 130 V400",
  "M240 140 V400",
  "M320 120 V400",
  "M400 160 V400",
  "M460 170 V400",
  "M540 200 V400",
];

/** Where a postcode sits on the drawing — spread west to east by number. */
function pinFor(pc: string) {
  const n = Number(pc);
  const x =
    n >= 2200
      ? 120
      : n >= 2130
        ? 90
        : n >= 2036
          ? 190 + ((n - 2036) % 15) * 9
          : n >= 2021
            ? 450 + ((n - 2021) % 11) * 9
            : 330 + ((n - 2000) % 18) * 5;
  const y =
    n >= 2200
      ? 330
      : n >= 2130
        ? 260
        : n >= 2036
          ? 200 + ((n * 7) % 90)
          : n >= 2021
            ? 230 + ((n * 5) % 110)
            : 200 + ((n * 3) % 80);
  return { x, y };
}

/**
 * Chapter 03 — where we go: type a postcode, and the map drops a pin and
 * tells you the suburb and how far the nearest van is right now. Three vans
 * drive their routes across the drawing. Every suburb we cover is listed.
 */
export function Area() {
  const { postcode, setPostcode, openSheet } = useBooking();
  const [eta, setEta] = useState<number | null>(null);
  const suburb = suburbOf(postcode);
  const ready = postcode.length === 4;
  useEffect(() => setEta(ready && suburb ? etaNow(postcode) : null), [postcode, ready, suburb]);
  const pin = ready && suburb ? pinFor(postcode) : null;

  return (
    <section
      id="area"
      className="sheet bg-stone pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="area-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="area" />
        <h2
          id="area-title"
          className="mt-8 max-w-[15ch] text-[clamp(40px,8.6vw,108px)] leading-[0.88]"
        >
          <MaskLines lines={[<>Are we</>, <em className="text-rose">near you?</em>]} />
        </h2>

        <div className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
          <Reveal className="flex flex-col gap-5">
            <div className="rounded-[18px] bg-ivory p-6 md:p-8">
              <label
                htmlFor="area-postcode"
                className="font-mono text-[12px] uppercase tracking-[0.16em] text-rose"
              >
                Your postcode
              </label>
              <input
                id="area-postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="e.g. 2042"
                className="mt-2 block h-[72px] w-full rounded-2xl border-2 border-ink/15 bg-card px-5 font-mono text-[34px] font-bold tracking-[0.12em] text-ink placeholder:text-ash/60 focus:border-ink focus:outline-none"
              />
              <div className="mt-4 min-h-[96px]" aria-live="polite">
                {!ready ? (
                  <p className="text-[15px] leading-relaxed text-ash">
                    Four digits and we'll tell you if we cover you — and how far the nearest van is
                    right now.
                  </p>
                ) : suburb ? (
                  <>
                    <p className="text-[19px] font-bold text-ink">
                      Yes — {suburb} {postcode}.
                    </p>
                    <p className="mt-1 text-[15px] text-ash">
                      Nearest van:{" "}
                      <span className="font-mono font-bold text-ink">~{eta ?? "…"} min</span> away
                      right now.
                    </p>
                    <button
                      type="button"
                      onClick={() => openSheet({ postcode })}
                      className="btn-primary sheen mt-4"
                    >
                      Book in {suburb} <ArrowRight size={16} strokeWidth={2} />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[19px] font-bold text-ink">Not one of ours — yet.</p>
                    <p className="mt-1 text-[15px] text-ash">
                      Call {SITE.phone} anyway: we'll recommend a plumber who can get to you fast.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ash">
                Every suburb we cover · tap one
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(AREA).map(([pc, name]) => (
                  <li key={pc}>
                    <button
                      type="button"
                      onClick={() => setPostcode(pc)}
                      aria-pressed={postcode === pc}
                      className={`min-h-[40px] rounded-full border px-3 text-[13px] transition-colors ${postcode === pc ? "border-ink bg-ink text-ivory" : "border-ink/15 bg-card text-ink hover:border-ink"}`}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* the map */}
          <Reveal delay={0.08} className="relative overflow-hidden rounded-[22px] bg-noir">
            <svg
              viewBox="0 0 600 400"
              className="block h-auto w-full"
              role="img"
              aria-label={
                pin
                  ? `Map with a pin in ${suburb} and vans on the road`
                  : "Map of our area with three vans on the road"
              }
            >
              <defs>
                <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M24 0H0V24" fill="none" stroke="#8fdcec" strokeOpacity="0.08" />
                </pattern>
              </defs>
              <rect width="600" height="400" fill="url(#grid)" />
              {/* the harbour */}
              <path
                d="M0 0 H600 V110 C540 120 520 160 470 150 C420 140 400 100 340 108 C290 115 260 150 200 140 C150 132 120 100 60 110 C30 115 10 120 0 118 Z"
                fill="#0f4c6b"
                opacity="0.8"
              />
              <path
                d="M0 118 C10 120 30 115 60 110 C120 100 150 132 200 140 C260 150 290 115 340 108 C400 100 420 140 470 150 C520 160 540 120 600 110"
                fill="none"
                stroke="#8fdcec"
                strokeOpacity="0.5"
                strokeWidth="1.5"
              />
              {STREETS.map((d) => (
                <path key={d} d={d} stroke="#eef1ec" strokeOpacity="0.1" strokeWidth="3" />
              ))}
              {[
                ["Inner West", 110, 214],
                ["City", 330, 170],
                ["Eastern Suburbs", 500, 250],
                ["Port Jackson", 300, 50],
              ].map(([t, x, y]) => (
                <text
                  key={t as string}
                  x={x as number}
                  y={y as number}
                  textAnchor="middle"
                  fill={t === "Port Jackson" ? "#8fdcec" : "#8d9aa6"}
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 11,
                    letterSpacing: 2,
                  }}
                >
                  {(t as string).toUpperCase()}
                </text>
              ))}
              {ROUTES.map((r, i) => (
                <g key={i}>
                  <path
                    d={r.d}
                    fill="none"
                    stroke="#ff6a2b"
                    strokeOpacity="0.25"
                    strokeWidth="2"
                    strokeDasharray="4 6"
                  />
                  <g>
                    <rect x="-9" y="-6" width="18" height="12" rx="3" fill="#ff6a2b" />
                    <rect x="2" y="-4" width="5" height="4" rx="1" fill="#0b1624" />
                    <animateMotion
                      dur={r.dur}
                      repeatCount="indefinite"
                      path={r.d}
                      keyPoints="0;1;1;0;0"
                      keyTimes="0;0.45;0.5;0.95;1"
                      calcMode="linear"
                    />
                  </g>
                </g>
              ))}
              {pin && (
                <g transform={`translate(${pin.x} ${pin.y})`}>
                  <circle r="10" fill="#8fdcec" opacity="0.3">
                    <animate attributeName="r" values="8;26;8" dur="2s" repeatCount="indefinite" />
                    <animate
                      attributeName="opacity"
                      values="0.5;0;0.5"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle r="7" fill="#8fdcec" stroke="#0b1624" strokeWidth="2.5" />
                </g>
              )}
            </svg>
            <div className="flex items-center justify-between gap-3 border-t border-ivory/10 px-5 py-4 text-ivory">
              <p className="flex items-center gap-2 text-[14px]">
                <MapPin size={16} strokeWidth={1.8} className="text-flare" />{" "}
                {pin ? `${suburb} ${postcode}` : "Type a postcode to drop a pin"}
              </p>
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-pearl">
                Vans live*
              </p>
            </div>
          </Reveal>
        </div>
        <p className="mt-4 text-[12.5px] text-ash">*A drawing, not a tracker: {SITE.concept}</p>
      </div>
    </section>
  );
}
