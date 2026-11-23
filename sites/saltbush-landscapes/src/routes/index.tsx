import { createFileRoute } from "@tanstack/react-router";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Native Gardens, ${SITE.area} ${SITE.city}`;
const DESCRIPTION = `${SITE.name}: native garden design and planting for Sydney's ${SITE.area}. Find plants for your spot, see what flowers each month, estimate a garden and book a free site visit.`;
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
        content: `Native gardens for Sydney's ${SITE.area}.`,
      },
      { property: "og:url", content: `${SITE.url}/` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE.url}/` }],
    scripts: [
      {
        type: "application/ld+json",
        // A concept business: no street address, and the phone is from the fiction range.
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HomeAndConstructionBusiness",
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
          openingHours: ["Mo-Fr 08:00-16:00", "Sa 08:00-12:00"],
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
