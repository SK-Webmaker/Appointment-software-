import { createFileRoute } from "@tanstack/react-router";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.product} — The Real-Glass Neon Desk Lamp`;
const DESCRIPTION = `${SITE.product}: a neon desk lamp made the old way — a glass tube bent by hand, filled with noble gas, on a weighted base. Five shapes, five colours. ${SITE.tagline} A concept product.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.product} — the real-glass neon desk lamp` },
      { property: "og:description", content: "Real glass. Real gas. Real glow. A hand-bent neon desk lamp in five shapes and five colours. A concept product." },
      { property: "og:url", content: `${SITE.url}/` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "theme-color", content: "#0b0912" },
    ],
    links: [
      { rel: "canonical", href: `${SITE.url}/` },
      { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/syne.woff2", crossOrigin: "anonymous" },
    ],
  }),
});

function Index() {
  return <Site />;
}
