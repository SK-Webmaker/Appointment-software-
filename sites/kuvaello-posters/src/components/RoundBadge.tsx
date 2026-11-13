import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useId } from "react";
import { Face } from "./Logo";


/** Their tagline on a circle around the Kuvaello face, turning slowly as the page scrolls. */
export function RoundBadge({
  size = 132,
  className = "",
  tone = "cocoa",
  text = "WHERE YOUR NAME BECOMES ART · KUVAELLO · ",
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
  const color = tone === "cream" ? "#F4F2ED" : "#141416";

  return (
    // Clipped to its own square: the text is a circle inside it, so nothing
    // visible is lost, but the turning square's corners never poke past the
    // edge of a phone screen (which would make the phone zoom the page out).
    <span className={`relative inline-block overflow-hidden ${className}`} style={{ width: size, height: size }} aria-hidden="true">
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
      <Face className={`absolute left-1/2 top-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 ${tone === "cream" ? "text-silk" : "text-rose"}`} strokeWidth={2.2} />
    </span>
  );
}
