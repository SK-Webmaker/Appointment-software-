import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useId } from "react";

/** Her circular "BEAUTY L'ATELIER" mark, turning slowly as the page scrolls. */
export function RoundBadge({
  size = 132,
  className = "",
  tone = "bronze",
  text = "BEAUTY L'ATELIER · EST. 2024 · ",
}: {
  size?: number;
  className?: string;
  tone?: "bronze" | "gold" | "cream";
  text?: string;
}) {
  const id = `badge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduce = useReducedMotionSafe();
  const { scrollY } = useScroll();
  const rotate = useTransform(scrollY, (v) => v / 6);
  const color = tone === "gold" ? "#C9A876" : tone === "cream" ? "#F3EBDD" : "#957546";

  return (
    <motion.svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={{ rotate: reduce ? 0 : rotate, willChange: "transform" }}
      aria-hidden="true"
    >
      <defs>
        <path id={id} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
      </defs>
      <text fill={color} style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 15 }}>
        {/* textLength stretches the spacing so one pass meets itself exactly around the circle */}
        <textPath href={`#${id}`} startOffset="0" textLength={490} lengthAdjust="spacing">
          {text}
        </textPath>
      </text>
      <circle cx="100" cy="100" r="3" fill={color} />
    </motion.svg>
  );
}
