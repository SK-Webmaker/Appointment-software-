import { animate, motion } from "framer-motion";
import { ArrowRight, Check, Clock, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { ADDONS, OPEN, PACKAGES, VEHICLES, packageOf, quote, type VehicleId } from "@/site.config";
import { useBooking } from "@/context/booking";
import { dayLabel, isoDay, pretty, readyBy, fromMins } from "@/lib/slots";

/** Side profiles, drawn on a 120 × 48 grid. */
const SHAPES: Record<VehicleId, string> = {
  hatch:
    "M14 36 L14 27 Q15 23 24 22 L40 13 Q44 11 52 11 L74 11 Q82 11 88 18 L92 22 Q102 23 104 28 L104 36 Z",
  sedan:
    "M8 36 L8 28 Q9 24 18 23 L36 14 Q40 12 48 12 L70 12 Q78 12 86 20 L104 22 Q112 23 113 29 L113 36 Z",
  suv: "M8 36 L8 22 Q8 18 14 17 L28 9 Q31 7 38 7 L84 7 Q90 7 94 12 L100 18 Q112 19 113 26 L113 36 Z",
  ute: "M6 36 L6 23 Q6 19 12 18 L26 9 Q29 7 36 7 L60 7 Q64 7 64 12 L64 19 L114 19 L114 36 Z",
};

function Silhouette({ id, className = "" }: { id: VehicleId; className?: string }) {
  return (
    <svg viewBox="0 0 120 48" className={className} aria-hidden="true">
      <path d={SHAPES[id]} fill="currentColor" />
      <circle
        cx={id === "ute" ? 28 : 30}
        cy="37"
        r="7.5"
        fill="currentColor"
        stroke="var(--color-ivory)"
        strokeWidth="2.5"
      />
      <circle
        cx={id === "ute" ? 96 : 92}
        cy="37"
        r="7.5"
        fill="currentColor"
        stroke="var(--color-ivory)"
        strokeWidth="2.5"
      />
    </svg>
  );
}

/** A number that counts to its new value instead of jumping. */
function Count({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [shown, setShown] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    const c = animate(last.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    last.current = value;
    return () => c.stop();
  }, [value]);
  return (
    <span className="tabular-nums">
      {prefix}
      {shown.toLocaleString("en-AU")}
    </span>
  );
}

/** The next drop-off: the next open morning from tomorrow. */
function nextDropOff(now = new Date()) {
  for (let i = 1; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const h = OPEN[d.getDay()];
    if (h) return { day: isoDay(d), time: fromMins(h[0] * 60) };
  }
  return null;
}

/**
 * Chapter 01 — build a detail: pick the car, the package and any extras; the
 * spec sheet prices it, times it, says what protection you leave with and
 * when you'd have the car back if you dropped it off on the next open
 * morning. "Book this build" carries the lot into the booking.
 */
export function Builder() {
  const { vehicle, setVehicle, pkg, setPkg, addons, toggleAddon, openSheet } = useBooking();
  const id = pkg || "correction";
  const p = packageOf(id)!;
  const q = quote(vehicle, id, addons);
  const [ready, setReady] = useState<string | null>(null);
  useEffect(() => {
    const d = nextDropOff();
    if (!d) return;
    const r = readyBy(d.day, d.time, q.hours);
    setReady(
      `Drop off ${dayLabel(d.day, { weekday: "short" })} ${pretty(d.time)} → ready ${r.day === d.day ? "" : `${dayLabel(r.day, { weekday: "short" })} `}${pretty(r.time)}`,
    );
  }, [q.hours]);

  return (
    <section
      id="build"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="build-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="build" />
        <h2
          id="build-title"
          className="mt-8 max-w-[18ch] text-[clamp(30px,6.4vw,76px)] leading-[1.08] [&_em]:bg-none [&_em]:text-rose"
        >
          <MaskLines lines={[<>Build the detail.</>, <em>We'll price it live.</em>]} />
        </h2>

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <div className="space-y-10">
            <Reveal>
              <fieldset className="min-w-0">
                <legend className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em]">
                  1 · Your car
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {VEHICLES.map((v) => {
                    const on = vehicle === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setVehicle(v.id)}
                        className={`flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-[14px] border-2 px-2 py-3 transition-colors duration-300 ${on ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-card text-ink hover:border-ink/50"}`}
                      >
                        <Silhouette
                          id={v.id}
                          className={`h-10 w-auto ${on ? "text-ivory" : "text-ink"}`}
                        />
                        <span className="text-[14px] font-semibold">{v.name}</span>
                        <span className={`text-[11.5px] ${on ? "text-ivory/80" : "text-ash"}`}>
                          {v.example}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </Reveal>

            <Reveal>
              <fieldset className="min-w-0">
                <legend className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em]">
                  2 · The package
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PACKAGES.map((x) => {
                    const on = id === x.id;
                    return (
                      <button
                        key={x.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPkg(x.id)}
                        className={`relative flex min-h-[130px] flex-col items-start rounded-[14px] border-2 p-4 text-left transition-colors duration-300 ${on ? "border-rose bg-noir text-ivory" : "border-ink/10 bg-card hover:border-ink/50"}`}
                      >
                        <span className="flex w-full items-baseline justify-between gap-3">
                          <span className="font-display text-[14px] uppercase tracking-[0.04em]">
                            {x.name}
                          </span>
                          <span className={`text-[13px] ${on ? "text-silk" : "text-rose"}`}>
                            from ${x.price}
                          </span>
                        </span>
                        <span
                          className={`mt-2 text-[14px] leading-snug ${on ? "text-ivory/80" : "text-ash"}`}
                        >
                          {x.blurb}
                        </span>
                        <span
                          className={`mt-auto pt-3 text-[12px] font-medium uppercase tracking-[0.14em] ${on ? "text-pearl" : "text-ash"}`}
                        >
                          {x.hours >= 8
                            ? x.hours >= 16
                              ? "Overnight"
                              : "Full day"
                            : `${x.hours} hrs`}{" "}
                          · protects {x.protects}
                        </span>
                        {on && (
                          <span
                            className="iri-bg absolute inset-x-4 -bottom-[2px] h-[3px] rounded-full"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </Reveal>

            <Reveal>
              <fieldset className="min-w-0">
                <legend className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em]">
                  3 · Extras
                </legend>
                <div className="flex flex-wrap gap-2">
                  {ADDONS.map((a) => {
                    const on = addons.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleAddon(a.id)}
                        className={`inline-flex min-h-[46px] items-center gap-2 rounded-full border-2 px-4 text-[14px] font-medium transition-colors ${on ? "border-ink bg-ink text-ivory" : "border-ink/15 bg-card hover:border-ink/50"}`}
                      >
                        {on && <Check size={15} strokeWidth={2.4} />} {a.name}{" "}
                        <span className={on ? "text-silk" : "text-rose"}>+${a.price}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </Reveal>
          </div>

          {/* the spec sheet */}
          <div className="lg:relative">
            <div className="lg:sticky lg:top-[calc(var(--nav-h)+24px)]">
              <Reveal className="overflow-hidden rounded-[20px] bg-noir text-ivory shadow-[0_40px_80px_-40px_rgba(0,0,0,0.7)]">
                <div className="iri-bg h-1" aria-hidden="true" />
                <div className="p-6 md:p-8">
                  <p className="text-[11.5px] font-medium uppercase tracking-[0.24em] text-mist">
                    Spec sheet
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <Silhouette id={vehicle as VehicleId} className="h-9 w-auto text-ivory/90" />
                    <p className="font-display text-[15px] uppercase leading-snug">{p.name}</p>
                  </div>
                  <p
                    className="mt-6 font-display text-[clamp(44px,8vw,64px)] leading-none"
                    aria-live="polite"
                  >
                    <Count value={q.price} prefix="$" />
                  </p>
                  <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ivory/10 pt-5 text-[14px]">
                    <div>
                      <dt className="flex items-center gap-1.5 text-mist">
                        <Clock size={14} /> Time in the bay
                      </dt>
                      <dd className="mt-1 text-[16px] font-semibold">
                        {q.overnight ? "Overnight" : `${q.hours} hrs`}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5 text-mist">
                        <Shield size={14} /> Protection
                      </dt>
                      <dd className="mt-1 text-[16px] font-semibold">{p.protects}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 min-h-[22px] text-[13.5px] text-pearl">{ready}</p>
                  <ul className="mt-5 space-y-2 border-t border-ivory/10 pt-5 text-[14px] text-ivory/85">
                    {p.includes.map((x) => (
                      <motion.li
                        key={`${id}-${x}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4 }}
                        className="flex gap-2.5"
                      >
                        <Check size={15} className="mt-[3px] shrink-0 text-silk" /> {x}
                      </motion.li>
                    ))}
                    {addons.map((a) => (
                      <li key={a} className="flex gap-2.5 text-pearl">
                        <Check size={15} className="mt-[3px] shrink-0" />{" "}
                        {ADDONS.find((x) => x.id === a)?.name}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => openSheet({ pkg: id })}
                    className="btn-honey sheen mt-7 w-full"
                  >
                    Book this build <ArrowRight size={16} strokeWidth={1.8} />
                  </button>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
