import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { ROOMS, problemOf, type RoomId } from "@/site.config";
import { useBooking } from "@/context/booking";

/**
 * Common problems, room by room: pick a part of the house and see what
 * usually goes wrong there, what it usually costs, and book it.
 */
export function Problems() {
  const { openSheet } = useBooking();
  const [roomId, setRoomId] = useState<RoomId>("kitchen");
  const room = ROOMS.find((r) => r.id === roomId) ?? ROOMS[0]!;

  return (
    <section
      id="problems"
      className="bg-white py-20 text-ink md:py-28"
      aria-labelledby="problems-title"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="problems-title"
          label="Common problems"
          title="Not sure what it's called?"
          intro="Pick the part of the house. Here's what we're usually called out for, and what it usually costs — the exact price is agreed before we start."
        />

        <Reveal className="mt-10">
          <div
            data-qa="scroller"
            className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0"
            role="tablist"
            aria-label="Part of the house"
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
                className={`min-h-[46px] shrink-0 rounded-full border px-5 text-[15px] font-semibold transition-colors ${r.id === roomId ? "border-noir bg-noir text-white" : "border-ink/15 bg-white text-ink hover:border-ink/40"}`}
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
          className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-stone lg:aspect-auto lg:min-h-[480px]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={room.id}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Img
                  name={room.image}
                  widths={[800, 1200]}
                  sizes="(min-width:1024px) 640px, 92vw"
                  alt={room.alt}
                  className="h-full w-full object-cover"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <div>
            <p className="text-[16px] leading-relaxed text-ash">{room.line}</p>
            <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
              {room.problems.map((id) => {
                const p = problemOf(id);
                if (!p) return null;
                return (
                  <li key={id} className="flex items-center gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[17px] font-semibold">
                        {p.name}
                        {p.urgent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-candy/25 px-2 py-0.5 text-[12px] font-semibold text-plum">
                            <AlertTriangle size={12} /> Same day
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[14.5px] text-ash">{p.note}</p>
                      <p className="mt-1 text-[14px] text-ink">
                        Usually ${p.from.toLocaleString("en-AU")}–${p.to.toLocaleString("en-AU")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSheet({ problem: p.id })}
                      aria-label={`Book: ${p.name}`}
                      className="btn-ghost min-h-[44px] shrink-0 px-4 text-[14.5px]"
                    >
                      Book
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
