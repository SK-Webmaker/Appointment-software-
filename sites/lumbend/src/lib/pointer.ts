import { motionValue } from "framer-motion";

/**
 * One shared pointer for the whole page, so a dozen effects don't each add a
 * pointermove listener. `x`/`y` are viewport pixels; `nx`/`ny` run -1…1 from
 * the centre of the screen. Only a real mouse moves them: on touch screens
 * they stay centred and every pointer effect simply rests.
 */
export const pointer = {
  x: motionValue(-200),
  y: motionValue(-200),
  nx: motionValue(0),
  ny: motionValue(0),
};

let started = false;
export function startPointer(): boolean {
  if (typeof window === "undefined") return false;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!fine || started) return fine;
  started = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x.set(e.clientX);
      pointer.y.set(e.clientY);
      pointer.nx.set((e.clientX / window.innerWidth) * 2 - 1);
      pointer.ny.set((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );
  return true;
}
