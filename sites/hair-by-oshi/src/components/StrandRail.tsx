import { motion, useScroll, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { CHAPTERS, type ChapterId } from "@/site.config";

/** Dark chapters, where the rail turns cream. */
const DARK: ChapterId[] = ["dark-hair", "always", "book"];

// One long, loose wave — a single strand of hair down the edge of the page.
const STRAND = "M6 0 C 14 40, -2 80, 6 120 S 14 200, 6 240 S -2 320, 6 360 S 14 440, 6 480";

/**
 * The scroll journey, on large screens: a strand of hair down the left edge
 * that fills as you travel, with the seven chapters marked along it.
 */
export function StrandRail() {
  const [active, setActive] = useState<ChapterId | null>(null);
  const { scrollYProgress } = useScroll();
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const els = CHAPTERS.map((c) => document.getElementById(c.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(hit.target.id as ChapterId);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.01] },
    );
    els.forEach((el) => io.observe(el));
    // Step aside over the footer, and before the first chapter.
    const footer = document.querySelector("footer");
    const fio = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) setActive(null);
    }, { rootMargin: "0px 0px -40% 0px" });
    if (footer) fio.observe(footer);
    // Where the first chapter starts, in page coordinates — measured on resize,
    // not on every scroll event.
    let firstTop = Infinity;
    const measure = () => {
      const r = els[0]?.getBoundingClientRect();
      firstTop = r ? r.top + window.scrollY : Infinity;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    const top = () => {
      if (firstTop - window.scrollY > window.innerHeight * 0.5) setActive(null);
    };
    window.addEventListener("scroll", top, { passive: true });
    return () => {
      io.disconnect();
      fio.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", top);
    };
  }, []);

  const dark = active !== null && DARK.includes(active);

  return (
    <nav
      aria-label="Page chapters"
      className={`fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 transition-opacity duration-700 xl:block ${active ? "visible opacity-100" : "pointer-events-none invisible opacity-0"}`}
    >
      <div className="relative flex flex-col gap-6 py-2 pl-6">
        <svg viewBox="0 0 12 480" preserveAspectRatio="none" className="absolute bottom-0 left-0 top-0 h-full w-3 overflow-visible" fill="none" aria-hidden="true">
          <path d={STRAND} className={dark ? "stroke-cream/20" : "stroke-ink/15"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <motion.path d={STRAND} stroke="url(#strand-grad)" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: fill }} />
          <defs>
            <linearGradient id="strand-grad" x1="0" y1="0" x2="0" y2="480" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#80593A" />
              <stop offset="0.55" stopColor="#D2A26B" />
              <stop offset="1" stopColor="#E3CBA8" />
            </linearGradient>
          </defs>
        </svg>
        {CHAPTERS.map((c) => {
          const on = c.id === active;
          return (
            <a
              key={c.id}
              href={`#${c.id}`}
              aria-current={on ? "true" : undefined}
              className={`group flex min-h-[24px] items-center gap-3 text-[10.5px] font-medium uppercase tracking-[0.22em] transition-colors duration-500 ${dark ? "text-cream" : "text-ink"}`}
            >
              <span className={`w-6 font-display normal-case italic tracking-normal transition-[font-size,opacity] duration-500 ${on ? "text-[16px] opacity-100" : "text-[12.5px] opacity-[0.8]"}`}>{c.numeral}</span>
              <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:max-w-[120px] group-hover:opacity-100 group-focus-visible:max-w-[120px] group-focus-visible:opacity-100">
                {c.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
