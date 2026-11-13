import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GASES, GAS_SYMBOLS, SHAPE_NAMES, type GasSymbol, type Shape } from "@/site.config";

/** The page's light before anyone chooses a gas: sodium amber. */
export const DEFAULT_GLOW = "#ffb547";

type OrderState = {
  shape: Shape | "";
  setShape: (s: Shape | "") => void;
  gas: GasSymbol | "";
  setGas: (g: GasSymbol | "") => void;
  words: string;
  setWords: (s: string) => void;
  /** the colour the whole page glows in right now */
  glow: string;
  /** true once the visitor has started an order (a shape or a gas) */
  started: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<OrderState | null>(null);
const KEY = "lumbend.order.v1";

type Saved = { shape: Shape | ""; gas: GasSymbol | ""; words: string };

function load(): Saved {
  const empty: Saved = { shape: "", gas: "", words: "" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    return {
      shape: SHAPE_NAMES.find((p) => p === v.shape) ?? "",
      gas: GAS_SYMBOLS.find((g) => g === v.gas) ?? "",
      words: typeof v.words === "string" ? v.words.slice(0, 12) : "",
    };
  } catch {
    return empty;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // order is restored after mount so hydration always matches.
  const [shape, setShape] = useState<Shape | "">("");
  const [gas, setGas] = useState<GasSymbol | "">("");
  const [words, setWords] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);
  const glow = GASES.find((g) => g.symbol === gas)?.colour ?? DEFAULT_GLOW;

  useEffect(() => {
    const s = load();
    setShape(s.shape);
    setGas(s.gas);
    setWords(s.words);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ shape, gas, words }));
    } catch {
      /* private mode — the order simply won't persist */
    }
  }, [shape, gas, words]);

  // The whole page takes on the chosen light (a registered custom property,
  // so it fades rather than snaps — see styles.css).
  useEffect(() => {
    document.documentElement.style.setProperty("--glow", glow);
  }, [glow]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<OrderState>(
    () => ({
      shape,
      setShape,
      gas,
      setGas,
      words,
      setWords,
      glow,
      started: shape !== "" || gas !== "",
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [shape, gas, words, glow, sheetOpen, openSheet, closeSheet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
