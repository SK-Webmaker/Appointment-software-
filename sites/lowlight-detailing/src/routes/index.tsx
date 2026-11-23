import { createFileRoute } from "@tanstack/react-router";
import { HERO_SIZES } from "@/components/Hero";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Paint Correction & Ceramic Coating, ${SITE.city}`;
const DESCRIPTION = `${SITE.name}: paint correction, ceramic coating and interior detailing in a dark studio in ${SITE.area}, ${SITE.city} — or mobile. Build your detail, see the price live, book a bay. From ${SITE.from}.`;
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
        content: `Paint correction, ceramic and interior details. Build yours and book a bay.`,
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
        href: "/images/hero-1200.webp",
        imageSrcSet:
          "/images/hero-800.webp 800w, /images/hero-1200.webp 1200w, /images/hero-1600.webp 1600w, /images/hero-2000.webp 2000w, /images/hero-2400.webp 2400w",
        imageSizes: HERO_SIZES,
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        // A concept business: no street address, and the phone is from the fiction range.
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AutoWash",
          name: SITE.name,
          description: SITE.tagline,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          priceRange: "$149–$1800",
          telephone: SITE.phone,
          address: {
            "@type": "PostalAddress",
            addressLocality: SITE.area,
            addressRegion: "NSW",
            addressCountry: "AU",
          },
          openingHours: ["Mo-We 07:00-18:00", "Th 07:00-20:00", "Fr 07:00-18:00", "Sa 08:00-16:00"],
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
