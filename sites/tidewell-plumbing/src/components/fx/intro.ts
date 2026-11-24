import { useEffect, useState } from "react";

/**
 * A tiny signal for "the opening preloader has finished", so the hero can
 * hold its entrance until the page is actually visible. Server and first
 * client render both say "not done" so hydration matches.
 */
let done = false;
const EVENT = "fx:intro-done";

export function markIntroDone() {
  if (done) return;
  done = true;
  window.dispatchEvent(new Event(EVENT));
}

export function useIntroDone(): boolean {
  const [isDone, setDone] = useState(false);
  useEffect(() => {
    if (done) {
      setDone(true);
      return undefined;
    }
    const on = () => setDone(true);
    window.addEventListener(EVENT, on);
    // Never wait forever, whatever happens to the preloader.
    const t = window.setTimeout(on, 4000);
    return () => {
      window.removeEventListener(EVENT, on);
      window.clearTimeout(t);
    };
  }, []);
  return isDone;
}

/** True on devices with a real mouse (where cursor effects make sense). */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return fine;
}
