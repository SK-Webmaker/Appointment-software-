import { createFileRoute } from "@tanstack/react-router";
import { HERO_SIZES } from "@/components/Hero";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Dress & Suit Hire, ${SITE.suburb} ${SITE.state}`;
const DESCRIPTION = `${SITE.name}: dress and suit hire in ${SITE.suburb}, ${SITE.city}. Minis, midis, gowns and suits in sizes ${SITE.sizes} for formals, uni balls, birthdays, the races and weddings. ${SITE.tagline}. Book a try-on by Instagram DM or email.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.name} — ${SITE.tagline.toLowerCase()}` },
      { property: "og:description", content: `Dress and suit hire in ${SITE.suburb}, ${SITE.city}: minis, midis, gowns and suits, sizes ${SITE.sizes}. Book a try-on.` },
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
        href: "/images/nara-front-720.webp",
        imageSrcSet: "/images/nara-front-480.webp 480w, /images/nara-front-720.webp 720w",
        imageSizes: HERO_SIZES,
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        // Only what is public: suburb, prices from her guide, no street address or hours.
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ClothingStore",
          name: SITE.name,
          slogan: SITE.tagline,
          description: `${SITE.role} in ${SITE.suburb}, ${SITE.city}. Sizes ${SITE.sizes}. Try-ons by appointment via Instagram DM or email.`,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          email: SITE.email,
          priceRange: "$50–$100+",
          address: {
            "@type": "PostalAddress",
            addressLocality: SITE.suburb,
            postalCode: SITE.postcode,
            addressRegion: SITE.state,
            addressCountry: "AU",
          },
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
