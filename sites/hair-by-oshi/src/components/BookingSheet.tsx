import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { Camera, Check, Copy, Instagram, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HAIR_HISTORY, HAIR_LENGTHS, HAIR_TEXTURES, SERVICES, SITE, VIBES } from "@/site.config";
import { useBooking } from "@/context/booking";
import { composeMessage, copyText } from "@/lib/booking";
import { lockScroll } from "@/lib/smooth";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The booking request. Oshi books by Instagram DM only, so this writes the
 * DM for the client — services, hair, history, days, vibe — copies it, and
 * opens her chat.
 */
export function BookingSheet() {
  const { sheetOpen, closeSheet, selected, isSelected, toggle, days, toggleDay, vibe, setVibe } = useBooking();
  const reduce = useReducedMotionSafe();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [name, setName] = useState("");
  const [length, setLength] = useState("");
  const [texture, setTexture] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const message = useMemo(
    () => composeMessage(selected, { name, length, texture, history, vibe, days, note }),
    [selected, name, length, texture, history, vibe, days, note],
  );

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
    setToast(ok ? `Message copied — paste it into the chat with ${SITE.founder}.` : `Opening Instagram — tell ${SITE.founder} what you’d like to book.`);
    window.open(SITE.instagramDm, "_blank", "noopener,noreferrer");
  };

  const copyOnly = async () => {
    const ok = await copyText(message);
    setToast(ok ? "Copied to your clipboard." : "Couldn’t copy — select the message and copy it manually.");
  };

  const toggleHistory = (h: string) => setHistory((cur) => HAIR_HISTORY.filter((x) => (x === h ? !cur.includes(x) : cur.includes(x))));

  return (
    <AnimatePresence>
      {sheetOpen && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Close booking"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full cursor-default bg-espresso/60 backdrop-blur-[3px]"
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
            className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col overflow-hidden rounded-t-[28px] bg-cream shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[500px] md:rounded-none md:rounded-l-[28px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink/20 md:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-4 md:px-8 md:pt-8">
              <div>
                <p className="eyebrow">{SITE.name} · DM to book</p>
                <h2 id="sheet-title" className="mt-2 font-display text-[32px] font-light leading-[1.05] text-ink">
                  Your booking <em className="text-cocoa">message</em>
                </h2>
              </div>
              <button onClick={closeSheet} data-autofocus className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 text-ink hover:bg-cocoa hover:text-cream" aria-label="Close">
                <X size={20} strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-6 md:px-8" data-lenis-prevent>
              <Group label="I’m interested in">
                {SERVICES.map((s) => (
                  <Chip key={s.id} on={isSelected(s.id)} onClick={() => toggle(s.id)}>
                    {s.short}
                  </Chip>
                ))}
              </Group>

              <Group label="My hair" hint="optional">
                {HAIR_LENGTHS.map((l) => (
                  <Chip key={l} on={length === l} onClick={() => setLength(length === l ? "" : l)}>
                    {l}
                  </Chip>
                ))}
                <span className="basis-full" aria-hidden="true" />
                {HAIR_TEXTURES.map((t) => (
                  <Chip key={t} on={texture === t} onClick={() => setTexture(texture === t ? "" : t)}>
                    {t}
                  </Chip>
                ))}
              </Group>

              <Group label="Hair history" hint="optional — your starting point matters">
                {HAIR_HISTORY.map((h) => (
                  <Chip key={h} on={history.includes(h)} onClick={() => toggleHistory(h)}>
                    {h}
                  </Chip>
                ))}
              </Group>

              <Group label="Days that suit me" hint="optional">
                {SITE.days.map((d) => (
                  <Chip key={d} on={days.includes(d)} onClick={() => toggleDay(d)}>
                    {d}
                  </Chip>
                ))}
              </Group>

              <Group label="Appointment vibe" hint="optional">
                {VIBES.map((v) => (
                  <Chip key={v.id} on={vibe === v.id} onClick={() => setVibe(vibe === v.id ? null : v.id)}>
                    {v.label}
                  </Chip>
                ))}
              </Group>

              <div className="mt-6 space-y-4">
                <Field label="Your name" optional>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className={inputCls} placeholder="e.g. Priya" />
                </Field>
                <Field label="Anything else" optional>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} resize-none py-3`} placeholder="The look you’re dreaming of, an event date…" />
                </Field>
              </div>

              <p className="mt-5 flex gap-3 rounded-2xl bg-latte px-4 py-3.5 text-[14px] leading-relaxed text-ink/85">
                <Camera size={18} strokeWidth={1.6} className="mt-0.5 shrink-0 text-cocoa" />
                In the chat, add a photo of your hair as it is now and your inspo — it helps Oshi plan what’s realistically achievable.
              </p>

              <details className="group mt-5 rounded-2xl border border-ink/10 bg-card px-5 py-4">
                <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between text-[12px] font-medium uppercase tracking-[0.2em] text-ink">
                  Preview your message
                  <span className="text-[18px] text-cocoa transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-[14px] leading-relaxed text-mocha">{message}</pre>
                <button onClick={copyOnly} className="mt-3 inline-flex min-h-[40px] items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-cocoa hover:text-ink">
                  <Copy size={14} strokeWidth={1.8} /> Copy message
                </button>
              </details>
            </div>

            {/* Action */}
            <div className="border-t border-ink/10 bg-cream px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8">
              <button onClick={sendInstagram} className="btn-primary sheen w-full">
                <Instagram size={17} strokeWidth={1.7} /> Send to Oshi on Instagram
              </button>
              <p className="mt-3 text-center text-[12.5px] leading-snug text-mocha">
                Your message is copied first — just paste it into the chat with @{SITE.instagramHandle}.
              </p>
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div
                  role="status"
                  className="pointer-events-none absolute inset-x-6 bottom-32 flex items-center gap-3 rounded-2xl bg-espresso px-5 py-4 text-[14px] text-cream shadow-xl md:bottom-36"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <Check size={18} className="shrink-0 text-honey" /> {toast}
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
  "w-full min-h-[48px] rounded-xl border border-ink/15 bg-card px-4 text-[16px] text-ink placeholder:text-mocha/70 focus:border-cocoa focus:outline-none focus:ring-2 focus:ring-cocoa/20";

function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 first:mt-1">
      <legend className="flex w-full items-baseline justify-between gap-3 text-[12px] font-medium uppercase tracking-[0.18em] text-ink">
        {label}
        {hint && <span className="text-right text-[11.5px] font-normal normal-case tracking-normal text-mocha">{hint}</span>}
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
        on ? "border-cocoa bg-cocoa text-cream" : "border-ink/20 bg-card text-ink hover:border-cocoa"
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
        {optional && <span className="text-[11.5px] font-normal normal-case tracking-normal text-mocha">optional</span>}
      </span>
      {children}
    </label>
  );
}
