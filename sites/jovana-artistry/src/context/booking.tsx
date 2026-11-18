import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SERVICE_NAMES } from "@/site.config";

export type Mode = "studio" | "mobile" | "";

type BookingState = {
  service: string;
  setService: (s: string) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  /** the date or occasion, in the visitor's own words */
  when: string;
  setWhen: (s: string) => void;
  /** true once the visitor has started a booking (a service or a date) */
  started: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "jovana.booking.v1";

type Saved = { service: string; mode: Mode; when: string };

function load(): Saved {
  const empty: Saved = { service: "", mode: "", when: "" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    return {
      service: SERVICE_NAMES.find((p) => p === v.service) ?? "",
      mode: v.mode === "studio" || v.mode === "mobile" ? v.mode : "",
      when: typeof v.when === "string" ? v.when.slice(0, 80) : "",
    };
  } catch {
    return empty;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // booking is restored after mount so hydration always matches.
  const [service, setService] = useState("");
  const [mode, setMode] = useState<Mode>("");
  const [when, setWhen] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setService(s.service);
    setMode(s.mode);
    setWhen(s.when);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ service, mode, when }));
    } catch {
      /* private mode — the booking simply won't persist */
    }
  }, [service, mode, when]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<BookingState>(
    () => ({
      service,
      setService,
      mode,
      setMode,
      when,
      setWhen,
      started: service !== "" || when.trim() !== "",
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [service, mode, when, sheetOpen, openSheet, closeSheet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
