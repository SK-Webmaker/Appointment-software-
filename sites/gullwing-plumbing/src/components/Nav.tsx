import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { Menu as MenuIcon, Phone, Siren, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Logo";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";
import { useReducedMotionSafe } from "@/lib/motion";

const LINKS = [
  { href: "#problems", label: "Problems" },
  { href: "#prices", label: "Prices" },
  { href: "#area", label: "Area" },
  { href: "#how", label: "How" },
];

export function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet, setEmergency } = useBooking();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  // Over the dark opening scene the bar stays clear with light type; it turns
  // solid once the scene lets go. The scene's end is measured on resize only.
  const heroEnd = useRef(24);
  useEffect(() => {
    const measure = () => {
      const hero = document.getElementById("top");
      heroEnd.current = hero ? Math.max(24, hero.offsetHeight - window.innerHeight - 40) : 24;
      setSolid(window.scrollY > heroEnd.current);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  useMotionValueEvent(scrollY, "change", (v) => setSolid(v > heroEnd.current));

  useEffect(() => {
    if (!open) return undefined;
    const release = lockScroll();
    const timer = window.setTimeout(
      () => menu.current?.querySelector<HTMLButtonElement>("button")?.focus(),
      60,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab" || !menu.current) return;
      const items = menu.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
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
        // Over the dark opening scene the bar is see-through: its real backdrop
        // is the photo, which the contrast check can't read.
        data-qa={solid ? undefined : "bg-sibling"}
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          solid
            ? "bg-ivory/92 shadow-[0_1px_0_rgba(20,14,10,0.1)] backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <nav
          className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-10 xl:px-24"
          aria-label="Main"
        >
          <a
            href="#top"
            className="flex min-h-[44px] items-center pr-3"
            aria-label={`${SITE.name} — back to top`}
          >
            <Wordmark size={27} tone={solid ? "dark" : "light"} className="min-[375px]:hidden" />
            <Wordmark size={36} tone={solid ? "dark" : "light"} className="max-[374px]:hidden" />
          </a>

          <div className="hidden items-center gap-8 lg:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`group relative text-[12px] font-semibold uppercase tracking-[0.22em] transition-colors ${solid ? "text-ink/80 hover:text-ink" : "text-ivory/85 hover:text-ivory"}`}
              >
                {l.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-rose transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
              </a>
            ))}
            <a
              href={SITE.phoneHref}
              className={`flex min-h-[44px] items-center gap-2 text-[13px] font-semibold transition-colors ${solid ? "text-ink/80 hover:text-ink" : "text-ivory/85 hover:text-ivory"}`}
            >
              <Phone size={16} strokeWidth={1.7} /> {SITE.phone}
            </a>
            <button
              onClick={() => setEmergency(true)}
              className="btn min-h-[44px] border border-flare px-5 text-[11.5px] text-flare hover:bg-flare hover:text-noir"
            >
              <Siren size={15} strokeWidth={2} /> Emergency
            </button>
            <button
              onClick={() => openSheet()}
              className="btn-primary sheen min-h-[44px] px-6 text-[11.5px]"
            >
              Book
            </button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setEmergency(true)}
              className="grid h-11 w-11 place-items-center rounded-full bg-flare text-noir"
              aria-label="Emergency mode"
            >
              <Siren size={19} strokeWidth={2.1} />
            </button>
            <button
              onClick={() => openSheet()}
              className="btn-primary min-h-[44px] px-4 text-[11px] tracking-[0.16em]"
            >
              Book
            </button>
            <button
              ref={menuTrigger}
              onClick={() => setOpen(true)}
              className={`grid h-11 w-11 place-items-center rounded-full transition-colors ${solid ? "text-ink" : "text-ivory"}`}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              <MenuIcon size={22} strokeWidth={1.5} />
            </button>
          </div>
        </nav>
        <motion.div
          className="h-[2px] origin-left bg-gradient-to-r from-rose via-silk to-pearl"
          style={{ scaleX: progress }}
          aria-hidden="true"
        />
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[60] flex flex-col bg-noir text-ivory"
            initial={reduce ? false : { clipPath: "circle(0% at 92% 4%)" }}
            animate={{ clipPath: "circle(150% at 92% 4%)" }}
            exit={{ clipPath: "circle(0% at 92% 4%)" }}
            transition={{ duration: reduce ? 0 : 0.75, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="flex h-16 items-center justify-between px-5">
              <Wordmark size={38} tone="light" />
              <button
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full"
                aria-label="Close menu"
                autoFocus
              >
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <ul className="mt-6 flex flex-1 flex-col justify-center gap-1 px-7">
              {LINKS.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: reduce ? 0 : 0.25 + i * 0.07,
                    duration: reduce ? 0 : 0.8,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-baseline gap-4 py-2 font-display text-[clamp(36px,11vw,56px)] font-black uppercase leading-[0.95] [font-stretch:125%]"
                  >
                    <span className="font-sans text-[11.5px] tracking-[0.2em] text-silk">
                      0{i + 1}
                    </span>
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
                className="btn-honey sheen w-full"
              >
                Book a plumber
              </button>
              <div className="flex items-center justify-between text-[13px] tracking-[0.1em] text-ivory/75">
                <span>
                  {SITE.area}, {SITE.city}
                </span>
                <a href={SITE.phoneHref} className="flex min-h-[44px] items-center gap-2">
                  <Phone size={16} strokeWidth={1.6} /> {SITE.phone}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
