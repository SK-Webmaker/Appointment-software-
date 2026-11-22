import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowLeft, ArrowRight, CalendarPlus, Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FINISHES,
  LENGTHS,
  MENU,
  POLICY,
  SHADES,
  SHAPES,
  SITE,
  STAFF,
  serviceOf,
  shadeOf,
  staffName,
} from "@/site.config";
import { useBooking, type Look } from "@/context/booking";
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
import { NailHand } from "./NailHand";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS = ["Service", "Look", "Time", "Details"] as const;
/** The look's shade value for "I'll choose in the studio". */
export const IN_STUDIO = "Studio";

type Done = {
  ref: string;
  service: string;
  artist: string;
  day: string;
  time: string;
  mins: number;
  price: number;
  name: string;
  look: Look;
};

export const lookLabel = (l: Look) =>
  l.shade === IN_STUDIO || !l.shade
    ? "Shade chosen in the studio"
    : `${l.shade} · ${l.finish} · ${l.length} ${l.shape.toLowerCase()}`;

/**
 * The booking: service → look (shade, finish, shape, length — or decide in
 * the studio) → artist, day and time → your details → booked. Times come
 * from the (simulated) appointment book in lib/slots.ts; the last screen
 * gives a reference and a calendar file. Everything is kept if you close it.
 */
