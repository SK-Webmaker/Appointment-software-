import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowLeft, ArrowRight, CalendarPlus, Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ADDONS,
  PACKAGES,
  POLICY,
  SITE,
  VEHICLES,
  packageOf,
  quote,
  vehicleOf,
} from "@/site.config";
import { useBooking, type Mode } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";
import {
  dayLabel,
  downloadFile,
  icsFor,
  isoDay,
  jobTimes,
  makeRef,
  openDays,
  pretty,
  readyBy,
  validPhone,
} from "@/lib/slots";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS = ["Build", "Where", "When", "Details"] as const;
const MOBILE_OK = ["express", "interior"];

type Done = {
  ref: string;
  pkg: string;
  vehicle: string;
  addons: string[];
  mode: Mode;
  day: string;
  time: string;
  price: number;
  hours: number;
  ready: { day: string; time: string };
  name: string;
  car: string;
};

/**
 * The booking: the build (car, package, extras) → studio or mobile → day and
 * time → your details → booked, with the price, when the car will be ready,
 * a reference and a calendar file. Everything is kept if you close it.
 */
export function BookingSheet() {
  const b = useBooking();
  const {
    sheetOpen,
    closeSheet,
    vehicle,
    setVehicle,
    pkg,
    setPkg,
    addons,
    toggleAddon,
    mode,
    setMode,
    day,
    setDay,
    time,
    setTime,
  } = b;
  const reduce = useReducedMotionSafe();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [car, setCar] = useState("");
  const [address, setAddress] = useState("");
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const p = packageOf(pkg);
  const q = quote(vehicle, pkg || "express", addons);
  const mobileOk = !pkg || MOBILE_OK.includes(pkg);
  const timeOk = useMemo(
    () => !!mode && !!day && !!time && jobTimes(day, mode as "studio" | "mobile").includes(time),
    [mode, day, time],
  );
  useEffect(() => {
    if (time && day && mode && !timeOk) setTime("");
  }, [time, day, mode, timeOk, setTime]);
  const whereOk = mode === "studio" || (mode === "mobile" && mobileOk && address.trim().length > 4);
  const ready = [!!p, whereOk, timeOk, name.trim().length > 1 && validPhone(phone)];

  useEffect(() => {
    if (!sheetOpen) return;
    setDone(null);
    setTried(false);
    const first = [
      !!packageOf(pkg),
      mode === "studio" || (mode === "mobile" && address.trim().length > 4),
      !!day && !!time,
    ].findIndex((ok) => !ok);
    setStep(first === -1 ? 3 : first);
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
    if (!ready.every(Boolean) || !p) return;
    setDone({
      ref: makeRef(SITE.refPrefix, `${pkg}${day}${time}${name}`),
      pkg,
      vehicle,
      addons,
      mode,
      day,
      time,
      price: q.price,
      hours: q.hours,
      ready: readyBy(day, time, q.hours),
      name: name.trim(),
      car: car.trim(),
    });
    setDir(1);
    setStep(4);
  };
  const finish = () => {
    b.reset();
    setName("");
    setPhone("");
    setCar("");
    setAddress("");
    closeSheet();
  };

  const summary = [
    p?.name,
    vehicleOf(vehicle)?.name,
    mode && (mode === "studio" ? "studio" : "mobile"),
    day && time && `${dayLabel(day)} ${pretty(time)}`,
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
            className="absolute inset-0 h-full w-full cursor-default bg-noir/75 backdrop-blur-[3px]"
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
            className="absolute inset-x-0 bottom-0 flex h-[92svh] flex-col overflow-hidden rounded-t-[22px] bg-ivory text-ink shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[560px] md:rounded-none md:rounded-l-[22px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="iri-bg h-1 w-full" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5 md:px-8 md:pt-7">
              <div>
                <p className="text-[11.5px] font-medium uppercase tracking-[0.22em] text-rose">
                  {SITE.name} · Book a bay
                </p>
                <h2
                  id="sheet-title"
                  className="mt-2 text-[24px] leading-[1.15] text-ink [&_em]:bg-none [&_em]:text-rose"
                >
                  {step === 4 ? (
                    <>
                      You're <em>booked in.</em>
                    </>
                  ) : (
                    <>
                      Your <em>booking</em>
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
                          className={`h-[3px] rounded-full transition-colors duration-500 ${i === step ? "bg-rose" : ready[i] ? "bg-ink" : "bg-ink/15"}`}
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
                      <Group label="Your car">
                        <div className="grid grid-cols-2 gap-2">
                          {VEHICLES.map((v) => (
                            <Option
                              key={v.id}
                              on={vehicle === v.id}
                              onClick={() => setVehicle(v.id)}
                            >
                              <span className="text-[15px] font-semibold">{v.name}</span>
                              <span className="block text-[12.5px] opacity-75">{v.example}</span>
                            </Option>
                          ))}
                        </div>
                      </Group>
                      <Group label="The package">
                        <div className="grid gap-2">
                          {PACKAGES.map((x) => (
                            <Option key={x.id} on={pkg === x.id} onClick={() => setPkg(x.id)}>
                              <span className="flex w-full items-baseline justify-between gap-3">
                                <span className="text-[16px] font-semibold">{x.name}</span>
                                <span className="text-[14px]">
                                  ${quote(vehicle, x.id, []).price}
                                </span>
                              </span>
                              <span className="block text-[13px] opacity-75">{x.blurb}</span>
                            </Option>
                          ))}
                        </div>
                      </Group>
                      <Group label="Extras">
                        <div className="flex flex-wrap gap-2">
                          {ADDONS.map((a) => (
                            <Chip
                              key={a.id}
                              on={addons.includes(a.id)}
                              onClick={() => toggleAddon(a.id)}
                            >
                              {a.name} +${a.price}
                            </Chip>
                          ))}
                        </div>
                      </Group>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-5">
                      <Group label="Where?">
                        <div className="grid gap-2">
                          <Option on={mode === "studio"} onClick={() => setMode("studio")}>
                            <span className="text-[16px] font-semibold">
                              The studio · {SITE.area}
                            </span>
                            <span className="block text-[13px] opacity-75">
                              Drop off in the morning; we text when it's ready.
                            </span>
                          </Option>
                          <Option
                            on={mode === "mobile"}
                            onClick={() => mobileOk && setMode("mobile")}
                            disabled={!mobileOk}
                          >
                            <span className="text-[16px] font-semibold">
                              Mobile · we come to you
                            </span>
                            <span className="block text-[13px] opacity-75">
                              {mobileOk
                                ? "Within 15 km. Our own water and power."
                                : `${p?.name} needs the studio's lights and a dust-free bay.`}
                            </span>
                          </Option>
                        </div>
                      </Group>
                      {mode === "mobile" && (
                        <Field
                          label="Address"
                          error={
                            tried && address.trim().length < 5 ? "Where should the van park?" : ""
                          }
                        >
                          <input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            autoComplete="street-address"
                            className={inputCls}
                            placeholder="Street and suburb"
                          />
                        </Field>
                      )}
                      {tried && !mode && <Err>Choose the studio or mobile.</Err>}
                    </div>
                  )}

                  {step === 2 && (
                    <When
                      mode={(mode || "studio") as "studio" | "mobile"}
                      day={day}
                      setDay={setDay}
                      time={time}
                      setTime={setTime}
                      hours={q.hours}
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
                          placeholder="For progress photos and pickup"
                        />
                      </Field>
                      <Field label="Make, model, colour" optional>
                        <input
                          value={car}
                          onChange={(e) => setCar(e.target.value)}
                          className={inputCls}
                          placeholder="e.g. Mazda 3, Soul Red"
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

            <div className="border-t border-ink/10 bg-ivory px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8">
              {step < 4 ? (
                <>
                  <p className="mb-3 flex min-h-[22px] items-baseline justify-between gap-3 text-[13.5px] text-ash">
                    <span className="truncate">{summary || "Nothing picked yet"}</span>
                    {p && <span className="shrink-0 font-semibold text-ink">${q.price}</span>}
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
                      disabled={step === 0 && !ready[0]}
                      className="btn-primary sheen flex-1 disabled:cursor-not-allowed disabled:bg-ink/25 disabled:shadow-none"
                    >
                      {step === 3
                        ? "Confirm booking"
                        : step === 0 && !p
                          ? "Pick a package"
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

function When({
  mode,
  day,
  setDay,
  time,
  setTime,
  hours,
}: {
  mode: "studio" | "mobile";
  day: string;
  setDay: (d: string) => void;
  time: string;
  setTime: (t: string) => void;
  hours: number;
}) {
  const days = useMemo(() => openDays(10), []);
  const active = day || days.find((d) => !d.closed && jobTimes(d.iso, mode).length)?.iso || "";
  useEffect(() => {
    if (!day && active) setDay(active);
  }, [day, active, setDay]);
  const times = active ? jobTimes(active, mode) : [];
  const r = active && time ? readyBy(active, time, hours) : null;
  return (
    <>
      <Group label={mode === "studio" ? "Drop-off day" : "Which day?"}>
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
                className={`flex min-h-[72px] w-[62px] shrink-0 flex-col items-center justify-center rounded-xl border text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-ink bg-ink text-ivory" : "border-ink/15 bg-card text-ink hover:border-ink"}`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                  {d.iso === isoDay(new Date()) ? "Today" : dayLabel(d.iso, { weekday: "short" })}
                </span>
                <span className="text-[24px] font-bold leading-none">
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
      <fieldset className="mt-6 min-w-0" aria-live="polite">
        <legend className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ash">
          {mode === "studio" ? "Drop-off time" : "Start time"}
        </legend>
        {times.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {times.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={time === t}
                onClick={() => setTime(time === t ? "" : t)}
                className={`min-h-[46px] rounded-lg border text-[14.5px] font-semibold transition-colors ${time === t ? "border-rose bg-rose text-white" : "border-ink/15 bg-card text-ink hover:border-ink"}`}
              >
                {pretty(t)}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-mint px-4 py-3 text-[14.5px]">
            Fully booked that day — try the next.
          </p>
        )}
        {r && (
          <p className="mt-4 rounded-xl bg-noir px-4 py-3 text-[14.5px] text-ivory">
            Ready{" "}
            <span className="font-semibold text-pearl">
              {r.day === active ? "the same day" : dayLabel(r.day, { weekday: "long" })} at{" "}
              {pretty(r.time)}
            </span>
          </p>
        )}
      </fieldset>
    </>
  );
}

function Confirmed({ done }: { done: Done }) {
  const p = packageOf(done.pkg);
  const add = () =>
    downloadFile(
      `lowlight-${done.day}.ics`,
      icsFor({
        ref: done.ref,
        title: `${p?.name} — ${SITE.name}`,
        day: done.day,
        time: done.time,
        mins: Math.round(done.hours * 60),
        location:
          done.mode === "studio"
            ? `${SITE.name}, ${SITE.area}, ${SITE.city}`
            : "Mobile service — your address",
      }),
    );
  return (
    <div>
      <motion.div
        className="iri-bg mx-auto grid h-20 w-20 place-items-center rounded-full text-noir"
        initial={{ scale: 0.6, opacity: 0, rotate: -40 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.1 }}
      >
        <Check size={38} strokeWidth={2.4} />
      </motion.div>
      <p className="mt-5 text-center text-[15.5px] text-ash">
        Thanks, {done.name.split(" ")[0]}. Your reference is{" "}
        <span className="font-semibold text-ink">{done.ref}</span>.
      </p>
      <dl className="mt-6 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-card px-5">
        {[
          [
            "Build",
            `${p?.name} · ${vehicleOf(done.vehicle)?.name}${done.addons.length ? ` + ${done.addons.length} extra${done.addons.length > 1 ? "s" : ""}` : ""}`,
          ],
          [
            done.mode === "studio" ? "Drop off" : "Van arrives",
            `${dayLabel(done.day, { weekday: "long", day: "numeric", month: "long" })}, ${pretty(done.time)}`,
          ],
          [
            "Ready",
            `${done.ready.day === done.day ? "Same day" : dayLabel(done.ready.day, { weekday: "long" })}, ${pretty(done.ready.time)}`,
          ],
          [
            "Where",
            done.mode === "studio" ? `${SITE.name}, ${SITE.area}` : "Mobile — your address",
          ],
          ["Price", `$${done.price} · pay on pickup`],
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
  "w-full min-h-[50px] rounded-xl border border-ink/15 bg-card px-4 text-[16px] text-ink placeholder:text-ash/70 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20";

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink">
        {label}
      </legend>
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
      aria-disabled={disabled || undefined}
      onClick={onClick}
      className={`flex min-h-[56px] w-full flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors duration-300 ${disabled ? "cursor-not-allowed border-ink/10 bg-mint text-ash" : on ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-card text-ink hover:border-ink"}`}
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
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[14px] transition-colors ${on ? "border-ink bg-ink text-ivory" : "border-ink/20 bg-card text-ink hover:border-ink"}`}
    >
      {on && <Check size={14} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

function Err({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13.5px] font-medium text-rose" role="alert">
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
