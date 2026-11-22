import { AnimatePresence, motion } from "framer-motion";
import { Check, Phone, Siren, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EMERGENCY_STEPS, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";
import { useReducedMotionSafe } from "@/lib/motion";
import { etaNow, isAfterHours, suburbOf } from "@/lib/slots";

/**
 * Emergency mode. One tap anywhere ("Water everywhere?") floods the screen
 * signal-orange from the button: a giant call button, the nearest van's ETA
 * for your postcode, and a checklist of what to do while we drive — tick as
 * you go. "Send a van" carries straight into an emergency job request.
 */
export function Emergency() {
  const { emergency, setEmergency, openSheet, postcode, setPostcode } = useBooking();
  const reduce = useReducedMotionSafe();
  const panel = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState<number[]>([]);
  const suburb = suburbOf(postcode);

  useEffect(() => {
    if (!emergency) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    const release = lockScroll();
    const t = window.setTimeout(
      () => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(),
      80,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmergency(false);
      if (e.key !== "Tab" || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input");
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
  }, [emergency, setEmergency]);

  const toggle = (i: number) =>
    setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));

  return (
    <AnimatePresence>
      {emergency && (
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-title"
          className="fixed inset-0 z-[85] overflow-y-auto overscroll-contain bg-flare text-noir"
          data-lenis-prevent
          initial={reduce ? { opacity: 0 } : { clipPath: "circle(0% at 88% 4%)" }}
          animate={reduce ? { opacity: 1 } : { clipPath: "circle(150% at 88% 4%)" }}
          exit={reduce ? { opacity: 0 } : { clipPath: "circle(0% at 88% 4%)" }}
          transition={{ duration: reduce ? 0.3 : 0.7, ease: [0.76, 0, 0.24, 1] }}
        >
          {/* hazard stripes */}
          <div
            className="h-3 w-full bg-[repeating-linear-gradient(-45deg,#0b1624_0_14px,#ff6a2b_14px_28px)]"
            aria-hidden="true"
          />
          <div className="mx-auto max-w-[1200px] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 md:px-10 md:pt-10">
            <div className="flex items-start justify-between gap-4">
              <p className="flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-[0.18em]">
                <Siren size={18} strokeWidth={2.2} /> Emergency mode
              </p>
              <button
                onClick={() => setEmergency(false)}
                data-autofocus
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-noir text-noir hover:bg-noir hover:text-flare"
                aria-label="Close emergency mode"
              >
                <X size={20} strokeWidth={2.2} />
              </button>
            </div>
            <h2 id="sos-title" className="mt-5 text-[clamp(44px,11vw,128px)] leading-[0.86]">
              Breathe.
              <br />
              We're coming.
            </h2>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <a
                href={SITE.phoneHref}
                className="group flex min-h-[120px] items-center justify-between gap-4 rounded-[18px] bg-noir px-6 py-5 text-ivory md:px-8"
              >
                <span>
                  <span className="block font-mono text-[12px] uppercase tracking-[0.16em] text-pearl">
                    Call now — a person answers
                  </span>
                  <span className="mt-1 block font-display text-[clamp(30px,7vw,60px)] font-black leading-none [font-stretch:125%]">
                    {SITE.phone}
                  </span>
                </span>
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-flare text-noir transition-transform duration-500 group-hover:scale-110">
                  <Phone size={28} strokeWidth={2.2} />
                </span>
              </a>
              <div className="rounded-[18px] border-2 border-noir/80 px-6 py-5">
                <label
                  htmlFor="sos-postcode"
                  className="block font-mono text-[12px] font-bold uppercase tracking-[0.16em]"
                >
                  Your postcode
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="sos-postcode"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="2042"
                    className="h-14 w-[7.5rem] rounded-xl border-2 border-noir bg-transparent px-4 font-mono text-[24px] font-bold text-noir placeholder:text-noir/60 focus:outline-none focus:ring-4 focus:ring-noir/20"
                  />
                  <p className="text-[15px] font-semibold leading-snug" aria-live="polite">
                    {postcode.length < 4
                      ? "We'll tell you how far the nearest van is."
                      : suburb
                        ? `${suburb}: nearest van about ${etaNow(postcode)} minutes away.`
                        : "That's outside our area — call us and we'll find someone who can get there."}
                  </p>
                </div>
                {isAfterHours() && (
                  <p className="mt-3 text-[13px] font-medium">
                    After-hours rate applies — we confirm the price on the phone before we leave.
                  </p>
                )}
              </div>
            </div>

            <h3 className="mt-10 text-[clamp(24px,4vw,36px)] leading-none">While we drive</h3>
            <ol className="mt-4 grid gap-3 md:grid-cols-2">
              {EMERGENCY_STEPS.map((s, i) => {
                const on = done.includes(i);
                return (
                  <li key={s.title}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(i)}
                      className={`flex w-full items-start gap-4 rounded-[16px] p-5 text-left transition-colors duration-300 ${on ? "bg-noir text-ivory" : "bg-ivory/80 text-noir hover:bg-ivory"}`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 font-mono text-[14px] font-bold ${on ? "border-flare bg-flare text-noir" : "border-noir"}`}
                      >
                        {on ? <Check size={18} strokeWidth={3} /> : i + 1}
                      </span>
                      <span>
                        <span className="block text-[17px] font-bold leading-snug">{s.title}</span>
                        <span
                          className={`mt-1 block text-[14.5px] leading-relaxed ${on ? "text-ivory/80" : "text-noir/80"}`}
                        >
                          {s.text}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p
              className="mt-3 font-mono text-[12.5px] font-bold uppercase tracking-[0.14em]"
              aria-live="polite"
            >
              {done.length} of {EMERGENCY_STEPS.length} done
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setEmergency(false);
                  openSheet({ urgency: "now", problem: "burst" });
                }}
                className="btn bg-noir px-8 text-ivory hover:bg-ivory hover:text-noir"
              >
                Send a van — request online
              </button>
              <button
                type="button"
                onClick={() => setEmergency(false)}
                className="btn border-2 border-noir px-8 text-noir hover:bg-noir hover:text-flare"
              >
                It's not an emergency
              </button>
            </div>
            <p className="mt-6 max-w-[70ch] text-[12.5px] font-medium leading-relaxed text-noir/80">
              {SITE.concept}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
