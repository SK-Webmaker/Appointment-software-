import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowUpRight, Check, Copy, Instagram, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { POLICY, QUICK, SERVICE_NAMES, SITE, priceOf } from "@/site.config";
import { useBooking } from "@/context/booking";
import { composeMessage, copyText } from "@/lib/booking";
import { lockScroll } from "@/lib/smooth";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The booking: what you'd like, in studio or mobile, your date or occasion
 * and your name — written into one message for her DMs. In-studio bookings
 * can go straight to her booking page instead, as her bio says.
 */
export function BookingSheet() {
  const { sheetOpen, closeSheet, service, setService, mode, setMode, when, setWhen } = useBooking();
  const reduce = useReducedMotionSafe();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [contact, setContact] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const price = service ? priceOf(service) : undefined;
  const message = useMemo(() => composeMessage({ service, price, mode, when, name, notes, contact }), [service, price, mode, when, name, notes, contact]);
  const chips = showAll || (service && !(QUICK as readonly string[]).includes(service)) ? SERVICE_NAMES : [...QUICK];

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

  const sendInstagram = async () => {
    const ok = await copyText(message);
    setToast(ok ? `Message copied — paste it into the chat with @${SITE.instagramHandle}.` : `Opening Instagram — tell ${SITE.shortName} what you’d like to book.`);
    window.open(SITE.instagramDm, "_blank", "noopener,noreferrer");
  };

  const copyOnly = async () => {
    const ok = await copyText(message);
    setToast(ok ? "Copied to your clipboard." : "Couldn’t copy — select the message and copy it manually.");
  };

  return (
    <AnimatePresence>
      {sheetOpen && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Close the booking"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full cursor-default bg-noir/60 backdrop-blur-[3px]"
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
            className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col overflow-hidden rounded-t-[28px] bg-ivory shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[500px] md:rounded-none md:rounded-l-[28px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink/20 md:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-4 md:px-8 md:pt-8">
              <div>
                <p className="eyebrow">{SITE.name} · Book now</p>
                <h2 id="sheet-title" className="mt-2 font-display text-[30px] leading-[1.08] text-ink">
                  Your <em className="text-rose">booking</em>
                </h2>
              </div>
              <button onClick={closeSheet} data-autofocus className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 text-ink hover:bg-onyx hover:text-ivory" aria-label="Close">
                <X size={20} strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-6 md:px-8" data-lenis-prevent>
              <Group label="What would you like?" hint="choose one">
                {chips.map((p) => (
                  <Chip key={p} on={service === p} onClick={() => setService(service === p ? "" : p)}>
                    {p} <span className={service === p ? "text-pearl" : "text-rose"}>${priceOf(p)}</span>
                  </Chip>
                ))}
                {chips.length < SERVICE_NAMES.length && (
                  <button type="button" onClick={() => setShowAll(true)} className="inline-flex min-h-[44px] items-center px-2 text-[13px] font-semibold text-rose underline underline-offset-4">
                    Show all services
                  </button>
                )}
              </Group>

              <Group label="Where?">
                <Chip on={mode === "studio"} onClick={() => setMode(mode === "studio" ? "" : "studio")}>
                  In studio · {SITE.area}
                </Chip>
                <Chip on={mode === "mobile"} onClick={() => setMode(mode === "mobile" ? "" : "mobile")}>
                  Mobile · I come to you
                </Chip>
              </Group>

              <div className="mt-6 space-y-4">
                <Field label="Date or occasion">
                  <input value={when} onChange={(e) => setWhen(e.target.value.slice(0, 80))} className={inputCls} placeholder="e.g. Sat 6 Dec, formal at 5pm" />
                </Field>
                <Field label="Your name" optional>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputCls} />
                </Field>
                <Field label="Anything else" optional>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none py-3`} placeholder="Inspiration, skin or lash notes, how many in your party…" />
                </Field>
                <Field label="Your phone or email" optional>
                  <input value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" className={inputCls} placeholder="So I can confirm your spot" />
                </Field>
              </div>

              <p className="mt-5 rounded-2xl bg-mint px-4 py-3.5 text-[14px] leading-relaxed text-ink">{POLICY}</p>

              <details className="group mt-5 rounded-2xl border border-ink/10 bg-card px-5 py-4">
                <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between text-[12px] font-medium uppercase tracking-[0.2em] text-ink">
                  Preview your message
                  <span className="text-[18px] text-onyx transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-[14px] leading-relaxed text-ash">{message}</pre>
                <button onClick={copyOnly} className="mt-3 inline-flex min-h-[40px] items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-onyx hover:text-ink">
                  <Copy size={14} strokeWidth={1.8} /> Copy message
                </button>
              </details>
            </div>

            {/* Action */}
            <div className="border-t border-ink/10 bg-ivory px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8">
              {mode === "studio" ? (
                <>
                  <a href={SITE.bookingUrl} target="_blank" rel="noreferrer" className="btn-primary sheen w-full">
                    <ArrowUpRight size={17} strokeWidth={1.7} /> Pick a time online
                  </a>
                  <button onClick={sendInstagram} className="btn-ghost mt-2 w-full">
                    <Instagram size={16} strokeWidth={1.7} /> Or send on Instagram
                  </button>
                </>
              ) : (
                <>
                  <button onClick={sendInstagram} className="btn-primary sheen w-full">
                    <Instagram size={17} strokeWidth={1.7} /> Send on Instagram
                  </button>
                  <a href={SITE.bookingUrl} target="_blank" rel="noreferrer" className="btn-ghost mt-2 w-full">
                    <ArrowUpRight size={16} strokeWidth={1.7} /> Book in studio online
                  </a>
                </>
              )}
              <p className="mt-3 text-center text-[12.5px] leading-snug text-ash">
                Instagram: your message is copied first — paste it into the chat with @{SITE.instagramHandle}.
              </p>
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div
                  role="status"
                  className="pointer-events-none absolute inset-x-6 bottom-32 flex items-center gap-3 rounded-2xl bg-noir px-5 py-4 text-[14px] text-ivory shadow-xl md:bottom-36"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <Check size={18} className="shrink-0 text-silk" /> {toast}
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
  "w-full min-h-[48px] rounded-xl border border-ink/15 bg-card px-4 text-[16px] text-ink placeholder:text-ash/70 focus:border-onyx focus:outline-none focus:ring-2 focus:ring-onyx/20";

function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 first:mt-1">
      <legend className="flex w-full items-baseline justify-between gap-3 text-[12px] font-medium uppercase tracking-[0.18em] text-ink">
        {label}
        {hint && <span className="text-right text-[11.5px] font-normal normal-case tracking-normal text-ash">{hint}</span>}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[14px] transition-colors duration-300 ${
        on ? "border-onyx bg-onyx text-ivory" : "border-ink/20 bg-card text-ink hover:border-onyx"
      }`}
    >
      {on && <Check size={14} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[12px] font-medium uppercase tracking-[0.18em] text-ink">
        {label}
        {optional && <span className="text-[11.5px] font-normal normal-case tracking-normal text-ash">optional</span>}
      </span>
      {children}
    </label>
  );
}
