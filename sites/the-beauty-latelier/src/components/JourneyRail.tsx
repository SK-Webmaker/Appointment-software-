import { motion, useScroll, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { CHAPTERS, type ChapterId } from "@/site.config";

/**
 * The scroll journey, on large screens: a hairline down the left edge that
 * fills as you travel, with the six chapters marked along it.
 */
export function JourneyRail() {
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
    // Step aside over the footer.
    const footer = document.querySelector("footer");
    const fio = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setActive(null); }, { rootMargin: "0px 0px -40% 0px" });
    if (footer) fio.observe(footer);
    const top = () => window.scrollY < window.innerHeight * 0.9 && setActive(null);
    window.addEventListener("scroll", top, { passive: true });
    return () => {
      io.disconnect();
      fio.disconnect();
      window.removeEventListener("scroll", top);
    };
  }, []);

  const dark = active === "nail-art";

  return (
    <nav
      aria-label="Page chapters"
      className={`fixed left-7 top-1/2 z-40 hidden -translate-y-1/2 transition-opacity duration-700 xl:block ${active ? "visible opacity-100" : "pointer-events-none invisible opacity-0"}`}
    >
      <div className="relative flex flex-col gap-6 py-2 pl-5">
        <span className={`absolute bottom-0 left-0 top-0 w-px ${dark ? "bg-cream/15" : "bg-espresso/15"}`} aria-hidden="true" />
        <motion.span className="absolute left-0 top-0 h-full w-px origin-top bg-bronze" style={{ scaleY: fill }} aria-hidden="true" />
        {CHAPTERS.map((c) => {
          const on = c.id === active;
          return (
            <a
              key={c.id}
              href={`#${c.id}`}
              aria-current={on ? "true" : undefined}
              className={`group flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] transition-colors duration-500 ${
                dark ? "text-cream" : "text-espresso"
              }`}
            >
              <span className={`w-5 font-display normal-case italic tracking-normal transition-[font-size,opacity] duration-500 ${on ? "text-[15px] opacity-100" : "text-[12px] opacity-[0.78]"}`}>{c.numeral}</span>
              <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-focus-visible:max-w-[120px] group-focus-visible:opacity-100`}>
                {c.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
