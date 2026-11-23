import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { ROOMS, problemOf, type RoomId } from "@/site.config";
import { useBooking } from "@/context/booking";

// Where each room sits in the drawing (viewBox 800 × 520), for its highlight.
const AREAS: Record<RoomId, string> = {
  ensuite: "M160 140 H410 V310 H160 Z",
  bathroom: "M410 140 H660 V310 H410 Z",
  kitchen: "M160 310 H410 V480 H160 Z",
  laundry: "M410 310 H660 V480 H410 Z",
  outside: "M660 300 H800 V510 H660 Z",
  roof: "M130 140 L410 32 L690 140 Z",
};

/**
 * Chapter 01 — around the house: a cutaway of a two-storey home, its pipes
 * running room to room. Tap a room (or its pin) and the panel lists what
 * usually goes wrong there, with the fixed-price range, ready to book.
 */
export function House() {
  const { openSheet } = useBooking();
  const [room, setRoom] = useState<RoomId>("bathroom");
  const r = ROOMS.find((x) => x.id === room)!;

  return (
    <section
      id="house"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="house-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="house" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="house-title"
            className="max-w-[13ch] text-[clamp(40px,8.4vw,104px)] leading-[0.96]"
          >
            <MaskLines lines={[<>Where's the</>, <em className="text-rose">trouble?</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.75] text-ash md:text-[17px]">
              Tap a room. We'll show you what usually goes wrong in there — and what it usually
              costs to fix.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:gap-12">
          <Reveal className="relative min-w-0 rounded-[28px] bg-stone p-3 md:p-6">
            <div className="relative">
              <svg
                viewBox="0 0 800 520"
                className="block h-auto w-full"
                role="img"
                aria-label="A cutaway drawing of a two-storey house with an ensuite, bathroom, kitchen, laundry, roof gutters and the hot water unit outside"
              >
                {/* sky + ground */}
                <rect x="0" y="480" width="800" height="40" fill="#cfe0d6" />
                {/* roof */}
                <path d="M130 140 L410 32 L690 140 Z" fill="#153a38" />
                <path d="M124 142 H696" stroke="#0f2b2a" strokeWidth="6" strokeLinecap="round" />
                {/* house body */}
                <rect
                  x="160"
                  y="140"
                  width="500"
                  height="340"
                  fill="#fbfcfa"
                  stroke="#10302f"
                  strokeWidth="4"
                />
                <path d="M160 310 H660 M410 140 V480" stroke="#10302f" strokeWidth="4" />
                {/* the pipes: cold from the street, hot from the unit */}
                <path
                  d="M800 470 H680 V400 M680 440 H630 V290 H440 M630 440 H440 M300 440 H190 V290 H300 M300 440 H410"
                  stroke="#0f5c56"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="10 8"
                  opacity="0.7"
                />
                <path
                  d="M700 400 V360 H650 V250 H560"
                  stroke="#b8412a"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="10 8"
                  opacity="0.7"
                />
                {/* ensuite: toilet + shower */}
                <rect
                  x="190"
                  y="250"
                  width="34"
                  height="42"
                  rx="6"
                  fill="#e2ebe5"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                <ellipse
                  cx="207"
                  cy="292"
                  rx="22"
                  ry="12"
                  fill="#fbfcfa"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                <path
                  d="M330 180 V300 M330 180 H370 M370 180 V196"
                  stroke="#10302f"
                  strokeWidth="2.5"
                  fill="none"
                />
                <circle cx="370" cy="200" r="6" fill="#10302f" />
                {/* bathroom: bath + basin */}
                <rect
                  x="440"
                  y="250"
                  width="130"
                  height="44"
                  rx="20"
                  fill="#e2ebe5"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                <path
                  d="M600 230 H640 V262 H600 Z"
                  fill="#fbfcfa"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                <path d="M620 230 V212 H632" stroke="#10302f" strokeWidth="2.5" fill="none" />
                <rect
                  x="596"
                  y="160"
                  width="48"
                  height="40"
                  rx="8"
                  fill="none"
                  stroke="#93aaa6"
                  strokeWidth="2.5"
                />
                {/* kitchen: bench, sink, tap, cooktop */}
                <rect
                  x="180"
                  y="420"
                  width="210"
                  height="60"
                  fill="#e2ebe5"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                <rect x="210" y="420" width="60" height="12" fill="#93aaa6" />
                <path
                  d="M240 420 V392 Q240 382 252 382 H262 V392"
                  stroke="#10302f"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path d="M310 416 H370" stroke="#10302f" strokeWidth="5" strokeLinecap="round" />
                {/* laundry: washer + tub */}
                <rect
                  x="440"
                  y="400"
                  width="80"
                  height="80"
                  rx="6"
                  fill="#fbfcfa"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                <circle
                  cx="480"
                  cy="445"
                  r="22"
                  fill="#e2ebe5"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                <rect
                  x="550"
                  y="420"
                  width="70"
                  height="60"
                  fill="#e2ebe5"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                {/* outside: hot water unit, gas meter, drain */}
                <rect
                  x="684"
                  y="372"
                  width="40"
                  height="108"
                  rx="18"
                  fill="#fbfcfa"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                <rect
                  x="736"
                  y="430"
                  width="30"
                  height="40"
                  rx="4"
                  fill="#ffb59f"
                  stroke="#10302f"
                  strokeWidth="2.5"
                />
                <rect x="740" y="486" width="44" height="8" fill="#10302f" />
                <path d="M660 146 V300" stroke="#93aaa6" strokeWidth="6" />
                {/* the chosen room, lit */}
                <AnimatePresence>
                  <motion.path
                    key={room}
                    d={AREAS[room]}
                    fill="#9fe3d4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.45 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{ mixBlendMode: "multiply" }}
                  />
                </AnimatePresence>
              </svg>
              {ROOMS.map((x) => {
                const on = x.id === room;
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRoom(x.id)}
                    className="group absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center"
                    style={{
                      left: `${(x.pin[0] / 800) * 100}%`,
                      top: `${(x.pin[1] / 520) * 100}%`,
                    }}
                  >
                    <span
                      className={`absolute h-11 w-11 rounded-full ${on ? "bg-rose/25" : "animate-ping bg-onyx/25"}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`relative grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[11px] font-bold shadow-md transition-colors ${on ? "bg-rose text-white" : "bg-onyx text-white group-hover:bg-rose"}`}
                    >
                      {ROOMS.indexOf(x) + 1}
                    </span>
                    <span className="sr-only">{x.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ROOMS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={x.id === room}
                  onClick={() => setRoom(x.id)}
                  className={`min-h-[44px] shrink-0 rounded-full px-4 text-[14px] font-medium transition-colors ${x.id === room ? "bg-ink text-ivory" : "bg-card text-ink hover:bg-white"}`}
                >
                  {x.name}
                </button>
              ))}
            </div>
          </Reveal>

          <div className="lg:sticky lg:top-[calc(var(--nav-h)+24px)]" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={room}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-[24px] bg-noir p-6 text-ivory md:p-8"
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-pearl">
                  {r.name}
                </p>
                <p className="mt-2 font-display text-[24px] leading-snug [font-variation-settings:'SOFT'_100,'WONK'_1]">
                  {r.line}
                </p>
                <ul className="mt-6 divide-y divide-ivory/10 border-y border-ivory/10">
                  {r.problems.map((id) => {
                    const pr = problemOf(id)!;
                    return (
                      <li key={id} className="flex items-center justify-between gap-3 py-3.5">
                        <span>
                          <span className="block text-[15.5px] font-semibold">{pr.name}</span>
                          <span className="block text-[13px] text-ivory/70">
                            ${pr.from.toLocaleString("en-AU")}–${pr.to.toLocaleString("en-AU")} ·{" "}
                            {pr.note}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => openSheet({ problem: id })}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-silk text-noir transition-transform hover:scale-105"
                          aria-label={`Book: ${pr.name}`}
                        >
                          <ArrowRight size={18} strokeWidth={2} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-[13px] text-ivory/70">
                  Fixed price agreed before we start. $79 call-out, taken off the job.
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
