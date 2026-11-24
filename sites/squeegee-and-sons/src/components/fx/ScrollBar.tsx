import { motion, useScroll, useSpring } from "framer-motion";

/** A thin bar along the top of the screen that fills as you read down the page. */
export function ScrollBar({ className = "bg-silk" }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      className={`fixed inset-x-0 top-0 z-[60] h-[3px] origin-left ${className}`}
      style={{ scaleX }}
      aria-hidden="true"
    />
  );
}
