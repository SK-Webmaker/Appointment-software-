import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FLAVOUR_NAMES, METHODS, type Flavour, type Method } from "@/site.config";

type BookingState = {
  flavours: Flavour[];
  toggleFlavour: (f: Flavour) => void;
  count: string;
  setCount: (c: string) => void;
  method: Method | "";
  setMethod: (m: Method | "") => void;
  date: string;
  setDate: (d: string) => void;
  /** true once the client has started an order (flavours, count, method or date) */
  started: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "sweetcup.order.v1";

type Saved = { flavours: Flavour[]; count: string; method: Method | ""; date: string };

function load(): Saved {
  const empty: Saved = { flavours: [], count: "", method: "", date: "" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    return {
      flavours: Array.isArray(v.flavours) ? FLAVOUR_NAMES.filter((f) => (v.flavours as unknown[]).includes(f)) : [],
      count: typeof v.count === "string" && /^\d{0,4}$/.test(v.count) ? v.count : "",
      method: METHODS.find((m) => m === v.method) ?? "",
      date: typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : "",
    };
  } catch {
    return empty;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // order is restored after mount so hydration always matches.
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [count, setCount] = useState("");
  const [method, setMethod] = useState<Method | "">("");
  const [date, setDate] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setFlavours(s.flavours);
    setCount(s.count);
    setMethod(s.method);
    setDate(s.date);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ flavours, count, method, date }));
    } catch {
      /* private mode — the order simply won't persist */
    }
  }, [flavours, count, method, date]);

  // Keep the menu's order whatever order the flavours were tapped in.
  const toggleFlavour = useCallback(
    (f: Flavour) => setFlavours((cur) => FLAVOUR_NAMES.filter((x) => (x === f ? !cur.includes(x) : cur.includes(x)))),
    [],
  );
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<BookingState>(
    () => ({
      flavours,
      toggleFlavour,
      count,
      setCount,
      method,
      setMethod,
      date,
      setDate,
      started: flavours.length > 0 || count !== "" || method !== "" || date !== "",
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [flavours, toggleFlavour, count, method, date, sheetOpen, openSheet, closeSheet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
