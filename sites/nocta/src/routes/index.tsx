import { createFileRoute } from "@tanstack/react-router";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Neon & Light Studio`;
const DESCRIPTION = `${SITE.fullName}: hand-bent neon signs, light installations, club rigs and brand nights. ${SITE.tagline}. A concept brand.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.name} — ${SITE.tagline.toLowerCase()}` },
      { property: "og:description", content: "Hand-bent neon, light installations and nights that glow. A concept light studio." },
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
