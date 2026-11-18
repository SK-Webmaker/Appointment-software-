import { createFileRoute } from "@tanstack/react-router";
import { HERO_SIZES } from "@/components/Hero";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Sydney Makeup, Brow & Spray Tan Artist`;
const DESCRIPTION = `${SITE.name}: soft glam, full glam and bridal makeup, HD brows, brow lamination and spray tans in ${SITE.area}, Sydney — or mobile. Brows from $20, glam from $80, bride $150.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.name} — Sydney makeup, brows & spray tans` },
      { property: "og:description", content: `Glam for occasions, formals and brides, HD brows and spray tans — studio in ${SITE.area} or mobile.` },
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
        href: "/images/babydoll-800.webp",
        imageSrcSet: "/images/babydoll-480.webp 480w, /images/babydoll-800.webp 800w, /images/babydoll-1200.webp 1200w, /images/babydoll-1600.webp 1600w",
        imageSizes: HERO_SIZES,
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        // Only what is public on her Instagram and her booking page (no street address).
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BeautySalon",
          name: SITE.name,
          description: SITE.bio,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          priceRange: "$20–$150",
          address: { "@type": "PostalAddress", addressLocality: "Liverpool", addressRegion: "NSW", postalCode: "2170", addressCountry: "AU" },
          sameAs: [SITE.instagramUrl],
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
