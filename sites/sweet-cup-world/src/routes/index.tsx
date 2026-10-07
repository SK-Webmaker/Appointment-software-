import { createFileRoute } from "@tanstack/react-router";
import { HERO_SIZES } from "@/components/Hero";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Dessert Cups, ${SITE.suburb} ${SITE.city}`;
const DESCRIPTION = `${SITE.name}: freshly handcrafted dessert cups made with love by two sisters in ${SITE.suburb}, ${SITE.city}. Biscoff, Dubai Chocolate, Pistachio, Mehelebi, Oreo and Coconut — made fresh to order for any occasion. Pickup or delivery; order by Instagram DM.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.name} — ${SITE.tagline.toLowerCase()}` },
      { property: "og:description", content: `Freshly handcrafted dessert cups by two sisters in ${SITE.suburb}, ${SITE.city}. Made fresh to order — pickup or delivery.` },
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
        href: "/images/party-cups-720.webp",
        imageSrcSet: "/images/party-cups-480.webp 480w, /images/party-cups-720.webp 720w, /images/party-cups-1080.webp 1080w",
        imageSizes: HERO_SIZES,
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        // Only what is public: suburb, no street address, hours or prices (to confirm).
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Bakery",
          name: SITE.name,
          slogan: SITE.tagline,
          description: `Freshly handcrafted dessert cups made with love by two sisters. Pickup or delivery from ${SITE.suburb}, ${SITE.city}.`,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          address: { "@type": "PostalAddress", addressLocality: SITE.suburb, addressRegion: SITE.state, addressCountry: "AU" },
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
