import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bath, BedDouble, Check, Minus, Plus, Users } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { CLEANS, EXTRAS, FREQS } from "@/site.config";
import { useBooking } from "@/context/booking";
import { hoursLabel, quote } from "@/lib/slots";

/**
 * Chapter 01 — your price, right now. Count the bedrooms and bathrooms, pick
 * the clean, how often and any extras; the price bubble wobbles to each new
 * number, with the team and the time beside it. Then book exactly that.
 */
export function Quote() {
  const b = useBooking();
  const q = quote(b);
  const lease = b.clean === "lease";

  return (
    <section
      id="quote"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="quote-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="quote" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="quote-title" className="max-w-[12ch] text-[clamp(44px,9vw,120px)] leading-[0.9]">
            <MaskLines lines={[<>Your price,</>, <em className="text-rose">right now.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.7] text-ash md:text-[18px]">
              No "from $99*". Tell us the house, and that's the price — the same on the day.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          <Reveal className="min-w-0 space-y-7 rounded-[30px] bg-card p-6 shadow-[0_30px_60px_-44px_rgba(20,33,61,0.45)] md:p-9">
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
              <legend className="mb-2.5 text-[12.5px] font-bold uppercase tracking-[0.14em]">
                The clean
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {CLEANS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={b.clean === c.id}
                    onClick={() => b.set({ clean: c.id })}
                    className={`min-h-[76px] rounded-[20px] border-2 px-4 py-3 text-left transition-colors duration-300 ${b.clean === c.id ? "border-onyx bg-onyx text-white" : "border-ink/10 bg-ivory hover:border-ink"}`}
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
              <legend className="mb-2.5 text-[12.5px] font-bold uppercase tracking-[0.14em]">
                How often
              </legend>
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
                      className={`min-h-[56px] rounded-[18px] border-2 px-3 text-[15px] font-bold transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-45 ${on ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-ivory hover:border-ink"}`}
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
              <legend className="mb-2.5 text-[12.5px] font-bold uppercase tracking-[0.14em]">
                Extras
              </legend>
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

          {/* the price, in a bubble */}
          <Reveal delay={0.06} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="relative overflow-hidden rounded-[30px] bg-onyx p-6 text-white md:p-9">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border-[3px] border-white/15"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-10 -left-8 h-40 w-40 rounded-full border-[3px] border-white/10"
                aria-hidden="true"
              />
              <p className="relative text-[12.5px] font-bold uppercase tracking-[0.14em] text-pearl">
                {lease
                  ? "One clean"
                  : q.freq.id === "once"
                    ? "One clean"
                    : `Per clean, ${q.freq.every}`}
              </p>
              <div className="relative mx-auto mt-6 grid aspect-square w-[min(78%,300px)] place-items-center">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={q.price}
                    className="absolute inset-0 grid place-items-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#ffffff,#d9efff_38%,#9ad7ff_70%,#6fb8ff)] text-ink shadow-[inset_-14px_-18px_40px_rgba(31,69,214,0.35),0_30px_50px_-20px_rgba(0,0,0,0.45)]"
                    initial={{ scale: 0.86 }}
                    animate={{ scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 11 }}
                  >
                    <span className="absolute left-[22%] top-[16%] h-[16%] w-[26%] -rotate-[30deg] rounded-full bg-white/80" />
                    <span className="text-center" aria-live="polite">
                      <span className="block text-[clamp(52px,7vw,84px)] font-extrabold leading-none tracking-[-0.04em] [font-stretch:85%]">
                        ${q.price}
                      </span>
                      {q.off > 0 && (
                        <span className="mt-1 block text-[14px] font-semibold text-ash">
                          <s>${q.full}</s> · {Math.round(q.off * 100)}% off
                        </span>
                      )}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>
              <dl className="relative mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-[18px] bg-white/10 p-4">
                  <dt className="flex items-center gap-1.5 text-[12.5px] text-white">
                    <Users size={14} /> Team
                  </dt>
                  <dd className="mt-1 text-[22px] font-extrabold leading-none">
                    {q.team === 2 ? "Two of us" : "One of us"}
                  </dd>
                </div>
                <div className="rounded-[18px] bg-white/10 p-4">
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
              <p className="relative mt-3 text-center text-[12.5px] text-white/75">
                Prices for a concept business — illustrative only.
              </p>
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
    <div className="flex items-center justify-between gap-3 rounded-[20px] bg-mint px-4 py-3">
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
