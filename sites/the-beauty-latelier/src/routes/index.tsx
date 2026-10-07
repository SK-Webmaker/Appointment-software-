import { createFileRoute } from "@tanstack/react-router";
import { Site } from "@/components/Site";
import { CATEGORIES, NAIL_ART_TIERS, SITE, formatPrice } from "@/site.config";

const TITLE = `${SITE.name} — Nails, Lashes, Brows, Skin & Hair · ${SITE.suburb}, ${SITE.city}`;
const DESCRIPTION = `${SITE.studio} — a private beauty studio in ${SITE.suburb}, ${SITE.city}. Gel-X, acrylic, SNS and BIAB nails, nail art, lash lifts, brows, facials and hair. Re-opening ${SITE.reopening}. DM to book.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.name} — where beauty becomes confidence` },
      { property: "og:description", content: `Nails, lashes, brows, skin and hair by ${SITE.founder}, in a private studio in ${SITE.suburb}, ${SITE.city}. Re-opening ${SITE.reopening}.` },
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
        href: "/images/nails-gelx-tier4-800.webp",
        imageSrcSet: "/images/nails-gelx-tier4-480.webp 480w, /images/nails-gelx-tier4-800.webp 800w, /images/nails-gelx-tier4-1200.webp 1200w, /images/nails-gelx-tier4-1320.webp 1320w",
        imageSizes: "100vw",
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BeautySalon",
          name: SITE.name,
          alternateName: SITE.studio,
          slogan: "Where beauty becomes confidence",
          description: `Private beauty studio by ${SITE.founder}, ${SITE.credential.toLowerCase()}. Nails, nail art, lashes, brows, facials and hair.`,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          foundingDate: SITE.established,
          founder: { "@type": "Person", name: SITE.founder },
          telephone: SITE.phoneE164,
          email: SITE.email,
          priceRange: "$15–$180",
          currenciesAccepted: "AUD",
          address: {
            "@type": "PostalAddress",
            addressLocality: SITE.suburb,
            addressRegion: SITE.state,
            postalCode: "2767",
            addressCountry: "AU",
          },
          areaServed: "Western Sydney",
          sameAs: [SITE.instagramUrl],
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Beauty services",
            itemListElement: [
              ...CATEGORIES.map((c) => ({
                "@type": "OfferCatalog",
                name: c.title,
                itemListElement: c.services.map((s) => ({
                  "@type": "Offer",
                  itemOffered: { "@type": "Service", name: s.name },
                  ...(s.price !== null && { price: String(s.price), priceCurrency: "AUD", description: formatPrice(s) }),
                })),
              })),
              {
                "@type": "OfferCatalog",
                name: "Nail art",
                itemListElement: NAIL_ART_TIERS.map((t) => ({
                  "@type": "Offer",
                  itemOffered: { "@type": "Service", name: `Nail art — ${t.name}` },
                  price: String(t.price),
                  priceCurrency: "AUD",
                })),
              },
            ],
          },
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
