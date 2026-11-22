import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowLeft, ArrowRight, CalendarPlus, Camera, Check, Siren, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PROBLEMS, SITE, WINDOWS, problemOf } from "@/site.config";
import { useBooking, type Urgency } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";
import {
  dayLabel,
  downloadFile,
  estimate,
  etaNow,
  freeWindows,
  icsFor,
  isAfterHours,
  isoDay,
  makeRef,
  openDays,
  suburbOf,
  validPhone,
} from "@/lib/slots";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS = ["Problem", "When", "Where", "Details"] as const;
const URGENCY: { id: Exclude<Urgency, "">; label: string; note: string }[] = [
  { id: "now", label: "Now — it's an emergency", note: "A van heads your way. 24/7." },
  { id: "booked", label: "Book a time", note: "Pick a day and a two-hour window." },
  { id: "quote", label: "Just a quote", note: "We'll text a fixed price, often from a photo." },
];

type Done = {
  ref: string;
  problem: string;
  urgency: Urgency;
  day: string;
  windowId: string;
  suburb: string;
  postcode: string;
  address: string;
  name: string;
  eta: number;
  price: string;
};

/**
 * The job request: problem → how soon (now / a time / a quote) → where
 * (postcode checked against our area) → your details, with an optional photo
 * → logged, with a job number. Emergencies get a live ETA; booked jobs get a
 * calendar file. Everything is kept if you close it.
 */
