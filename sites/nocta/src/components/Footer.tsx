import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CHAPTERS, SITE } from "@/site.config";
import { Wordmark } from "./Logo";

/** The visitor's own time, ticking. Blank on the server so hydration matches. */
function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const h = now?.getHours() ?? 0;
  const dark = h >= 18 || h < 6;
  return (
    <p className="stamp text-haze">
      <span className="text-bone">{now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</span>
      <span className="mx-2 text-bone/30" aria-hidden="true">/</span>
      {now ? (dark ? "Your lights should be on" : "The tubes are warming up") : "Your time"}
    </p>
  );
}

/**
 * The sign-off: the name in bare glass across the whole width, filling with
 * light from the bottom as you arrive, over a live clock and the chapters.
 */
export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const fill = useTransform(scrollYProgress, [0.25, 1], ["100%", "0%"]);
  const inner = useTransform(scrollYProgress, [0.25, 1], ["-100%", "0%"]);
  const year = __BUILD_YEAR__;

  return (
    <footer ref={ref} className="relative overflow-hidden bg-void text-bone" aria-label="Footer">
      <div className="mx-auto max-w-[1440px] px-5 pt-20 md:px-10 md:pt-28 xl:px-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Wordmark size={44} />
            <p className="mt-6 max-w-[38ch] text-[14px] leading-relaxed text-haze">{SITE.bio}</p>
          </div>
          <nav aria-label="Chapters" className="grid grid-cols-2 gap-x-10 gap-y-1 sm:grid-cols-3">
            {CHAPTERS.map((c) => (
              <a key={c.id} href={`#${c.id}`} className="group flex min-h-[44px] items-center gap-3 text-[14px] text-bone/85 transition-colors hover:text-amber">
                <span className="stamp text-[10px] text-haze group-hover:text-amber">{c.numeral}</span>
                {c.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-bone/10 pt-8 md:flex-row md:items-center md:justify-between">
          <Clock />
          <p className="stamp text-haze">A concept brand — {SITE.name} is fictional, the physics is real.</p>
        </div>
      </div>

      <div className="relative mt-12 select-none px-2 pb-6 md:mt-16" aria-hidden="true">
        <p className="tube-off text-center font-display text-[15vw] font-extrabold leading-[0.78] tracking-[-0.04em]">NOCTA</p>
        <motion.div className="absolute inset-x-2 bottom-6 top-0 overflow-hidden will-change-transform" style={{ y: fill }}>
          <motion.p className="neon text-center font-display text-[15vw] font-extrabold leading-[0.78] tracking-[-0.04em] [--tube:#ffb547] will-change-transform" style={{ y: inner }}>
            NOCTA
          </motion.p>
        </motion.div>
      </div>
      <p className="stamp pb-8 text-center text-[10px] text-haze">© {year} {SITE.fullName} · Made after dark</p>
    </footer>
  );
}
