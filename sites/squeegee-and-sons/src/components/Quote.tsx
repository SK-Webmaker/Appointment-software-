import { ArrowRight, Bath, BedDouble, Check, Minus, Plus, Users } from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { Tween } from "./fx/Tween";
import { CLEANS, EXTRAS, FREQS } from "@/site.config";
import { useBooking } from "@/context/booking";
import { hoursLabel, quote } from "@/lib/slots";

/**
 * Prices: count the bedrooms and bathrooms, pick the clean, how often and any
 * extras; the price per clean updates as you go, with the team and the time
 * beside it. Then book exactly that.
 */
export function Quote() {
  const b = useBooking();
  const q = quote(b);
  const lease = b.clean === "lease";

  return (
    <section id="quote" className="bg-ivory py-20 text-ink md:py-28" aria-labelledby="quote-title">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="quote-title"
          label="Prices"
          title="Work out your price"
          intro="Tell us about the house and how often you'd like us. The price you see is the price per clean — it doesn't change on the day."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          <Reveal className="min-w-0 space-y-7 rounded-[14px] border border-ink/10 bg-white p-6 md:p-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <Stepper
                label="Bedrooms"
                icon={<BedDouble size={20} strokeWidth={1.9} />}
                value={b.bedrooms}
                min={1}
                max={6}
                onChange={(n) => b.set({ bedrooms: n })}
              />
              <Stepper
                label="Bathrooms"
                icon={<Bath size={20} strokeWidth={1.9} />}
                value={b.bathrooms}
                min={1}
                max={4}
                onChange={(n) => b.set({ bathrooms: n })}
              />
            </div>

            <fieldset className="min-w-0">
              <legend className="mb-2.5 text-[15px] font-bold">The clean</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {CLEANS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={b.clean === c.id}
                    onClick={() => b.set({ clean: c.id })}
                    className={`min-h-[76px] rounded-[12px] border-2 px-4 py-3 text-left transition-colors duration-300 ${b.clean === c.id ? "border-onyx bg-onyx text-white" : "border-ink/10 bg-ivory hover:border-ink"}`}
                  >
                    <span className="block text-[18px] font-extrabold tracking-[-0.01em]">
                      {c.name}
                    </span>
                    <span className="block text-[13px] leading-snug opacity-85">{c.note}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="mb-2.5 text-[15px] font-bold">How often</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FREQS.map((f) => {
                  const on = (lease ? "once" : b.freq) === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={on}
                      disabled={lease && f.id !== "once"}
                      onClick={() => b.set({ freq: f.id })}
                      className={`min-h-[56px] rounded-[12px] border-2 px-3 text-[15px] font-bold transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-45 ${on ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-ivory hover:border-ink"}`}
                    >
                      {f.name}
                      {f.off > 0 && (
                        <span
                          className={`block text-[12px] font-semibold ${on ? "text-silk" : "text-rose"}`}
                        >
                          {Math.round(f.off * 100)}% off
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {lease && (
                <p className="mt-2 text-[13.5px] text-ash">
                  End-of-lease cleans are one-offs — hopefully.
                </p>
              )}
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="mb-2.5 text-[15px] font-bold">Extras</legend>
              <div className="flex flex-wrap gap-2">
                {EXTRAS.map((x) => {
                  const on = b.extras.includes(x.id);
                  return (
                    <button
                      key={x.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => b.toggleExtra(x.id)}
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-4 text-[14px] font-semibold transition-colors duration-300 ${on ? "border-onyx bg-mint" : "border-ink/10 hover:border-ink"}`}
                    >
                      {on ? <Check size={14} strokeWidth={2.8} /> : <Plus size={14} />} {x.name}{" "}
                      <span className="font-medium text-ash">${x.price}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Reveal>

          {/* the price */}
          <Reveal delay={0.06} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="relative overflow-hidden rounded-[14px] bg-noir p-6 text-white md:p-8">
              <p className="relative text-[15px] font-semibold text-pearl">
                {lease
                  ? "One clean"
                  : q.freq.id === "once"
                    ? "One clean"
                    : `Per clean, ${q.freq.every}`}
              </p>
              <p
                className="relative mt-3 text-[clamp(52px,7vw,72px)] font-bold leading-none tracking-[-0.03em]"
                aria-live="polite"
              >
                <Tween value={q.price} format={(n) => `$${Math.round(n)}`} />
              </p>
              {q.off > 0 && (
                <p className="relative mt-2 text-[15px] text-white/80">
                  <s>${q.full}</s> · {Math.round(q.off * 100)}% off for a regular booking
                </p>
              )}
              <dl className="relative mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-[10px] bg-white/10 p-4">
                  <dt className="flex items-center gap-1.5 text-[12.5px] text-white">
                    <Users size={14} /> Team
                  </dt>
                  <dd className="mt-1 text-[22px] font-extrabold leading-none">
                    {q.team === 2 ? "Two of us" : "One of us"}
                  </dd>
                </div>
                <div className="rounded-[10px] bg-white/10 p-4">
                  <dt className="text-[12.5px] text-white">On site</dt>
                  <dd className="mt-1 text-[22px] font-extrabold leading-none">
                    about {hoursLabel(q.hours)}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => b.openSheet({ step: 1 })}
                className="btn-honey sheen relative mt-6 w-full"
              >
                Book this clean <ArrowRight size={16} strokeWidth={1.8} />
              </button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Stepper({
  label,
  icon,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] bg-mint px-4 py-3">
      <span className="flex items-center gap-2 text-[16px] font-bold">
        {icon} {label}
      </span>
      <span className="flex items-center gap-2" role="group" aria-label={label}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-sm transition-colors hover:bg-ink hover:text-white disabled:opacity-40"
        >
          <Minus size={18} strokeWidth={2.4} />
        </button>
        <output
          className="w-7 text-center text-[26px] font-extrabold tabular-nums"
          aria-live="polite"
        >
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-sm transition-colors hover:bg-ink hover:text-white disabled:opacity-40"
        >
          <Plus size={18} strokeWidth={2.4} />
        </button>
      </span>
    </div>
  );
}
