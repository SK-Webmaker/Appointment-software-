import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { CLEANS, ROOMS, cleanOf } from "@/site.config";
import { useBooking } from "@/context/booking";

const EASE = [0.22, 1, 0.36, 1] as const;
const NEEDS = ["", "Deep", "End of lease"] as const;

/**
 * Chapter 02 — what we clean, room by room. Pick a room and a kind of clean
 * (the same choice as the price above — change one, the other follows) and
 * the clipboard ticks itself off: what's in, and what a bigger clean adds.
 */
export function Checklist() {
  const b = useBooking();
  const [roomId, setRoomId] = useState(ROOMS[0]!.id);
  const room = ROOMS.find((r) => r.id === roomId) ?? ROOMS[0]!;
  const level = cleanOf(b.clean)?.level ?? 0;
  const done = room.tasks.filter((t) => t.level <= level).length;

  return (
    <section
      id="checklist"
      className="sheet bg-stone pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="checklist-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="checklist" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="checklist-title"
            className="max-w-[12ch] text-[clamp(44px,9vw,120px)] leading-[0.9]"
          >
            <MaskLines lines={[<>Every room,</>, <em className="text-rose">ticked off.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[40ch] text-[16px] leading-[1.7] text-ash md:text-[18px]">
              Exactly what's in each clean, so nobody wonders whether the oven was "included".
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-12">
          <div
            className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0"
            data-qa="scroller"
            role="tablist"
            aria-label="Rooms"
          >
            {ROOMS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                id={`tab-${r.id}`}
                aria-selected={r.id === roomId}
                aria-controls="room-panel"
                onClick={() => setRoomId(r.id)}
                className={`min-h-[48px] shrink-0 rounded-full px-5 text-[15.5px] font-bold transition-colors duration-300 ${r.id === roomId ? "bg-ink text-ivory" : "bg-card text-ink hover:bg-white"}`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </Reveal>

        <div
          id="room-panel"
          role="tabpanel"
          aria-labelledby={`tab-${room.id}`}
          className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <Reveal className="relative min-h-[280px] overflow-hidden rounded-[30px] bg-card lg:min-h-[560px]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={room.id}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <Img
                  name={room.image}
                  widths={[800, 1200]}
                  sizes="(min-width:1024px) 40vw, 92vw"
                  alt={room.alt}
                  className="h-full w-full object-cover"
                />
              </motion.div>
            </AnimatePresence>
          </Reveal>

          <Reveal delay={0.06} className="min-w-0 rounded-[30px] bg-card p-6 md:p-9">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of clean">
              {CLEANS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={b.clean === c.id}
                  onClick={() => b.set({ clean: c.id })}
                  className={`min-h-[44px] rounded-full border-2 px-4 text-[14.5px] font-bold transition-colors duration-300 ${b.clean === c.id ? "border-onyx bg-onyx text-white" : "border-ink/10 hover:border-ink"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <p className="mt-5 text-[15px] font-semibold" aria-live="polite">
              {room.name}: {done} of {room.tasks.length} jobs
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-mint" aria-hidden="true">
              <motion.div
                className="h-full origin-left rounded-full bg-onyx"
                animate={{ scaleX: done / room.tasks.length }}
                transition={{ duration: 0.6, ease: EASE }}
              />
            </div>
            <ul className="mt-6 divide-y divide-ink/8">
              {room.tasks.map((t) => {
                const on = t.level <= level;
                return (
                  <li key={`${room.id}-${t.t}`} className="flex items-center gap-3 py-3">
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-300 ${on ? "bg-onyx" : "border-2 border-ink/15"}`}
                      aria-hidden="true"
                    >
                      {on && (
                        <svg viewBox="0 0 20 20" className="h-4 w-4">
                          <motion.path
                            key={`${room.id}-${level}`}
                            d="M4 10.5 L8.5 15 L16 6"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.4, ease: EASE }}
                          />
                        </svg>
                      )}
                    </span>
                    <span className={`flex-1 text-[15.5px] ${on ? "text-ink" : "text-ash"}`}>
                      <span className="sr-only">{on ? "Included: " : "Not included: "}</span>
                      {t.t}
                    </span>
                    {!on && (
                      <span className="shrink-0 rounded-full bg-mint px-2.5 py-1 text-[12px] font-bold text-onyx">
                        + {NEEDS[t.level]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
