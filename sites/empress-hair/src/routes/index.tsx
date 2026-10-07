import { createFileRoute } from "@tanstack/react-router";
import { HERO_SIZES } from "@/components/Hero";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Braids & Protective Styling, ${SITE.city}`;
const DESCRIPTION = `${SITE.name}: braids and protective styling in ${SITE.city}, with scalp health, clean & low-tox products and length retention at the heart of every appointment. ${SITE.tagline}. Book by Instagram DM.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.name} — braids that look after your hair` },
      { property: "og:description", content: `Protective styling in ${SITE.city}: scalp health, clean & low-tox products, length retention. ${SITE.tagline}.` },
      { property: "og:url", content: `${SITE.url}/` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: `${SITE.url}/` },
      // The hero photograph is the largest paint — start it with the CSS.
      {
        rel: "preload",
        as: "image",
        href: "/images/curl-640.webp",
        imageSrcSet: "/images/curl-480.webp 480w, /images/curl-640.webp 640w",
        imageSizes: HERO_SIZES,
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        // Only what is public: no address, hours or prices yet (see site.config.ts).
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HairSalon",
          name: SITE.name,
          slogan: SITE.tagline,
          description: `${SITE.role} in ${SITE.city}: scalp health, clean & low-tox styling, length retention, comfort & confidence.`,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          areaServed: `${SITE.city}, ${SITE.state}`,
          sameAs: [SITE.instagramUrl],
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