export function BookingSheet() {
  const b = useBooking();
  const {
    sheetOpen,
    closeSheet,
    service,
    setService,
    artist,
    setArtist,
    day,
    setDay,
    time,
    setTime,
    look,
    setLook,
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
  const who = artist || "any";
  const timeOk = useMemo(
    () => !!day && !!time && freeTimes(day, who, svc?.mins ?? 60).includes(time),
    [day, time, who, svc],
  );
  useEffect(() => {
    if (time && day && !timeOk) setTime("");
  }, [time, day, timeOk, setTime]);
  const ready = [!!svc, !!look.shade, timeOk, name.trim().length > 1 && validPhone(phone)];

  // Open on the first step that still needs an answer.
  useEffect(() => {
    if (!sheetOpen) return;
    setDone(null);
    setTried(false);
    const first = [!!serviceOf(service), !!look.shade, !!day && !!time].findIndex((ok) => !ok);
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
    const by = who === "any" ? whoIsFree(day, time, svc.mins) : who;
    setDone({
      ref: makeRef(SITE.refPrefix, `${day}${time}${by}${name}`),
      service,
      artist: by,
      day,
      time,
      mins: svc.mins,
      price: svc.price,
      name: name.trim(),
      look,
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
    look.shade && (look.shade === IN_STUDIO ? "shade in studio" : look.shade),
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
            className="absolute inset-x-0 bottom-0 flex h-[92svh] flex-col overflow-hidden rounded-t-[28px] bg-ivory shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[540px] md:rounded-none md:rounded-l-[28px]"
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
                <p className="eyebrow">{SITE.name} · Book now</p>
                <h2
                  id="sheet-title"
                  className="mt-2 font-display text-[34px] leading-[1.02] text-ink"
                >
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
                        className="flex min-h-[44px] w-full flex-col justify-end gap-1.5 text-left disabled:cursor-default"
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
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -40 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  {step === 0 && (
                    <Group label="What would you like?" hint="choose one">
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
                                    <span className="font-display text-[21px] leading-tight">
                                      {it.name}
                                    </span>
                                    <span className="font-display text-[21px]">${it.price}</span>
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

                  {step === 1 && <LookStep look={look} setLook={setLook} />}

                  {step === 2 && (
                    <>
                      <Group label="With">
                        <div className="flex flex-wrap gap-2">
                          {[{ id: "any", name: "Any artist" }, ...STAFF].map((x) => (
                            <Chip key={x.id} on={who === x.id} onClick={() => setArtist(x.id)}>
                              {x.name}
                            </Chip>
                          ))}
                        </div>
                      </Group>
                      <div className="mt-6">
                        <TimeStep
                          day={day}
                          setDay={setDay}
                          time={time}
                          setTime={setTime}
                          artist={who}
                          mins={svc?.mins ?? 60}
                        />
                      </div>
                    </>
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
                          placeholder="Removing gel from another salon, an inspiration photo, sensitive skin…"
                        />
                      </Field>
                      <p className="rounded-2xl bg-mint px-4 py-3.5 text-[14px] leading-relaxed text-ink">
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
                          : step === 1 && !look.shade
                            ? "Pick a shade"
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

/** The look: a small live hand, then shade (or "in the studio"), finish, shape and length. */
function LookStep({ look, setLook }: { look: Look; setLook: (l: Partial<Look>) => void }) {
  const shade = shadeOf(look.shade);
  return (
    <div>
      <div className="flex items-center gap-4 rounded-2xl bg-stone px-4 py-3">
        <NailHand
          hex={shade?.hex ?? "#e8d4c6"}
          finish={look.finish}
          shape={look.shape}
          length={look.length}
          skin="#d9a98a"
          className="h-24 w-auto shrink-0"
        />
        <p className="text-[14px] leading-snug text-ink" aria-live="polite">
          {look.shade === IN_STUDIO
            ? "We'll choose your shade together in the studio."
            : shade
              ? lookLabel(look)
              : "Pick a shade below — or choose it with us in the studio."}
        </p>
      </div>
      <Group label="Shade">
        <div className="flex flex-wrap gap-1">
          {SHADES.map((s) => (
            <button
              aria-label={s.name}
              key={s.name}
              type="button"
              aria-pressed={look.shade === s.name}
              onClick={() => setLook({ shade: s.name })}
              title={s.name}
              className="grid h-11 w-11 place-items-center rounded-full"
            >
              <span
                className={`block h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-ivory ${look.shade === s.name ? "ring-ink" : "ring-transparent"}`}
                style={{ background: s.hex }}
              />
            </button>
          ))}
        </div>
        <div className="mt-2">
          <Chip on={look.shade === IN_STUDIO} onClick={() => setLook({ shade: IN_STUDIO })}>
            I'll choose in the studio
          </Chip>
        </div>
      </Group>
      {look.shade !== IN_STUDIO && (
        <>
          <Group label="Finish">
            <div className="flex flex-wrap gap-2">
              {FINISHES.map((f) => (
                <Chip key={f} on={look.finish === f} onClick={() => setLook({ finish: f })}>
                  {f}
                </Chip>
              ))}
            </div>
          </Group>
          <Group label="Shape">
            <div className="flex flex-wrap gap-2">
              {SHAPES.map((f) => (
                <Chip key={f} on={look.shape === f} onClick={() => setLook({ shape: f })}>
                  {f}
                </Chip>
              ))}
            </div>
          </Group>
          <Group label="Length">
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((f) => (
                <Chip key={f} on={look.length === f} onClick={() => setLook({ length: f })}>
                  {f}
                </Chip>
              ))}
            </div>
          </Group>
        </>
      )}
    </div>
  );
}

/** The day strip and that day's free times, morning / afternoon / evening. */
function TimeStep({
  day,
  setDay,
  time,
  setTime,
  artist,
  mins,
}: {
  day: string;
  setDay: (d: string) => void;
  time: string;
  setTime: (t: string) => void;
  artist: string;
  mins: number;
}) {
  const days = useMemo(() => openDays(12), []);
  const active = day || days.find((d) => !d.closed)?.iso || "";
  useEffect(() => {
    if (!day && active) setDay(active);
  }, [day, active, setDay]);
  const times = useMemo(
    () => (active ? freeTimes(active, artist, mins) : []),
    [active, artist, mins],
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
                className={`flex min-h-[72px] w-[62px] shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-onyx bg-onyx text-ivory" : "border-ink/15 bg-card text-ink hover:border-onyx"}`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                  {today ? "Today" : dayLabel(d.iso, { weekday: "short" })}
                </span>
                <span className="font-display text-[24px] leading-none">
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
          <p className="rounded-2xl bg-mint px-4 py-4 text-[14.5px] text-ink">
            Fully booked on {active ? dayLabel(active, { weekday: "long" }) : "this day"} — try the
            next day, or “Any artist”.
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
                    className={`min-h-[46px] rounded-full border text-[14.5px] font-semibold transition-colors duration-300 ${time === t ? "border-rose bg-rose text-ivory" : "border-ink/15 bg-card text-ink hover:border-onyx"}`}
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
      `petalcoat-${done.day}.ics`,
      icsFor({
        ref: done.ref,
        title: `${done.service} with ${staffName(done.artist)} — ${SITE.name}`,
        day: done.day,
        time: done.time,
        mins: done.mins,
        location: `${SITE.name}, ${SITE.area}, ${SITE.city}`,
      }),
    );
  const shade = shadeOf(done.look.shade);
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
          ["Look", lookLabel(done.look)],
          ["Artist", staffName(done.artist)],
          [
            "When",
            `${dayLabel(done.day, { weekday: "long", day: "numeric", month: "long" })} at ${pretty(done.time)}`,
          ],
          ["Where", `${SITE.name}, ${SITE.area}`],
          ["Price", `$${done.price} · pay after`],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-3.5">
            <dt className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ash">{k}</dt>
            <dd className="flex items-center justify-end gap-2 text-right text-[15px] text-ink">
              {k === "Look" && shade && (
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: shade.hex }}
                  aria-hidden="true"
                />
              )}
              {v}
            </dd>
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
  "w-full min-h-[50px] rounded-2xl border border-ink/15 bg-card px-4 text-[16px] text-ink placeholder:text-ash/70 focus:border-onyx focus:outline-none focus:ring-2 focus:ring-onyx/20";

function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 min-w-0 first:mt-0">
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
      className={`flex min-h-[56px] w-full flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition-colors duration-300 ${on ? "border-onyx bg-onyx text-ivory" : "border-ink/15 bg-card text-ink hover:border-onyx"}`}
    >
      {children}
    </button>
  );
}

function Chip({
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
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[14px] transition-colors duration-300 ${on ? "border-onyx bg-onyx text-ivory" : "border-ink/20 bg-card text-ink hover:border-onyx"}`}
    >
      {on && <Check size={14} strokeWidth={2.2} />}
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
