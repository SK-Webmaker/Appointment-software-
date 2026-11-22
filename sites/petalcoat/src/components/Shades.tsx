import { ArrowRight, Shuffle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { NailHand, mix } from "./NailHand";
import { MaskLines, Reveal } from "./Reveal";
import { FINISHES, LENGTHS, SHADES, SHAPES, shadeOf } from "@/site.config";
import { DEFAULT_LOOK, useBooking } from "@/context/booking";

const FAMILIES = [...new Set(SHADES.map((s) => s.family))];
const SKINS = [
  { name: "Fair", hex: "#f1d3c2" },
  { name: "Medium", hex: "#d9a98a" },
  { name: "Tan", hex: "#b07a58" },
  { name: "Deep", hex: "#6f4630" },
];

/**
 * Chapter I — the shade bar: try a colour, finish, shape and length on a
 * hand (in your skin tone) before you book, then take the look straight
 * into your booking. The signature piece — and genuinely useful.
 */
export function Shades() {
  const { look, setLook, openSheet } = useBooking();
  const [skin, setSkin] = useState(SKINS[1]!.hex);
  const shade = shadeOf(look.shade) ?? shadeOf("Cherry Lacquer")!;
  const hex = shade.hex;

  const surprise = () => {
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;
    setLook({
      shade: pick(SHADES).name,
      finish: pick(FINISHES),
      shape: pick(SHAPES),
      length: pick(LENGTHS),
    });
  };

  return (
    <section
      id="shades"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="shades-title"
    >
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="shades" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="shades-title"
            className="max-w-[13ch] text-[clamp(46px,9.6vw,120px)] leading-[0.94]"
          >
            <MaskLines
              lines={[<>Try it on</>, <em className="text-rose">before you sit down.</em>]}
            />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.75] text-ash md:text-[17px]">
              Pick a shade, a finish, a shape and a length — the hand updates as you go. Like it?
              Take the look straight into your booking.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          {/* the preview */}
          <Reveal className="relative overflow-hidden rounded-[28px] bg-stone">
            <div
              className="absolute inset-0 transition-[background] duration-700"
              style={{
                background: `radial-gradient(70% 60% at 50% 38%, ${mix(hex, "#ffffff", 0.72)}, transparent 72%)`,
              }}
              aria-hidden="true"
            />
            <div className="relative flex flex-col items-center px-5 pb-6 pt-8 md:px-10 md:pb-8 md:pt-12">
              <NailHand
                hex={hex}
                finish={look.finish}
                shape={look.shape}
                length={look.length}
                skin={skin}
                className="h-auto w-full max-w-[440px]"
              />
              <p
                className="mt-4 text-center font-display text-[clamp(28px,4vw,40px)] leading-tight"
                aria-live="polite"
              >
                {shade.name} <em className="text-ash">· {look.finish}</em>
              </p>
              <p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-ash">
                {look.length} · {look.shape}
              </p>
              <div className="mt-5 flex items-center gap-2" role="group" aria-label="Skin tone">
                {SKINS.map((s) => (
                  <button
                    aria-label={`${s.name} skin`}
                    key={s.hex}
                    type="button"
                    aria-pressed={skin === s.hex}
                    onClick={() => setSkin(s.hex)}
                    className={`grid h-11 w-11 place-items-center rounded-full transition-transform duration-300 ${skin === s.hex ? "scale-110" : "hover:scale-105"}`}
                  >
                    <span
                      className={`block h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-stone ${skin === s.hex ? "ring-ink" : "ring-transparent"}`}
                      style={{ background: s.hex }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          {/* the controls */}
          <Reveal delay={0.08} className="flex flex-col gap-7">
            <Row label="Shade" hint={shade.family}>
              <div className="space-y-3">
                {FAMILIES.map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <span className="w-[4.6rem] shrink-0 text-[12px] font-semibold uppercase tracking-[0.14em] text-ash">
                      {f}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SHADES.filter((s) => s.family === f).map((s) => {
                        const on = look.shade === s.name || (!look.shade && s.name === shade.name);
                        return (
                          <button
                            aria-label={s.name}
                            key={s.name}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setLook({ shade: s.name })}
                            title={s.name}
                            className={`grid h-11 w-11 place-items-center rounded-full transition-transform duration-300 ${on ? "scale-105" : "hover:scale-105"}`}
                          >
                            <span
                              className={`block h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-ivory shadow-[inset_0_-6px_10px_rgba(0,0,0,0.18),inset_0_4px_6px_rgba(255,255,255,0.35)] ${on ? "ring-ink" : "ring-transparent"}`}
                              style={{ background: s.hex }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Row>
            <Row label="Finish">
              <Segment
                options={FINISHES}
                value={look.finish}
                onChange={(v) => setLook({ finish: v })}
              />
            </Row>
            <Row label="Shape">
              <Segment
                options={SHAPES}
                value={look.shape}
                onChange={(v) => setLook({ shape: v })}
              />
            </Row>
            <Row label="Length">
              <Segment
                options={LENGTHS}
                value={look.length}
                onChange={(v) => setLook({ length: v })}
              />
            </Row>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openSheet({ look: { ...look, shade: shade.name } })}
                className="btn-primary sheen flex-1"
              >
                Book this look <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <button type="button" onClick={surprise} className="btn-ghost sm:px-6">
                <Shuffle size={16} strokeWidth={1.8} /> Surprise me
              </button>
            </div>
            {(look.shade || look.finish !== DEFAULT_LOOK.finish) && (
              <button
                type="button"
                onClick={() => setLook({ ...DEFAULT_LOOK })}
                className="-mt-3 self-start text-[13px] font-semibold text-ash underline underline-offset-4 hover:text-ink"
              >
                Start again
              </button>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 flex w-full items-baseline justify-between text-[12px] font-semibold uppercase tracking-[0.2em] text-ink">
        {label}
        {hint && (
          <span className="text-[12px] font-normal normal-case tracking-normal text-ash">
            {hint}
          </span>
        )}
      </legend>
      {children}
    </fieldset>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`min-h-[44px] rounded-full border px-4 text-[14px] font-medium transition-colors duration-300 ${value === o ? "border-ink bg-ink text-ivory" : "border-ink/20 bg-card text-ink hover:border-ink"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
