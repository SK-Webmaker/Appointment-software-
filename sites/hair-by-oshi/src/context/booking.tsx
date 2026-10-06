import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SERVICE_BY_ID, SITE, VIBES, type VibeId } from "@/site.config";

type Day = (typeof SITE.days)[number];

type BookingState = {
  selected: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  vibe: VibeId | null;
  setVibe: (v: VibeId | null) => void;
  days: Day[];
  toggleDay: (d: Day) => void;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "oshi.request.v1";

type Saved = { selected: string[]; vibe: VibeId | null; days: Day[] };

function load(): Saved {
  const empty: Saved = { selected: [], vibe: null, days: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    const selected = Array.isArray(v.selected) ? v.selected.filter((id): id is string => typeof id === "string" && id in SERVICE_BY_ID) : [];
    const vibe = VIBES.find((x) => x.id === v.vibe)?.id ?? null;
    const days = Array.isArray(v.days) ? SITE.days.filter((d) => (v.days as unknown[]).includes(d)) : [];
    return { selected, vibe, days };
  } catch {
    return empty;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // request is restored after mount so hydration always matches.
  const [selected, setSelected] = useState<string[]>([]);
  const [vibe, setVibe] = useState<VibeId | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setSelected(s.selected);
    setVibe(s.vibe);
    setDays(s.days);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ selected, vibe, days }));
    } catch {
      /* private mode — the request simply won't persist */
    }
  }, [selected, vibe, days]);

  const toggle = useCallback(
    (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
    [],
  );
  const remove = useCallback((id: string) => setSelected((s) => s.filter((x) => x !== id)), []);
  const clear = useCallback(() => setSelected([]), []);
  // Keep the week's order whatever order the days were tapped in.
  const toggleDay = useCallback(
    (d: Day) => setDays((cur) => SITE.days.filter((x) => (x === d ? !cur.includes(x) : cur.includes(x)))),
    [],
  );
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<BookingState>(
    () => ({
      selected,
      isSelected: (id) => selected.includes(id),
      toggle,
      remove,
      clear,
      vibe,
      setVibe,
      days,
      toggleDay,
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [selected, vibe, days, sheetOpen, toggle, remove, clear, toggleDay, openSheet, closeSheet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
