import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useId } from "react";

const HEART = "M12 20.2s-7.6-4.6-9.6-9.2C.9 7.4 3.1 3 6.9 3c2.1 0 3.7 1.3 5.1 3.2C13.4 4.3 15 3 17.1 3c3.8 0 6 4.4 4.5 8-2 4.6-9.6 9.2-9.6 9.2z";

/** Her promise on a circle around the heart she signs with, turning slowly as the page scrolls. */
export function RoundBadge({
  size = 132,
  className = "",
  tone = "cocoa",
  text = "DRESS & SUIT HIRE · MULGRAVE · LUXURY LOOKS · ",
}: {
  size?: number;
  className?: string;
  tone?: "cocoa" | "cream";
  text?: string;
}) {
  const id = `badge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduce = useReducedMotionSafe();
  const { scrollY } = useScroll();
  const rotate = useTransform(scrollY, (v) => v / 6);
  const color = tone === "cream" ? "#FBF4F2" : "#3B2618";

  return (
    <span className={`relative inline-block ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <motion.svg viewBox="0 0 200 200" width={size} height={size} className="absolute inset-0 will-change-transform" style={{ rotate: reduce ? 0 : rotate }}>
        <defs>
          <path id={id} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <text fill={color} style={{ fontFamily: "Jost, sans-serif", fontWeight: 500, fontSize: 15.5 }}>
          {/* textLength stretches the spacing so one pass meets itself exactly around the circle */}
          <textPath href={`#${id}`} startOffset="0" textLength={490} lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </motion.svg>
      <svg viewBox="0 0 24 22" className={`absolute left-1/2 top-1/2 h-[22%] w-[24%] -translate-x-1/2 -translate-y-1/2 ${tone === "cream" ? "text-silk" : "text-rose"}`} fill="none">
        <path d={HEART} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
