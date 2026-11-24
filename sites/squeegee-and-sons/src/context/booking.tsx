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
import { CLEANS, EXTRAS, FREQS, WINDOWS } from "@/site.config";
import { isoDay } from "@/lib/slots";

/** The clean being put together — shared by the quote, the checklist and the booking. */
export type Clean = {
  bedrooms: number;
  bathrooms: number;
  clean: string;
  freq: string;
  extras: string[];
};
export type Pick = Partial<Clean> & { step?: number };

type BookingState = Clean & {
  set: (patch: Partial<Clean>) => void;
  toggleExtra: (id: string) => void;
  day: string;
  setDay: (d: string) => void;
  windowId: string;
  setWindowId: (w: string) => void;
  postcode: string;
  setPostcode: (p: string) => void;
  /** true once someone has changed the quote */
  started: boolean;
  sheetOpen: boolean;
  /** the step the sheet should open on, if the opener knows */
  openAt: number | null;
  openSheet: (pick?: Pick) => void;
  closeSheet: () => void;
  reset: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "squeegee.clean.v1";
export const DEFAULT: Clean = {
  bedrooms: 2,
  bathrooms: 1,
  clean: "regular",
  freq: "fortnightly",
  extras: [],
};
const clampInt = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<
      Record<
        | "day"
        | "bedrooms"
        | "bathrooms"
        | "clean"
        | "freq"
        | "extras"
        | "windowId"
        | "postcode"
        | "started",
        unknown
      >
    >;
    const day =
      typeof v.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.day) && v.day > isoDay(new Date())
        ? v.day
        : "";
    return {
      bedrooms: clampInt(v.bedrooms, 1, 6, DEFAULT.bedrooms),
      bathrooms: clampInt(v.bathrooms, 1, 4, DEFAULT.bathrooms),
      clean: CLEANS.find((c) => c.id === v.clean)?.id ?? DEFAULT.clean,
      freq: FREQS.find((f) => f.id === v.freq)?.id ?? DEFAULT.freq,
      extras: Array.isArray(v.extras)
        ? EXTRAS.filter((e) => (v.extras as unknown[]).includes(e.id)).map((e) => e.id as string)
        : [],
      day,
      windowId: day ? (WINDOWS.find((w) => w.id === v.windowId)?.id ?? "") : "",
      postcode: typeof v.postcode === "string" && /^\d{0,4}$/.test(v.postcode) ? v.postcode : "",
      started: v.started === true,
    };
  } catch {
    return null;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [c, setC] = useState<Clean>(DEFAULT);
  const [day, setDayRaw] = useState("");
  const [windowId, setWindowId] = useState("");
  const [postcode, setPostcode] = useState("");
  const [started, setStarted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    if (s) {
      setC({
        bedrooms: s.bedrooms,
        bathrooms: s.bathrooms,
        clean: s.clean,
        freq: s.freq,
        extras: s.extras,
      });
      setDayRaw(s.day);
      setWindowId(s.windowId);
      setPostcode(s.postcode);
      setStarted(s.started);
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...c, day, windowId, postcode, started }));
    } catch {
      /* private mode */
    }
  }, [c, day, windowId, postcode, started]);

  const set = useCallback((patch: Partial<Clean>) => {
    setC((x) => {
      const next = { ...x, ...patch };
      // an end-of-lease clean only happens once
      if (patch.clean === "lease") next.freq = "once";
      // …and leaving one goes back to a regular clean
      else if (patch.clean && x.clean === "lease" && !patch.freq) next.freq = DEFAULT.freq;
      return next;
    });
    setStarted(true);
  }, []);
  const toggleExtra = useCallback((id: string) => {
    setC((x) => ({
      ...x,
      extras: x.extras.includes(id) ? x.extras.filter((e) => e !== id) : [...x.extras, id],
    }));
    setStarted(true);
  }, []);
  const setDay = useCallback((d: string) => {
    setDayRaw(d);
    setWindowId("");
  }, []);
  const openSheet = useCallback(
    (pick?: Pick) => {
      if (pick) {
        const { step, ...patch } = pick;
        if (Object.keys(patch).length) set(patch);
        setOpenAt(step ?? null);
      } else setOpenAt(null);
      setSheetOpen(true);
    },
    [set],
  );
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const reset = useCallback(() => {
    setDayRaw("");
    setWindowId("");
    setStarted(false);
  }, []);

  const value = useMemo<BookingState>(
    () => ({
      ...c,
      set,
      toggleExtra,
      day,
      setDay,
      windowId,
      setWindowId,
      postcode,
      setPostcode,
      started,
      sheetOpen,
      openAt,
      openSheet,
      closeSheet,
      reset,
    }),
    [
      c,
      set,
      toggleExtra,
      day,
      setDay,
      windowId,
      postcode,
      started,
      sheetOpen,
      openAt,
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
