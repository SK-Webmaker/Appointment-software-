import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GASES, OFFER_NAMES, type Offer } from "@/site.config";

type GasSymbol = (typeof GASES)[number]["symbol"];

type BookingState = {
  offer: Offer | "";
  setOffer: (o: Offer | "") => void;
  words: string;
  setWords: (s: string) => void;
  gas: GasSymbol;
  setGas: (g: GasSymbol) => void;
  /** true once the visitor has started a brief (a commission or words) */
  started: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<BookingState | null>(null);
const KEY = "nocta.brief.v1";
const GAS_SYMBOLS = GASES.map((g) => g.symbol) as GasSymbol[];

type Saved = { offer: Offer | ""; words: string; gas: GasSymbol };

function load(): Saved {
  const empty: Saved = { offer: "", words: "", gas: "Ne" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    return {
      offer: OFFER_NAMES.find((p) => p === v.offer) ?? "",
      words: typeof v.words === "string" ? v.words.slice(0, 40) : "",
      gas: GAS_SYMBOLS.find((g) => g === v.gas) ?? "Ne",
    };
  } catch {
    return empty;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  // Starts empty on the server and the first client render alike; the saved
  // brief is restored after mount so hydration always matches.
  const [offer, setOffer] = useState<Offer | "">("");
  const [words, setWords] = useState("");
  const [gas, setGas] = useState<GasSymbol>("Ne");
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const s = load();
    setOffer(s.offer);
    setWords(s.words);
    setGas(s.gas);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ offer, words, gas }));
    } catch {
      /* private mode — the brief simply won't persist */
    }
  }, [offer, words, gas]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<BookingState>(
    () => ({
      offer,
      setOffer,
      words,
      setWords,
      gas,
      setGas,
      started: offer !== "" || words.trim() !== "",
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [offer, words, gas, sheetOpen, openSheet, closeSheet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used inside <BookingProvider>");
  return v;
}
