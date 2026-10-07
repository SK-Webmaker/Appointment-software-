import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DAYS, HAIR_LENGTHS, type Day } from "@/site.config";

type BookingState = {
  style: string;
  setStyle: (s: string) => void;
  length: string;
  setLength: (l: string) => void;
  days: Day[];
  toggleDay: (d: Day) => void;
  /** true once the client has started a request (style, length or days) */
  started: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "empress.request.v1";

type Saved = { style: string; length: string; days: Day[] };

function load(): Saved {
  const empty: Saved = { style: "", length: "", days: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    const style = typeof v.style === "string" ? v.style.slice(0, 200) : "";
    const length = HAIR_LENGTHS.find((l) => l === v.length) ?? "";
    const days = Array.isArray(v.days) ? DAYS.filter((d) => (v.days as unknown[]).includes(d)) : [];
    return { style, length, days };
  } catch {
    return empty;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // request is restored after mount so hydration always matches.
  const [style, setStyle] = useState("");
  const [length, setLength] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setStyle(s.style);
    setLength(s.length);
    setDays(s.days);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ style, length, days }));
    } catch {
      /* private mode — the request simply won't persist */
    }
  }, [style, length, days]);

  // Keep the week's order whatever order the days were tapped in.
  const toggleDay = useCallback((d: Day) => setDays((cur) => DAYS.filter((x) => (x === d ? !cur.includes(x) : cur.includes(x)))), []);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<BookingState>(
    () => ({
      style,
      setStyle,
      length,
      setLength,
      days,
      toggleDay,
      started: style.trim().length > 0 || length !== "" || days.length > 0,
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [style, length, days, sheetOpen, toggleDay, openSheet, closeSheet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
