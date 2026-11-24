import { AnimatePresence, motion } from "framer-motion";
import { Menu as MenuIcon, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Logo";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";
import { useReducedMotionSafe } from "@/lib/motion";

const LINKS = [
  { href: "#services", label: "Services" },
  { href: "#problems", label: "Common problems" },
  { href: "#about", label: "About" },
  { href: "#work", label: "Our work" },
  { href: "#book", label: "Service area" },
];

/** A plain white header: logo, links, the phone number and a Book button. */
export function Nav() {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet } = useBooking();

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
      <header className="fixed inset-x-0 top-0 z-50 border-b border-ink/10 bg-white/95 backdrop-blur">
        <nav
          className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 md:px-8"
          aria-label="Main"
        >
          <a
            href="#top"
            className="flex min-h-[44px] items-center pr-3"
            aria-label={`${SITE.name} — back to top`}
          >
            <Wordmark size={38} />
          </a>

          <div className="hidden items-center gap-7 lg:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[15px] font-medium text-ink/80 transition-colors hover:text-onyx"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            <a
              href={SITE.phoneHref}
              className="flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-ink hover:text-onyx"
            >
              <Phone size={17} strokeWidth={2} /> {SITE.phone}
            </a>
            <button onClick={() => openSheet()} className="btn-primary min-h-[44px] px-5">
              Book a plumber
            </button>
          </div>

          <div className="flex items-center gap-1.5 lg:hidden">
            <a
              href={SITE.phoneHref}
              aria-label={`Call ${SITE.phone}`}
              className="grid h-11 w-11 place-items-center rounded-full text-onyx"
            >
              <Phone size={20} strokeWidth={2} />
            </a>
            <button
              onClick={() => openSheet()}
              className="btn-primary min-h-[42px] px-4 text-[15px]"
            >
              Book
            </button>
            <button
              ref={menuTrigger}
              onClick={() => setOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full text-ink"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              <MenuIcon size={23} strokeWidth={1.8} />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[60] flex flex-col bg-white text-ink"
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
          >
            <div className="flex h-16 items-center justify-between border-b border-ink/10 px-5">
              <Wordmark size={38} />
              <button
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full"
                aria-label="Close menu"
                autoFocus
              >
                <X size={24} strokeWidth={1.8} />
              </button>
            </div>
            <ul className="flex-1 divide-y divide-ink/10 px-5 pt-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[56px] items-center text-[19px] font-semibold"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-ink/10 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
              <button
                onClick={() => {
                  setOpen(false);
                  openSheet();
                }}
                className="btn-primary w-full"
              >
                Book a plumber
              </button>
              <a href={SITE.phoneHref} className="btn-ghost w-full">
                <Phone size={17} /> Call {SITE.phone}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
