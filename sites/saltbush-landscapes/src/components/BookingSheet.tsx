import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowLeft, ArrowRight, CalendarPlus, Camera, Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PROJECTS, SITE, SIZES, STYLES, WINDOWS, plantOf, projectOf, styleOf } from "@/site.config";
import { useBooking } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";
import {
  dayLabel,
  downloadFile,
  estimate,
  freeWindows,
  icsFor,
  makeRef,
  openDays,
  suburbOf,
  validPhone,
} from "@/lib/slots";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS = ["Project", "Garden", "Visit", "Details"] as const;

type Done = {
  ref: string;
  project: string;
  size: string;
  style: string;
  day: string;
  windowId: string;
  suburb: string;
  postcode: string;
  address: string;
  name: string;
  plants: string[];
  guide: string;
};

/**
 * The visit request: what kind of job → the garden (size, look, where) → a
 * day and a start time → your details, with an optional photo → booked, with
 * a reference and a calendar file. Plants saved in the finder come too.
 * Everything is kept if you close it.
 */
export function BookingSheet() {
  const b = useBooking();
  const {
    sheetOpen,
    closeSheet,
    project,
    setProject,
    size,
    setSize,
    style,
    setStyle,
    day,
    setDay,
    windowId,
    setWindowId,
    postcode,
    setPostcode,
    shortlist,
    toggleShortlist,
  } = b;
  const reduce = useReducedMotionSafe();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const suburb = suburbOf(postcode);
  const windowOk = useMemo(
    () => !!day && !!windowId && freeWindows(day).some((w) => w.id === windowId),
    [day, windowId],
  );
  const gardenOk = !!size && !!suburb && address.trim().length > 4;
  const ready = [
    !!projectOf(project),
    gardenOk,
    windowOk,
    name.trim().length > 1 && validPhone(phone),
  ];

  useEffect(() => {
    if (!sheetOpen) return;
    setDone(null);
    setTried(false);
    setStep(projectOf(project) ? 1 : 0);
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
    const m2 = SIZES.find((x) => x.id === size)?.m2 ?? 50;
    const est = estimate({ m2, project, style: style || "bush", extras: [] });
    setDone({
      ref: makeRef(SITE.refPrefix, `${project}${postcode}${name}`),
      project,
      size,
      style,
      day,
      windowId,
      suburb: suburb ?? "",
      postcode,
      address: address.trim(),
      name: name.trim(),
      plants: shortlist,
      guide: est
        ? `$${est.from.toLocaleString("en-AU")}–$${est.to.toLocaleString("en-AU")}${est.perVisit ? " a visit" : ""}`
        : "",
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
    setPhoto(null);
    closeSheet();
  };

  const pj = projectOf(project);
  const sz = SIZES.find((x) => x.id === size);
  const win = WINDOWS.find((w) => w.id === windowId);
  const summary = [pj?.name, sz?.name, suburb, day && win ? `${dayLabel(day)} ${win.label}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <AnimatePresence>
      {sheetOpen && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Close the visit request"
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
            className="absolute inset-x-0 bottom-0 flex h-[92svh] flex-col overflow-hidden rounded-t-[22px] bg-ivory shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[560px] md:rounded-none md:rounded-l-[22px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div
              className="h-2 w-full bg-[linear-gradient(90deg,#3d5a3f,#c9d6c3,#e9b45a,#96481a)]"
              aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-4 md:px-8 md:pt-7">
              <div>
                <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-rose">
                  {SITE.shortName} · Free site visit
                </p>
                <h2 id="sheet-title" className="mt-2 text-[34px] leading-[0.92] text-ink">
                  {step === 4 ? (
                    <>
                      Visit <em className="text-rose">booked.</em>
                    </>
                  ) : (
                    <>
                      Your <em className="text-rose">garden</em>
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
              <ol className="grid grid-cols-4 gap-1.5 px-6 md:px-8" aria-label="Request steps">
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
                          className={`text-[11px] font-bold uppercase tracking-[0.1em] ${i === step ? "text-ink" : "text-ash"}`}
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
                    <Group label="What are we doing?">
                      <div className="grid gap-2">
                        {PROJECTS.map((x) => (
                          <Option key={x.id} on={project === x.id} onClick={() => setProject(x.id)}>
                            <span className="text-[17px] font-bold">{x.name}</span>
                            <span className="block text-[13.5px] opacity-80">{x.note}</span>
                          </Option>
                        ))}
                      </div>
                    </Group>
                  )}

                  {step === 1 && (
                    <div className="space-y-6">
                      <Group label="How big is it?">
                        <div className="grid grid-cols-2 gap-2">
                          {SIZES.map((x) => (
                            <Option key={x.id} on={size === x.id} onClick={() => setSize(x.id)}>
                              <span className="text-[16px] font-bold">{x.name}</span>
                              <span className="block text-[13px] opacity-80">{x.note}</span>
                            </Option>
                          ))}
                        </div>
                        {tried && !size && <Err>Roughly is fine — pick a size.</Err>}
                      </Group>
                      <Group label="The look (if you know)">
                        <div className="flex flex-wrap gap-2">
                          {STYLES.map((x) => (
                            <button
                              key={x.id}
                              type="button"
                              aria-pressed={style === x.id}
                              onClick={() => setStyle(style === x.id ? "" : x.id)}
                              className={`min-h-[44px] rounded-full border px-4 text-[14px] font-medium transition-colors ${style === x.id ? "border-onyx bg-onyx text-white" : "border-ink/15 bg-card text-ink hover:border-ink"}`}
                            >
                              {x.name}
                            </button>
                          ))}
                        </div>
                      </Group>
                      <Field
                        label="Postcode"
                        error={
                          tried && !suburb
                            ? postcode.length === 4
                              ? "That's outside the Hills District — call and we'll recommend someone."
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
                          placeholder="2154"
                        />
                      </Field>
                      {suburb && (
                        <p
                          className="rounded-xl bg-mint px-4 py-3 text-[14.5px] text-ink"
                          aria-live="polite"
                        >
                          ✓ {suburb} — we're there most weeks.
                        </p>
                      )}
                      <Field
                        label="Street address"
                        error={
                          tried && address.trim().length < 5 ? "So we know which gate to open." : ""
                        }
                      >
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          autoComplete="street-address"
                          className={inputCls}
                          placeholder="12 Example St"
                        />
                      </Field>
                    </div>
                  )}

                  {step === 2 && (
                    <>
                      <p className="text-[14.5px] leading-relaxed text-ash">
                        About 45 minutes, walking the garden together. We'll text the day before.
                      </p>
                      <WindowPicker
                        day={day}
                        setDay={setDay}
                        windowId={windowId}
                        setWindowId={setWindowId}
                      />
                      {tried && !windowOk && <Err>Pick a day and a start time.</Err>}
                    </>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
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
                          placeholder="For the reminder text"
                        />
                      </Field>
                      {shortlist.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink">
                            Your plant list
                          </p>
                          <ul className="flex flex-wrap gap-1.5">
                            {shortlist.map((id) => (
                              <li key={id}>
                                <button
                                  type="button"
                                  onClick={() => toggleShortlist(id)}
                                  aria-label={`Remove ${plantOf(id)?.name} from my list`}
                                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-mint px-3 text-[13.5px] text-ink hover:bg-stone"
                                >
                                  {plantOf(id)?.name} <X size={13} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Field label="Tell us about it" optional>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className={`${inputCls} resize-none py-3`}
                          placeholder="What you'd love, what has to go, the dog, the slope…"
                        />
                      </Field>
                      <div>
                        <p className="mb-1.5 flex items-baseline justify-between text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink">
                          A photo{" "}
                          <span className="font-sans text-[11.5px] font-normal normal-case tracking-normal text-ash">
                            optional
                          </span>
                        </p>
                        <label className="flex min-h-[64px] cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-ink/20 bg-card px-4 py-3 hover:border-ink">
                          {photo ? (
                            <img
                              src={photo}
                              alt="Your photo of the garden"
                              className="h-14 w-14 rounded-lg object-cover"
                            />
                          ) : (
                            <Camera size={22} strokeWidth={1.7} className="text-ash" />
                          )}
                          <span className="text-[14.5px] text-ink">
                            {photo ? "Photo added — tap to change" : "Add a photo of the garden"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setPhoto(URL.createObjectURL(f));
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {step === 4 && done && <Booked done={done} />}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="border-t border-ink/10 bg-ivory px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8">
              {step < 4 ? (
                <>
                  <p className="mb-3 min-h-[22px] truncate text-[13.5px] text-ash">
                    {summary || "Nothing picked yet"}
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
                      className="btn flex-1 bg-onyx text-white hover:bg-rose disabled:cursor-not-allowed disabled:bg-ink/25"
                    >
                      {step === 3 ? "Book the visit" : "Continue"}{" "}
                      {step < 3 && <ArrowRight size={16} strokeWidth={1.8} />}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  className="btn w-full bg-ink text-ivory hover:bg-rose"
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

/** The last screen: the reference, the visit, and what we'll bring. */
function Booked({ done }: { done: Done }) {
  const pj = projectOf(done.project);
  const sz = SIZES.find((x) => x.id === done.size);
  const st = styleOf(done.style);
  const win = WINDOWS.find((w) => w.id === done.windowId);
  const add = () =>
    downloadFile(
      `saltbush-visit-${done.day}.ics`,
      icsFor({
        ref: done.ref,
        title: `${SITE.shortName} garden visit — ${pj?.name}`,
        day: done.day,
        from: win?.from ?? 9,
        location: `${done.address}, ${done.suburb} NSW ${done.postcode}`,
      }),
    );
  return (
    <div>
      <motion.div
        className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-onyx text-white"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
      >
        <Check size={38} strokeWidth={2.4} />
      </motion.div>
      <p className="mt-5 text-center text-[15.5px] text-ash">
        Reference <span className="font-bold text-ink">{done.ref}</span>
      </p>
      <dl className="mt-5 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-card px-5">
        {[
          ["Job", [pj?.name, st?.name].filter(Boolean).join(" · ")],
          [
            "Visit",
            `${dayLabel(done.day, { weekday: "long", day: "numeric", month: "long" })}, ${win?.label}`,
          ],
          ["Where", `${done.address}, ${done.suburb} ${done.postcode}`],
          ["Garden", sz ? `${sz.name}, ${sz.note}` : ""],
          ["Rough guide", done.guide],
          ...(done.plants.length
            ? [["Bringing", done.plants.map((id) => plantOf(id)?.name).join(", ")]]
            : []),
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-3.5">
            <dt className="shrink-0 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ash">
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
          Start time
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
      className={`flex min-h-[60px] w-full flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors duration-300 ${on ? "border-onyx bg-onyx text-white" : "border-ink/10 bg-card text-ink hover:border-ink"}`}
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
