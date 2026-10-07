import { createFileRoute } from "@tanstack/react-router";
import { HERO_SIZES } from "@/components/Hero";
import { Site } from "@/components/Site";
import { SERVICES, SITE } from "@/site.config";

const TITLE = `${SITE.name} — Colour & Nanoplasty · Dark Hair Specialist, ${SITE.suburbShort}`;
const DESCRIPTION = `${SITE.fullName} is a colourist and Nanoplasty specialist for dark, thick hair, in a private suite at ${SITE.venue}, ${SITE.suburb}. Colour, grey blending, colour correction and Nanoplasty. ${SITE.daysLong}. DM to book.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.name} — healthy hair, confident you` },
      { property: "og:description", content: `Colour and Nanoplasty for dark, thick hair by ${SITE.fullName}, in her private suite in ${SITE.suburbShort}. DM to book.` },
      { property: "og:url", content: `${SITE.url}/` },
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
        href: "/images/oshi-hero-720.webp",
        imageSrcSet: "/images/oshi-hero-480.webp 480w, /images/oshi-hero-720.webp 720w",
        imageSizes: HERO_SIZES,
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HairSalon",
          name: SITE.name,
          slogan: "Healthy hair — confident you",
          description: `${SITE.role} by ${SITE.fullName}. ${SITE.specialty}.`,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          founder: { "@type": "Person", name: SITE.fullName },
          address: {
            "@type": "PostalAddress",
            streetAddress: `${SITE.venue}, ${SITE.street}`,
            addressLocality: SITE.suburb,
            addressRegion: SITE.state,
            postalCode: SITE.postcode,
            addressCountry: "AU",
          },
          areaServed: SITE.city,
          sameAs: [SITE.instagramUrl],
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Hair services",
            itemListElement: SERVICES.filter((s) => s.id !== "advice").map((s) => ({
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: s.name, description: s.note },
            })),
          },
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
