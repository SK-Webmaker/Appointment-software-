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
import {
  FINISHES,
  LENGTHS,
  SERVICE_NAMES,
  SHADES,
  SHAPES,
  STAFF,
  type Finish,
  type Length,
  type Shape,
} from "@/site.config";
import { isoDay } from "@/lib/slots";

export type Look = { shade: string; finish: Finish; shape: Shape; length: Length };
export type Pick = {
  service?: string;
  artist?: string;
  day?: string;
  time?: string;
  look?: Partial<Look>;
};

export const DEFAULT_LOOK: Look = { shade: "", finish: "Gloss", shape: "Almond", length: "Medium" };

type BookingState = {
  service: string;
  setService: (s: string) => void;
  /** an artist id, "any", or "" for not chosen yet */
  artist: string;
  setArtist: (b: string) => void;
  day: string;
  setDay: (d: string) => void;
  time: string;
  setTime: (t: string) => void;
  /** the look from the shade bar; shade "" = decide in the chair */
  look: Look;
  setLook: (l: Partial<Look>) => void;
  started: boolean;
  sheetOpen: boolean;
  openSheet: (pick?: Pick) => void;
  closeSheet: () => void;
  reset: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "petalcoat.booking.v1";

type Saved = { service: string; artist: string; day: string; time: string; look: Look };
const EMPTY: Saved = { service: "", artist: "", day: "", time: "", look: DEFAULT_LOOK };
const ARTIST_IDS = ["any", ...STAFF.map((b) => b.id)];
const one = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  list.find((x) => x === v) ?? fallback;

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    const day =
      typeof v.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.day) && v.day >= isoDay(new Date())
        ? v.day
        : "";
    const l = (v.look ?? {}) as Partial<Record<keyof Look, unknown>>;
    return {
      service: SERVICE_NAMES.find((p) => p === v.service) ?? "",
      artist: ARTIST_IDS.find((b) => b === v.artist) ?? "",
      day,
      time: day && typeof v.time === "string" && /^\d{2}:\d{2}$/.test(v.time) ? v.time : "",
      look: {
        shade:
          l.shade === "Studio" ? "Studio" : (SHADES.find((s) => s.name === l.shade)?.name ?? ""),
        finish: one(FINISHES, l.finish, DEFAULT_LOOK.finish),
        shape: one(SHAPES, l.shape, DEFAULT_LOOK.shape),
        length: one(LENGTHS, l.length, DEFAULT_LOOK.length),
      },
    };
  } catch {
    return EMPTY;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // booking is restored after mount so hydration always matches.
  const [service, setService] = useState("");
  const [artist, setArtistRaw] = useState("");
  const [day, setDayRaw] = useState("");
  const [time, setTime] = useState("");
  const [look, setLookRaw] = useState<Look>(DEFAULT_LOOK);
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setService(s.service);
    setArtistRaw(s.artist);
    setDayRaw(s.day);
    setTime(s.time);
    setLookRaw(s.look);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ service, artist, day, time, look }));
    } catch {
      /* private mode — the booking simply won't persist */
    }
  }, [service, artist, day, time, look]);

  // A different artist or day changes which times are free; a different
  // service is checked against the book in the sheet.
  const setArtist = useCallback((b: string) => {
    setArtistRaw(b);
    setTime("");
  }, []);
  const setDay = useCallback((d: string) => {
    setDayRaw(d);
    setTime("");
  }, []);
  const setLook = useCallback((l: Partial<Look>) => setLookRaw((cur) => ({ ...cur, ...l })), []);

  const openSheet = useCallback((pick?: Pick) => {
    if (pick?.service !== undefined) setService(pick.service);
    if (pick?.artist !== undefined) setArtistRaw(pick.artist);
    if (pick?.day !== undefined) setDayRaw(pick.day);
    if (pick?.look) setLookRaw((cur) => ({ ...cur, ...pick.look }));
    if (pick?.time !== undefined || pick?.day !== undefined || pick?.artist !== undefined)
      setTime(pick?.time ?? "");
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const reset = useCallback(() => {
    setService("");
    setArtistRaw("");
    setDayRaw("");
    setTime("");
    setLookRaw(DEFAULT_LOOK);
  }, []);

  const value = useMemo<BookingState>(
    () => ({
      service,
      setService,
      artist,
      setArtist,
      day,
      setDay,
      time,
      setTime,
      look,
      setLook,
      started: service !== "" || look.shade !== "",
      sheetOpen,
      openSheet,
      closeSheet,
      reset,
    }),
    [
      service,
      artist,
      setArtist,
      day,
      setDay,
      time,
      look,
      setLook,
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
