import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BARBERS, SERVICE_NAMES } from "@/site.config";
import { isoDay } from "@/lib/slots";

export type Pick = { service?: string; barber?: string; day?: string; time?: string };

type BookingState = {
  service: string;
  setService: (s: string) => void;
  /** a barber id, "any", or "" for not chosen yet */
  barber: string;
  setBarber: (b: string) => void;
  day: string;
  setDay: (d: string) => void;
  time: string;
  setTime: (t: string) => void;
  /** true once the visitor has picked something */
  started: boolean;
  sheetOpen: boolean;
  /** opens the booking, optionally with choices already made */
  openSheet: (pick?: Pick) => void;
  closeSheet: () => void;
  reset: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "hollis.booking.v1";

type Saved = { service: string; barber: string; day: string; time: string };
const EMPTY: Saved = { service: "", barber: "", day: "", time: "" };
const BARBER_IDS = ["any", ...BARBERS.map((b) => b.id)];

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    const day =
      typeof v.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.day) && v.day >= isoDay(new Date())
        ? v.day
        : "";
    return {
      service: SERVICE_NAMES.find((p) => p === v.service) ?? "",
      barber: BARBER_IDS.find((b) => b === v.barber) ?? "",
      day,
      time: day && typeof v.time === "string" && /^\d{2}:\d{2}$/.test(v.time) ? v.time : "",
    };
  } catch {
    return EMPTY;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // booking is restored after mount so hydration always matches.
  const [service, setServiceRaw] = useState("");
  const [barber, setBarberRaw] = useState("");
  const [day, setDayRaw] = useState("");
  const [time, setTime] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setServiceRaw(s.service);
    setBarberRaw(s.barber);
    setDayRaw(s.day);
    setTime(s.time);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ service, barber, day, time }));
    } catch {
      /* private mode — the booking simply won't persist */
    }
  }, [service, barber, day, time]);

  // A different barber or day changes which times are free; a different
  // service is checked against the book in the sheet (a time that still fits
  // is kept).
  const setService = setServiceRaw;
  const setBarber = useCallback((b: string) => {
    setBarberRaw(b);
    setTime("");
  }, []);
  const setDay = useCallback((d: string) => {
    setDayRaw(d);
    setTime("");
  }, []);

  const openSheet = useCallback((pick?: Pick) => {
    if (pick?.service !== undefined) setServiceRaw(pick.service);
    if (pick?.barber !== undefined) setBarberRaw(pick.barber);
    if (pick?.day !== undefined) setDayRaw(pick.day);
    if (pick?.time !== undefined || pick?.day !== undefined || pick?.barber !== undefined)
      setTime(pick?.time ?? "");
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const reset = useCallback(() => {
    setServiceRaw("");
    setBarberRaw("");
    setDayRaw("");
    setTime("");
  }, []);

  const value = useMemo<BookingState>(
    () => ({
      service,
      setService,
      barber,
      setBarber,
      day,
      setDay,
      time,
      setTime,
      started: service !== "" || barber !== "",
      sheetOpen,
      openSheet,
      closeSheet,
      reset,
    }),
    [
      service,
      setService,
      barber,
      setBarber,
      day,
      setDay,
      time,
      sheetOpen,
      openSheet,
      closeSheet,
      reset,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
