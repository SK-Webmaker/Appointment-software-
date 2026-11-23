import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Phone, RotateCcw, Wrench } from "lucide-react";
import { useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { QUIZ, SITE, VERDICTS } from "@/site.config";
import { useBooking } from "@/context/booking";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Chapter 03 — DIY or call us? Two or three taps and you get an honest
 * answer: here's what to try yourself first, or put the kettle down and call.
 * (A plumber telling you to save your money, sometimes, is the point.)
 */
export function Diy() {
  const { openSheet } = useBooking();
  const [path, setPath] = useState<number[]>([0]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const q = QUIZ[path[path.length - 1] ?? 0]!;
  const v = verdict ? VERDICTS[verdict] : null;

  const choose = (o: (typeof q.options)[number]) => {
    if ("verdict" in o) setVerdict(o.verdict);
    else setPath((p) => [...p, o.next]);
  };
  const back = () => {
    if (verdict) setVerdict(null);
    else setPath((p) => (p.length > 1 ? p.slice(0, -1) : p));
  };
  const restart = () => {
    setVerdict(null);
    setPath([0]);
  };

  return (
    <section
      id="diy"
      className="sheet bg-stone pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="diy-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="diy" />
        <div className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2
              id="diy-title"
              className="max-w-[12ch] text-[clamp(40px,8.4vw,104px)] leading-[0.96]"
            >
              <MaskLines lines={[<>DIY, or</>, <em className="text-rose">call us?</em>]} />
            </h2>
            <Reveal>
              <p className="mt-6 max-w-[38ch] text-[16px] leading-[1.75] text-ash md:text-[17px]">
                Honest answer in three taps. Sometimes it's a kettle and a plunger — and we'd rather
                you knew that.
              </p>
            </Reveal>
          </div>

          <Reveal className="relative min-h-[420px] overflow-hidden rounded-[28px] bg-card p-6 shadow-[0_30px_60px_-40px_rgba(15,43,42,0.4)] md:p-10">
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-8 rounded-full transition-colors duration-500 ${i < path.length + (verdict ? 1 : 0) ? "bg-onyx" : "bg-ink/15"}`}
                  />
                ))}
              </div>
              {(path.length > 1 || verdict) && (
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-ash hover:text-ink"
                >
                  <ArrowLeft size={15} /> Back
                </button>
              )}
            </div>
            <div aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                {!v ? (
                  <motion.div
                    key={`q${path.join("-")}`}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <p className="mt-8 font-display text-[clamp(26px,4vw,38px)] leading-tight [font-variation-settings:'SOFT'_100,'WONK'_1]">
                      {q.q}
                    </p>
                    <div className="mt-6 grid gap-2">
                      {q.options.map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          onClick={() => choose(o)}
                          className="flex min-h-[60px] items-center justify-between gap-3 rounded-[16px] border-2 border-ink/10 bg-ivory px-5 text-left text-[16px] font-semibold transition-colors hover:border-onyx hover:bg-white"
                        >
                          {o.label} <span className="text-[20px] text-onyx">→</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`v${verdict}`}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className={`mt-6 rounded-[22px] p-6 md:p-8 ${v.diy ? "bg-mint" : "bg-candy"}`}
                  >
                    <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-ink">
                      {v.diy ? <Wrench size={15} /> : <Phone size={15} />}{" "}
                      {v.diy ? "Have a go" : "Our call"}
                    </p>
                    <p className="mt-3 font-display text-[clamp(28px,4.4vw,42px)] leading-tight text-ink [font-variation-settings:'SOFT'_100,'WONK'_1]">
                      {v.title}
                    </p>
                    <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-ink">
                      {v.text}
                    </p>
                    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                      {v.diy ? (
                        <button
                          type="button"
                          onClick={() => openSheet(v.problem ? { problem: v.problem } : {})}
                          className="btn-primary"
                        >
                          Still stuck? Book us
                        </button>
                      ) : (
                        <a href={SITE.phoneHref} className="btn-primary">
                          <Phone size={16} /> Call {SITE.phone}
                        </a>
                      )}
                      <button type="button" onClick={restart} className="btn-ghost">
                        <RotateCcw size={15} /> Start again
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
