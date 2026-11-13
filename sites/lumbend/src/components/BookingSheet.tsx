import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { Check, Copy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GASES, SHAPES, SHAPE_NAMES, SITE, price } from "@/site.config";
import { useBooking } from "@/context/booking";
import { composeOrder, copyText } from "@/lib/booking";
import { Lamp } from "./Lamp";
import { lockScroll } from "@/lib/smooth";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The pre-order. Pick a shape and a gas and watch your lamp light up in the
 * sheet, add your word for the Word lamp, then copy the order. LUMBEND is a
 * concept product, so nothing is charged or sent — the sheet says so.
 */
export function BookingSheet() {
  const { sheetOpen, closeSheet, shape, setShape, words, setWords, gas, setGas, glow } = useBooking();
  const reduce = useReducedMotionSafe();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const cost = SHAPES.find((s) => s.name === shape)?.price;
  const brief = useMemo(() => composeOrder({ shape, words, gas, name, contact }), [shape, words, gas, name, contact]);

  // Focus handling, Escape to close, background scroll lock, and a simple focus trap.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    opener.current = document.activeElement as HTMLElement;
    const release = lockScroll();
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
      if (e.key !== "Tab" || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,textarea,summary,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      release();
      opener.current?.focus?.();
    };
  }, [sheetOpen, closeSheet]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const copyBrief = async () => {
    const ok = await copyText(brief);
    setToast(ok ? "Order copied. LUMBEND is a concept product — nothing was charged or sent." : "Couldn’t copy — select the order and copy it manually.");
  };

  return (
    <AnimatePresence>
      {sheetOpen && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Close the order"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full cursor-default bg-void/70 backdrop-blur-[3px]"
            onClick={closeSheet}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col overflow-hidden rounded-t-[28px] border-t border-bone/10 bg-night shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[520px] md:rounded-none md:rounded-l-[28px] md:border-l md:border-t-0"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-bone/20 md:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-4 md:px-8 md:pt-8">
              <div>
                <p className="stamp text-amber">{SITE.product} · Pre-order</p>
                <h2 id="sheet-title" className="mt-3 text-[32px] font-extrabold uppercase leading-[0.95]">
                  Your LUMBEND <span className="font-serif font-normal normal-case italic text-amber">order</span>
                </h2>
              </div>
              <button onClick={closeSheet} data-autofocus className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-bone/20 text-bone hover:bg-bone hover:text-void" aria-label="Close">
                <X size={20} strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-6 md:px-8" data-lenis-prevent>
              {/* live preview */}
              <div className="relative grid h-[220px] place-items-center overflow-hidden rounded-2xl border border-bone/10 bg-void" aria-live="polite">
                <div className="absolute inset-0" style={{ background: `radial-gradient(60% 60% at 50% 45%, color-mix(in oklab, ${glow} 22%, transparent), transparent 70%)` }} aria-hidden="true" />
                <Lamp shape={shape || "Loop"} word={words} className="relative h-[190px] aspect-[240/300]" />
                <p className="stamp absolute bottom-3 left-4 text-haze">
                  {shape ? `The ${shape}` : "Pick a shape"} · {GASES.find((g) => g.symbol === gas)?.name ?? "pick a light"}
                </p>
                <p className="stamp absolute bottom-3 right-4 text-bone">{cost ? price(cost) : ""}</p>
              </div>

              <Group label="Shape" hint="choose one">
                {SHAPE_NAMES.map((o) => (
                  <Chip key={o} on={shape === o} onClick={() => setShape(shape === o ? "" : o)}>
                    {o}
                  </Chip>
                ))}
              </Group>

              {shape === "Word" && (
                <div className="mt-6">
                  <Field label="Your word">
                    <input value={words} onChange={(e) => setWords(e.target.value.slice(0, 12))} className={inputCls} placeholder="Up to 12 letters" />
                  </Field>
                </div>
              )}

              <Group label="Light" hint="each gas glows its own colour">
                {GASES.map((g) => (
                  <Chip key={g.symbol} on={gas === g.symbol} onClick={() => setGas(gas === g.symbol ? "" : g.symbol)} label={`${g.name}, ${g.glow}`}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.colour, boxShadow: `0 0 8px ${g.colour}` }} aria-hidden="true" />
                    {g.symbol}
                  </Chip>
                ))}
              </Group>

              <div className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your name" optional>
                    <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputCls} />
                  </Field>
                  <Field label="Email or phone" optional>
                    <input value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" className={inputCls} />
                  </Field>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-bone/10 bg-void/60 px-5 py-4">
                <p className="stamp text-haze">Your order</p>
                <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-bone">{brief}</pre>
              </div>
            </div>

            {/* Action */}
            <div className="border-t border-bone/10 bg-night px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8">
              <button onClick={copyBrief} className="btn-amber w-full">
                <Copy size={16} strokeWidth={1.8} /> Copy my order
              </button>
              <p className="mt-3 text-center text-[12px] leading-snug text-haze">
                {SITE.product} is a concept product made for this showcase — nothing is charged or sent.
              </p>
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div
                  role="status"
                  className="pointer-events-none absolute inset-x-6 bottom-32 flex items-center gap-3 rounded-2xl bg-bone px-5 py-4 text-[14px] text-void shadow-xl"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <Check size={18} className="shrink-0 text-ember" /> {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const inputCls =
  "w-full min-h-[48px] rounded-xl border border-bone/15 bg-void px-4 text-[16px] text-bone placeholder:text-haze/70 focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/25";

function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6">
      <legend className="stamp flex w-full items-baseline justify-between gap-3 text-bone">
        {label}
        {hint && <span className="text-right text-[11px] normal-case tracking-normal text-haze">{hint}</span>}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[13px] transition-colors duration-300 ${
        on ? "border-amber bg-amber text-void" : "border-bone/20 bg-void text-bone hover:border-bone/60"
      }`}
    >
      {on && !label && <Check size={14} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="stamp mb-2 flex items-baseline justify-between text-bone">
        {label}
        {optional && <span className="text-[11px] normal-case tracking-normal text-haze">optional</span>}
      </span>
      {children}
    </label>
  );
}
