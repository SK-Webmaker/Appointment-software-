import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowLeft, ArrowRight, CalendarPlus, Check, Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ACCESS, CLEANS, EXTRAS, FREQS, SITE, WINDOWS, cleanOf } from "@/site.config";
import { useBooking } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";
import {
  dayLabel,
  downloadFile,
  freeWindows,
  hoursLabel,
  icsFor,
  makeRef,
  openDays,
  quote,
  suburbOf,
  validPhone,
} from "@/lib/slots";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS = ["Clean", "How often", "When", "Details"] as const;

type Done = {
  ref: string;
  what: string;
  freq: string;
  every: string;
  day: string;
  windowId: string;
  hours: number;
  team: number;
  price: number;
  suburb: string;
  postcode: string;
  address: string;
  access: string;
};

/**
 * The booking: the clean (rooms, kind, extras) → how often → a day and an
 * arrival time → where and how we get in, and who you are → booked, with a
 * reference and a calendar file. The price rides along at the bottom the
 * whole way. Everything is kept if you close it.
 */
export function BookingSheet() {
  const b = useBooking();
  const {
    sheetOpen,
    closeSheet,
    openAt,
    day,
    setDay,
    windowId,
    setWindowId,
    postcode,
    setPostcode,
  } = b;
  const reduce = useReducedMotionSafe();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [access, setAccess] = useState("home");
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const q = quote(b);
  const lease = b.clean === "lease";
  const suburb = suburbOf(postcode);
  const windowOk = useMemo(
    () => !!day && !!windowId && freeWindows(day).some((w) => w.id === windowId),
    [day, windowId],
  );
  const detailsOk =
    !!suburb && address.trim().length > 4 && name.trim().length > 1 && validPhone(phone);
  const ready = [!!cleanOf(b.clean), true, windowOk, detailsOk];

  useEffect(() => {
    if (!sheetOpen) return;
    setDone(null);
    setTried(false);
    setStep(openAt ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    const release = lockScroll();
    const t = window.setTimeout(
      () => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(),
      60,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
      if (e.key !== "Tab" || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,textarea,[tabindex]:not([tabindex="-1"])',
      );
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
      opener?.focus?.();
    };
  }, [sheetOpen, closeSheet]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    setTried(false);
    body.current?.scrollTo({ top: 0 });
  };
  const next = () => {
    if (step === 3) return confirm();
    if (ready[step]) go(step + 1);
    else setTried(true);
  };
  const confirm = () => {
    setTried(true);
    if (!ready.every(Boolean)) return;
    const c = cleanOf(b.clean);
    setDone({
      ref: makeRef(SITE.refPrefix, `${b.clean}${postcode}${name}`),
      what: `${c?.name} clean · ${b.bedrooms} bed, ${b.bathrooms} bath`,
      freq: q.freq.name,
      every: q.freq.every ?? "",
      day,
      windowId,
      hours: q.hours,
      team: q.team,
      price: q.price,
      suburb: suburb ?? "",
      postcode,
      address: address.trim(),
      access: ACCESS.find((a) => a.id === access)?.name ?? "",
    });
    setDir(1);
    setStep(4);
  };
  const finish = () => {
    b.reset();
    setName("");
    setPhone("");
    setNotes("");
    setAddress("");
    closeSheet();
  };

  return (
    <AnimatePresence>
      {sheetOpen && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Close the booking"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full cursor-default bg-noir/70 backdrop-blur-[3px]"
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
            className="absolute inset-x-0 bottom-0 flex h-[92svh] flex-col overflow-hidden rounded-t-[26px] bg-ivory shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[560px] md:rounded-none md:rounded-l-[26px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div
              className="h-2 w-full bg-[linear-gradient(90deg,#1f45d6,#9ad7ff,#ffd23f,#ff7eb6)]"
              aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-4 md:px-8 md:pt-7">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-rose">
                  {SITE.name} · Booking
                </p>
                <h2 id="sheet-title" className="mt-2 text-[36px] leading-[0.92] text-ink">
                  {step === 4 ? (
                    <>
                      Clean <em className="text-onyx">booked.</em>
                    </>
                  ) : (
                    <>
                      Your <em className="text-onyx">clean</em>
                    </>
                  )}
                </h2>
              </div>
              <button
                onClick={closeSheet}
                data-autofocus
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 text-ink hover:bg-ink hover:text-ivory"
                aria-label="Close"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>

            {step < 4 && (
              <ol className="grid grid-cols-4 gap-1.5 px-6 md:px-8" aria-label="Booking steps">
                {STEPS.map((label, i) => {
                  const reachable = i <= step || ready.slice(0, i).every(Boolean);
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        disabled={!reachable}
                        onClick={() => go(i)}
                        aria-current={i === step ? "step" : undefined}
                        className="flex min-h-[44px] w-full flex-col justify-end gap-1.5 text-left disabled:cursor-default"
                      >
                        <span
                          className={`text-[11px] font-bold uppercase tracking-[0.08em] ${i === step ? "text-ink" : "text-ash"}`}
                        >
                          {ready[i] && i < step ? (
                            <Check
                              size={11}
                              strokeWidth={3}
                              className="mr-1 inline -translate-y-px"
                            />
                          ) : null}
                          {label}
                        </span>
                        <span
                          className={`h-[4px] rounded-full transition-colors duration-500 ${i === step ? "bg-onyx" : i < step ? "bg-ink" : "bg-ink/15"}`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            <div
              ref={body}
              className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-6 pt-5 md:px-8"
              data-lenis-prevent
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -40 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  {step === 0 && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-2">
                        <Count
                          label="Bedrooms"
                          value={b.bedrooms}
                          min={1}
                          max={6}
                          onChange={(n) => b.set({ bedrooms: n })}
                        />
                        <Count
                          label="Bathrooms"
                          value={b.bathrooms}
                          min={1}
                          max={4}
                          onChange={(n) => b.set({ bathrooms: n })}
                        />
                      </div>
                      <Group label="The clean">
                        <div className="grid gap-2">
                          {CLEANS.map((c) => (
                            <Option
                              key={c.id}
                              on={b.clean === c.id}
                              onClick={() => b.set({ clean: c.id })}
                            >
                              <span className="text-[17px] font-bold">{c.name}</span>
                              <span className="block text-[13.5px] opacity-80">{c.note}</span>
                            </Option>
                          ))}
                        </div>
                      </Group>
                      <Group label="Extras">
                        <div className="flex flex-wrap gap-2">
                          {EXTRAS.map((x) => {
                            const on = b.extras.includes(x.id);
                            return (
                              <button
                                key={x.id}
                                type="button"
                                aria-pressed={on}
                                onClick={() => b.toggleExtra(x.id)}
                                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-3.5 text-[14px] font-semibold transition-colors ${on ? "border-onyx bg-mint" : "border-ink/10 bg-card hover:border-ink"}`}
                              >
                                {on ? <Check size={14} strokeWidth={2.8} /> : <Plus size={14} />}{" "}
                                {x.name}
                              </button>
                            );
                          })}
                        </div>
                      </Group>
                    </div>
                  )}

                  {step === 1 && (
                    <Group label="How often?">
                      <div className="grid gap-2">
                        {FREQS.map((f) => (
                          <Option
                            key={f.id}
                            on={(lease ? "once" : b.freq) === f.id}
                            disabled={lease && f.id !== "once"}
                            onClick={() => b.set({ freq: f.id })}
                          >
                            <span className="flex w-full items-baseline justify-between gap-3">
                              <span className="text-[17px] font-bold">{f.name}</span>
                              {f.off > 0 && (
                                <span className="text-[13.5px] font-bold">
                                  {Math.round(f.off * 100)}% off
                                </span>
                              )}
                            </span>
                            <span className="block text-[13.5px] opacity-80">
                              {f.every
                                ? `Same cleaners, same day, ${f.every}.`
                                : "One clean, no strings."}
                            </span>
                          </Option>
                        ))}
                      </div>
                      {lease && (
                        <p className="mt-3 text-[13.5px] text-ash">
                          End-of-lease cleans are one-offs.
                        </p>
                      )}
                    </Group>
                  )}

                  {step === 2 && (
                    <>
                      <p className="text-[14.5px] leading-relaxed text-ash">
                        {q.team === 2 ? "Two of us" : "One of us"}, for about {hoursLabel(q.hours)}.
                        {q.freq.every ? ` Then the same time ${q.freq.every}.` : ""}
                      </p>
                      <WindowPicker
                        day={day}
                        setDay={setDay}
                        windowId={windowId}
                        setWindowId={setWindowId}
                      />
                      {tried && !windowOk && <Err>Pick a day and an arrival time.</Err>}
                    </>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <Field
                        label="Postcode"
                        error={
                          tried && !suburb
                            ? postcode.length === 4
                              ? "That's outside the Eastern Suburbs — call and we'll recommend someone."
                              : "Enter your four-digit postcode."
                            : ""
                        }
                      >
                        <input
                          value={postcode}
                          onChange={(e) =>
                            setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))
                          }
                          inputMode="numeric"
                          autoComplete="postal-code"
                          className={`${inputCls} text-[20px] tracking-[0.1em]`}
                          placeholder="2026"
                        />
                      </Field>
                      {suburb && (
                        <p
                          className="rounded-xl bg-mint px-4 py-3 text-[14.5px] text-ink"
                          aria-live="polite"
                        >
                          ✓ {suburb} — we're there every day.
                        </p>
                      )}
                      <Field
                        label="Street address"
                        error={
                          tried && address.trim().length < 5
                            ? "So we know which door is yours."
                            : ""
                        }
                      >
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          autoComplete="street-address"
                          className={inputCls}
                          placeholder="Unit 4, 12 Example St"
                        />
                      </Field>
                      <Group label="Getting in">
                        <div className="flex flex-wrap gap-2">
                          {ACCESS.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              aria-pressed={access === a.id}
                              onClick={() => setAccess(a.id)}
                              className={`min-h-[44px] rounded-full border-2 px-4 text-[14px] font-semibold transition-colors ${access === a.id ? "border-onyx bg-onyx text-white" : "border-ink/10 bg-card hover:border-ink"}`}
                            >
                              {a.name}
                            </button>
                          ))}
                        </div>
                      </Group>
                      <Field
                        label="Your name"
                        error={tried && name.trim().length < 2 ? "Tell us who to ask for." : ""}
                      >
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          autoComplete="name"
                          className={inputCls}
                        />
                      </Field>
                      <Field
                        label="Mobile"
                        error={
                          tried && !validPhone(phone)
                            ? "Enter an Australian number, like 0412 345 678."
                            : ""
                        }
                      >
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          className={inputCls}
                          placeholder="We text when we arrive"
                        />
                      </Field>
                      <Field label="Anything we should know" optional>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className={`${inputCls} resize-none py-3`}
                          placeholder="The dog's friendly, the cat isn't, the good vacuum is in the hall…"
                        />
                      </Field>
                    </div>
                  )}

                  {step === 4 && done && <Booked done={done} />}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="border-t border-ink/10 bg-ivory px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8">
              {step < 4 ? (
                <>
                  <p className="mb-3 flex min-h-[22px] items-baseline justify-between gap-3 text-[13.5px] text-ash">
                    <span className="truncate">
                      {cleanOf(b.clean)?.name} · {b.bedrooms} bed, {b.bathrooms} bath
                      {q.freq.every ? ` · ${q.freq.name.toLowerCase()}` : ""}
                    </span>
                    <span
                      className="shrink-0 text-[17px] font-extrabold text-ink"
                      aria-live="polite"
                    >
                      ${q.price}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    {step > 0 && (
                      <button
                        type="button"
                        onClick={() => go(step - 1)}
                        className="btn-ghost shrink-0 px-5"
                        aria-label="Back"
                      >
                        <ArrowLeft size={16} strokeWidth={1.8} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={next}
                      className="btn sheen flex-1 bg-onyx text-white hover:bg-ink"
                    >
                      {step === 3 ? "Book the clean" : "Continue"}{" "}
                      {step < 3 && <ArrowRight size={16} strokeWidth={1.8} />}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  className="btn w-full bg-ink text-ivory hover:bg-onyx"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The last screen: the reference, the clean, and when we'll be back. */
function Booked({ done }: { done: Done }) {
  const win = WINDOWS.find((w) => w.id === done.windowId);
  const add = () =>
    downloadFile(
      `squeegee-${done.day}.ics`,
      icsFor({
        ref: done.ref,
        title: `${SITE.name} — ${done.what}`,
        day: done.day,
        from: win?.from ?? 8,
        hours: done.hours,
        location: `${done.address}, ${done.suburb} NSW ${done.postcode}`,
      }),
    );
  return (
    <div>
      <motion.div
        className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#ffffff,#d9efff_38%,#9ad7ff_70%,#6fb8ff)] text-onyx"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
      >
        <Check size={42} strokeWidth={2.6} />
      </motion.div>
      <p className="mt-5 text-center text-[15.5px] text-ash">
        Reference <span className="font-bold text-ink">{done.ref}</span>
      </p>
      <dl className="mt-5 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-card px-5">
        {[
          ["Clean", done.what],
          [
            "First visit",
            `${dayLabel(done.day, { weekday: "long", day: "numeric", month: "long" })}, ${win?.label}`,
          ],
          ["Then", done.every ? `The same time ${done.every}` : "Just the once"],
          ["Where", `${done.address}, ${done.suburb} ${done.postcode}`],
          ["Getting in", done.access],
          [
            "Price",
            `$${done.price} a clean · ${done.team === 2 ? "two" : "one"} of us, about ${hoursLabel(done.hours)}`,
          ],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-3.5">
            <dt className="shrink-0 text-[11.5px] font-bold uppercase tracking-[0.12em] text-ash">
              {k}
            </dt>
            <dd className="text-right text-[15px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={add} className="btn-ghost mt-4 w-full">
        <CalendarPlus size={17} strokeWidth={1.7} /> Add to calendar
      </button>
      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ash">{SITE.concept}</p>
    </div>
  );
}

function Count({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-2xl bg-mint p-3" role="group" aria-label={label}>
      <p className="text-[11.5px] font-bold uppercase tracking-[0.12em]">{label}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="grid h-11 w-11 place-items-center rounded-full bg-white disabled:opacity-40"
        >
          <Minus size={17} strokeWidth={2.4} />
        </button>
        <output className="text-[24px] font-extrabold tabular-nums">{value}</output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
          className="grid h-11 w-11 place-items-center rounded-full bg-white disabled:opacity-40"
        >
          <Plus size={17} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function WindowPicker({
  day,
  setDay,
  windowId,
  setWindowId,
}: {
  day: string;
  setDay: (d: string) => void;
  windowId: string;
  setWindowId: (w: string) => void;
}) {
  const days = useMemo(() => openDays(10), []);
  const active = day || days.find((d) => !d.closed && freeWindows(d.iso).length)?.iso || "";
  useEffect(() => {
    if (!day && active) setDay(active);
  }, [day, active, setDay]);
  const wins = active ? freeWindows(active) : [];
  return (
    <div className="mt-6">
      <Group label="Which day?">
        <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:-mx-8 md:px-8">
          {days.map((d) => {
            const on = d.iso === active;
            return (
              <button
                key={d.iso}
                type="button"
                disabled={d.closed}
                aria-pressed={on}
                onClick={() => setDay(d.iso)}
                className={`flex min-h-[70px] w-[62px] shrink-0 flex-col items-center justify-center rounded-xl border text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-ink bg-ink text-ivory" : "border-ink/15 bg-card text-ink hover:border-ink"}`}
              >
                <span className="text-[10.5px] uppercase">
                  {dayLabel(d.iso, { weekday: "short" })}
                </span>
                <span className="text-[22px] font-black leading-none">
                  {dayLabel(d.iso, { day: "numeric" })}
                </span>
                <span className="text-[10px] uppercase opacity-75">
                  {d.closed ? "Closed" : dayLabel(d.iso, { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </Group>
      <fieldset className="mt-5 min-w-0" aria-live="polite">
        <legend className="mb-2 text-[11.5px] uppercase tracking-[0.14em] text-ash">
          Arrival time
        </legend>
        {wins.length ? (
          <div className="grid grid-cols-2 gap-2">
            {wins.map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={windowId === w.id}
                onClick={() => setWindowId(w.id)}
                className={`min-h-[48px] rounded-xl border text-[14.5px] font-semibold transition-colors ${windowId === w.id ? "border-onyx bg-onyx text-white" : "border-ink/15 bg-card text-ink hover:border-ink"}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-mint px-4 py-3 text-[14.5px]">
            Fully booked that day — try the next.
          </p>
        )}
      </fieldset>
    </div>
  );
}

const inputCls =
  "w-full min-h-[50px] rounded-xl border border-ink/15 bg-card px-4 text-[16px] text-ink placeholder:text-ash/70 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20";

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-[12px] uppercase tracking-[0.14em] text-ink">{label}</legend>
      {children}
    </fieldset>
  );
}

function Option({
  on,
  onClick,
  disabled,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[60px] w-full flex-col items-start gap-1 rounded-xl border-2 disabled:cursor-not-allowed disabled:opacity-45 px-4 py-3 text-left transition-colors duration-300 ${on ? "border-onyx bg-onyx text-white" : "border-ink/10 bg-card text-ink hover:border-ink"}`}
    >
      {children}
    </button>
  );
}

function Err({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[13.5px] font-medium text-rose" role="alert">
      {children}
    </p>
  );
}

function Field({
  label,
  optional,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[11.5px] uppercase tracking-[0.14em] text-ink">
        {label}
        {optional && (
          <span className="font-sans text-[11.5px] normal-case tracking-normal text-ash">
            optional
          </span>
        )}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 block text-[13px] font-medium text-rose" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
