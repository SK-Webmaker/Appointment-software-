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
import { PLANTS, PROJECTS, SIZES, STYLES, WINDOWS } from "@/site.config";
import { isoDay } from "@/lib/slots";

export type Pick = { project?: string; size?: string; style?: string; postcode?: string };

type BookingState = {
  project: string;
  setProject: (s: string) => void;
  size: string;
  setSize: (s: string) => void;
  style: string;
  setStyle: (s: string) => void;
  day: string;
  setDay: (d: string) => void;
  windowId: string;
  setWindowId: (w: string) => void;
  postcode: string;
  setPostcode: (p: string) => void;
  /** plants saved from the finder, carried into the visit */
  shortlist: string[];
  toggleShortlist: (id: string) => void;
  started: boolean;
  sheetOpen: boolean;
  openSheet: (pick?: Pick) => void;
  closeSheet: () => void;
  reset: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "saltbush.visit.v1";
type Saved = {
  project: string;
  size: string;
  style: string;
  day: string;
  windowId: string;
  postcode: string;
  shortlist: string[];
};
const EMPTY: Saved = {
  project: "",
  size: "",
  style: "",
  day: "",
  windowId: "",
  postcode: "",
  shortlist: [],
};

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    const day =
      typeof v.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.day) && v.day > isoDay(new Date())
        ? v.day
        : "";
    return {
      project: PROJECTS.find((p) => p.id === v.project)?.id ?? "",
      size: SIZES.find((s) => s.id === v.size)?.id ?? "",
      style: STYLES.find((s) => s.id === v.style)?.id ?? "",
      day,
      windowId: day ? (WINDOWS.find((w) => w.id === v.windowId)?.id ?? "") : "",
      postcode: typeof v.postcode === "string" && /^\d{0,4}$/.test(v.postcode) ? v.postcode : "",
      shortlist: Array.isArray(v.shortlist)
        ? PLANTS.filter((p) => (v.shortlist as unknown[]).includes(p.id)).map((p) => p.id)
        : [],
    };
  } catch {
    return EMPTY;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState("");
  const [size, setSize] = useState("");
  const [style, setStyle] = useState("");
  const [day, setDayRaw] = useState("");
  const [windowId, setWindowId] = useState("");
  const [postcode, setPostcode] = useState("");
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setProject(s.project);
    setSize(s.size);
    setStyle(s.style);
    setDayRaw(s.day);
    setWindowId(s.windowId);
    setPostcode(s.postcode);
    setShortlist(s.shortlist);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ project, size, style, day, windowId, postcode, shortlist }),
      );
    } catch {
      /* private mode */
    }
  }, [project, size, style, day, windowId, postcode, shortlist]);

  const setDay = useCallback((d: string) => {
    setDayRaw(d);
    setWindowId("");
  }, []);
  const toggleShortlist = useCallback(
    (id: string) => setShortlist((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])),
    [],
  );
  const openSheet = useCallback((pick?: Pick) => {
    if (pick?.project !== undefined) setProject(pick.project);
    if (pick?.size !== undefined) setSize(pick.size);
    if (pick?.style !== undefined) setStyle(pick.style);
    if (pick?.postcode !== undefined) setPostcode(pick.postcode);
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const reset = useCallback(() => {
    setProject("");
    setSize("");
    setStyle("");
    setDayRaw("");
    setWindowId("");
  }, []);

  const value = useMemo<BookingState>(
    () => ({
      project,
      setProject,
      size,
      setSize,
      style,
      setStyle,
      day,
      setDay,
      windowId,
      setWindowId,
      postcode,
      setPostcode,
      shortlist,
      toggleShortlist,
      started: project !== "" || shortlist.length > 0,
      sheetOpen,
      openSheet,
      closeSheet,
      reset,
    }),
    [
      project,
      size,
      style,
      day,
      setDay,
      windowId,
      postcode,
      shortlist,
      toggleShortlist,
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