export function BookingSheet() {
  const b = useBooking();
  const {
    sheetOpen,
    closeSheet,
    problem,
    setProblem,
    urgency,
    setUrgency,
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
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const suburb = suburbOf(postcode);
  const windowOk = useMemo(
    () => !!day && !!windowId && freeWindows(day).some((w) => w.id === windowId),
    [day, windowId],
  );
  const whenOk = urgency === "now" || urgency === "quote" || (urgency === "booked" && windowOk);
  const whereOk = !!suburb && (urgency === "quote" || address.trim().length > 4);
  const ready = [
    !!problemOf(problem),
    whenOk,
    whereOk,
    name.trim().length > 1 && validPhone(phone),
  ];

  useEffect(() => {
    if (!sheetOpen) return;
    setDone(null);
    setTried(false);
    const first = [
      !!problemOf(problem),
      urgency === "now" || urgency === "quote" || (urgency === "booked" && !!windowId),
    ].findIndex((ok) => !ok);
    setStep(first === -1 ? 2 : first);
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
    const est = estimate(problem, 0, urgency === "now" && isAfterHours());
    setDone({
      ref: makeRef(SITE.refPrefix, `${problem}${postcode}${name}`),
      problem,
      urgency,
      day,
      windowId,
      suburb: suburb ?? "",
      postcode,
      address: address.trim(),
      name: name.trim(),
      eta: etaNow(postcode),
      price: est ? `$${est.from}–$${est.to}` : "",
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

  const p = problemOf(problem);
  const win = WINDOWS.find((w) => w.id === windowId);
  const summary = [
    p?.name,
    urgency === "now"
      ? "now"
      : urgency === "quote"
        ? "quote"
        : day && win
          ? `${dayLabel(day)} ${win.label}`
          : "",
    suburb,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AnimatePresence>
      {sheetOpen && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Close the job request"
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
              className="h-2 w-full bg-[repeating-linear-gradient(-45deg,#0b1624_0_10px,#f2c230_10px_20px)]"
              aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-4 md:px-8 md:pt-7">
              <div>
                <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-rose">
                  {SITE.shortName} · Job request
                </p>
                <h2 id="sheet-title" className="mt-2 text-[34px] leading-[0.92] text-ink">
                  {step === 4 ? (
                    <>
                      Job <em className="text-rose">logged.</em>
                    </>
                  ) : (
                    <>
                      Your <em className="text-rose">job</em>
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
                          className={`font-mono text-[11px] uppercase tracking-[0.1em] ${i === step ? "text-ink" : "text-ash"}`}
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
                    <Group label="What's wrong?">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {PROBLEMS.map((x) => (
                          <Option key={x.id} on={problem === x.id} onClick={() => setProblem(x.id)}>
                            <span className="text-[17px] font-bold">{x.name}</span>
                            <span className="block font-mono text-[12.5px] opacity-80">
                              usually ${x.from}–${x.to}
                            </span>
                          </Option>
                        ))}
                      </div>
                    </Group>
                  )}

                  {step === 1 && (
                    <>
                      <Group label="How soon?">
                        <div className="grid gap-2">
                          {URGENCY.map((u) => (
                            <Option
                              key={u.id}
                              on={urgency === u.id}
                              onClick={() => setUrgency(u.id)}
                              hot={u.id === "now"}
                            >
                              <span className="text-[17px] font-bold">{u.label}</span>
                              <span className="block text-[13.5px] opacity-80">{u.note}</span>
                            </Option>
                          ))}
                        </div>
                      </Group>
                      {urgency === "booked" && (
                        <WindowPicker
                          day={day}
                          setDay={setDay}
                          windowId={windowId}
                          setWindowId={setWindowId}
                        />
                      )}
                      {tried && !whenOk && (
                        <Err>
                          {urgency === "booked"
                            ? "Pick a day and a window."
                            : "Choose how soon you need us."}
                        </Err>
                      )}
                    </>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <Field
                        label="Postcode"
                        error={
                          tried && !suburb
                            ? postcode.length === 4
                              ? "That's outside our area — call us and we'll recommend someone."
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
                          className={`${inputCls} font-mono text-[20px] tracking-[0.1em]`}
                          placeholder="2042"
                        />
                      </Field>
                      {suburb && (
                        <p
                          className="rounded-xl bg-mint px-4 py-3 text-[14.5px] text-ink"
                          aria-live="polite"
                        >
                          ✓ {suburb} —{" "}
                          {urgency === "now"
                            ? `nearest van about ${etaNow(postcode)} minutes away.`
                            : "we're there every day."}
                        </p>
                      )}
                      <Field
                        label="Street address"
                        optional={urgency === "quote"}
                        error={
                          tried && urgency !== "quote" && address.trim().length < 5
                            ? "So we know which door to knock on."
                            : ""
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
                          placeholder="We'll call when we're close"
                        />
                      </Field>
                      <Field label="What's happening" optional>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className={`${inputCls} resize-none py-3`}
                          placeholder="Where the water is, when it started, anything you've tried…"
                        />
                      </Field>
                      <div>
                        <p className="mb-1.5 flex items-baseline justify-between font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink">
                          A photo{" "}
                          <span className="font-sans text-[11.5px] normal-case tracking-normal text-ash">
                            optional — helps us quote
                          </span>
                        </p>
                        <label className="flex min-h-[64px] cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-ink/20 bg-card px-4 py-3 hover:border-ink">
                          {photo ? (
                            <img
                              src={photo}
                              alt="Your photo of the problem"
                              className="h-14 w-14 rounded-lg object-cover"
                            />
                          ) : (
                            <Camera size={22} strokeWidth={1.7} className="text-ash" />
                          )}
                          <span className="text-[14.5px] text-ink">
                            {photo ? "Photo added — tap to change" : "Add a photo"}
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

                  {step === 4 && done && <Logged done={done} />}
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
                      className={`btn sheen flex-1 disabled:cursor-not-allowed disabled:bg-ink/25 ${urgency === "now" && step === 3 ? "bg-flare text-noir hover:bg-ink hover:text-ivory" : "bg-ink text-ivory hover:bg-rose"}`}
                    >
                      {step === 3
                        ? urgency === "now"
                          ? "Send a van"
                          : urgency === "quote"
                            ? "Request my quote"
                            : "Book the job"
                        : "Continue"}{" "}
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
  const days = useMemo(() => openDays(8), []);
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
                <span className="font-mono text-[10.5px] uppercase">
                  {d.iso === isoDay(new Date()) ? "Today" : dayLabel(d.iso, { weekday: "short" })}
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
        <legend className="mb-2 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ash">
          Arrival window
        </legend>
        {wins.length ? (
          <div className="grid grid-cols-2 gap-2">
            {wins.map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={windowId === w.id}
                onClick={() => setWindowId(w.id)}
                className={`min-h-[48px] rounded-xl border text-[14.5px] font-semibold transition-colors ${windowId === w.id ? "border-rose bg-rose text-ivory" : "border-ink/15 bg-card text-ink hover:border-ink"}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-mint px-4 py-3 text-[14.5px]">
            No windows left that day — try the next, or choose "Now".
          </p>
        )}
      </fieldset>
    </div>
  );
}

/** The last screen: the job number, and what happens next. */
function Logged({ done }: { done: Done }) {
  const p = problemOf(done.problem);
  const win = WINDOWS.find((w) => w.id === done.windowId);
  const [left, setLeft] = useState(done.eta);
  useEffect(() => {
    if (done.urgency !== "now") return undefined;
    const t = window.setInterval(() => setLeft((l) => Math.max(1, l - 1)), 60_000);
    return () => window.clearInterval(t);
  }, [done.urgency]);
  const add = () =>
    downloadFile(
      `gullwing-${done.day}.ics`,
      icsFor({
        ref: done.ref,
        title: `${SITE.shortName} plumber — ${p?.name}`,
        day: done.day,
        from: win?.from ?? 9,
        location: `${done.address}, ${done.suburb} NSW ${done.postcode}`,
      }),
    );
  return (
    <div>
      {done.urgency === "now" ? (
        <div className="flex items-center gap-5 rounded-2xl bg-noir p-5 text-ivory">
          <div className="relative grid h-24 w-24 shrink-0 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#eef1ec"
                strokeOpacity="0.15"
                strokeWidth="7"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#ff6a2b"
                strokeWidth="7"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: left / Math.max(done.eta, 1) }}
                transition={{ duration: 1.2, ease: EASE }}
              />
            </svg>
            <span className="text-center font-mono leading-none">
              <span className="block text-[28px] font-bold">{left}</span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-pearl">min</span>
            </span>
          </div>
          <div>
            <p className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-flare">
              <Siren size={15} strokeWidth={2} /> Van on its way*
            </p>
            <p className="mt-1 text-[15.5px] leading-snug">
              We'll call {done.name.split(" ")[0]} in two minutes to confirm the price, then again
              when we're five minutes out.
            </p>
          </div>
        </div>
      ) : (
        <motion.div
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ink text-ivory"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
        >
          <Check size={38} strokeWidth={2.4} />
        </motion.div>
      )}
      <p className="mt-5 text-center text-[15.5px] text-ash">
        Job number <span className="font-mono font-bold text-ink">{done.ref}</span>
      </p>
      <dl className="mt-5 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-card px-5">
        {[
          ["Job", p?.name ?? ""],
          [
            "When",
            done.urgency === "now"
              ? `Now — about ${done.eta} min`
              : done.urgency === "quote"
                ? "Quote by text within the hour (business hours)"
                : `${dayLabel(done.day, { weekday: "long", day: "numeric", month: "long" })}, ${win?.label}`,
          ],
          [
            "Where",
            done.address
              ? `${done.address}, ${done.suburb} ${done.postcode}`
              : `${done.suburb} ${done.postcode}`,
          ],
          ["Usually", `${done.price} · fixed before we start`],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-3.5">
            <dt className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-ash">{k}</dt>
            <dd className="text-right text-[15px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {done.urgency === "booked" && (
        <button type="button" onClick={add} className="btn-ghost mt-4 w-full">
          <CalendarPlus size={17} strokeWidth={1.7} /> Add to calendar
        </button>
      )}
      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ash">*{SITE.concept}</p>
    </div>
  );
}

const inputCls =
  "w-full min-h-[50px] rounded-xl border border-ink/15 bg-card px-4 text-[16px] text-ink placeholder:text-ash/70 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20";

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function Option({
  on,
  onClick,
  hot,
  children,
}: {
  on: boolean;
  onClick: () => void;
  hot?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex min-h-[60px] w-full flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors duration-300 ${on ? (hot ? "border-flare bg-flare text-noir" : "border-ink bg-ink text-ivory") : "border-ink/10 bg-card text-ink hover:border-ink"}`}
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
      <span className="mb-1.5 flex items-baseline justify-between font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink">
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
