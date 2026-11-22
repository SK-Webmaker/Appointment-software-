import { createFileRoute } from "@tanstack/react-router";
import { HERO_SIZES } from "@/components/Hero";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Barbers in ${SITE.area}, ${SITE.city}`;
const DESCRIPTION = `${SITE.name}: skin fades, scissor cuts, beard trims and hot-towel shaves in ${SITE.area}. See who's free today and book a chair in under a minute. Cuts from ${SITE.from}.`;
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
        content: `Fades, scissor cuts, beards and hot-towel shaves in ${SITE.area}. Book a chair online.`,
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
      // The shop photograph is the largest paint — start it with the CSS.
      {
        rel: "preload",
        as: "image",
        href: "/images/shop-1280.webp",
        imageSrcSet:
          "/images/shop-800.webp 800w, /images/shop-1280.webp 1280w, /images/shop-1920.webp 1920w, /images/shop-2400.webp 2400w",
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
          "@type": "BarberShop",
          name: SITE.name,
          description: SITE.tagline,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          priceRange: "$35–$110",
          telephone: SITE.phone,
          address: {
            "@type": "PostalAddress",
            addressLocality: SITE.area,
            addressRegion: "NSW",
            addressCountry: "AU",
          },
          openingHours: [
            "Tu-We 09:00-19:00",
            "Th 09:00-20:00",
            "Fr 09:00-19:00",
            "Sa 08:00-16:00",
            "Su 10:00-15:00",
          ],
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
