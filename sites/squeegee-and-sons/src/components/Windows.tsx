import { useState } from "react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { EXTRAS } from "@/site.config";
import { useBooking } from "@/context/booking";

const WIDTHS = [800, 1200, 1600, 2000, 2400];
const WINDOWS_EXTRA = EXTRAS.find((e) => e.id === "windows");

/**
 * Windows, inside and out: a before-and-after you can drag. The "before" is
 * the same photo seen through grimy glass.
 */
export function Windows() {
  const { toggleExtra, extras } = useBooking();
  const [pos, setPos] = useState(55);
  const added = extras.includes("windows");

  return (
    <section
      id="windows"
      className="bg-ivory py-20 text-ink md:py-28"
      aria-labelledby="windows-title"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="windows-title"
          label="Window cleaning"
          title="Windows, inside and out"
          intro="Drag across to see the difference a squeegee makes. Add inside windows to any clean, or ask us about outside panes."
        >
          <button
            type="button"
            aria-pressed={added}
            onClick={() => toggleExtra("windows")}
            className={added ? "btn-primary shrink-0" : "btn-ghost shrink-0"}
          >
            {added ? "Windows added" : `Add inside windows · $${WINDOWS_EXTRA?.price}`}
          </button>
        </SectionHead>

        <Reveal className="mt-10">
          <div
            data-qa="layered"
            className="relative aspect-[4/3] select-none overflow-hidden rounded-[16px] bg-stone md:aspect-[16/9]"
          >
            <Img
              name="kitchen2"
              widths={WIDTHS}
              sizes="(min-width:1320px) 1256px, 94vw"
              alt="After: a kitchen seen through freshly cleaned glass"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
              <Img
                name="kitchen2-fog"
                widths={WIDTHS}
                sizes="(min-width:1320px) 1256px, 94vw"
                alt="Before: the same kitchen seen through grimy, streaked glass"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
              style={{ left: `${pos}%` }}
              aria-hidden="true"
            >
              <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[18px] font-bold text-ink shadow-lg">
                ↔
              </span>
            </div>
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[13.5px] font-semibold">
              Before
            </span>
            <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[13.5px] font-semibold">
              After
            </span>
            <label className="absolute inset-0 cursor-ew-resize">
              <span className="sr-only">Compare before and after</span>
              <input
                type="range"
                min={0}
                max={100}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                className="h-full w-full cursor-ew-resize opacity-0"
              />
            </label>
          </div>
          <p className="mt-3 text-[13.5px] text-ash">
            Illustration: the same photo shown before and after the glass is cleaned.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
