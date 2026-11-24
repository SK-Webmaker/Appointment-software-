import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { SplitText } from "./fx/SplitText";

/** A section's heading block: a short label, the heading, and an optional line under it. */
export function SectionHead({
  id,
  label,
  title,
  intro,
  light = false,
  className = "",
  children,
}: {
  id: string;
  label: string;
  title: ReactNode;
  intro?: ReactNode;
  light?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Reveal
      className={`flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between ${className}`}
    >
      <div>
        <p className={`text-[14px] font-semibold ${light ? "text-pearl" : "text-onyx"}`}>{label}</p>
        {typeof title === "string" ? (
          <SplitText
            as="h2"
            id={id}
            text={title}
            className="mt-2 max-w-[20ch] text-[clamp(34px,6.4vw,64px)] leading-[1.02]"
          />
        ) : (
          <h2 id={id} className="mt-2 max-w-[20ch] text-[clamp(34px,6.4vw,64px)] leading-[1.02]">
            {title}
          </h2>
        )}
        {intro && (
          <p
            className={`mt-4 max-w-[56ch] text-[16.5px] leading-relaxed ${light ? "text-white/80" : "text-ash"}`}
          >
            {intro}
          </p>
        )}
      </div>
      {children}
    </Reveal>
  );
}
