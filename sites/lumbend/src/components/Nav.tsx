import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { Menu as MenuIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Logo";
import { Magnetic } from "./Magnetic";
import { setLightsOff, useLightsOff } from "@/lib/lights";
import { Lightbulb, LightbulbOff } from "lucide-react";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";
import { useReducedMotionSafe } from "@/lib/motion";

const LINKS = [
  { href: "#inside", label: "Inside" },
  { href: "#shapes", label: "Shapes" },
  { href: "#colours", label: "Colours" },
  { href: "#specs", label: "Specs" },
];

export function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet } = useBooking();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  useMotionValueEvent(scrollY, "change", (v) => setSolid(v > 24));

  useEffect(() => {
    if (!open) return undefined;
    const release = lockScroll();
    const timer = window.setTimeout(() => menu.current?.querySelector<HTMLButtonElement>("button")?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab" || !menu.current) return;
      const items = menu.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      release();
      menuTrigger.current?.focus();
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          solid ? "bg-void/75 shadow-[0_1px_0_rgba(242,237,228,0.08)] backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-10 xl:px-24" aria-label="Main">
          <a href="#top" className="flex min-h-[44px] items-center pr-3" aria-label={`${SITE.name} — back to top`}>
            <span className="sm:hidden"><Wordmark size={26} /></span>
            <span className="max-sm:hidden"><Wordmark size={34} /></span>
          </a>

          <div className="hidden items-center gap-8 lg:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="stamp group relative text-bone/80 transition-colors hover:text-bone">
                {l.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-amber transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
              </a>
            ))}
            <LightsSwitch />
            <Magnetic>
              <button onClick={openSheet} className="btn-amber min-h-[44px] px-6 text-[11px]">
                Pre-order
              </button>
            </Magnetic>
          </div>

          <div className="flex items-center gap-1.5 lg:hidden">
            <LightsSwitch />
            <button onClick={openSheet} className="btn-amber min-h-[44px] px-4 text-[11px] tracking-[0.14em]">
              Order
            </button>
            <button
              ref={menuTrigger}
              onClick={() => setOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full text-bone"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              <MenuIcon size={22} strokeWidth={1.5} />
            </button>
          </div>
        </nav>
        <motion.div className="h-[2px] origin-left bg-gradient-to-r from-uv via-amber to-amber shadow-[0_0_8px_rgba(255,181,71,0.8)]" style={{ scaleX: progress }} aria-hidden="true" />
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[60] flex flex-col bg-void text-bone"
            initial={reduce ? false : { clipPath: "circle(0% at 92% 4%)" }}
            animate={{ clipPath: "circle(150% at 92% 4%)" }}
            exit={{ clipPath: "circle(0% at 92% 4%)" }}
            transition={{ duration: reduce ? 0 : 0.75, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="flex h-16 items-center justify-between px-5">
              <Wordmark size={34} />
              <button onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full" aria-label="Close menu" autoFocus>
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <ul className="mt-6 flex flex-1 flex-col justify-center gap-1 px-7">
              {LINKS.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.25 + i * 0.07, duration: reduce ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  <a href={l.href} onClick={() => setOpen(false)} className="flex items-baseline gap-4 py-2.5 font-display text-[clamp(34px,10vw,48px)] font-extrabold uppercase leading-tight tracking-[-0.03em]">
                    <span className="stamp text-amber">0{i + 1}</span>
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            <div className="space-y-4 px-7 pb-[max(2rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => {
                  setOpen(false);
                  openSheet();
                }}
                className="btn-amber w-full"
              >
                Pre-order yours
              </button>
              <p className="stamp text-center text-haze">{SITE.tagline}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Lights off / on: the whole page goes dark except where you point. */
function LightsSwitch() {
  const off = useLightsOff();
  return (
    <button
      type="button"
      aria-pressed={off}
      aria-label={off ? "Turn the lights back on" : "Turn the lights off"}
      onClick={() => setLightsOff(!off)}
      className={`grid h-11 w-11 place-items-center rounded-full border transition-colors duration-300 ${off ? "border-amber bg-amber text-void" : "border-bone/20 text-bone hover:border-bone/60"}`}
    >
      {off ? <LightbulbOff size={18} strokeWidth={1.6} /> : <Lightbulb size={18} strokeWidth={1.6} />}
    </button>
  );
}
