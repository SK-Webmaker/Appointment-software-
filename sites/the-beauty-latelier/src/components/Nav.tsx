import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { Instagram, Menu as MenuIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { lockScroll } from "@/lib/smooth";

const LINKS = [
  { href: "#menu", label: "Menu" },
  { href: "#nail-art", label: "Nail art" },
  { href: "#helena", label: "Helena" },
  { href: "#book", label: "Visit" },
];

export function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const { openSheet, selected } = useBooking();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  useMotionValueEvent(scrollY, "change", (v) => setSolid(v > 24));

  useEffect(() => {
    if (!open) return undefined;
    const release = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      release();
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          solid ? "bg-ivory/90 shadow-[0_1px_0_rgba(36,26,20,0.08)] backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-10 xl:px-24" aria-label="Main">
          <a href="#top" className="opsz-sm group flex min-h-[44px] items-center gap-1.5 font-display text-[19px] leading-none text-espresso" aria-label={`${SITE.name} — back to top`}>
            <span>The Beauty</span>{" "}
            <em className="text-bronze-deep transition-colors group-hover:text-espresso">L'atelier</em>
          </a>

          <div className="hidden items-center gap-9 lg:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="group relative text-[11px] font-semibold uppercase tracking-[0.22em] text-espresso/80 transition-colors hover:text-espresso">
                {l.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-bronze transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
              </a>
            ))}
            <a href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="text-espresso/80 transition-colors hover:text-bronze" aria-label="Instagram @thebeautyatelierrr__ (opens in a new tab)">
              <Instagram size={18} strokeWidth={1.6} />
            </a>
            <button onClick={openSheet} className="btn-primary sheen min-h-[44px] px-6 text-[11px]">
              Book now{selected.length > 0 && <span className="ml-0.5 rounded-full bg-gold px-1.5 text-[10px] leading-[18px] text-ink">{selected.length}</span>}
            </button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={openSheet} className="btn-primary min-h-[40px] px-4 text-[10.5px] tracking-[0.18em]">
              Book{selected.length > 0 && <span className="rounded-full bg-gold px-1.5 text-[10px] leading-[18px] text-ink">{selected.length}</span>}
            </button>
            <button
              onClick={() => setOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full text-espresso"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              <MenuIcon size={22} strokeWidth={1.5} />
            </button>
          </div>
        </nav>
        <motion.div className="h-[2px] origin-left bg-bronze/80" style={{ scaleX: progress }} aria-hidden="true" />
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[60] flex flex-col bg-espresso text-cream"
            initial={{ clipPath: "circle(0% at 92% 4%)" }}
            animate={{ clipPath: "circle(150% at 92% 4%)" }}
            exit={{ clipPath: "circle(0% at 92% 4%)" }}
            transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="flex h-16 items-center justify-between px-5">
              <span className="opsz-sm font-display text-[19px]">
                The Beauty <em className="text-gold">L'atelier</em>
              </span>
              <button onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full" aria-label="Close menu" autoFocus>
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <ul className="mt-6 flex flex-1 flex-col justify-center gap-1 px-7">
              {LINKS.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.07, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  <a href={l.href} onClick={() => setOpen(false)} className="flex items-baseline gap-4 py-2.5 font-display text-[44px] leading-tight">
                    <span className="font-sans text-[11px] tracking-[0.2em] text-gold/80">0{i + 1}</span>
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
                className="btn-gold sheen w-full"
              >
                Book your appointment
              </button>
              <div className="flex items-center justify-between text-[12px] tracking-[0.12em] text-cream/70">
                <a href={`tel:${SITE.phoneE164}`} className="py-2">{SITE.phoneDisplay}</a>
                <a href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-2">
                  <Instagram size={16} strokeWidth={1.6} /> @{SITE.instagramHandle}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
