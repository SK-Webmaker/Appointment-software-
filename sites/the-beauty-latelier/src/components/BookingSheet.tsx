import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { Check, Copy, Instagram, Mail, MessageSquare, Phone, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CATEGORIES, SERVICE_BY_ID, formatPrice } from "@/site.config";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { composeMessage, copyText, estimate, mailHref, smsHref, telHref } from "@/lib/booking";
import { lockScroll } from "@/lib/smooth";

const EASE = [0.22, 1, 0.36, 1] as const;

export function BookingSheet() {
  const { sheetOpen, closeSheet, selected, remove, clear } = useBooking();
  const reduce = useReducedMotionSafe();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [name, setName] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const message = useMemo(() => composeMessage(selected, { name, when, note }), [selected, name, when, note]);
  const { total, open } = estimate(selected);

  // Focus handling, Escape to close, background scroll lock, and a simple focus trap.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    opener.current = document.activeElement as HTMLElement;
    const release = lockScroll();
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
      if (e.key !== "Tab" || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,textarea,[tabindex]:not([tabindex="-1"])');
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

  const sendInstagram = async () => {
    const ok = await copyText(message);
    setToast(ok ? "Message copied — paste it into the chat with Helena." : "Opening Instagram — tell Helena what you'd like to book.");
    window.open(SITE.instagramDm, "_blank", "noopener,noreferrer");
  };

  const copyOnly = async () => {
    const ok = await copyText(message);
    setToast(ok ? "Copied to your clipboard." : "Couldn't copy — select the message and copy it manually.");
  };

  return (
    <AnimatePresence>
      {sheetOpen && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Close booking"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full cursor-default bg-ink/55 backdrop-blur-[3px]"
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
            className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col overflow-hidden rounded-t-[28px] bg-ivory shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[480px] md:rounded-none md:rounded-l-[28px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-espresso/20 md:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-4 md:px-8 md:pt-8">
              <div>
                <p className="eyebrow">Re-opening {SITE.reopeningShort}</p>
                <h2 id="sheet-title" className="mt-2 font-display text-[32px] leading-[1.05] text-espresso">
                  Request your <em className="text-bronze">appointment</em>
                </h2>
              </div>
              <button onClick={closeSheet} data-autofocus className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-espresso/15 text-espresso hover:bg-espresso hover:text-cream" aria-label="Close">
                <X size={20} strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-6 md:px-8" data-lenis-prevent>
              {/* Selected services */}
              <div className="rounded-2xl border border-espresso/10 bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-espresso">Your services</p>
                  {selected.length > 0 && (
                    <button onClick={clear} className="min-h-[32px] text-[11px] uppercase tracking-[0.16em] text-mocha underline underline-offset-4 hover:text-espresso">
                      Clear
                    </button>
                  )}
                </div>
                {selected.length === 0 ? (
                  <div className="mt-3">
                    <p className="text-[14px] leading-relaxed text-mocha">Nothing added yet — that's fine. Send a quick hello, or pick from the menu first:</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {CATEGORIES.map((c) => (
                        <a key={c.id} href="#menu" onClick={closeSheet} className="min-h-[38px] rounded-full border border-espresso/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso hover:border-espresso">
                          {c.title}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ul className="mt-3 divide-y divide-espresso/10">
                    {selected.map((id) => {
                      const s = SERVICE_BY_ID[id];
                      if (!s) return null;
                      return (
                        <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="text-[14px] text-espresso">{s.name}</span>
                          <span className="flex items-center gap-2">
                            <span className="opsz-sm whitespace-nowrap font-display text-[17px] text-espresso">{formatPrice(s)}</span>
                            <button onClick={() => remove(id)} className="grid h-9 w-9 place-items-center rounded-full text-mocha hover:bg-espresso/5 hover:text-espresso" aria-label={`Remove ${s.name}`}>
                              <X size={15} strokeWidth={1.8} />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {total > 0 && (
                  <div className="mt-3 flex items-baseline justify-between border-t border-espresso/15 pt-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mocha">Estimate</span>
                    <span className="opsz-sm font-display text-[24px] text-espresso">
                      {open && <span className="mr-1 text-[14px] italic text-mocha">from</span>}${total}
                    </span>
                  </div>
                )}
              </div>

              {/* Optional details */}
              <div className="mt-5 space-y-4">
                <Field label="Your name" optional>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className={inputCls} placeholder="e.g. Sophia" />
                </Field>
                <Field label="Best days & times" optional>
                  <input value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} placeholder="e.g. Saturday morning, or weekday evenings" />
                </Field>
                <Field label="Anything else" optional>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} resize-none py-3`} placeholder="Inspiration, nail length, allergies…" />
                </Field>
              </div>

              <details className="group mt-5 rounded-2xl border border-espresso/10 bg-linen/60 px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-espresso">
                  Preview your message
                  <span className="text-bronze transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-mocha">{message}</pre>
                <button onClick={copyOnly} className="mt-3 inline-flex min-h-[36px] items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-bronze-deep hover:text-espresso">
                  <Copy size={14} strokeWidth={1.8} /> Copy message
                </button>
              </details>
            </div>

            {/* Actions */}
            <div className="border-t border-espresso/10 bg-ivory px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8">
              <button onClick={sendInstagram} className="btn-primary sheen w-full">
                <Instagram size={17} strokeWidth={1.7} /> Send on Instagram
              </button>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <a href={smsHref(message)} className={altCls}>
                  <MessageSquare size={17} strokeWidth={1.6} /> Text
                </a>
                <a href={mailHref(message)} className={altCls}>
                  <Mail size={17} strokeWidth={1.6} /> Email
                </a>
                <a href={telHref} className={altCls}>
                  <Phone size={17} strokeWidth={1.6} /> Call
                </a>
              </div>
              <p className="mt-3 text-center text-[11.5px] leading-snug text-mocha">
                Instagram copies your message first, ready to paste. Text and email arrive pre-written.
              </p>
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div
                  role="status"
                  className="pointer-events-none absolute inset-x-6 bottom-36 flex items-center gap-3 rounded-2xl bg-espresso px-5 py-4 text-[13.5px] text-cream shadow-xl md:bottom-44"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <Check size={18} className="shrink-0 text-gold" /> {toast}
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
  "w-full min-h-[48px] rounded-xl border border-espresso/15 bg-card px-4 text-[16px] text-espresso placeholder:text-mocha/60 focus:border-bronze focus:outline-none focus:ring-2 focus:ring-bronze/20";

const altCls =
  "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-espresso/15 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-espresso transition-colors hover:border-espresso hover:bg-espresso hover:text-cream";

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-espresso">
        {label}
        {optional && <span className="text-[10px] font-medium normal-case tracking-normal text-mocha">optional</span>}
      </span>
      {children}
    </label>
  );
}
