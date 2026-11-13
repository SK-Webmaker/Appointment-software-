import { useSyncExternalStore } from "react";

/** "Lights off" mode: the page goes dark except where you point. */
let off = false;
const subs = new Set<() => void>();

export function setLightsOff(v: boolean) {
  off = v;
  subs.forEach((f) => f());
}

export function useLightsOff(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => off,
    () => false,
  );
}
