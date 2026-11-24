import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { BUCKET, type BucketId } from "@/site.config";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Chapter 03 — what's in the bucket. A drawing of the kit; pick a tool and
 * it lifts out of the bucket while its card (a photo and a line on why we
 * use it) slides in.
 */
export function Bucket() {
  const [pick, setPick] = useState<BucketId>("squeegee");
  const item = BUCKET.find((x) => x.id === pick) ?? BUCKET[0];

  return (
    <section
      id="bucket"
      className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36"
      aria-labelledby="bucket-title"
    >
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -left-40 top-20 h-[760px] w-[760px] bg-[radial-gradient(closest-side,rgb(154_215_255/0.14),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="bucket" light />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="bucket-title" className="max-w-[12ch] text-[clamp(44px,9vw,120px)] leading-[0.9]">
            <MaskLines lines={[<>What's in</>, <em className="text-silk">the bucket.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.7] text-ivory/80 md:text-[18px]">
              We bring everything. Here's the kit — and why each bit earns its place.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_1fr] lg:gap-14">
          <Reveal className="relative mx-auto w-full max-w-[520px] will-change-transform">
            <div className="aspect-square rounded-full bg-coal" aria-hidden="true">
              <BucketArt pick={pick} />
            </div>
          </Reveal>

          <div className="min-w-0">
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              role="group"
              aria-label="The kit"
            >
              {BUCKET.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={x.id === pick}
                  onClick={() => setPick(x.id)}
                  className={`min-h-[52px] rounded-[16px] px-4 text-left text-[15px] font-bold transition-colors duration-300 ${x.id === pick ? "bg-silk text-noir" : "bg-coal text-ivory hover:bg-ivory/15"}`}
                >
                  {x.name}
                </button>
              ))}
            </div>
            <div className="relative mt-5 min-h-[360px]" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="overflow-hidden rounded-[26px] bg-ivory text-ink"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-stone">
                    <Img
                      name={item.image}
                      widths={[800, 1200]}
                      sizes="(min-width:1024px) 40vw, 92vw"
                      alt={item.alt}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-5 md:p-7">
                    <h3 className="text-[26px] leading-none">{item.name}</h3>
                    <p className="mt-2.5 text-[15.5px] leading-relaxed text-ash">{item.text}</p>
                  </div>
                </motion.article>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Lift({ on, dim, children }: { on: boolean; dim: boolean; children: ReactNode }) {
  return (
    <g
      style={{
        transform: on ? "translateY(-22px)" : "none",
        opacity: dim ? 0.45 : 1,
        transition: "transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s",
      }}
    >
      {children}
    </g>
  );
}

function BucketArt({ pick }: { pick: BucketId }) {
  const is = (id: BucketId) => ({ on: pick === id, dim: pick !== id });
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full">
      {/* the handle, behind everything */}
      <path d="M112 206 Q200 108 288 206" fill="none" stroke="#a3b2cc" strokeWidth="5" />
      {/* inside the bucket */}
      <ellipse cx="200" cy="204" rx="86" ry="12" fill="#0b1328" />
      <Lift {...is("mop")}>
        <path d="M150 210 L118 52" stroke="#e3ebf5" strokeWidth="8" strokeLinecap="round" />
        <circle cx="117" cy="48" r="8" fill="#ff7eb6" />
      </Lift>
      <Lift {...is("duster")}>
        <path d="M178 210 L186 120" stroke="#b07a46" strokeWidth="7" strokeLinecap="round" />
        {[
          [186, 98, 20],
          [172, 108, 15],
          [200, 108, 15],
          [178, 86, 14],
          [196, 84, 14],
          [187, 74, 12],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={i % 2 ? "#f3e6d0" : "#fbf3e6"} />
        ))}
      </Lift>
      <Lift {...is("squeegee")}>
        <path d="M244 214 L266 104" stroke="#ffd23f" strokeWidth="12" strokeLinecap="round" />
        <g transform="rotate(12 268 92)">
          <rect x="218" y="80" width="104" height="16" rx="5" fill="#1f45d6" />
          <rect x="218" y="94" width="104" height="7" rx="3" fill="#14213d" />
        </g>
      </Lift>
      <Lift {...is("sprays")}>
        <rect x="204" y="140" width="34" height="74" rx="8" fill="#a8551b" />
        <rect x="204" y="140" width="34" height="74" rx="8" fill="url(#glass)" />
        <rect x="214" y="124" width="14" height="18" rx="3" fill="#14213d" />
        <path d="M212 124 h26 l8 -10 h-34 z" fill="#14213d" />
        <rect x="210" y="168" width="22" height="18" rx="3" fill="#f4f7fb" opacity="0.9" />
      </Lift>
      {/* the bucket's front */}
      <path d="M112 206 L132 360 Q200 376 268 360 L288 206 Q200 222 112 206 Z" fill="#1f45d6" />
      <path d="M122 232 Q200 248 278 232" stroke="#5b7cff" strokeWidth="5" fill="none" />
      <ellipse cx="200" cy="205" rx="90" ry="15" fill="none" stroke="#ffd23f" strokeWidth="8" />
      <text
        x="200"
        y="304"
        textAnchor="middle"
        fontFamily="'Bricolage Grotesque', sans-serif"
        fontWeight="800"
        fontSize="30"
        fill="#ffd23f"
      >
        S&amp;S
      </text>
      {/* cloths over the rim */}
      <Lift {...is("cloths")}>
        <path d="M118 200 q-10 30 4 56 q14 -4 20 -48 z" fill="#4d8dff" />
        <path d="M262 206 q14 26 6 58 q-18 -2 -22 -52 z" fill="#4cc38a" />
        <path d="M276 202 q16 18 14 44 q-14 2 -22 -38 z" fill="#ff7eb6" />
      </Lift>
      {/* the vacuum on the floor */}
      <Lift {...is("vacuum")}>
        <path d="M318 330 Q350 250 300 228" stroke="#a3b2cc" strokeWidth="7" fill="none" />
        <rect x="296" y="316" width="76" height="48" rx="22" fill="#ff7eb6" />
        <rect x="306" y="324" width="30" height="14" rx="7" fill="#fff" opacity="0.6" />
        <circle cx="310" cy="366" r="8" fill="#14213d" />
        <circle cx="358" cy="366" r="8" fill="#14213d" />
      </Lift>
      <defs>
        <linearGradient id="glass" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
