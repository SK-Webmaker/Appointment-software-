import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EVENTS, LOOKS, SIZES, type Look, type Occasion, type Size } from "@/site.config";

type BookingState = {
  occasion: Occasion | "";
  setOccasion: (o: Occasion | "") => void;
  date: string;
  setDate: (d: string) => void;
  look: Look | "";
  setLook: (l: Look | "") => void;
  size: Size | "";
  setSize: (s: Size | "") => void;
  /** true once the client has started a request (event, date, look or size) */
  started: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "estelle.request.v1";

type Saved = { occasion: Occasion | ""; look: Look | ""; size: Size | ""; date: string };

function load(): Saved {
  const empty: Saved = { occasion: "", look: "", size: "", date: "" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    return {
      occasion: EVENTS.find((e) => e === v.occasion) ?? "",
      look: LOOKS.find((l) => l === v.look) ?? "",
      size: SIZES.find((s) => s === v.size) ?? "",
      date: typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : "",
    };
  } catch {
    return empty;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // request is restored after mount so hydration always matches.
  const [occasion, setOccasion] = useState<Occasion | "">("");
  const [look, setLook] = useState<Look | "">("");
  const [size, setSize] = useState<Size | "">("");
  const [date, setDate] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setOccasion(s.occasion);
    setLook(s.look);
    setSize(s.size);
    setDate(s.date);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ occasion, look, size, date }));
    } catch {
      /* private mode — the request simply won't persist */
    }
  }, [occasion, look, size, date]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<BookingState>(
    () => ({
      occasion,
      setOccasion,
      date,
      setDate,
      look,
      setLook,
      size,
      setSize,
      started: occasion !== "" || date !== "" || look !== "" || size !== "",
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [occasion, date, look, size, sheetOpen, openSheet, closeSheet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
