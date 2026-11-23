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
import { ADDONS, PACKAGES, VEHICLES } from "@/site.config";
import { isoDay } from "@/lib/slots";

export type Mode = "studio" | "mobile" | "";
export type Build = { vehicle: string; pkg: string; addons: string[] };
export type Pick = Partial<Build> & { mode?: Mode; day?: string; time?: string };

type BookingState = Build & {
  setVehicle: (v: string) => void;
  setPkg: (p: string) => void;
  toggleAddon: (id: string) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  day: string;
  setDay: (d: string) => void;
  time: string;
  setTime: (t: string) => void;
  started: boolean;
  sheetOpen: boolean;
  openSheet: (pick?: Pick) => void;
  closeSheet: () => void;
  reset: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "lowlight.booking.v1";
type Saved = Build & { mode: Mode; day: string; time: string };
const EMPTY: Saved = { vehicle: "sedan", pkg: "", addons: [], mode: "", day: "", time: "" };

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
      vehicle: VEHICLES.find((x) => x.id === v.vehicle)?.id ?? "sedan",
      pkg: PACKAGES.find((x) => x.id === v.pkg)?.id ?? "",
      addons: Array.isArray(v.addons)
        ? ADDONS.filter((a) => (v.addons as unknown[]).includes(a.id)).map((a) => a.id)
        : [],
      mode: v.mode === "studio" || v.mode === "mobile" ? v.mode : "",
      day,
      time: day && typeof v.time === "string" && /^\d{2}:\d{2}$/.test(v.time) ? v.time : "",
    };
  } catch {
    return EMPTY;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [vehicle, setVehicle] = useState("sedan");
  const [pkg, setPkgRaw] = useState("");
  const [addons, setAddons] = useState<string[]>([]);
  const [mode, setModeRaw] = useState<Mode>("");
  const [day, setDayRaw] = useState("");
  const [time, setTime] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setVehicle(s.vehicle);
    setPkgRaw(s.pkg);
    setAddons(s.addons);
    setModeRaw(s.mode);
    setDayRaw(s.day);
    setTime(s.time);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ vehicle, pkg, addons, mode, day, time }));
    } catch {
      /* private mode */
    }
  }, [vehicle, pkg, addons, mode, day, time]);

  // Correction and ceramic need the bay: they can't go mobile.
  const setPkg = useCallback((p: string) => {
    setPkgRaw(p);
    if (p === "correction" || p === "ceramic") setModeRaw((m) => (m === "mobile" ? "studio" : m));
  }, []);
  const toggleAddon = useCallback(
    (id: string) => setAddons((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id])),
    [],
  );
  const setMode = useCallback((m: Mode) => {
    setModeRaw(m);
    setTime("");
  }, []);
  const setDay = useCallback((d: string) => {
    setDayRaw(d);
    setTime("");
  }, []);
  const openSheet = useCallback(
    (pick?: Pick) => {
      if (pick?.vehicle) setVehicle(pick.vehicle);
      if (pick?.pkg !== undefined) setPkg(pick.pkg);
      if (pick?.addons) setAddons(pick.addons);
      if (pick?.mode !== undefined) setModeRaw(pick.mode);
      if (pick?.day !== undefined) setDayRaw(pick.day);
      if (pick?.time !== undefined) setTime(pick.time);
      setSheetOpen(true);
    },
    [setPkg],
  );
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const reset = useCallback(() => {
    setPkgRaw("");
    setAddons([]);
    setModeRaw("");
    setDayRaw("");
    setTime("");
  }, []);

  const value = useMemo<BookingState>(
    () => ({
      vehicle,
      setVehicle,
      pkg,
      setPkg,
      addons,
      toggleAddon,
      mode,
      setMode,
      day,
      setDay,
      time,
      setTime,
      started: pkg !== "",
      sheetOpen,
      openSheet,
      closeSheet,
      reset,
    }),
    [
      vehicle,
      pkg,
      setPkg,
      addons,
      toggleAddon,
      mode,
      setMode,
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
