import { createFileRoute } from "@tanstack/react-router";
import { HERO_SIZES } from "@/components/Hero";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — House Cleaning, ${SITE.area} ${SITE.city}`;
const DESCRIPTION = `${SITE.name}: family house cleaners in Sydney's ${SITE.area} since ${SITE.est}. Get an exact price for a regular, deep or end-of-lease clean, see what's included room by room, and book in a minute.`;
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
        content: `Family house cleaners for Sydney's ${SITE.area}.`,
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
      // The two hero photographs are the first paint — start them with the CSS.
      ...["kitchen2", "kitchen2-fog"].map((n) => ({
        rel: "preload",
        as: "image",
        href: `/images/${n}-1200.webp`,
        imageSrcSet: [800, 1200, 1600, 2000, 2400]
          .map((w) => `/images/${n}-${w}.webp ${w}w`)
          .join(", "),
        imageSizes: HERO_SIZES,
        fetchPriority: "high" as const,
      })),
    ],
    scripts: [
      {
        type: "application/ld+json",
        // A concept business: no street address, and the phone is from the fiction range.
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: SITE.name,
          description: SITE.tagline,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          priceRange: "$$",
          telephone: SITE.phone,
          address: {
            "@type": "PostalAddress",
            addressLocality: SITE.area,
            addressRegion: "NSW",
            addressCountry: "AU",
          },
          openingHours: ["Mo-Fr 08:00-17:00", "Sa 08:00-14:00"],
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
