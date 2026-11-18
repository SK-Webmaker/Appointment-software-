import type { CSSProperties } from "react";

type Props = {
  name: string;
  widths: number[];
  alt: string;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
};

/** Responsive WebP from /public/images, named `${name}-${width}.webp`. */
export function Img({ name, widths, alt, sizes = "100vw", className, style, priority }: Props) {
  const srcSet = widths.map((w) => `/images/${name}-${w}.webp ${w}w`).join(", ");
  const fallback = `/images/${name}-${widths[Math.min(1, widths.length - 1)]}.webp`;
  return (
    <img
      src={fallback}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      className={className}
      style={style}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
    />
  );
}
