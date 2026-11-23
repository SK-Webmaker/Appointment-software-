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
import { PROBLEMS, WINDOWS } from "@/site.config";
import { isoDay } from "@/lib/slots";

export type Urgency = "now" | "booked" | "quote" | "";
export type Pick = { problem?: string; urgency?: Urgency; postcode?: string };

type BookingState = {
  problem: string;
  setProblem: (s: string) => void;
  urgency: Urgency;
  setUrgency: (u: Urgency) => void;
  day: string;
  setDay: (d: string) => void;
  windowId: string;
  setWindowId: (w: string) => void;
  postcode: string;
  setPostcode: (p: string) => void;
  started: boolean;
  sheetOpen: boolean;
  openSheet: (pick?: Pick) => void;
  closeSheet: () => void;
  reset: () => void;
  /** emergency mode: the whole site turns into the burst-pipe screen */
  emergency: boolean;
  setEmergency: (on: boolean) => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "tidewell.job.v1";
type Saved = { problem: string; urgency: Urgency; day: string; windowId: string; postcode: string };
const EMPTY: Saved = { problem: "", urgency: "", day: "", windowId: "", postcode: "" };

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
      problem: PROBLEMS.find((p) => p.id === v.problem)?.id ?? "",
      urgency:
        v.urgency === "now" || v.urgency === "booked" || v.urgency === "quote" ? v.urgency : "",
      day,
      windowId: day ? (WINDOWS.find((w) => w.id === v.windowId)?.id ?? "") : "",
      postcode: typeof v.postcode === "string" && /^\d{0,4}$/.test(v.postcode) ? v.postcode : "",
    };
  } catch {
    return EMPTY;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [problem, setProblem] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("");
  const [day, setDayRaw] = useState("");
  const [windowId, setWindowId] = useState("");
  const [postcode, setPostcode] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setProblem(s.problem);
    setUrgency(s.urgency);
    setDayRaw(s.day);
    setWindowId(s.windowId);
    setPostcode(s.postcode);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ problem, urgency, day, windowId, postcode }));
    } catch {
      /* private mode */
    }
  }, [problem, urgency, day, windowId, postcode]);

  const setDay = useCallback((d: string) => {
    setDayRaw(d);
    setWindowId("");
  }, []);
  const openSheet = useCallback((pick?: Pick) => {
    if (pick?.problem !== undefined) setProblem(pick.problem);
    if (pick?.urgency !== undefined) setUrgency(pick.urgency);
    if (pick?.postcode !== undefined) setPostcode(pick.postcode);
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const reset = useCallback(() => {
    setProblem("");
    setUrgency("");
    setDayRaw("");
    setWindowId("");
  }, []);

  const value = useMemo<BookingState>(
    () => ({
      problem,
      setProblem,
      urgency,
      setUrgency,
      day,
      setDay,
      windowId,
      setWindowId,
      postcode,
      setPostcode,
      started: problem !== "" || urgency !== "",
      sheetOpen,
      openSheet,
      closeSheet,
      reset,
      emergency,
      setEmergency,
    }),
    [
      problem,
      urgency,
      day,
      setDay,
      windowId,
      postcode,
      sheetOpen,
      openSheet,
      closeSheet,
      reset,
      emergency,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
