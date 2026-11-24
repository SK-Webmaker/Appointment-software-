import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A pinned sideways gallery: the section holds still while you scroll and
 * its row of panels travels left, ending exactly on the last panel. The
 * section's height is worked out from how far the row has to travel.
 * Phones get the same, with narrower panels.
 */
export function HScroll({
  id,
  head,
  children,
  className = "",
  labelledBy,
}: {
  id: string;
  head?: ReactNode;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState(0);
  const [vh, setVh] = useState(800);

  useEffect(() => {
    const measure = () => {
      if (!track.current) return;
      setTravel(Math.max(0, track.current.scrollWidth - window.innerWidth));
      setVh(window.innerHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.04, 0.96], [0, -travel]);

  return (
    <section
      id={id}
      ref={section}
      className={`relative ${className}`}
      style={{ height: travel ? travel + vh : "auto" }}
      aria-labelledby={labelledBy}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <motion.div
          ref={track}
          data-qa="scroller"
          className="flex w-max items-stretch gap-5 pl-5 pr-5 will-change-transform md:gap-8 md:pl-8 md:pr-8"
          style={{ x }}
        >
          {head}
          {children}
        </motion.div>
      </div>
    </section>
  );
}
