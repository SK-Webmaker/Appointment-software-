import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowLeft, ArrowRight, CalendarPlus, Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BARBERS, MENU, POLICY, SITE, barberName, serviceOf } from "@/site.config";
import { useBooking } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";
import {
  dayLabel,
  downloadFile,
  freeTimes,
  icsFor,
  isoDay,
  makeRef,
  openDays,
  pretty,
  toMins,
  validPhone,
  whoIsFree,
} from "@/lib/slots";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS = ["Service", "Barber", "Time", "Details"] as const;

type Done = {
  ref: string;
  service: string;
  barber: string;
  day: string;
  time: string;
  mins: number;
  price: number;
  name: string;
};

/**
 * The booking: service → barber → day and time → your details → booked.
 * The times come from the (simulated) appointment book in lib/slots.ts, so
 * the flow behaves exactly like the real thing; the last screen gives a
 * reference and a calendar file. Everything you pick is kept if you close it.
 */
export function BookingSheet() {
  const b = useBooking();
  const {
    sheetOpen,
    closeSheet,
    service,
    setService,
    barber,
    setBarber,
    day,
    setDay,
    time,
    setTime,
  } = b;
  const reduce = useReducedMotionSafe();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const svc = serviceOf(service);
  // The chosen time must still be free for the chosen service and barber.
  const timeOk = useMemo(
    () => !!day && !!time && freeTimes(day, barber || "any", svc?.mins ?? 45).includes(time),
    [day, time, barber, svc],
  );
  useEffect(() => {
    if (time && day && !timeOk) setTime("");
  }, [time, day, timeOk, setTime]);
  const ready = [!!svc, !!barber, timeOk, name.trim().length > 1 && validPhone(phone)];

  // Open on the first step that still needs an answer.
  useEffect(() => {
    if (!sheetOpen) return;
    setDone(null);
    setTried(false);
    const first = [!!serviceOf(service), !!barber, !!day && !!time].findIndex((ok) => !ok);
    setStep(first === -1 ? 3 : first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  // Focus handling, Escape to close, background scroll lock, and a simple focus trap.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    opener.current = document.activeElement as HTMLElement;
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
      opener.current?.focus?.();
    };
  }, [sheetOpen, closeSheet]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    body.current?.scrollTo({ top: 0 });
  };
  const next = () => {
    if (step === 3) return confirm();
    if (ready[step]) go(step + 1);
  };

  const confirm = () => {
    setTried(true);
    if (!ready.every(Boolean) || !svc) return;
    const who = barber === "any" ? whoIsFree(day, time, svc.mins) : barber;
    setDone({
      ref: makeRef("HG", `${day}${time}${who}${name}`),
      service,
      barber: who,
      day,
      time,
      mins: svc.mins,
      price: svc.price,
      name: name.trim(),
    });
    setDir(1);
    setStep(4);
  };

  const finish = () => {
    b.reset();
    setName("");
    setPhone("");
    setNotes("");
    closeSheet();
  };

  const summary = [
    service,
    barber && barberName(barber),
    day && time && `${dayLabel(day)} · ${pretty(time)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AnimatePresence>
      {sheetOpen && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Close the booking"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full cursor-default bg-noir/65 backdrop-blur-[3px]"
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
            className="absolute inset-x-0 bottom-0 flex h-[92svh] flex-col overflow-hidden rounded-t-[22px] bg-ivory shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[540px] md:rounded-none md:rounded-l-[22px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div
              className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink/20 md:hidden"
              aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-4 md:px-8 md:pt-8">
              <div>
                <p className="eyebrow">{SITE.name} · Book a chair</p>
                <h2 id="sheet-title" className="mt-2 text-[40px] leading-[0.9] text-ink">
                  {step === 4 ? (
                    <>
                      You're <em className="text-rose">booked in.</em>
                    </>
                  ) : (
                    <>
                      Your <em className="text-rose">booking</em>
                    </>
                  )}
                </h2>
              </div>
              <button
                onClick={closeSheet}
                data-autofocus
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 text-ink hover:bg-onyx hover:text-ivory"
                aria-label="Close"
              >
                <X size={20} strokeWidth={1.6} />
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
                        className="group flex min-h-[44px] w-full flex-col justify-end gap-1.5 text-left disabled:cursor-default"
                      >
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${i === step ? "text-ink" : "text-ash"}`}
                        >
                          {ready[i] && i !== step ? (
                            <Check
                              size={11}
                              strokeWidth={3}
                              className="mr-1 inline -translate-y-px"
                            />
                          ) : null}
                          {label}
                        </span>
                        <span
                          className={`h-[3px] rounded-full transition-colors duration-500 ${i === step ? "bg-rose" : ready[i] ? "bg-onyx" : "bg-ink/15"}`}
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
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <motion.div
                  key={step}
                  custom={dir}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -40 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  {step === 0 && (
                    <Group label="What are we doing?" hint="choose one">
                      <div className="space-y-6">
                        {MENU.map((g) => (
                          <div key={g.group}>
                            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ash">
                              {g.group}
                            </p>
                            <div className="grid gap-2">
                              {g.items.map((it) => (
                                <Option
                                  key={it.name}
                                  on={service === it.name}
                                  onClick={() => setService(service === it.name ? "" : it.name)}
                                >
                                  <span className="flex w-full items-baseline justify-between gap-3">
                                    <span className="font-display text-[22px] font-bold uppercase leading-tight">
                                      {it.name}
                                    </span>
                                    <span className="font-display text-[22px] font-bold">
                                      ${it.price}
                                    </span>
                                  </span>
                                  <span className="block text-[13px] opacity-80">
                                    {it.mins} min · {it.note}
                                  </span>
                                </Option>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Group>
                  )}

                  {step === 1 && (
                    <Group label="Who's cutting?">
                      <div className="grid gap-2">
                        <Option on={barber === "any"} onClick={() => setBarber("any")}>
                          <span className="font-display text-[22px] font-bold uppercase leading-tight">
                            First available
                          </span>
                          <span className="block text-[13px] opacity-80">
                            Whoever's free at the time you pick — the most times to choose from.
                          </span>
                        </Option>
                        {BARBERS.map((x) => (
                          <Option key={x.id} on={barber === x.id} onClick={() => setBarber(x.id)}>
                            <span className="flex w-full items-baseline justify-between gap-3">
                              <span className="font-display text-[22px] font-bold uppercase leading-tight">
                                {x.name}
                              </span>
                              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] opacity-80">
                                {x.title}
                              </span>
                            </span>
                            <span className="block text-[13px] opacity-80">{x.known}</span>
                          </Option>
                        ))}
                      </div>
                    </Group>
                  )}

                  {step === 2 && (
                    <TimeStep
                      day={day}
                      setDay={setDay}
                      time={time}
                      setTime={setTime}
                      barber={barber || "any"}
                      mins={svc?.mins ?? 45}
                    />
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <Field
                        label="Your name"
                        error={tried && name.trim().length < 2 ? "Tell us who to expect." : ""}
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
                          placeholder="For your reminder text"
                        />
                      </Field>
                      <Field label="Anything we should know" optional>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className={`${inputCls} resize-none py-3`}
                          placeholder="How you wear it, a reference photo you'll bring, first time here…"
                        />
                      </Field>
                      <p className="rounded-xl bg-mint px-4 py-3.5 text-[14px] leading-relaxed text-ink">
                        {POLICY}
                      </p>
                    </div>
                  )}

                  {step === 4 && done && <Confirmed done={done} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Action */}
            <div className="border-t border-ink/10 bg-ivory px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8">
              {step < 4 ? (
                <>
                  <p className="mb-3 flex min-h-[22px] items-baseline justify-between gap-3 text-[13.5px] text-ash">
                    <span className="truncate">{summary || "Nothing picked yet"}</span>
                    {svc && <span className="shrink-0 font-semibold text-ink">${svc.price}</span>}
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
                      disabled={step < 3 && !ready[step]}
                      className="btn-primary sheen flex-1 disabled:cursor-not-allowed disabled:bg-ink/25 disabled:shadow-none"
                    >
                      {step === 3
                        ? "Confirm booking"
                        : step === 2 && !time
                          ? "Pick a time"
                          : "Continue"}{" "}
                      {step < 3 && <ArrowRight size={16} strokeWidth={1.8} />}
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" onClick={finish} className="btn-primary w-full">
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

/** The day strip and that day's free times, morning / afternoon / evening. */
function TimeStep({
  day,
  setDay,
  time,
  setTime,
  barber,
  mins,
}: {
  day: string;
  setDay: (d: string) => void;
  time: string;
  setTime: (t: string) => void;
  barber: string;
  mins: number;
}) {
  const days = useMemo(() => openDays(12), []);
  const active = day || days.find((d) => !d.closed)?.iso || "";
  useEffect(() => {
    if (!day && active) setDay(active);
  }, [day, active, setDay]);
  const times = useMemo(
    () => (active ? freeTimes(active, barber, mins) : []),
    [active, barber, mins],
  );
  const parts = [
    { label: "Morning", list: times.filter((t) => toMins(t) < 720) },
    { label: "Afternoon", list: times.filter((t) => toMins(t) >= 720 && toMins(t) < 1020) },
    { label: "Evening", list: times.filter((t) => toMins(t) >= 1020) },
  ].filter((p) => p.list.length);

  return (
    <>
      <Group label="Which day?">
        <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:-mx-8 md:px-8">
          {days.map((d) => {
            const on = d.iso === active;
            const today = d.iso === isoDay(new Date());
            return (
              <button
                key={d.iso}
                type="button"
                disabled={d.closed}
                aria-pressed={on}
                onClick={() => setDay(d.iso)}
                className={`flex min-h-[72px] w-[62px] shrink-0 flex-col items-center justify-center rounded-xl border text-center transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                  on
                    ? "border-onyx bg-onyx text-ivory"
                    : "border-ink/15 bg-card text-ink hover:border-onyx"
                }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                  {today ? "Today" : dayLabel(d.iso, { weekday: "short" })}
                </span>
                <span className="font-display text-[26px] font-bold leading-none">
                  {dayLabel(d.iso, { day: "numeric" })}
                </span>
                <span className="text-[10.5px] uppercase tracking-[0.1em] opacity-75">
                  {d.closed ? "Closed" : dayLabel(d.iso, { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </Group>
      <div className="mt-6" aria-live="polite">
        {parts.length === 0 ? (
          <p className="rounded-xl bg-mint px-4 py-4 text-[14.5px] text-ink">
            Fully booked on {active ? dayLabel(active, { weekday: "long" }) : "this day"} — try the
            next day, or choose “First available”.
          </p>
        ) : (
          parts.map((p) => (
            <fieldset key={p.label} className="mt-5 min-w-0 first:mt-0">
              <legend className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ash">
                {p.label}
              </legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {p.list.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={time === t}
                    onClick={() => setTime(time === t ? "" : t)}
                    className={`min-h-[46px] rounded-lg border text-[14.5px] font-semibold transition-colors duration-300 ${time === t ? "border-rose bg-rose text-ivory" : "border-ink/15 bg-card text-ink hover:border-onyx"}`}
                  >
                    {pretty(t)}
                  </button>
                ))}
              </div>
            </fieldset>
          ))
        )}
      </div>
    </>
  );
}

/** The last screen: the reference, the details, and a calendar file. */
function Confirmed({ done }: { done: Done }) {
  const add = () =>
    downloadFile(
      `hollis-and-grain-${done.day}.ics`,
      icsFor({
        ref: done.ref,
        title: `${done.service} with ${barberName(done.barber)} — ${SITE.name}`,
        day: done.day,
        time: done.time,
        mins: done.mins,
        location: `${SITE.name}, ${SITE.area}, ${SITE.city}`,
      }),
    );
  return (
    <div>
      <motion.div
        className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-rose text-ivory"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
      >
        <Check size={38} strokeWidth={2.4} />
      </motion.div>
      <p className="mt-5 text-center text-[15.5px] text-ash">
        See you then, {done.name.split(" ")[0]}. Your reference is{" "}
        <span className="font-semibold text-ink">{done.ref}</span>.
      </p>
      <dl className="mt-6 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-card px-5">
        {[
          ["Service", `${done.service} · ${done.mins} min`],
          ["Barber", barberName(done.barber)],
          [
            "When",
            `${dayLabel(done.day, { weekday: "long", day: "numeric", month: "long" })} at ${pretty(done.time)}`,
          ],
          ["Where", `${SITE.name}, ${SITE.area}`],
          ["Price", `$${done.price} · pay in the shop`],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-3.5">
            <dt className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ash">{k}</dt>
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

const inputCls =
  "w-full min-h-[50px] rounded-xl border border-ink/15 bg-card px-4 text-[16px] text-ink placeholder:text-ash/70 focus:border-onyx focus:outline-none focus:ring-2 focus:ring-onyx/20";

function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 flex w-full items-baseline justify-between gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink">
        {label}
        {hint && (
          <span className="text-right text-[11.5px] font-normal normal-case tracking-normal text-ash">
            {hint}
          </span>
        )}
      </legend>
      {children}
    </fieldset>
  );
}

function Option({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex min-h-[56px] w-full flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors duration-300 ${
        on ? "border-onyx bg-onyx text-ivory" : "border-ink/15 bg-card text-ink hover:border-onyx"
      }`}
    >
      {children}
    </button>
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
      <span className="mb-1.5 flex items-baseline justify-between text-[12px] font-semibold uppercase tracking-[0.18em] text-ink">
        {label}
        {optional && (
          <span className="text-[11.5px] font-normal normal-case tracking-normal text-ash">
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
