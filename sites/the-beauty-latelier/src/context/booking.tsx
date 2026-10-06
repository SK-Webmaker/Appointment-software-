import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SERVICE_BY_ID } from "@/site.config";

type BookingState = {
  selected: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "atelier.selection.v1";

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && id in SERVICE_BY_ID) : [];
  } catch {
    return [];
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // selection is restored after mount so hydration always matches.
  const [selected, setSelected] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    setSelected(load());
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(selected));
    } catch {
      /* private mode — the selection simply won't persist */
    }
  }, [selected]);

  const toggle = useCallback(
    (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
    [],
  );
  const remove = useCallback((id: string) => setSelected((s) => s.filter((x) => x !== id)), []);
  const clear = useCallback(() => setSelected([]), []);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<BookingState>(
    () => ({
      selected,
      isSelected: (id) => selected.includes(id),
      toggle,
      remove,
      clear,
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [selected, sheetOpen, toggle, remove, clear, openSheet, closeSheet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
