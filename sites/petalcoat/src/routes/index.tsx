import { createFileRoute } from "@tanstack/react-router";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Nail Studio in ${SITE.area}, ${SITE.city}`;
const DESCRIPTION = `${SITE.name}: gel manicures, BIAB, Gel-X extensions, chrome and nail art in ${SITE.area}. Try your shade on a hand before you book, then pick a time in under a minute. From ${SITE.from}.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.name} — ${SITE.tagline}` },
      {
        property: "og:description",
        content: `Gel, BIAB, Gel-X and nail art in ${SITE.area}. Try your shade, then book online.`,
      },
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
        href: "/images/white-800.webp",
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        // A concept business: no street address, and the phone is from the fiction range.
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "NailSalon",
          name: SITE.name,
          description: SITE.tagline,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          priceRange: "$20–$95",
          telephone: SITE.phone,
          address: {
            "@type": "PostalAddress",
            addressLocality: SITE.area,
            addressRegion: "NSW",
            addressCountry: "AU",
          },
          openingHours: [
            "Tu-We 10:00-18:00",
            "Th-Fr 10:00-20:00",
            "Sa 09:00-17:00",
            "Su 10:00-16:00",
          ],
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
