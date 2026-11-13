import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PRODUCT_NAMES, type Product } from "@/site.config";

type BookingState = {
  product: Product | "";
  setProduct: (p: Product | "") => void;
  sport: string;
  setSport: (s: string) => void;
  /** true once the visitor has started an order (a product or a sport) */
  started: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "kuvaello.order.v1";

type Saved = { product: Product | ""; sport: string };

function load(): Saved {
  const empty: Saved = { product: "", sport: "" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    return {
      product: PRODUCT_NAMES.find((p) => p === v.product) ?? "",
      sport: typeof v.sport === "string" ? v.sport.slice(0, 60) : "",
    };
  } catch {
    return empty;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // order is restored after mount so hydration always matches.
  const [product, setProduct] = useState<Product | "">("");
  const [sport, setSport] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setProduct(s.product);
    setSport(s.sport);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ product, sport }));
    } catch {
      /* private mode — the order simply won't persist */
    }
  }, [product, sport]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<BookingState>(
    () => ({
      product,
      setProduct,
      sport,
      setSport,
      started: product !== "" || sport.trim() !== "",
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [product, sport, sheetOpen, openSheet, closeSheet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
